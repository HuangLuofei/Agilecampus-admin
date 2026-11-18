import Link from "next/link";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/project";
import { getDocument, getDocumentVersion } from "@/lib/document";
import { MarkdownBody } from "../../../markdown";
import { restoreDocumentVersionAction } from "../../../actions";
import { BackButton } from "@/components/back-button";
import { scopedHref } from "@/lib/workbench-navigation";

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function DocVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; documentId: string; versionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId, documentId, versionId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (
    !z.uuid().safeParse(projectId).success ||
    !z.uuid().safeParse(documentId).success ||
    !z.uuid().safeParse(versionId).success
  )
    notFound();

  const access = await getProjectForUser(session.user.id, projectId);
  if (!access) notFound();
  const sp = await searchParams;
  const teamId = sp.team === access.project.teamId ? access.project.teamId : null;

  const doc = await getDocument(session.user.id, documentId);
  if (!doc || doc.projectId !== projectId) notFound();

  const version = await getDocumentVersion(session.user.id, documentId, versionId);
  if (!version) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <BackButton
          fallbackHref={scopedHref(`/projects/${projectId}/docs/${documentId}/history`, teamId)}
          label="返回历史"
        />
        <Link href={scopedHref("/projects", teamId)} className="text-sm text-primary">
          返回工作台
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-ink">
              版本 {version.versionNumber}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              {version.category && (
                <span className="ac-badge bg-primary-soft text-primary">{version.category}</span>
              )}
              {version.note && (
                <span className="ac-badge bg-sunken text-ink-soft">{version.note}</span>
              )}
              <span>
                {version.authorName ?? "已注销成员"} · {fmtTime(version.createdAt)}
              </span>
            </p>
          </div>
          <form action={restoreDocumentVersionAction} className="shrink-0">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="versionId" value={versionId} />
            {teamId && <input type="hidden" name="team" value={teamId} />}
            <button className="ac-btn">恢复此版本</button>
          </form>
        </div>
        <p className="text-sm text-ink-soft">
          文档《{doc.title}》的历史版本（只读）。恢复后将以该版本内容生成一个新版本，保留完整历史。
        </p>
      </header>

      <article className="ac-card p-6">
        {version.content.trim() ? (
          <MarkdownBody content={version.content} />
        ) : (
          <p className="text-sm text-ink-faint">（该版本为空）</p>
        )}
      </article>
    </main>
  );
}
