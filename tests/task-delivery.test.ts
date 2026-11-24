import { beforeEach, describe, expect, it } from "vitest";
import { createUser } from "@/lib/user";
import { createTeam, joinTeam } from "@/lib/team";
import { createProject } from "@/lib/project";
import { createTask } from "@/lib/task";
import {
  listTaskDeliveries,
  reviewTaskDelivery,
  submitTaskDelivery,
} from "@/lib/task-delivery";
import { ForbiddenError } from "@/lib/errors";
import { resetDb } from "./helpers";

async function scene() {
  const owner = await createUser({ email: "delivery-owner@example.com", password: "password123", name: "组长" });
  const team = await createTeam(owner.id, "交付测试组");
  const student = await createUser({ email: "delivery-student@example.com", password: "password123", name: "负责人" });
  await joinTeam(student.id, team.inviteCode);
  const other = await createUser({ email: "delivery-other@example.com", password: "password123", name: "成员" });
  await joinTeam(other.id, team.inviteCode);
  const project = await createProject(owner.id, team.id, { name: "交付项目" });
  const task = await createTask(student.id, project.id, {
    title: "准备报告",
    assigneeId: student.id,
    acceptanceCriteria: "完成报告并上传 PDF",
  });
  return { owner, student, other, task };
}

describe("任务交付与验收", () => {
  beforeEach(resetDb);

  it("负责人可提交，组长可通过并保留历史", async () => {
    const { owner, student, other, task } = await scene();
    await expect(submitTaskDelivery(other.id, task.id, "代提交")).rejects.toBeInstanceOf(ForbiddenError);
    const created = await submitTaskDelivery(student.id, task.id, "已完成报告并上传 PDF");
    expect(created.status).toBe("submitted");

    const approved = await reviewTaskDelivery(owner.id, created.id, "approved");
    expect(approved.status).toBe("approved");
    expect((await listTaskDeliveries(student.id, task.id))).toHaveLength(1);
  });

  it("退回必须有意见，退回后允许再次提交", async () => {
    const { owner, student, task } = await scene();
    const first = await submitTaskDelivery(student.id, task.id, "初版报告");
    await expect(reviewTaskDelivery(owner.id, first.id, "rejected")).rejects.toThrow("审核意见");
    const rejected = await reviewTaskDelivery(owner.id, first.id, "rejected", "请补充数据来源");
    expect(rejected.status).toBe("rejected");

    const second = await submitTaskDelivery(student.id, task.id, "已补充数据来源");
    expect(second.status).toBe("submitted");
    await expect(reviewTaskDelivery(owner.id, first.id, "approved")).rejects.toThrow("已经审核过");
  });
});
