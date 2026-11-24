"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { applyToJoinTeam, resolveInviteToken } from "@/lib/team";
import { AppError } from "@/lib/errors";

export type FormState = { error: string; success: string } | null;

const schema = z.object({
  teamId: z.uuid(),
  inviteToken: z.string().min(1).max(128),
  projectId: z.union([z.literal(""), z.uuid()]).optional(),
});

export async function applyJoinAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录", success: "" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, success: "" };

  try {
    const invite = await resolveInviteToken(parsed.data.inviteToken);
    if (!invite || invite.team.id !== parsed.data.teamId) {
      return { error: "邀请链接已失效，请重新获取邀请链接。", success: "" };
    }
    if (invite.link.projectId && parsed.data.projectId !== invite.link.projectId) {
      return { error: "请通过该邀请链接指定的项目加入。", success: "" };
    }
    await applyToJoinTeam(
      session.user.id,
      parsed.data.teamId,
      parsed.data.projectId ? parsed.data.projectId : null,
    );
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, success: "" };
    throw e;
  }
  revalidatePath("/teams");
  return { error: "", success: "申请已提交，请等待组长审核。" };
}
