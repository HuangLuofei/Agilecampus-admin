"use client";

import { useActionState } from "react";
import type { ProjectTemplate } from "@/lib/project-template";
import { applyProjectTemplateAction, type TemplateActionState } from "./actions";

type TemplateProject = { id: string; name: string; teamId: string; teamName: string };

export function TemplateCenter({
  templates,
  projects,
}: {
  templates: readonly ProjectTemplate[];
  projects: TemplateProject[];
}) {
  return (
    <div className="space-y-4">
      {projects.length === 0 && (
        <div className="ac-card border-primary/20 bg-primary-soft/30 p-4 text-sm text-ink-soft">
          只有团队组长可以应用模板。请先创建团队项目，或联系所属团队的组长操作。
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} projects={projects} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ template, projects }: { template: ProjectTemplate; projects: TemplateProject[] }) {
  const [state, formAction, pending] = useActionState<TemplateActionState, FormData>(
    applyProjectTemplateAction,
    null,
  );

  return (
    <section className="ac-card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="ac-badge bg-primary-soft text-primary">{template.stages.length} 个阶段</span>
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">{template.name}</h2>
        </div>
        <span aria-hidden className="text-xl text-primary">▤</span>
      </div>
      <p className="mt-2 min-h-12 text-sm leading-6 text-ink-soft">{template.description}</p>
      <ol className="mt-4 space-y-2 border-t border-line pt-4 text-sm text-ink-soft">
        {template.stages.map((stage, index) => (
          <li key={stage.title} className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-medium text-primary">{index + 1}</span>
            <span className="min-w-0"><strong className="font-medium text-ink">{stage.title}</strong><span className="ml-1">· {stage.taskTitle}</span></span>
          </li>
        ))}
      </ol>
      <form action={formAction} className="mt-5 space-y-2 border-t border-line pt-4">
        <input type="hidden" name="templateId" value={template.id} />
        <label className="block text-xs font-medium text-ink-soft" htmlFor={`project-${template.id}`}>应用到项目</label>
        <div className="flex gap-2">
          <select id={`project-${template.id}`} name="projectId" required disabled={projects.length === 0 || pending} className="ac-input min-w-0 flex-1 text-sm">
            <option value="">选择项目</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.teamName} · {project.name}</option>)}
          </select>
          <button type="submit" disabled={projects.length === 0 || pending} className="ac-btn shrink-0 px-3 py-2 text-sm">
            {pending ? "应用中…" : "应用模板"}
          </button>
        </div>
        {state && "error" in state && <p role="alert" className="text-xs text-high">{state.error}</p>}
        {state && "ok" in state && <p role="status" className="text-xs text-done">模板已应用，可前往项目查看流程。</p>}
      </form>
    </section>
  );
}
