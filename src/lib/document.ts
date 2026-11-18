import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type DbTx } from "@/db";
import { documentVersions, documents, users } from "@/db/schema";
import { AppError, ForbiddenError } from "./errors";
import { getProjectForUser } from "./project";
import { notifyTeamMembers } from "./notification";

// 同一张 users 表需两次关联（创建者/更新者），用别名区分
const updater = alias(users, "updater");

const DOC_TITLE_MAX = 120;

function normalizeTitle(raw: string) {
  const title = raw.trim();
  if (!title) throw new AppError("文档标题不可为空");
  if (title.length > DOC_TITLE_MAX)
    throw new AppError(`文档标题不可超过 ${DOC_TITLE_MAX} 字`);
  return title;
}

function normalizeCategory(raw?: string | null) {
  const c = (raw ?? "").trim();
  return c || null;
}

// ILIKE 通配符转义，配合 ESCAPE '\'
function escapeLike(raw: string) {
  return raw.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// 全文搜索：中文不适合 PG 默认分词器，用 ILIKE 匹配标题/正文
function contains(q: string) {
  const pattern = `%${escapeLike(q)}%`;
  return sql`(${documents.title} ilike ${pattern} escape '\\' or ${documents.content} ilike ${pattern} escape '\\')`;
}

// 文档访问收敛点：取到文档并校验访问者为其项目成员；不存在/越权抛错
async function requireDocumentAccess(actorId: string, documentId: string) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw new AppError("文档不存在");
  const access = await getProjectForUser(actorId, doc.projectId);
  if (!access) throw new ForbiddenError();
  return { doc, access };
}

// 版本作者别名（与 documents 的 createdById/updatedById 分开，避免同表二次 join 冲突）
const versionAuthor = alias(users, "version_author");

// 写一个新版本快照：versionNumber 取当前最大 + 1。若与最近一版 title/content/category
// 完全相同则跳过（返回 null），避免连续保存刷出无意义版本。exec 可为 db 或事务 tx。
async function appendVersion(
  exec: DbTx | typeof db,
  documentId: string,
  snapshot: { title: string; content: string; category: string | null },
  authorId: string,
  note?: string | null,
) {
  const [latest] = await exec
    .select({
      versionNumber: documentVersions.versionNumber,
      title: documentVersions.title,
      content: documentVersions.content,
      category: documentVersions.category,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber))
    .limit(1);

  if (
    latest &&
    latest.title === snapshot.title &&
    latest.content === snapshot.content &&
    (latest.category ?? null) === (snapshot.category ?? null)
  ) {
    return null;
  }

  const [version] = await exec
    .insert(documentVersions)
    .values({
      documentId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      title: snapshot.title,
      content: snapshot.content,
      category: snapshot.category,
      authorId,
      note: note ?? null,
    })
    .returning();
  return version;
}

// 列举项目文档（倒序），支持按关键词搜索与按分类过滤
export async function listProjectDocuments(
  actorId: string,
  projectId: string,
  opts: { q?: string; category?: string } = {},
) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access) throw new ForbiddenError();

  const q = opts.q?.trim();
  const category = opts.category?.trim();

  return db
    .select({
      id: documents.id,
      title: documents.title,
      category: documents.category,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      updatedByName: updater.name,
    })
    .from(documents)
    .leftJoin(updater, eq(documents.updatedById, updater.id))
    .where(
      and(
        eq(documents.projectId, projectId),
        ...(q ? [contains(q)] : []),
        ...(category ? [eq(documents.category, category)] : []),
      ),
    )
    .orderBy(desc(documents.updatedAt));
}

// 去重返回项目的分类列表（忽略空分类）
export async function listDocumentCategories(actorId: string, projectId: string) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access) throw new ForbiddenError();

  const rows = await db
    .selectDistinct({ category: documents.category })
    .from(documents)
    .where(eq(documents.projectId, projectId));

  return rows
    .map((r) => r.category?.trim())
    .filter((c): c is string => Boolean(c))
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

// 取单文档（含创建/更新人姓名）；不存在或无访问权返回 null，供页面 notFound()
export async function getDocument(actorId: string, documentId: string) {
  const [doc] = await db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      title: documents.title,
      content: documents.content,
      category: documents.category,
      createdByName: users.name,
      updatedById: documents.updatedById,
      updatedByName: updater.name,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(users, eq(documents.createdById, users.id))
    .leftJoin(updater, eq(documents.updatedById, updater.id))
    .where(eq(documents.id, documentId));
  if (!doc) return null;

  const access = await getProjectForUser(actorId, doc.projectId);
  if (!access) return null;
  return doc;
}

