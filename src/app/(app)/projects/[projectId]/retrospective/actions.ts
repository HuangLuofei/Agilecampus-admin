"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  createProjectRetrospective,
  publishProjectRetrospective,
  updateProjectRetrospective,
} from "@/lib/project-retrospective";

export type RetrospectiveFormState = { error: string } | null;

const inputSchema = z.object({
  projectId: z.uuid("项目参数无效"),
  retrospectiveId: z.uuid("复盘参数无效").optional(),
  title: z.string().trim().min(1, "请填写复盘标题").max(120, "标题不能超过 120 个字"),
  summary: z.string().trim().max(10000, "项目总结不能超过 10000 字"),
  wentWell: z.string().trim().max(10000, "做得好的地方不能超过 10000 字"),
  challenges: z.string().trim().max(10000, "遇到的问题不能超过 10000 字"),
  lessons: z.string().trim().max(10000, "经验教训不能超过 10000 字"),
  nextSteps: z.string().trim().max(10000, "后续行动不能超过 10000 字"),
});

function readInput(formData: FormData) {
  return inputSchema.safeParse({
    projectId: formData.get("projectId"),
    retrospectiveId: formData.get("retrospectiveId") || undefined,
    title: formData.get("title"),
    summary: formData.get("summary") ?? "",
    wentWell: formData.get("wentWell") ?? "",
    challenges: formData.get("challenges") ?? "",
    lessons: formData.get("lessons") ?? "",
    nextSteps: formData.get("nextSteps") ?? "",
  });
}

export async function saveRetrospectiveAction(
  _prev: RetrospectiveFormState,
  formData: FormData,
): Promise<RetrospectiveFormState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const parsed = readInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "请检查填写内容" };

  const { projectId, retrospectiveId, ...input } = parsed.data;
  try {
    if (retrospectiveId) {
      await updateProjectRetrospective(session.user.id, retrospectiveId, input);
    } else {
      await createProjectRetrospective(session.user.id, projectId, input);
    }
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/projects/${projectId}/retrospective`);
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/retrospective`);
}

export async function publishRetrospectiveAction(
  _prev: RetrospectiveFormState,
  formData: FormData,
): Promise<RetrospectiveFormState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const parsed = z
    .object({ projectId: z.uuid("项目参数无效"), retrospectiveId: z.uuid("复盘参数无效") })
    .safeParse({
      projectId: formData.get("projectId"),
      retrospectiveId: formData.get("retrospectiveId"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "参数无效" };

  try {
    await publishProjectRetrospective(session.user.id, parsed.data.retrospectiveId);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/projects/${parsed.data.projectId}/retrospective`);
  revalidatePath(`/projects/${parsed.data.projectId}`);
  redirect(`/projects/${parsed.data.projectId}/retrospective`);
}
