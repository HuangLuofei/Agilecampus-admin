import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectRetrospectives, users } from "@/db/schema";
import { getProjectForUser } from "@/lib/project";
import { isTeamLead } from "@/lib/team-permissions";
import { AppError, ForbiddenError } from "@/lib/errors";

export type ProjectRetrospectiveInput = {
  title: string;
  summary: string;
  wentWell: string;
  challenges: string;
  lessons: string;
  nextSteps: string;
};

async function requireProjectMember(actorId: string, projectId: string) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access) throw new ForbiddenError();
  return access;
}

export async function listProjectRetrospectives(actorId: string, projectId: string) {
  await requireProjectMember(actorId, projectId);
  return db
    .select({
      id: projectRetrospectives.id,
      projectId: projectRetrospectives.projectId,
      createdById: projectRetrospectives.createdById,
      title: projectRetrospectives.title,
      summary: projectRetrospectives.summary,
      wentWell: projectRetrospectives.wentWell,
      challenges: projectRetrospectives.challenges,
      lessons: projectRetrospectives.lessons,
      nextSteps: projectRetrospectives.nextSteps,
      status: projectRetrospectives.status,
      publishedById: projectRetrospectives.publishedById,
      publishedAt: projectRetrospectives.publishedAt,
      createdAt: projectRetrospectives.createdAt,
      updatedAt: projectRetrospectives.updatedAt,
      createdByName: users.name,
    })
    .from(projectRetrospectives)
    .leftJoin(users, eq(projectRetrospectives.createdById, users.id))
    .where(eq(projectRetrospectives.projectId, projectId))
    .orderBy(desc(projectRetrospectives.createdAt));
}

export async function createProjectRetrospective(
  actorId: string,
  projectId: string,
  input: ProjectRetrospectiveInput,
) {
  await requireProjectMember(actorId, projectId);
  const [retrospective] = await db
    .insert(projectRetrospectives)
    .values({ projectId, createdById: actorId, ...input })
    .returning();
  return retrospective;
}

async function getRetrospectiveAccess(actorId: string, retrospectiveId: string) {
  const [retrospective] = await db
    .select()
    .from(projectRetrospectives)
    .where(eq(projectRetrospectives.id, retrospectiveId));
  if (!retrospective) throw new AppError("复盘记录不存在");
  const access = await requireProjectMember(actorId, retrospective.projectId);
  return { retrospective, access };
}

export async function updateProjectRetrospective(
  actorId: string,
  retrospectiveId: string,
  input: ProjectRetrospectiveInput,
) {
  const { retrospective, access } = await getRetrospectiveAccess(actorId, retrospectiveId);
  const canEdit = isTeamLead(access.role) || retrospective.createdById === actorId;
  if (!canEdit) throw new ForbiddenError("只有复盘创建者或组长可以编辑复盘");
  if (retrospective.status === "published" && !isTeamLead(access.role)) {
    throw new ForbiddenError("已发布的复盘只能由组长编辑");
  }

  const [updated] = await db
    .update(projectRetrospectives)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projectRetrospectives.id, retrospectiveId))
    .returning();
  if (!updated) throw new AppError("复盘记录不存在");
  return updated;
}

export async function publishProjectRetrospective(actorId: string, retrospectiveId: string) {
  const { retrospective, access } = await getRetrospectiveAccess(actorId, retrospectiveId);
  if (!isTeamLead(access.role)) throw new ForbiddenError("只有组长可以发布项目复盘");
  if (retrospective.status === "published") return retrospective;

  const [published] = await db
    .update(projectRetrospectives)
    .set({
      status: "published",
      publishedById: actorId,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(projectRetrospectives.id, retrospectiveId), eq(projectRetrospectives.status, "draft")))
    .returning();
  if (!published) throw new AppError("复盘记录状态已发生变化，请刷新后重试");
  return published;
}
