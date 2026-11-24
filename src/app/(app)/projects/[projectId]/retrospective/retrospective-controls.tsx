"use client";

import { useActionState } from "react";
import { publishRetrospectiveAction, type RetrospectiveFormState } from "./actions";

export function RetrospectiveControls({ projectId, retrospectiveId }: { projectId: string; retrospectiveId: string }) {
  const [state, formAction, pending] = useActionState<RetrospectiveFormState, FormData>(
    publishRetrospectiveAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="retrospectiveId" value={retrospectiveId} />
      <button
        disabled={pending}
        className="ac-btn px-3 py-2 text-sm"
        onClick={(event) => {
          if (!confirm("确认发布这份项目复盘？发布后团队成员都可以查看。")) event.preventDefault();
        }}
      >
        {pending ? "发布中…" : "发布复盘"}
      </button>
      {state && "error" in state && <p role="alert" className="text-xs text-high">{state.error}</p>}
    </form>
  );
}
