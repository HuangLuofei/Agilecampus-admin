import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { milestones } from "@/db/schema";
import { createTask } from "@/lib/task";
import { getProjectForUser } from "@/lib/project";
import { isTeamLead } from "@/lib/team-permissions";
import { AppError, ForbiddenError } from "@/lib/errors";

export type ProjectTemplateStage = {
  title: string;
  taskTitle: string;
  description: string;
  acceptanceCriteria?: string;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  stages: readonly ProjectTemplateStage[];
};

export const GROUP_ASSIGNMENT_STAGES = [
  {
    title: "选题",
    taskTitle: "确认作业主题与目标",
    description: "整理备选方向，确认选题范围、目标和最终交付要求。",
    acceptanceCriteria: "已确定主题、目标、范围和最终交付形式，并获得小组确认。",
  },
  {
    title: "分工",
    taskTitle: "拆分任务并确定负责人",
    description: "把作业拆分为可执行任务，明确负责人、协作者和截止日期。",
    acceptanceCriteria: "任务已经拆分，每项任务都有负责人和明确的完成时间。",
  },
  {
    title: "调研",
    taskTitle: "收集资料并形成调研结论",
    description: "收集可信资料，记录来源，并整理关键发现与结论。",
    acceptanceCriteria: "已整理关键资料和来源，并形成可供制作阶段使用的调研结论。",
  },
  {
    title: "制作",
    taskTitle: "汇总成果并制作展示材料",
    description: "整合各成员成果，完成报告、演示文稿或其他作业交付物。",
    acceptanceCriteria: "展示材料结构完整，内容经过小组审阅，能够支持最终答辩。",
  },
  {
    title: "答辩",
    taskTitle: "准备答辩并完成演练",
    description: "准备讲稿与问答，核对最终材料并进行一次完整演练。",
    acceptanceCriteria: "已完成至少一次完整演练，材料、讲稿和问答分工均已确认。",
  },
] as const;

const RESEARCH_STAGES = [
  {
    title: "研究问题",
    taskTitle: "明确研究问题与假设",
    description: "界定研究对象、核心问题、研究目标和可验证的假设。",
    acceptanceCriteria: "研究问题边界清晰，目标和假设已经由小组共同确认。",
  },
  {
    title: "研究设计",
    taskTitle: "制定研究方案与分工",
    description: "确定研究方法、样本或实验材料、时间安排和成员分工。",
    acceptanceCriteria: "研究方案可执行，分工、材料和时间安排已经明确。",
  },
  {
    title: "数据收集",
    taskTitle: "完成数据收集并记录过程",
    description: "按研究方案收集数据，记录过程、原始资料和可能的异常情况。",
    acceptanceCriteria: "原始数据和过程记录完整，异常情况已经标注并说明处理方式。",
  },
  {
    title: "分析讨论",
    taskTitle: "分析数据并讨论研究发现",
    description: "整理和分析数据，解释主要发现，并讨论局限性与后续方向。",
    acceptanceCriteria: "分析过程可追溯，主要发现有证据支撑，并明确说明局限性。",
  },
  {
    title: "研究交付",
    taskTitle: "完成研究报告与成果汇报",
    description: "汇总研究过程和结果，完成报告、图表和最终汇报材料。",
    acceptanceCriteria: "报告结构完整、引用规范，汇报材料已审核并完成演练。",
  },
] as const;

const PRODUCT_STAGES = [
  {
    title: "需求定义",
    taskTitle: "整理用户需求与版本目标",
    description: "明确目标用户、待解决的问题、需求优先级和本次迭代范围。",
    acceptanceCriteria: "需求有明确的用户场景和优先级，迭代范围已经确认。",
  },
  {
    title: "方案设计",
    taskTitle: "完成方案设计与任务拆解",
    description: "设计解决方案，补充关键交互或技术说明，并拆解执行任务。",
    acceptanceCriteria: "方案覆盖核心场景，任务拆解可执行并已安排负责人。",
  },
  {
    title: "开发实现",
    taskTitle: "完成版本功能开发",
    description: "按计划完成开发和联调，及时记录风险、阻塞和范围变化。",
    acceptanceCriteria: "计划功能已实现并通过基本自测，已记录遗留问题。",
  },
  {
    title: "测试验收",
    taskTitle: "完成测试并处理问题",
    description: "执行功能测试和关键场景验证，修复问题并记录验收结果。",
    acceptanceCriteria: "关键场景测试通过，高优先级问题已处理或有明确跟进计划。",
  },
  {
    title: "发布复盘",
    taskTitle: "发布成果并完成迭代复盘",
    description: "整理发布说明，展示迭代成果，并记录数据、反馈和下一步改进。",
    acceptanceCriteria: "发布说明和成果展示已完成，复盘结论和下一步行动项已记录。",
  },
] as const;

export const PROJECT_TEMPLATES = [
  {
    id: "group-assignment",
    name: "小组课程作业",
    description: "适合课程项目，从选题到答辩逐步推进协作成果。",
    stages: GROUP_ASSIGNMENT_STAGES,
  },
  {
    id: "research-project",
    name: "科研实验项目",
    description: "适合研究和实验项目，覆盖问题、设计、数据、分析和交付。",
    stages: RESEARCH_STAGES,
  },
  {
    id: "product-iteration",
    name: "产品开发迭代",
    description: "适合产品或软件迭代，从需求定义推进到发布复盘。",
    stages: PRODUCT_STAGES,
  },
] as const satisfies readonly ProjectTemplate[];

export function getProjectTemplate(templateId: string) {
  return PROJECT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

async function applyTemplate(
  actorId: string,
  projectId: string,
  template: ProjectTemplate,
  duplicateMessage: string,
) {
  const access = await getProjectForUser(actorId, projectId);
  if (!access || !isTeamLead(access.role)) throw new ForbiddenError();

  const stageTitles = template.stages.map((stage) => stage.title);
  const existing = await db
    .select({ title: milestones.title })
    .from(milestones)
    .where(and(eq(milestones.projectId, projectId), inArray(milestones.title, stageTitles)));
  if (existing.length > 0) throw new AppError(duplicateMessage);

  return db.transaction(async (tx) => {
    const created: { milestoneId: string; taskId: string }[] = [];
    for (const stage of template.stages) {
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
          acceptanceCriteria: stage.acceptanceCriteria,
          milestoneId: milestone.id,
        },
        { tx },
      );
      created.push({ milestoneId: milestone.id, taskId: task.id });
    }
    return created;
  });
}

export async function applyProjectTemplate(actorId: string, projectId: string, templateId: string) {
  const template = getProjectTemplate(templateId);
  if (!template) throw new AppError("项目模板不存在");
  return applyTemplate(actorId, projectId, template, `项目中已存在「${template.name}」模板阶段，请先检查现有里程碑`);
}

/** 保留项目详情页已有入口的兼容包装。 */
export async function createGroupAssignmentTemplate(actorId: string, projectId: string) {
  const template = getProjectTemplate("group-assignment")!;
  return applyTemplate(actorId, projectId, template, "项目中已存在作业模板阶段，请先检查现有里程碑");
}
