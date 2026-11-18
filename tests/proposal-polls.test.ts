import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  proposalComments,
  proposalOptions,
  proposalPolls,
  proposalVotes,
  users,
} from "@/db/schema";
import { createUser } from "@/lib/user";
import { createTeam, joinTeam } from "@/lib/team";
import {
  addProposalComment,
  castProposalVote,
  closeProposalPoll,
  createProposalPoll,
  deleteProposalComment,
  deleteProposalPoll,
  listTeamProposalPolls,
} from "@/lib/proposal-poll";
import { resetDb } from "./helpers";

async function makeUser(email: string) {
  return createUser({ email, password: "password123", name: email.split("@")[0] });
}

async function scene() {
  const admin = await makeUser("poll-admin@example.com");
  const creator = await makeUser("poll-creator@example.com");
  const member = await makeUser("poll-member@example.com");
  const outsider = await makeUser("poll-outsider@example.com");
  const team = await createTeam(admin.id, "产品设计组");
  await joinTeam(creator.id, team.inviteCode);
  await joinTeam(member.id, team.inviteCode);
  return { admin, creator, member, outsider, team };
}

describe("群投票与方案评审", () => {
  beforeEach(resetDb);

  it("团队成员可发起和查看选题、设计稿、技术方案投票，非成员无法访问", async () => {
    const { admin, creator, outsider, team } = await scene();
    const created = await createProposalPoll(creator.id, team.id, {
      title: "课程项目最终选题",
      category: "topic",
      description: "按可行性、创新性和课程匹配度比较。",
      referenceUrl: "https://example.com/topics",
      options: [
        { label: "校园闲置交易", description: "需求明确" },
        { label: "学习搭子匹配", description: "用户增长快" },
        { label: "实验室预约助手", description: "场景稳定" },
      ],
    });

    const listed = await listTeamProposalPolls(admin.id, team.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: created.poll.id,
      title: "课程项目最终选题",
      category: "topic",
      creatorName: "poll-creator",
      effectiveOpen: true,
      totalVotes: 0,
    });
    expect(listed[0].options.map((option) => option.label)).toEqual([
      "校园闲置交易",
      "学习搭子匹配",
      "实验室预约助手",
    ]);

    await expect(listTeamProposalPolls(outsider.id, team.id)).rejects.toThrow("没有权限");
    await expect(
      createProposalPoll(outsider.id, team.id, {
        title: "越权投票",
        category: "technical",
        options: [{ label: "A" }, { label: "B" }],
      }),
    ).rejects.toThrow("没有权限");
    await expect(
      createProposalPoll(admin.id, team.id, {
        title: "重复选项",
        category: "design",
        options: [{ label: "方案 A" }, { label: "方案 A" }],
      }),
    ).rejects.toThrow("不能重复");
  });

  it("每位成员只有一票且可改票，评审意见对所有成员可见", async () => {
    const { admin, creator, member, outsider, team } = await scene();
    const created = await createProposalPoll(creator.id, team.id, {
      title: "首页视觉方向",
      category: "design",
      options: [{ label: "信息密度高" }, { label: "留白更充分" }],
    });
    const [dense, spacious] = created.options;

    await expect(castProposalVote(outsider.id, created.poll.id, { optionId: dense.id }))
      .rejects.toThrow("没有权限");
    await expect(addProposalComment(outsider.id, created.poll.id, { content: "越权意见" }))
      .rejects.toThrow("没有权限");
    const anotherPoll = await createProposalPoll(admin.id, team.id, {
      title: "另一项设计投票",
      category: "design",
      options: [{ label: "方案甲" }, { label: "方案乙" }],
    });
    await expect(
      castProposalVote(member.id, created.poll.id, {
        optionId: anotherPoll.options[0].id,
      }),
    ).rejects.toThrow("不属于该投票");

    await castProposalVote(member.id, created.poll.id, { optionId: dense.id });
    let poll = (await listTeamProposalPolls(member.id, team.id))
      .find((item) => item.id === created.poll.id)!;
    expect(poll.totalVotes).toBe(1);
    expect(poll.myOptionId).toBe(dense.id);
    expect(poll.options.map((option) => option.voteCount)).toEqual([1, 0]);

    await castProposalVote(member.id, created.poll.id, { optionId: spacious.id });
    poll = (await listTeamProposalPolls(member.id, team.id))
      .find((item) => item.id === created.poll.id)!;
    expect(poll.totalVotes).toBe(1);
    expect(poll.myOptionId).toBe(spacious.id);
    expect(poll.options.map((option) => option.voteCount)).toEqual([0, 1]);
    expect(await db.select().from(proposalVotes).where(eq(proposalVotes.pollId, created.poll.id)))
      .toHaveLength(1);

    const memberComment = await addProposalComment(member.id, created.poll.id, {
      content: "留白版更符合低年级用户阅读习惯。",
    });
    await addProposalComment(admin.id, created.poll.id, {
      content: "移动端字号需要再核对。",
    });
    poll = (await listTeamProposalPolls(admin.id, team.id))
      .find((item) => item.id === created.poll.id)!;
    expect(poll.comments.map((comment) => comment.authorName)).toEqual([
      "poll-member",
      "poll-admin",
    ]);
    await expect(
      deleteProposalComment(admin.id, memberComment.id),
    ).resolves.toBeUndefined();
  });

  it("只有发起人或组长可结束投票并确认最终方案，结束后停止计票", async () => {
    const { admin, creator, member, team } = await scene();
    const created = await createProposalPoll(creator.id, team.id, {
      title: "后端技术路线",
      category: "technical",
      options: [{ label: "单体 Next.js" }, { label: "前后端分离" }],
    });
    const [monolith, separated] = created.options;
    await castProposalVote(member.id, created.poll.id, { optionId: separated.id });

    await expect(
      closeProposalPoll(member.id, created.poll.id, { finalOptionId: separated.id }),
    ).rejects.toThrow("发起人或组长");

    const closed = await closeProposalPoll(creator.id, created.poll.id, {
      finalOptionId: separated.id,
    });
    expect(closed.status).toBe("closed");
    expect(closed.finalOptionLabel).toBe("前后端分离");
    await expect(
      castProposalVote(admin.id, created.poll.id, { optionId: monolith.id }),
    ).rejects.toThrow("已结束");
    expect((await listTeamProposalPolls(admin.id, team.id))[0]).toMatchObject({
      effectiveOpen: false,
      finalOptionLabel: "前后端分离",
      totalVotes: 1,
    });
  });

  it("截止后不能投票，仍可由组长结束投票；删除投票会级联清理选项、票数和意见", async () => {
    const { admin, member, team } = await scene();
    const created = await createProposalPoll(admin.id, team.id, {
      title: "答辩演示稿风格",
      category: "design",
      closesAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      options: [{ label: "简洁图表" }, { label: "叙事型长图" }],
    });
    const [simple, story] = created.options;
    await castProposalVote(member.id, created.poll.id, { optionId: simple.id });
    await addProposalComment(member.id, created.poll.id, { content: "建议突出关键数据。" });
    await db
      .update(proposalPolls)
      .set({ closesAt: new Date(Date.now() - 60_000) })
      .where(eq(proposalPolls.id, created.poll.id));

    const listed = (await listTeamProposalPolls(admin.id, team.id))[0];
    expect(listed.effectiveOpen).toBe(false);
    await expect(
      castProposalVote(member.id, created.poll.id, { optionId: story.id }),
    ).rejects.toThrow("已截止");

    await closeProposalPoll(admin.id, created.poll.id, { finalOptionId: simple.id });
    await deleteProposalPoll(admin.id, created.poll.id);
    expect(await db.select().from(proposalPolls).where(eq(proposalPolls.id, created.poll.id)))
      .toHaveLength(0);
    expect(await db.select().from(proposalOptions).where(eq(proposalOptions.pollId, created.poll.id)))
      .toHaveLength(0);
    expect(await db.select().from(proposalVotes).where(eq(proposalVotes.pollId, created.poll.id)))
      .toHaveLength(0);
    expect(await db.select().from(proposalComments).where(eq(proposalComments.pollId, created.poll.id)))
      .toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.id, member.id))).toHaveLength(1);
  });
});
