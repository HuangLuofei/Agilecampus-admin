import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/project";
import { isTeamLead } from "@/lib/team-permissions";
import { listProjectRetrospectives } from "@/lib/project-retrospective";
import { BackButton } from "@/components/back-button";
import { RetrospectiveForm } from "./retrospective-form";
import { RetrospectiveControls } from "./retrospective-controls";

const STATUS_LABEL = { draft: "草稿", published: "已发布" } as const;

export default async function ProjectRetrospectivePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!z.uuid().safeParse(projectId).success) notFound();

  const access = await getProjectForUser(session.user.id, projectId);
  if (!access) notFound();
  const retrospectives = await listProjectRetrospectives(session.user.id, projectId);
  const isLead = isTeamLead(access.role);

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref={`/projects/${projectId}`} />
          <Link href={`/projects/${projectId}`} className="text-sm text-primary">返回项目</Link>
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{access.project.name} · 项目复盘</h1>
          <p className="mt-1 text-sm text-ink-soft">记录项目成果、协作问题和后续改进，让下一次项目有可复用的经验。</p>
        </div>
      </header>

      <RetrospectiveForm projectId={projectId} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-ink">历史复盘（{retrospectives.length}）</h2>
          <span className="text-xs text-ink-faint">草稿仅供团队成员协作，发布后作为正式记录留档</span>
        </div>
        {retrospectives.length === 0 ? (
          <div className="ac-card p-8 text-center text-sm text-ink-soft">还没有复盘记录，完成一次项目阶段后就可以开始总结。</div>
        ) : (
          <ul className="space-y-4">
            {retrospectives.map((retrospective) => {
              const canEdit = isLead || (retrospective.status === "draft" && retrospective.createdById === session.user.id);
              return (
                <li key={retrospective.id} className="ac-card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">{retrospective.title}</h3>
                        <span className={`ac-badge ${retrospective.status === "published" ? "bg-primary-soft text-primary" : "bg-low-soft text-low"}`}>
                          {STATUS_LABEL[retrospective.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        创建者：{retrospective.createdByName ?? "已退出成员"} · {retrospective.createdAt.toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    {isLead && retrospective.status === "draft" && (
                      <RetrospectiveControls projectId={projectId} retrospectiveId={retrospective.id} />
                    )}
                  </div>
                  <RetrospectiveContent retrospective={retrospective} />
                  {canEdit && (
                    <details className="border-t border-line pt-3">
                      <summary className="cursor-pointer text-sm text-primary">编辑这份复盘</summary>
                      <div className="mt-3">
                        <RetrospectiveForm
                          projectId={projectId}
                          compact
                          initial={{
                            id: retrospective.id,
                            title: retrospective.title,
                            summary: retrospective.summary,
                            wentWell: retrospective.wentWell,
                            challenges: retrospective.challenges,
                            lessons: retrospective.lessons,
                            nextSteps: retrospective.nextSteps,
                          }}
                        />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function RetrospectiveContent({ retrospective }: { retrospective: Awaited<ReturnType<typeof listProjectRetrospectives>>[number] }) {
  const fields = [
    ["项目总结", retrospective.summary],
    ["做得好的地方", retrospective.wentWell],
    ["遇到的问题", retrospective.challenges],
    ["经验教训", retrospective.lessons],
    ["后续行动", retrospective.nextSteps],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map(([label, content]) => (
        <section key={label} className="rounded-field bg-surface-soft p-3">
          <h4 className="text-sm font-medium text-ink">{label}</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{content || "暂未填写"}</p>
        </section>
      ))}
    </div>
  );
}
