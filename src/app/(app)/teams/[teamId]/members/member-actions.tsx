"use client";

import { useActionState } from "react";
import {
  leaveTeamAction,
  removeMemberAction,
  type MemberActionState,
} from "./actions";

export function RemoveMemberButton({
  teamId,
  userId,
  name,
}: {
  teamId: string;
  userId: string;
  name: string;
}) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(removeMemberAction, null);
  return (
    <div className="flex items-center gap-2">
      <form
        action={action}
        onSubmit={(event) => {
          if (!confirm(`确认将「${name}」移出小组？`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="teamId" value={teamId} />
        <input type="hidden" name="userId" value={userId} />
        <button disabled={pending} className="ac-btn-ghost px-2 py-1 text-xs text-high">
          {pending ? "处理中…" : "移出小组"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-high">{state.error}</span>}
    </div>
  );
}

export function LeaveTeamButton({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState<MemberActionState, FormData>(leaveTeamAction, null);
  return (
    <div className="flex items-center justify-end gap-2">
      <form
        action={action}
        onSubmit={(event) => {
          if (!confirm("确认退出这个小组？退出后需要重新申请才能加入。")) event.preventDefault();
        }}
      >
        <input type="hidden" name="teamId" value={teamId} />
        <button disabled={pending} className="ac-btn-ghost px-2 py-1 text-xs text-high">
          {pending ? "处理中…" : "退出小组"}
        </button>
      </form>
      {state?.error && <span className="text-xs text-high">{state.error}</span>}
    </div>
  );
}
