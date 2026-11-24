"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError, ForbiddenError } from "@/lib/errors";
import { applyProjectTemplate } from "@/lib/project-template";

export type TemplateActionState = { error: string } | { ok: true; templateName: string } | null;

const schema = z.object({
  projectId: z.uuid("项目参数无效"),
  templateId: z.string().trim().min(1, "模板参数无效"),
});

export async function applyProjectTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const session = await auth();
  if (!session?.user) return { error: "请先登录" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "参数无效" };

  try {
    await applyProjectTemplate(session.user.id, parsed.data.projectId, parsed.data.templateId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: "仅团队组长可以应用项目模板" };
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath("/templates");
  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath("/", "layout");
  return { ok: true, templateName: parsed.data.templateId };
}
