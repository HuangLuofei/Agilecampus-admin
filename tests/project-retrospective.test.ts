import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectRetrospectives } from "@/db/schema";
import { createProject } from "@/lib/project";
import {
  createProjectRetrospective,
  listProjectRetrospectives,
  publishProjectRetrospective,
  updateProjectRetrospective,
} from "@/lib/project-retrospective";
import { createTeam, joinTeam } from "@/lib/team";
import { createUser } from "@/lib/user";
import { resetDb } from "./helpers";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

async function scene() {
  const owner = await makeUser("retro-owner@example.com");
  const team = await createTeam(owner.id, "复盘小组");
  const member = await makeUser("retro-member@example.com");
  await joinTeam(member.id, team.inviteCode);
  const outsider = await makeUser("retro-outsider@example.com");
  const project = await createProject(owner.id, team.id, { name: "复盘项目" });
  return { owner, member, outsider, project };
}

const input = {
  title: "结项复盘",
  summary: "完成了第一版交付",
  wentWell: "分工清晰，沟通及时",
  challenges: "测试时间不足",
  lessons: "应该更早安排验收",
  nextSteps: "建立发布前检查清单",
};

describe("项目复盘", () => {
  beforeEach(resetDb);

  it("团队成员可以创建和查看复盘，非成员无法访问", async () => {
    const { owner, member, outsider, project } = await scene();
    const created = await createProjectRetrospective(member.id, project.id, input);
    expect(created.status).toBe("draft");

    const listed = await listProjectRetrospectives(owner.id, project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ title: input.title, createdById: member.id, createdByName: "retro-member" });
    await expect(createProjectRetrospective(outsider.id, project.id, input)).rejects.toThrow("没有权限");
    await expect(listProjectRetrospectives(outsider.id, project.id)).rejects.toThrow("没有权限");
  });

  it("只有创建者或组长可以编辑，发布后成员不能修改", async () => {
    const { owner, member, project } = await scene();
    const created = await createProjectRetrospective(member.id, project.id, input);
    await expect(updateProjectRetrospective(owner.id, created.id, { ...input, title: "组长修订" })).resolves.toMatchObject({ title: "组长修订" });
    await expect(updateProjectRetrospective(member.id, created.id, { ...input, title: "成员修订" })).resolves.toMatchObject({ title: "成员修订" });

    await publishProjectRetrospective(owner.id, created.id);
    await expect(updateProjectRetrospective(member.id, created.id, { ...input, title: "发布后修改" })).rejects.toThrow("已发布");
    expect(await db.select().from(projectRetrospectives).where(eq(projectRetrospectives.id, created.id))).toHaveLength(1);
  });

  it("只有组长可以发布，发布操作保持幂等", async () => {
    const { owner, member, project } = await scene();
    const created = await createProjectRetrospective(member.id, project.id, input);
    await expect(publishProjectRetrospective(member.id, created.id)).rejects.toThrow("只有组长");
    const published = await publishProjectRetrospective(owner.id, created.id);
    expect(published.status).toBe("published");
    expect(published.publishedById).toBe(owner.id);
    await expect(publishProjectRetrospective(owner.id, created.id)).resolves.toMatchObject({ status: "published" });
  });
});
