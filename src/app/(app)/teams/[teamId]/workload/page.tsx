import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { displayRole } from "@/lib/team-permissions";
import { listTeamWorkload } from "@/lib/team-workload";
import { getTeamMembership } from "@/lib/team";

const LEVEL_STYLE = {
  较空闲: "bg-done/12 text-done",
  适中: "bg-primary/10 text-primary",
  较忙: "bg-high/12 text-high",
} as const;

export default async function TeamWorkloadPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!z.uuid().safeParse(teamId).success) notFound();
  const membership = await getTeamMembership(session.user.id, teamId);
  if (!membership) notFound();

  const workload = await listTeamWorkload(session.user.id, teamId);
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <Link href={`/teams/${teamId}`} className="text-sm text-primary">返回小组</Link>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">成员工作量</h1>
            <p className="mt-1 text-sm text-ink-faint">{displayRole(membership.role)} · 统计进行中项目的未完成任务</p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-ink">团队成员</h2>
          <p className="text-xs text-ink-faint">多人任务计入每位负责人；忙闲程度按任务数粗略估算</p>
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead className="border-b border-line bg-sunken/60 text-xs text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">成员</th>
                <th scope="col" className="px-4 py-3 font-medium">未完成任务</th>
                <th scope="col" className="px-4 py-3 font-medium">逾期任务</th>
                <th scope="col" className="px-4 py-3 font-medium">当前负载</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {workload.map((member) => (
                <tr key={member.id}>
                  <th scope="row" className="px-4 py-3 font-medium text-ink">{member.name}</th>
                  <td className="px-4 py-3 tabular-nums text-ink">{member.openTaskCount}</td>
                  <td className={`px-4 py-3 tabular-nums ${member.overdueTaskCount > 0 ? "font-medium text-high" : "text-ink-soft"}`}>
                    {member.overdueTaskCount}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`ac-badge ${LEVEL_STYLE[member.level]}`}>{member.level}</span>
                  </td>
                </tr>
              ))}
              {workload.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-faint">暂无团队成员</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
