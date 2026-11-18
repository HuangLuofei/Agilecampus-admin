import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { milestones, taskEvents, tasks } from "@/db/schema";
import { createProject } from "@/lib/project";
import { createGroupAssignmentTemplate, GROUP_ASSIGNMENT_STAGES } from "@/lib/project-template";
import { createTeam, joinTeam } from "@/lib/team";
import { createUser } from "@/lib/user";
import { resetDb } from "./helpers";
import { eq } from "drizzle-orm";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

async function scene() {
  const owner = await makeUser("template-owner@example.com");
  const team = await createTeam(owner.id, "模板小组");
  const student = await makeUser("template-student@example.com");
  await joinTeam(student.id, team.inviteCode);
  const project = await createProject(owner.id, team.id, { name: "课程作业" });
  return { owner, student, project };
}

describe("小组作业模板", () => {
  beforeEach(resetDb);

  it("原子创建五个阶段里程碑、起步任务和创建记录", async () => {
    const { owner, project } = await scene();
    const created = await createGroupAssignmentTemplate(owner.id, project.id);
    const projectMilestones = await db.select().from(milestones).where(eq(milestones.projectId, project.id));
    const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, project.id));
    const eventRows = await db.select().from(taskEvents);

    expect(created).toHaveLength(5);
    expect(projectMilestones.map((row) => row.title)).toEqual(GROUP_ASSIGNMENT_STAGES.map((stage) => stage.title));
    expect(projectTasks.map((row) => row.title)).toEqual(GROUP_ASSIGNMENT_STAGES.map((stage) => stage.taskTitle));
    expect(projectTasks.every((row) => created.some((item) => item.milestoneId === row.milestoneId))).toBe(true);
    expect(eventRows).toHaveLength(5);
  });

  it("拒绝非组长并阻止重复创建", async () => {
    const { owner, student, project } = await scene();
    await expect(createGroupAssignmentTemplate(student.id, project.id)).rejects.toThrow("没有权限");

    await createGroupAssignmentTemplate(owner.id, project.id);
    await expect(createGroupAssignmentTemplate(owner.id, project.id)).rejects.toThrow("已存在作业模板阶段");
    expect(await db.select().from(milestones).where(eq(milestones.projectId, project.id))).toHaveLength(5);
    expect(await db.select().from(tasks).where(eq(tasks.projectId, project.id))).toHaveLength(5);
  });
});
