"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

export type PasswordState = { error: string } | { ok: true } | null;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "请输入当前密码"),
  newPassword: z.string().min(8, "新密码至少 8 位").max(64, "新密码最长 64 位"),
  confirmPassword: z.string().min(1, "请再次输入新密码"),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "两次输入的新密码不一致",
  path: ["confirmPassword"],
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: "新密码不能与当前密码相同",
  path: ["newPassword"],
});

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "登录状态已失效，请重新登录" };

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [user] = await db.select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id));
  if (!user) return { error: "账号不存在，请重新登录" };

  const currentPasswordMatches = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!currentPasswordMatches) return { error: "当前密码不正确" };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, session.user.id));

  return { ok: true };
}
