import { tool } from "ai";
import { z } from "zod";
import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { taskDependencies, taskDeliveries } from "@/db/schema";
import { listMyProjects, listProjectMilestones } from "@/lib/project";
import { listProjectTasks } from "@/lib/task";
import type { TaskStatus } from "@/db/schema";

// 读工具纯函数：权限经底层 lib（listProjectMilestones/listProjectTasks 内部各调 getProjectForUser）
export async function queryProgress(actorId: string, projectId: string) {
  const [ms, ts] = await Promise.all([
    listProjectMilestones(actorId, projectId),
    listProjectTasks(actorId, projectId),
  ]);
  const byStatus: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const t of ts) byStatus[t.status]++;
  return {
    taskTotal: ts.length,
    byStatus,
    milestoneTotal: ms.length,
    milestones: ms.map((m) => ({
      title: m.title,
      status: m.status,
      targetDate: m.targetDate,
    })),
  };
}

export async function listTasksFiltered(
  actorId: string,
  projectId: string,
  filters: { status?: TaskStatus; assigneeId?: string; dueBefore?: string },
) {
  let list = await listProjectTasks(actorId, projectId);
  if (filters.status) list = list.filter((t) => t.status === filters.status);
  // 按负责人筛选＝该任务指派给此人（多负责人集合，任一命中即可）
  if (filters.assigneeId) list = list.filter((t) => t.assigneeIds.includes(filters.assigneeId!));
  if (filters.dueBefore)
    list = list.filter((t) => t.dueDate !== null && t.dueDate <= filters.dueBefore!);
  return list.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    // assigneeName 为主负责人（兼容既有调用），assigneeNames 为完整集合
    assigneeName: t.assigneeName,
    assigneeNames: t.assignees.map((a) => a.name),
  }));
}

// 跨项目概览：裁去 createdAt 等模型用不上的字段，省 token
export async function listMyProjectsBrief(actorId: string) {
  const rows = await listMyProjects(actorId);
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    teamName: p.teamName,
    taskTotal: p.taskTotal,
    doneCount: p.doneCount,
  }));
}

// 里程碑 id 兜底：快照超限降级后模型仍需 milestoneId
export async function listMilestonesBrief(actorId: string, projectId: string) {
  const rows = await listProjectMilestones(actorId, projectId);
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    targetDate: m.targetDate,
  }));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// 读取项目风险信号，供助手给出有依据的提醒与下一步建议。
// 所有任务先经 listProjectTasks 做项目成员校验，关联查询只补充依赖和验收状态。
export async function analyzeProjectRisks(
  actorId: string,
  projectId: string,
  horizonDays = 7,
) {
  const tasks = await listProjectTasks(actorId, projectId);
  const today = new Date().toISOString().slice(0, 10);
  const horizonEnd = addDays(today, horizonDays);
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const dependencyRows = tasks.length
    ? await db
        .select({ predecessorId: taskDependencies.predecessorId, successorId: taskDependencies.successorId })
        .from(taskDependencies)
        .where(inArray(taskDependencies.successorId, tasks.map((task) => task.id)))
    : [];
  const blocked = dependencyRows
    .map((row) => {
      const predecessor = taskById.get(row.predecessorId);
      const successor = taskById.get(row.successorId);
      if (!predecessor || !successor || predecessor.status === "done" || successor.status === "done") return null;
      return {
        taskId: successor.id,
        title: successor.title,
        blockedBy: predecessor.title,
      };
    })
    .filter((row): row is { taskId: string; title: string; blockedBy: string } => row !== null);

  const latestDeliveries = new Map<string, { status: "submitted" | "approved" | "rejected"; reviewNote: string | null }>();
  if (tasks.length > 0) {
    const deliveryRows = await db
      .select({ taskId: taskDeliveries.taskId, status: taskDeliveries.status, reviewNote: taskDeliveries.reviewNote })
      .from(taskDeliveries)
      .where(inArray(taskDeliveries.taskId, tasks.map((task) => task.id)))
      .orderBy(desc(taskDeliveries.submittedAt));
    for (const row of deliveryRows) {
      if (!latestDeliveries.has(row.taskId)) latestDeliveries.set(row.taskId, row);
    }
  }

  const overdue = tasks
    .filter((task) => task.status !== "done" && task.dueDate !== null && task.dueDate < today)
    .map((task) => ({ taskId: task.id, title: task.title, dueDate: task.dueDate }));
  const dueSoon = tasks
    .filter((task) => task.status !== "done" && task.dueDate !== null && task.dueDate >= today && task.dueDate <= horizonEnd)
    .map((task) => ({ taskId: task.id, title: task.title, dueDate: task.dueDate }));
  const unassigned = tasks
    .filter((task) => task.assigneeIds.length === 0)
    .map((task) => ({ taskId: task.id, title: task.title, dueDate: task.dueDate }));
  const deliveryRisks = tasks
    .map((task) => {
      const delivery = latestDeliveries.get(task.id);
      if (!delivery || delivery.status === "approved") return null;
      return { taskId: task.id, title: task.title, status: delivery.status, reviewNote: delivery.reviewNote };
    })
    .filter((row): row is { taskId: string; title: string; status: "submitted" | "rejected"; reviewNote: string | null } => row !== null);

  const riskCount = overdue.length + blocked.length + deliveryRisks.filter((row) => row.status === "rejected").length;
  return {
    today,
    horizonDays,
    riskLevel: riskCount >= 3 ? "high" : riskCount > 0 ? "medium" : "low",
    overdue,
    dueSoon,
    blocked,
    unassigned,
    deliveryRisks,
  };
}

