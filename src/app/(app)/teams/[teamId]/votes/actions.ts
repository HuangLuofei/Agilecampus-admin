"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  addProposalComment,
  castProposalVoteSchema,
  castProposalVote,
  closeProposalPollSchema,
  closeProposalPoll,
  createProposalPollSchema,
  createProposalPoll,
  deleteProposalComment,
  deleteProposalPoll,
  getProposalCommentPollId,
  getProposalPollTeamId,
  proposalCommentSchema,
} from "@/lib/proposal-poll";

export type ProposalActionState =
  | { error: string }
  | { ok: true; message?: string }
  | null;

function formError(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请重试";
}

function parseOptions(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") throw new AppError("请检查投票选项");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AppError("请检查投票选项");
  }
}

export async function createProposalPollAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };

  const teamId = z.uuid().safeParse(formData.get("teamId"));
  if (!teamId.success) return { error: "团队参数无效" };

  let options: unknown;
  try {
    options = parseOptions(formData.get("options"));
  } catch (error) {
    return { error: formError(error) };
  }
  const parsed = createProposalPollSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || "",
    referenceUrl: formData.get("referenceUrl") || "",
    closesAt: formData.get("closesAt") || null,
    options,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "请检查投票内容" };

  try {
    await createProposalPoll(session.user.id, teamId.data, parsed.data);
    revalidatePath(`/teams/${teamId.data}/votes`);
    revalidatePath(`/teams/${teamId.data}`);
    return { ok: true, message: "投票已发布" };
  } catch (error) {
    return { error: formError(error) };
  }
}

export async function castProposalVoteAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const pollId = z.uuid().safeParse(formData.get("pollId"));
  if (!pollId.success) return { error: "投票参数无效" };
  const parsed = castProposalVoteSchema.safeParse({ optionId: formData.get("optionId") });
  if (!parsed.success) return { error: "请选择有效选项" };

  try {
    const teamId = await getProposalPollTeamId(pollId.data);
    await castProposalVote(session.user.id, pollId.data, parsed.data);
    revalidatePath(`/teams/${teamId}/votes`);
    return { ok: true, message: "已记录选择" };
  } catch (error) {
    return { error: formError(error) };
  }
}

export async function closeProposalPollAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const pollId = z.uuid().safeParse(formData.get("pollId"));
  if (!pollId.success) return { error: "投票参数无效" };
  const parsed = closeProposalPollSchema.safeParse({
    finalOptionId: formData.get("finalOptionId") || null,
  });
  if (!parsed.success) return { error: "请选择最终方案" };

  try {
    const teamId = await getProposalPollTeamId(pollId.data);
    await closeProposalPoll(session.user.id, pollId.data, parsed.data);
    revalidatePath(`/teams/${teamId}/votes`);
    revalidatePath(`/teams/${teamId}`);
    return { ok: true, message: "投票已结束" };
  } catch (error) {
    return { error: formError(error) };
  }
}

export async function addProposalCommentAction(
  _prev: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const pollId = z.uuid().safeParse(formData.get("pollId"));
  if (!pollId.success) return { error: "投票参数无效" };
  const parsed = proposalCommentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "请填写评审意见" };

  try {
    const teamId = await getProposalPollTeamId(pollId.data);
    await addProposalComment(session.user.id, pollId.data, parsed.data);
    revalidatePath(`/teams/${teamId}/votes`);
    return { ok: true, message: "评审意见已发布" };
  } catch (error) {
    return { error: formError(error) };
  }
}

export async function deleteProposalPollAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new AppError("请先登录");
  const pollId = z.uuid().safeParse(formData.get("pollId"));
  if (!pollId.success) throw new AppError("投票参数无效");
  const teamId = await getProposalPollTeamId(pollId.data);
  await deleteProposalPoll(session.user.id, pollId.data);
  revalidatePath(`/teams/${teamId}/votes`);
  revalidatePath(`/teams/${teamId}`);
}

export async function deleteProposalCommentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new AppError("请先登录");
  const commentId = z.uuid().safeParse(formData.get("commentId"));
  if (!commentId.success) throw new AppError("评审意见参数无效");
  const pollId = await getProposalCommentPollId(commentId.data);
  const teamId = await getProposalPollTeamId(pollId);
  await deleteProposalComment(session.user.id, commentId.data);
  revalidatePath(`/teams/${teamId}/votes`);
}
