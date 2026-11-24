"use client";

import { useActionState } from "react";
import {
  reviewTaskDeliveryAction,
  submitTaskDeliveryAction,
  type FormState,
} from "./actions";

type Delivery = {
  id: string;
  taskId: string;
  submittedById: string;
  submittedByName: string;
  note: string;
  status: "submitted" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedById: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
};

const statusLabel = {
  submitted: "待审核",
  approved: "已通过",
  rejected: "需修改",
} as const;

export function TaskDeliveryPanel({
  projectId,
  taskId,
  acceptanceCriteria,
  deliveries,
  currentUserId,
  canReview,
}: {
  projectId: string;
  taskId: string;
  acceptanceCriteria: string | null;
  deliveries: Delivery[];
  currentUserId: string;
  canReview: boolean;
}) {
  const latest = deliveries[0];
  const canSubmit = latest?.status !== "submitted" && latest?.status !== "approved";

  return (
    <section className="mt-5 rounded-xl border border-line bg-sunken/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-ink">任务交付与验收</h3>
        {latest && (
          <span className={`ac-badge ${latest.status === "approved" ? "bg-done/15 text-done" : latest.status === "rejected" ? "bg-alert-soft text-alert" : "bg-primary-soft text-primary"}`}>
            {statusLabel[latest.status]}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-ink-soft">验收标准</p>
          <p className="mt-1 whitespace-pre-wrap text-ink-soft">
            {acceptanceCriteria || "暂未设置验收标准"}
          </p>
        </div>

        {canSubmit && <SubmitForm projectId={projectId} taskId={taskId} />}

        {deliveries.length > 0 && (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-medium text-ink-soft">交付历史</p>
            {deliveries.map((delivery) => (
              <DeliveryRow
                key={delivery.id}
                projectId={projectId}
                delivery={delivery}
                canReview={canReview}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SubmitForm({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitTaskDeliveryAction, null);
  return (
    <form action={action} className="space-y-2 rounded-lg border border-line bg-surface p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={taskId} />
      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink-soft">提交交付说明</span>
        <textarea name="note" rows={3} className="ac-field text-sm" placeholder="说明完成内容、测试结果和需要验收的事项" />
      </label>
      {state?.error && <p className="text-xs text-high">{state.error}</p>}
      <button disabled={pending} className="ac-btn px-3 py-2 text-sm">
        {pending ? "提交中…" : "提交交付"}
      </button>
    </form>
  );
}

function DeliveryRow({
  projectId,
  delivery,
  canReview,
  currentUserId,
}: {
  projectId: string;
  delivery: Delivery;
  canReview: boolean;
  currentUserId: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewTaskDeliveryAction, null);
  return (
    <article className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
        <span>{delivery.submittedById === currentUserId ? "我" : delivery.submittedByName} · {formatDate(delivery.submittedAt)}</span>
        <span className="ac-badge bg-sunken text-ink-soft">{statusLabel[delivery.status]}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{delivery.note}</p>
      {delivery.reviewNote && (
        <p className="mt-2 rounded bg-alert-soft px-2 py-1 text-xs text-ink-soft">审核意见：{delivery.reviewNote}</p>
      )}
      {canReview && delivery.status === "submitted" && (
        <form action={action} className="mt-3 space-y-2 border-t border-line pt-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="deliveryId" value={delivery.id} />
          <textarea name="reviewNote" rows={2} className="ac-field text-sm" placeholder="审核意见，退回时必填" />
          {state?.error && <p className="text-xs text-high">{state.error}</p>}
          <div className="flex gap-2">
            <button name="decision" value="approved" disabled={pending} className="ac-btn px-3 py-1.5 text-xs">通过</button>
            <button name="decision" value="rejected" disabled={pending} className="ac-btn-ghost px-3 py-1.5 text-xs">退回修改</button>
          </div>
        </form>
      )}
    </article>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