// 新建文档：项目内任一成员可建（全员可编辑口径）
export async function createDocument(
  actorId: string,
  projectId: string,
  input: { title: string; content?: string; category?: string | null },
) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access) throw new ForbiddenError();

  const title = normalizeTitle(input.title);
  const content = input.content ?? "";
  const category = normalizeCategory(input.category);

  const doc = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(documents)
      .values({
        projectId,
        title,
        content,
        category,
        createdById: actorId,
        updatedById: actorId,
      })
      .returning();
    // 建文档即写入版本 1（初始快照）
    await appendVersion(tx, inserted.id, { title, content, category }, actorId);
    return inserted;
  });

  void notifyTeamMembers({
    teamId: access.project.teamId,
    actorId,
    type: "document_created",
    title: "新文档",
    content: `文档《${title}》已创建`,
    linkUrl: `/projects/${projectId}/docs/${doc.id}`,
    projectId,
  });
  return doc;
}

// 编辑文档：白名单构造 set（勿 ...patch 展开，防夹带越权字段），并刷新更新人/时间
export async function updateDocument(
  actorId: string,
  documentId: string,
  patch: { title?: string; content?: string; category?: string | null },
) {
  const { doc, access } = await requireDocumentAccess(actorId, documentId);

  const title = patch.title === undefined ? doc.title : normalizeTitle(patch.title);
  const content = patch.content === undefined ? doc.content : patch.content;
  const category =
    patch.category === undefined ? doc.category : normalizeCategory(patch.category);

  const updated = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(documents)
      .set({
        title,
        content,
        category,
        updatedAt: new Date(),
        updatedById: actorId,
      })
      .where(eq(documents.id, documentId))
      .returning();
    // 快照保存后的新状态；若与上一版完全相同，appendVersion 内部去重跳过
    await appendVersion(tx, documentId, { title, content, category }, actorId);
    return u;
  });

  void notifyTeamMembers({
    teamId: access.project.teamId,
    actorId,
    type: "document_updated",
    title: "文档已更新",
    content: `文档《${updated.title}》发生了更新`,
    linkUrl: `/projects/${doc.projectId}/docs/${documentId}`,
    projectId: doc.projectId,
  });
  return updated;
}

// 删除文档：项目内任一成员可删
export async function deleteDocument(actorId: string, documentId: string) {
  const { doc, access } = await requireDocumentAccess(actorId, documentId);
  await db.delete(documents).where(eq(documents.id, documentId));

  void notifyTeamMembers({
    teamId: access.project.teamId,
    actorId,
    type: "document_deleted",
    title: "文档已删除",
    content: `文档《${doc.title}》已被删除`,
    linkUrl: `/projects/${doc.projectId}/docs`,
    projectId: doc.projectId,
  });
}

// ==================== 版本历史 ====================

// 版本列表（按版本号倒序，最新在前），含作者名与备注
export async function listDocumentVersions(actorId: string, documentId: string) {
  await requireDocumentAccess(actorId, documentId);
  return db
    .select({
      id: documentVersions.id,
      documentId: documentVersions.documentId,
      versionNumber: documentVersions.versionNumber,
      title: documentVersions.title,
      category: documentVersions.category,
      authorId: documentVersions.authorId,
      authorName: versionAuthor.name,
      note: documentVersions.note,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .leftJoin(versionAuthor, eq(documentVersions.authorId, versionAuthor.id))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber));
}

// 取单个版本只读内容（含正文）；不存在返回 null，供页面 notFound()
export async function getDocumentVersion(
  actorId: string,
  documentId: string,
  versionId: string,
) {
  const [doc] = await db
    .select({ projectId: documents.projectId })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!doc || !(await getProjectForUser(actorId, doc.projectId))) return null;
  const [version] = await db
    .select({
      id: documentVersions.id,
      documentId: documentVersions.documentId,
      versionNumber: documentVersions.versionNumber,
      title: documentVersions.title,
      content: documentVersions.content,
      category: documentVersions.category,
      authorId: documentVersions.authorId,
      authorName: versionAuthor.name,
      note: documentVersions.note,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .leftJoin(versionAuthor, eq(documentVersions.authorId, versionAuthor.id))
    .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
  return version ?? null;
}

// 恢复旧版本：用该版本内容覆盖当前文档，并生成一个新版本（不回滚覆盖历史，审计链完整）
export async function restoreDocumentVersion(
  actorId: string,
  documentId: string,
  versionId: string,
) {
  const { doc, access } = await requireDocumentAccess(actorId, documentId);

  const [target] = await db
    .select()
    .from(documentVersions)
    .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
  if (!target) throw new AppError("版本不存在");

  const restored = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(documents)
      .set({
        title: target.title,
        content: target.content,
        category: target.category,
        updatedAt: new Date(),
        updatedById: actorId,
      })
      .where(eq(documents.id, documentId))
      .returning();
    // 恢复也走 appendVersion：目标内容与当前一致（无实际变化）则内部去重跳过
    await appendVersion(
      tx,
      documentId,
      { title: target.title, content: target.content, category: target.category },
      actorId,
      `恢复自版本 ${target.versionNumber}`,
    );
    return u;
  });

  void notifyTeamMembers({
    teamId: access.project.teamId,
    actorId,
    type: "document_updated",
    title: "文档已恢复",
    content: `文档《${restored.title}》已恢复到版本 ${target.versionNumber}`,
    linkUrl: `/projects/${doc.projectId}/docs/${documentId}`,
    projectId: doc.projectId,
  });
  return restored;
}
