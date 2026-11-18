import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { createTask } from "@/lib/task";
import { getProjectForUser } from "@/lib/project";
import { isTeamLead } from "@/lib/team-permissions";
import { AppError, ForbiddenError } from "@/lib/errors";

export const GROUP_ASSIGNMENT_STAGES = [
  {
    title: "选题",
    taskTitle: "确认作业主题与目标",
    description: "整理备选方向，确认选题范围、目标和最终交付要求。",
  },
  {
    title: "分工",
    taskTitle: "拆分任务并确定负责人",
    description: "把作业拆分为可执行任务，明确负责人、协作者和截止日期。",
  },
  {
    title: "调研",
    taskTitle: "收集资料并形成调研结论",
    description: "收集可信资料，记录来源，并整理关键发现与结论。",
  },
  {
    title: "制作",
    taskTitle: "汇总成果并制作展示材料",
    description: "整合各成员成果，完成报告、演示文稿或其他作业交付物。",
  },
  {
    title: "答辩",
    taskTitle: "准备答辩并完成演练",
    description: "准备讲稿与问答，核对最终材料并进行一次完整演练。",
  },
] as const;

export async function createGroupAssignmentTemplate(actorId: string, projectId: string) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access || !isTeamLead(access.role)) throw new ForbiddenError();

  const stageTitles = GROUP_ASSIGNMENT_STAGES.map((stage) => stage.title);
  const existing = await db
    .select({ title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), inArray(milestones.title, stageTitles)));
  if (existing.length > 0) {
    throw new AppError("项目中已存在作业模板阶段，请先检查现有里程碑");
  }

  return db.transaction(async (tx) => {
    const created: { milestoneId: string; taskId: string }[] = [];
    for (const stage of GROUP_ASSIGNMENT_STAGES) {
      const [milestone] = await tx
        .insert(milestones)
        .values({ projectId, title: stage.title })
        .returning({ id: milestones.id });
      const task = await createTask(
        actorId,
        projectId,
        {
          title: stage.taskTitle,
          description: stage.description,
          milestoneId: milestone.id,
        },
        { tx },
      );
      created.push({ milestoneId: milestone.id, taskId: task.id });
    }
    return created;
  });
}
