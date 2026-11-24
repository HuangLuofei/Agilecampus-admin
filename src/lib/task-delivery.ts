import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAssignees, taskDeliveries, tasks, users } from "@/db/schema";
import { getProjectForUser } from "./project";
import { AppError, ForbiddenError } from "./errors";
import { isTeamLead } from "./team-permissions";

async function getTaskForActor(actorId: string, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) throw new AppError("任务不存在");
  const access = await getProjectForUser(actorId, task.projectId);
  if (!access) throw new ForbiddenError();
  return { task, access };
}

export async function listTaskDeliveries(actorId: string, taskId: string) {
  await getTaskForActor(actorId, taskId);
  return db
    .select({
      id: taskDeliveries.id,
      taskId: taskDeliveries.taskId,
      submittedById: taskDeliveries.submittedById,
      submittedByName: users.name,
      note: taskDeliveries.note,
      status: taskDeliveries.status,
      reviewNote: taskDeliveries.reviewNote,
      reviewedById: taskDeliveries.reviewedById,
      submittedAt: taskDeliveries.submittedAt,
      reviewedAt: taskDeliveries.reviewedAt,
    })
    .from(taskDeliveries)
    .innerJoin(users, eq(taskDeliveries.submittedById, users.id))
    .where(eq(taskDeliveries.taskId, taskId))
    .orderBy(desc(taskDeliveries.submittedAt));
}

export async function submitTaskDelivery(actorId: string, taskId: string, note: string) {
  const { task } = await getTaskForActor(actorId, taskId);
  const trimmed = note.trim();
  if (!trimmed) throw new AppError("请填写交付说明");
  if (trimmed.length > 5000) throw new AppError("交付说明不能超过 5000 字");

  const [assignment] = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, actorId)));
  if (task.assigneeId !== actorId && !assignment) {
    throw new ForbiddenError("只有任务负责人可以提交交付");
  }

  const [delivery] = await db
    .insert(taskDeliveries)
    .values({ taskId, submittedById: actorId, note: trimmed })
    .returning();
  return delivery;
}

export async function reviewTaskDelivery(
  actorId: string,
  deliveryId: string,
  status: "approved" | "rejected",
  reviewNote?: string,
) {
  const [delivery] = await db
    .select({
      id: taskDeliveries.id,
      taskId: taskDeliveries.taskId,
      currentStatus: taskDeliveries.status,
    })
    .from(taskDeliveries)
    .where(eq(taskDeliveries.id, deliveryId));
  if (!delivery) throw new AppError("交付记录不存在");

  const { access } = await getTaskForActor(actorId, delivery.taskId);
  if (!isTeamLead(access.role)) throw new ForbiddenError("只有项目组长可以审核交付");
  if (delivery.currentStatus !== "submitted") throw new AppError("这条交付记录已经审核过了");

  const trimmedReviewNote = reviewNote?.trim() ?? "";
  if (status === "rejected" && !trimmedReviewNote) {
    throw new AppError("退回时请填写审核意见");
  }
  if (trimmedReviewNote.length > 5000) throw new AppError("审核意见不能超过 5000 字");

  const [updated] = await db
    .update(taskDeliveries)
    .set({
      status,
      reviewNote: trimmedReviewNote || null,
      reviewedById: actorId,
      reviewedAt: new Date(),
    })
    .where(and(eq(taskDeliveries.id, deliveryId), eq(taskDeliveries.status, "submitted")))
    .returning();
  if (!updated) throw new AppError("这条交付记录已经审核过了");
  return updated;
}
