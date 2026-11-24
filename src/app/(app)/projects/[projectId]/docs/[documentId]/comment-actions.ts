"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  createDocumentComment,
  deleteDocumentComment,
  setDocumentCommentResolved,
  updateDocumentComment,
} from "@/lib/document-comments";
import { scopedHref } from "@/lib/workbench-navigation";

export type CommentFormState = { error: string } | null;

const baseSchema = z.object({
  projectId: z.uuid(),
  documentId: z.uuid(),
  team: z.uuid().optional(),
});

function redirectBack(projectId: string, documentId: string, team?: string): never {
  revalidatePath(`/projects/${projectId}/docs/${documentId}`);
  redirect(scopedHref(`/projects/${projectId}/docs/${documentId}`, team));
}

export async function createDocumentCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const parsed = baseSchema
    .extend({ content: z.string(), quote: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "评论参数无效" };
  try {
    await createDocumentComment(session.user.id, parsed.data.documentId, {
      content: parsed.data.content,
      quote: parsed.data.quote,
    });
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AppError) return { error: error.message };
    throw error;
  }
  redirectBack(parsed.data.projectId, parsed.data.documentId, parsed.data.team);
}

export async function updateDocumentCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };
  const parsed = baseSchema
    .extend({ commentId: z.uuid(), content: z.string() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "评论参数无效" };
  try {
    await updateDocumentComment(session.user.id, parsed.data.commentId, parsed.data.content);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof AppError) return { error: error.message };
    throw error;
  }
  redirectBack(parsed.data.projectId, parsed.data.documentId, parsed.data.team);
}

export async function deleteDocumentCommentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new AppError("请先登录");
  const parsed = baseSchema.extend({ commentId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new AppError("评论参数无效");
  await deleteDocumentComment(session.user.id, parsed.data.commentId);
  redirectBack(parsed.data.projectId, parsed.data.documentId, parsed.data.team);
}

export async function resolveDocumentCommentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new AppError("请先登录");
  const parsed = baseSchema
    .extend({ commentId: z.uuid(), resolved: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new AppError("评论参数无效");
  await setDocumentCommentResolved(session.user.id, parsed.data.commentId, parsed.data.resolved === "true");
  redirectBack(parsed.data.projectId, parsed.data.documentId, parsed.data.team);
}
