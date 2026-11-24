"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(changePasswordAction, null);

  return (
    <form action={formAction} className="ac-card space-y-4 p-5">
      <div>
        <h2 className="font-display text-base font-semibold text-ink">修改密码</h2>
        <p className="mt-1 text-sm text-ink-soft">修改后，下次登录请使用新密码。新密码长度为 8 至 64 位。</p>
      </div>
      <label className="block space-y-1.5 text-sm text-ink-soft">
        <span>当前密码</span>
        <input name="currentPassword" type="password" autoComplete="current-password" required className="ac-field" />
      </label>
      <label className="block space-y-1.5 text-sm text-ink-soft">
        <span>新密码</span>
        <input name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={64} required className="ac-field" />
      </label>
      <label className="block space-y-1.5 text-sm text-ink-soft">
        <span>确认新密码</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={64} required className="ac-field" />
      </label>
      {state && "error" in state && <p role="alert" className="text-sm text-high">{state.error}</p>}
      {state && "ok" in state && <p role="status" className="text-sm text-done">密码已更新。</p>}
      <button type="submit" disabled={pending} className="ac-btn">
        {pending ? "正在更新…" : "更新密码"}
      </button>
    </form>
  );
}