// AI SDK 工具装配：绑定 actorId/projectId，execute 委托纯函数
export function buildTools(actorId: string, projectId: string) {
  return {
    query_progress: tool({
      description: "查询该项目进度统计：各状态任务数、里程碑概况。无需参数。",
      inputSchema: z.object({}),
      execute: async () => queryProgress(actorId, projectId),
    }),
    list_tasks: tool({
      description:
        "按状态、负责人、截止日筛选该项目任务，返回含 taskId。改任务前必先用它取回 id。",
      inputSchema: z.object({
        status: z.enum(["todo", "doing", "done"]).optional(),
        assigneeId: z.string().optional().describe("负责人用户 id"),
        dueBefore: z.string().optional().describe("截止日不晚于此日期（YYYY-MM-DD）"),
      }),
      execute: async (filters) => listTasksFiltered(actorId, projectId, filters),
    }),
    list_projects: tool({
      description:
        "列出我参与的全部项目（跨团队）及其任务统计。用户问「我有哪些项目」或需跨项目比较时用。无需参数。",
      inputSchema: z.object({}),
      execute: async () => listMyProjectsBrief(actorId),
    }),
    list_milestones: tool({
      description: "列出该项目全部里程碑，返回含 milestoneId。快照未列出里程碑时用它现查。无需参数。",
      inputSchema: z.object({}),
      execute: async () => listMilestonesBrief(actorId, projectId),
    }),
    analyze_risks: tool({
      description: "分析当前项目风险：逾期任务、近期截止、未分配任务、依赖阻塞和交付验收状态。用户问风险、延期、进度隐患或下一步时使用。无需修改数据。",
      inputSchema: z.object({
        horizonDays: z.number().int().min(1).max(30).optional().describe("未来多少天视为近期，默认 7 天"),
      }),
      execute: async ({ horizonDays }) => analyzeProjectRisks(actorId, projectId, horizonDays ?? 7),
    }),
    create_project: tool({
      description: "拟一个新项目草案（在当前项目所属团队下）。仅产草案，需人工确认后落库。",
      inputSchema: z.object({
        name: z.string(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      execute: async (input) => draftEnvelope("create_project", input),
    }),
    decompose_tasks: tool({
      description: "把目标/需求拆成任务清单草案。仅产草案，需人工确认后落库。",
      inputSchema: z.object({
        tasks: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            assigneeId: z.string().optional(),
            assigneeIds: z.array(z.string()).optional().describe("多负责人（优先于 assigneeId）"),
            acceptanceCriteria: z.string().optional().describe("验收标准"),
            dueDate: z.string().optional(),
            milestoneId: z.string().optional(),
            priority: z.enum(["low", "medium", "high"]).optional(),
          }),
        ),
      }),
      execute: async (input) => draftEnvelope("decompose_tasks", input),
    }),
    update_tasks: tool({
      description: "拟批量任务变更草案（状态/负责人/截止日/里程碑/优先级/标题）。仅产草案，需人工确认。",
      inputSchema: z.object({
        updates: z.array(
          z.object({
            taskId: z.string(),
            patch: z.object({
              title: z.string().optional(),
              status: z.enum(["todo", "doing", "done"]).optional(),
              assigneeId: z.string().optional(),
              assigneeIds: z.array(z.string()).optional().describe("多负责人（优先于 assigneeId）"),
              acceptanceCriteria: z.string().optional().describe("验收标准"),
              dueDate: z.string().optional(),
              milestoneId: z.string().optional(),
              priority: z.enum(["low", "medium", "high"]).optional(),
            }),
          }),
        ),
      }),
      // 为每个 update 填入当前 updatedAt（乐观锁读时版本），供 commit 比对
      execute: async (input) => {
        const rows = await listProjectTasks(actorId, projectId);
        const versionOf = new Map(rows.map((r) => [r.id, r.updatedAt]));
        const updates = input.updates.map((u) => ({
          taskId: u.taskId,
          updatedAt: versionOf.get(u.taskId)?.toISOString() ?? "",
          patch: u.patch,
        }));
        return draftEnvelope("update_tasks", { updates });
      },
    }),
    plan_sprint: tool({
      description: "把选定任务排入某里程碑并批量设截止日。仅产草案，需人工确认。",
      inputSchema: z.object({
        milestoneId: z.string(),
        taskIds: z.array(z.string()),
        dueDate: z.string(),
      }),
      execute: async (input) => draftEnvelope("plan_sprint", input),
    }),
    create_milestone: tool({
      description: "在当前项目下拟一个里程碑草案（阶段节点，如中期答辩）。仅产草案，需人工确认后落库。",
      inputSchema: z.object({
        title: z.string(),
        targetDate: z.string().optional().describe("目标日期 YYYY-MM-DD"),
      }),
      execute: async (input) => draftEnvelope("create_milestone", input),
    }),
    confirm_report: tool({
      description:
        "生成周报前先解析时间范围并产出确认卡片。范围经用户在卡片上确认后才真正生成周报草稿；未经确认绝不生成。范围即当前项目。",
      inputSchema: z.object({
        startDate: z.string().describe("YYYY-MM-DD"),
        endDate: z.string().describe("YYYY-MM-DD"),
        includeRisks: z.boolean().optional().describe("是否包含风险与下一周期建议，默认 true"),
      }),
      execute: async (input) => draftEnvelope("confirm_report", input),
    }),
  };
}

export const WRITE_TOOL_NAMES = [
  "create_project",
  "decompose_tasks",
  "update_tasks",
  "plan_sprint",
  "create_milestone",
  "confirm_report",
] as const;

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];

// 草案信封：写工具 execute 的统一返回形态，供 orchestrator 识别提取
export type DraftEnvelope = { __draft: true; tool: WriteToolName; draft: unknown };

function draftEnvelope(tool: WriteToolName, draft: unknown): DraftEnvelope {
  return { __draft: true, tool, draft };
}
