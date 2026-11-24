import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listMyTeamsWithProjects } from "@/lib/project";
import { PROJECT_TEMPLATES } from "@/lib/project-template";
import { TemplateCenter } from "./template-center";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const teams = await listMyTeamsWithProjects(session.user.id);
  const adminProjects = teams
    .filter((team) => team.role === "admin")
    .flatMap((team) => team.projects.map((project) => ({
      ...project,
      teamId: team.id,
      teamName: team.name,
    })));

  return (
    <main className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">项目模板中心</h1>
        <p className="mt-1 text-sm text-ink-faint">选择一套经过整理的项目流程，快速建立里程碑、起步任务和验收标准。</p>
      </div>
      <TemplateCenter
        templates={PROJECT_TEMPLATES}
        projects={adminProjects}
      />
    </main>
  );
}
