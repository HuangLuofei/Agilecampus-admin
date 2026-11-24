import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentComments, documents, users } from "@/db/schema";
import { getProjectForUser } from "@/lib/project";
import { isTeamLead } from "@/lib/team-permissions";
import { AppError, ForbiddenError } from "@/lib/errors";

const resolver = alias(users, "document_comment_resolver");

async function getDocumentAccess(actorId: string, documentId: string) {
  const [document] = await db.select().from(documents).where(eq(documents.id, documentId));
  if (!document) throw new AppError("文档不存在");
  const access = await getProjectForUser(actorId, document.projectId);
  if (!access) throw new ForbiddenError();
  return { document, access };
}

async function getCommentAccess(actorId: string, commentId: string) {
  const [comment] = await db
    .select()
    .from(documentComments)
    .where(eq(documentComments.id, commentId));
  if (!comment) throw new AppError("评论不存在");
  const access = await getDocumentAccess(actorId, comment.documentId);
  return { comment, ...access };
}

export async function listDocumentComments(actorId: string, documentId: string) {
  await getDocumentAccess(actorId, documentId);
  return db
    .select({
      id: documentComments.id,
      documentId: documentComments.documentId,
      authorId: documentComments.authorId,
      authorName: users.name,
      quote: documentComments.quote,
      content: documentComments.content,
      resolvedAt: documentComments.resolvedAt,
      resolvedById: documentComments.resolvedById,
      resolvedByName: resolver.name,
      createdAt: documentComments.createdAt,
      updatedAt: documentComments.updatedAt,
    })
    .from(documentComments)
    .innerJoin(users, eq(documentComments.authorId, users.id))
    .leftJoin(resolver, eq(documentComments.resolvedById, resolver.id))
    .where(eq(documentComments.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));
}

export async function createDocumentComment(
  actorId: string,
  documentId: string,
  input: { content: string; quote?: string | null },
) {
  await getDocumentAccess(actorId, documentId);
  const content = input.content.trim();
  if (!content) throw new AppError("评论内容不能为空");
  if (content.length > 2000) throw new AppError("评论不能超过 2000 字");
  const quote = input.quote?.trim() || null;
  if (quote && quote.length > 1000) throw new AppError("引用内容不能超过 1000 字");

  const [comment] = await db
    .insert(documentComments)
    .values({ documentId, authorId: actorId, content, quote })
    .returning();
  return comment;
}

export async function updateDocumentComment(actorId: string, commentId: string, content: string) {
  const { comment } = await getCommentAccess(actorId, commentId);
  if (comment.authorId !== actorId) throw new ForbiddenError("只有评论作者可以编辑评论");
  const trimmed = content.trim();
  if (!trimmed) throw new AppError("评论内容不能为空");
  if (trimmed.length > 2000) throw new AppError("评论不能超过 2000 字");

  const [updated] = await db
    .update(documentComments)
    .set({ content: trimmed, updatedAt: new Date() })
    .where(eq(documentComments.id, commentId))
    .returning();
  return updated;
}

export async function deleteDocumentComment(actorId: string, commentId: string) {
  const { comment, access } = await getCommentAccess(actorId, commentId);
  if (comment.authorId !== actorId && !isTeamLead(access.role) && access.role !== "teacher") {
    throw new ForbiddenError("没有权限删除这条评论");
  }
  await db.delete(documentComments).where(eq(documentComments.id, commentId));
}

export async function setDocumentCommentResolved(actorId: string, commentId: string, resolved: boolean) {
  const { access } = await getCommentAccess(actorId, commentId);
  if (!isTeamLead(access.role)) throw new ForbiddenError("只有组长可以标记文档评论已解决");

  const [updated] = await db
    .update(documentComments)
    .set({
      resolvedAt: resolved ? new Date() : null,
      resolvedById: resolved ? actorId : null,
      updatedAt: new Date(),
    })
    .where(eq(documentComments.id, commentId))
    .returning();
  return updated;
}
