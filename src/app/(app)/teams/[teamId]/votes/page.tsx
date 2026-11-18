import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { teams } from "@/db/schema";
import { getTeamMembership } from "@/lib/team";
import { listTeamProposalPolls } from "@/lib/proposal-poll";
import { BackButton } from "@/components/back-button";
import { CreateProposalPollForm, ProposalPollCard } from "./proposal-board";

export default async function TeamVotesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!z.uuid().safeParse(teamId).success) notFound();

  const membership = await getTeamMembership(session.user.id, teamId);
  if (!membership) notFound();

  const [[team], polls] = await Promise.all([
    db.select().from(teams).where(eq(teams.id, teamId)),
    listTeamProposalPolls(session.user.id, teamId),
  ]);
  if (!team) notFound();

  const openPolls = polls.filter((poll) => poll.effectiveOpen);
  const closedPolls = polls.filter((poll) => !poll.effectiveOpen);
  const awaitingMyVote = openPolls.filter((poll) => !poll.myOptionId).length;
  const commentCount = polls.reduce((total, poll) => total + poll.comments.length, 0);

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3">
        <BackButton fallbackHref={`/teams/${teamId}`} label="返回团队" />
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            {team.name} · 群投票与方案评审
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            快速比较选题、设计稿和技术方案。每位成员一票，可在截止前改票，并留下评审依据。
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="投票概览">
        <div className="ac-card p-4">
          <p className="text-xs text-ink-faint">进行中的投票</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {openPolls.length}
          </p>
        </div>
        <div className="ac-card p-4">
          <p className="text-xs text-ink-faint">等待我投票</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-primary">
            {awaitingMyVote}
          </p>
        </div>
        <div className="ac-card p-4">
          <p className="text-xs text-ink-faint">评审意见</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {commentCount}
          </p>
        </div>
      </section>

      <section className="ac-card p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="font-display text-lg font-semibold text-ink">发起群投票</h2>
          <p className="mt-1 text-sm text-ink-soft">
            固定候选方案后发布，团队可以补充比较意见，发起人或组长负责结束投票并确认最终方案。
          </p>
        </div>
        <CreateProposalPollForm teamId={teamId} />
      </section>

      <section className="space-y-3" aria-labelledby="open-polls-heading">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-1 rounded-full bg-primary" />
          <h2 id="open-polls-heading" className="font-display text-lg font-semibold text-ink">
            进行中
          </h2>
          <span className="text-xs text-ink-faint">{openPolls.length}</span>
        </div>
        {openPolls.length > 0 ? (
          <div className="space-y-4">
            {openPolls.map((poll) => (
              <ProposalPollCard
                key={poll.id}
                poll={poll}
                currentUserId={session.user.id}
                canManage={poll.createdById === session.user.id || membership.role === "admin"}
              />
            ))}
          </div>
        ) : (
          <div className="ac-card p-8 text-center text-sm text-ink-faint">
            当前没有进行中的投票。选择一个需要团队共同决定的方案发起评审吧。
          </div>
        )}
      </section>

      {closedPolls.length > 0 && (
        <section className="space-y-3" aria-labelledby="closed-polls-heading">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-4 w-1 rounded-full bg-low" />
            <h2 id="closed-polls-heading" className="font-display text-lg font-semibold text-ink">
              已结束
            </h2>
            <span className="text-xs text-ink-faint">{closedPolls.length}</span>
          </div>
          <div className="space-y-4">
            {closedPolls.map((poll) => (
              <ProposalPollCard
                key={poll.id}
                poll={poll}
                currentUserId={session.user.id}
                canManage={poll.createdById === session.user.id || membership.role === "admin"}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
