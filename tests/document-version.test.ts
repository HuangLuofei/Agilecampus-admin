import { describe, it, expect, beforeEach } from "vitest";
import { createUser } from "@/lib/user";
import { createTeam, joinTeam } from "@/lib/team";
import { createProject } from "@/lib/project";
import {
  createDocument,
  updateDocument,
  getDocument,
  listDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
} from "@/lib/document";
import { resetDb } from "./helpers";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

async function scene() {
  const owner = await makeUser("owner@example.com");
  const team = await createTeam(owner.id, "东吴实验室");
  const student = await makeUser("student@example.com");
  await joinTeam(student.id, team.inviteCode);
  const outsider = await makeUser("outsider@example.com");
  const project = await createProject(owner.id, team.id, { name: "项目A" });
  return { owner, team, project, student, outsider };
}

describe("版本快照", () => {
  beforeEach(resetDb);

  it("创建文档即写入版本 1", async () => {
    const { student, project } = await scene();
    const doc = await createDocument(student.id, project.id, {
      title: "需求文档",
      content: "# 初始",
      category: "需求",
    });
    const versions = await listDocumentVersions(student.id, doc.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].authorName).toBe("student");
    expect(versions[0].title).toBe("需求文档");
  });

  it("编辑后生成新版本且编号递增、作者更新", async () => {
    const { student, owner, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "旧" });
    await updateDocument(owner.id, doc.id, { content: "第二版" });

    const versions = await listDocumentVersions(owner.id, doc.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(2); // 最新在前
    expect(versions[0].authorName).toBe("owner");
    expect(versions[1].versionNumber).toBe(1);
  });

  it("内容无变化不产生新版本（去重）", async () => {
    const { student, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "同", content: "不变" });
    await updateDocument(student.id, doc.id, { content: "不变" });

    const versions = await listDocumentVersions(student.id, doc.id);
    expect(versions).toHaveLength(1);
  });
});

describe("查看版本 / 权限", () => {
  beforeEach(resetDb);

  it("getDocumentVersion 返回版本正文", async () => {
    const { student, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "T", content: "初" });
    await updateDocument(student.id, doc.id, { content: "改" });
    const versions = await listDocumentVersions(student.id, doc.id);

    const v1 = await getDocumentVersion(student.id, doc.id, versions[1].id);
    expect(v1?.versionNumber).toBe(1);
    expect(v1?.content).toBe("初");
  });

  it("非成员查看被拒", async () => {
    const { student, outsider, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "私密" });
    const versions = await listDocumentVersions(student.id, doc.id);

    await expect(listDocumentVersions(outsider.id, doc.id)).rejects.toThrow("没有权限");
    expect(await getDocumentVersion(outsider.id, doc.id, versions[0].id)).toBeNull();
  });
});

describe("恢复旧版本", () => {
  beforeEach(resetDb);

  it("恢复生成新版本并覆盖当前内容，历史保留", async () => {
    const { student, owner, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "T", content: "第一版" });
    await updateDocument(student.id, doc.id, { content: "第二版" });
    await updateDocument(student.id, doc.id, { content: "第三版" });

    const before = await listDocumentVersions(student.id, doc.id);
    const v1 = before.find((v) => v.versionNumber === 1)!;

    await restoreDocumentVersion(owner.id, doc.id, v1.id);

    // 当前文档内容回退，更新者=恢复者
    const current = await getDocument(student.id, doc.id);
    expect(current?.content).toBe("第一版");
    expect(current?.updatedById).toBe(owner.id);

    // 历史 4 个版本：1、2、3 + 恢复出来的新版本
    const versions = await listDocumentVersions(student.id, doc.id);
    expect(versions).toHaveLength(4);
    expect(versions[0].versionNumber).toBe(4);
    expect(versions[0].authorName).toBe("owner");
    expect(versions[0].note).toBe("恢复自版本 1");

    const restoredVersion = await getDocumentVersion(student.id, doc.id, versions[0].id);
    expect(restoredVersion?.content).toBe("第一版");
  });

  it("非成员恢复被拒", async () => {
    const { student, outsider, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "T", content: "A" });
    const versions = await listDocumentVersions(student.id, doc.id);
    await expect(
      restoreDocumentVersion(outsider.id, doc.id, versions[0].id),
    ).rejects.toThrow("没有权限");
  });

  it("恢复不存在的版本报错", async () => {
    const { student, project } = await scene();
    const doc = await createDocument(student.id, project.id, { title: "T" });
    await expect(
      restoreDocumentVersion(student.id, doc.id, crypto.randomUUID()),
    ).rejects.toThrow("版本不存在");
  });
});
