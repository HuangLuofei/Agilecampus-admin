import Link from "next/link";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProjectForUser } from "@/lib/project";
import { getDocument, listDocumentVersions } from "@/lib/document";
import { BackButton } from "@/components/back-button";
import { scopedHref } from "@/lib/workbench-navigation";

function fmtTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function DocHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId, documentId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(documentId).success)
    notFound();

  const access = await getProjectForUser(session.user.id, projectId);
  if (!access) notFound();
  const sp = await searchParams;
  const teamId = sp.team === access.project.teamId ? access.project.teamId : null;

  const doc = await getDocument(session.user.id, documentId);
  if (!doc || doc.projectId !== projectId) notFound();

  const versions = await listDocumentVersions(session.user.id, documentId);

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <BackButton
          fallbackHref={scopedHref(`/projects/${projectId}/docs/${documentId}`, teamId)}
          label="返回文档"
        />
        <Link href={scopedHref("/projects", teamId)} className="text-sm text-primary">
          返回工作台
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">版本历史</h1>
        <p className="text-sm text-ink-soft">
          文档《{doc.title}》的修改记录，共 {versions.length} 个版本。
        </p>
      </header>

      <section>
        {versions.length === 0 ? (
          <div className="ac-card p-8 text-center text-sm text-ink-soft">暂无版本记录。</div>
        ) : (
          <ol className="space-y-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={scopedHref(
                    `/projects/${projectId}/docs/${documentId}/history/${v.id}`,
                    teamId,
                  )}
                  className="ac-card flex items-center justify-between gap-4 p-4 transition-colors hover:border-primary"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">版本 {v.versionNumber}</span>
                      {v.note && (
                        <span className="ac-badge bg-sunken text-ink-soft">{v.note}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {v.authorName ?? "已注销成员"} · {fmtTime(v.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
