import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PasswordForm } from "./password-form";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [account] = await db.select({ email: users.email, studentId: users.studentId })
    .from(users)
    .where(eq(users.id, session.user.id));

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-ink">账号安全</h1>
        <p className="text-sm text-ink-soft">查看登录账号并管理密码。</p>
      </header>

      <section className="ac-card space-y-4 p-5">
        <h2 className="font-display text-base font-semibold text-ink">登录方式</h2>
        <dl className="divide-y divide-line text-sm">
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="text-ink-faint">邮箱</dt>
            <dd className="break-all text-ink">{account?.email ?? session.user.email ?? "未设置"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2 py-3">
            <dt className="text-ink-faint">学号登录</dt>
            <dd className="text-ink">{account?.studentId ?? "尚未设置"}</dd>
          </div>
        </dl>
        <p className="text-xs leading-5 text-ink-faint">邮箱和学号可用于登录。学号可在个人资料页面补充或修改。</p>
      </section>

      <PasswordForm />
    </main>
  );
}
