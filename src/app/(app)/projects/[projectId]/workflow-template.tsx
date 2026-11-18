"use client";

import { useActionState } from "react";
import { createGroupAssignmentTemplateAction, type FormState } from "./actions";

export function WorkflowTemplate({ projectId, canApply }: { projectId: string; canApply: boolean }) {
  const [state, formAction, pending] = useActionState<FormState | { ok: true }, FormData>(
    createGroupAssignmentTemplateAction,
    null,
  );

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-ink">小组作业模板</h2>
          <p className="mt-1 text-sm text-ink-soft">一键建立选题、分工、调研、制作、答辩阶段和起步任务。</p>
        </div>
        {canApply && (
          <form action={formAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <button disabled={pending} className="ac-btn px-3 py-2 text-sm">
              {pending ? "正在创建…" : "应用模板"}
            </button>
          </form>
        )}
      </div>
      {state && "error" in state && <p role="alert" className="text-sm text-high">{state.error}</p>}
      {state && "ok" in state && <p role="status" className="text-sm text-done">流程和起步任务已创建。</p>}
    </section>
  );
}
