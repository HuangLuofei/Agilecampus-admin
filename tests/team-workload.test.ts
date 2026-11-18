import { beforeEach, describe, expect, it } from "vitest";
import { createProject, updateProject } from "@/lib/project";
import { createTask, updateTask } from "@/lib/task";
import { createTeam, joinTeam } from "@/lib/team";
import { createUser } from "@/lib/user";
import { listTeamWorkload, workloadLevel } from "@/lib/team-workload";
import { resetDb } from "./helpers";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

describe("团队工作量", () => {
  beforeEach(resetDb);

  it("按负责人去重统计未完成与逾期任务，忽略完成任务和归档项目", async () => {
    const owner = await makeUser("workload-owner@example.com");
    const team = await createTeam(owner.id, "工作量小组");
    const student = await makeUser("workload-student@example.com");
    await joinTeam(student.id, team.inviteCode);
    const project = await createProject(owner.id, team.id, { name: "当前项目" });
    const archived = await createProject(owner.id, team.id, { name: "已归档项目" });

    await createTask(owner.id, project.id, {
      title: "共同任务",
      assigneeIds: [owner.id, student.id],
      dueDate: "2026-05-09",
    });
    await createTask(owner.id, project.id, {
      title: "今日截止",
      assigneeId: student.id,
      dueDate: "2026-05-10",
    });
    await createTask(owner.id, project.id, { title: "未分配" });
    const completed = await createTask(owner.id, project.id, { title: "已完成", assigneeId: owner.id });
    const archivedTask = await createTask(owner.id, archived.id, { title: "归档任务", assigneeId: student.id, dueDate: "2026-05-01" });
    await updateTask(owner.id, completed.id, { status: "done" });
    await updateProject(owner.id, archived.id, { status: "archived" });

    const rows = await listTeamWorkload(student.id, team.id, "2026-05-10");
    const ownerWork = rows.find((row) => row.id === owner.id)!;
    const studentWork = rows.find((row) => row.id === student.id)!;
    expect(ownerWork).toMatchObject({ openTaskCount: 1, overdueTaskCount: 1, level: "较空闲" });
    expect(studentWork).toMatchObject({ openTaskCount: 2, overdueTaskCount: 1, level: "较空闲" });
    expect(archivedTask.projectId).toBe(archived.id);
  });

  it("用未完成任务数映射粗略负载等级", () => {
    expect(workloadLevel(0)).toBe("较空闲");
    expect(workloadLevel(2)).toBe("较空闲");
    expect(workloadLevel(3)).toBe("适中");
    expect(workloadLevel(5)).toBe("适中");
    expect(workloadLevel(6)).toBe("较忙");
  });
});
