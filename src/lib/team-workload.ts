import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { projects, taskAssignees, tasks, teamMembers, users } from "@/db/schema";
import { requireTeamRole } from "@/lib/team";

export type WorkloadLevel = "较空闲" | "适中" | "较忙";

export function workloadLevel(openTaskCount: number): WorkloadLevel {
  if (openTaskCount <= 2) return "较空闲";
  if (openTaskCount <= 5) return "适中";
  return "较忙";
}

export async function listTeamWorkload(actorId: string, teamId: string, today = new Date().toLocaleDateString("sv-SE")) {
  await requireTeamRole(actorId, teamId, ["admin", "teacher", "student"]);

  const members = await db
    .select({ id: users.id, name: users.name, role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));
  const activeProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.teamId, teamId), eq(projects.status, "active")));
  if (activeProjects.length === 0) {
    return members.map((member) => ({ ...member, openTaskCount: 0, overdueTaskCount: 0, level: workloadLevel(0) }));
  }

  const openTasks = await db
    .select({ id: tasks.id, assigneeId: tasks.assigneeId, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(inArray(tasks.projectId, activeProjects.map((project) => project.id)), ne(tasks.status, "done")));
  if (openTasks.length === 0) {
    return members.map((member) => ({ ...member, openTaskCount: 0, overdueTaskCount: 0, level: workloadLevel(0) }));
  }

  const assigneeRows = await db
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(inArray(taskAssignees.taskId, openTasks.map((task) => task.id)));
  const assigneesByTask = new Map<string, Set<string>>();
  for (const row of assigneeRows) {
    const assignees = assigneesByTask.get(row.taskId) ?? new Set<string>();
    assignees.add(row.userId);
    assigneesByTask.set(row.taskId, assignees);
  }
  for (const task of openTasks) {
    if (!task.assigneeId) continue;
    const assignees = assigneesByTask.get(task.id) ?? new Set<string>();
    assignees.add(task.assigneeId);
    assigneesByTask.set(task.id, assignees);
  }

  const totals = new Map(members.map((member) => [member.id, { openTaskCount: 0, overdueTaskCount: 0 }]));
  for (const task of openTasks) {
    for (const userId of assigneesByTask.get(task.id) ?? []) {
      const total = totals.get(userId);
      if (!total) continue;
      total.openTaskCount += 1;
      if (task.dueDate && task.dueDate < today) total.overdueTaskCount += 1;
    }
  }

  return members.map((member) => {
    const total = totals.get(member.id)!;
    return { ...member, ...total, level: workloadLevel(total.openTaskCount) };
  });
}
