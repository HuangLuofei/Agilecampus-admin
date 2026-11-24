import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentComments } from "@/db/schema";
import { createAsset, updateAsset } from "@/lib/asset";
import {
  createDocumentComment,
  deleteDocumentComment,
  listDocumentComments,
  setDocumentCommentResolved,
  updateDocumentComment,
} from "@/lib/document-comments";
import { createDocument } from "@/lib/document";
import { createProject } from "@/lib/project";
import { createTeam, joinTeam } from "@/lib/team";
import { createUser } from "@/lib/user";
import { resetDb } from "./helpers";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

async function scene() {
  const owner = await makeUser("collab-owner@example.com");
  const team = await createTeam(owner.id, "协作小组");
  const member = await makeUser("collab-member@example.com");
  await joinTeam(member.id, team.inviteCode);
  const outsider = await makeUser("collab-outsider@example.com");
  const project = await createProject(owner.id, team.id, { name: "协作文档项目" });
  const document = await createDocument(owner.id, project.id, { title: "设计说明" });
  const asset = await createAsset(owner.id, {
    projectId: project.id,
    name: "设计稿链接",
    assetType: "link",
    url: "https://example.com/design",
  });
  return { owner, member, outsider, project, document, asset };
}

describe("文档讨论", () => {
  beforeEach(resetDb);

  it("成员可以发起、编辑和查看评论，非成员无法访问", async () => {
    const { owner, member, outsider, document } = await scene();
    const comment = await createDocumentComment(member.id, document.id, {
      quote: "需要补充验收条件",
      content: "这里建议增加一个失败场景。",
    });
    expect(comment.content).toContain("失败场景");
    const listed = await listDocumentComments(owner.id, document.id);
    expect(listed[0]).toMatchObject({ authorName: "collab-member", quote: "需要补充验收条件" });
    await expect(listDocumentComments(outsider.id, document.id)).rejects.toThrow("没有权限");
    await expect(createDocumentComment(outsider.id, document.id, { content: "越权" })).rejects.toThrow("没有权限");
  });

  it("评论作者可编辑，组长可标记解决，删除权限受控", async () => {
    const { owner, member, document } = await scene();
    const comment = await createDocumentComment(member.id, document.id, { content: "初始意见" });
    await expect(updateDocumentComment(member.id, comment.id, "更新后的意见")).resolves.toMatchObject({ content: "更新后的意见" });
    await expect(updateDocumentComment(owner.id, comment.id, "组长不能代替作者改评论")).rejects.toThrow("评论作者");
    const resolved = await setDocumentCommentResolved(owner.id, comment.id, true);
    expect(resolved.resolvedById).toBe(owner.id);
    await deleteDocumentComment(owner.id, comment.id);
    expect(await db.select().from(documentComments).where(eq(documentComments.id, comment.id))).toHaveLength(0);
  });
});

describe("文件审阅状态", () => {
  beforeEach(resetDb);

  it("成员可以更新文件审阅状态和说明，状态会保留审阅人", async () => {
    const { member, asset } = await scene();
    const updated = await updateAsset(member.id, asset.id, {
      reviewStatus: "changes_requested",
      reviewNote: "请补充移动端截图",
    });
    expect(updated.reviewStatus).toBe("changes_requested");
    expect(updated.reviewNote).toBe("请补充移动端截图");
    expect(updated.reviewedById).toBe(member.id);
  });

  it("归档文件不能修改审阅状态，取消归档仍可用", async () => {
    const { owner, asset } = await scene();
    await updateAsset(owner.id, asset.id, { isArchived: true });
    await expect(updateAsset(owner.id, asset.id, { reviewStatus: "approved" })).rejects.toThrow("已归档");
    const restored = await updateAsset(owner.id, asset.id, { isArchived: false });
    expect(restored.isArchived).toBe(false);
  });
});
