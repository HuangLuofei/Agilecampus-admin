"use client";

import { useActionState } from "react";
import { saveRetrospectiveAction, type RetrospectiveFormState } from "./actions";

type RetrospectiveValues = {
  id?: string;
  title: string;
  summary: string;
  wentWell: string;
  challenges: string;
  lessons: string;
  nextSteps: string;
};

export function RetrospectiveForm({
  projectId,
  initial,
  compact = false,
}: {
  projectId: string;
  initial?: RetrospectiveValues;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState<RetrospectiveFormState, FormData>(
    saveRetrospectiveAction,
    null,
  );
  const value = (key: keyof RetrospectiveValues) => initial?.[key] ?? "";

  return (
    <form action={formAction} className="ac-card space-y-4 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      {initial?.id && <input type="hidden" name="retrospectiveId" value={initial.id} />}
      <div>
        <h2 className="font-medium text-ink">{initial ? "编辑复盘" : "创建项目复盘"}</h2>
        {!compact && <p className="mt-1 text-sm text-ink-faint">把本次项目的成果、问题和下一步行动沉淀下来，方便团队持续改进。</p>}
      </div>
      <label className="block text-sm text-ink-soft">
        复盘标题
        <input name="title" required maxLength={120} defaultValue={value("title")} className="ac-field" placeholder="例如：课程项目结项复盘" />
      </label>
      <Field name="summary" label="项目总结" defaultValue={value("summary")} placeholder="项目完成了什么，最终结果如何？" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="wentWell" label="做得好的地方" defaultValue={value("wentWell")} placeholder="哪些做法值得继续保持？" />
        <Field name="challenges" label="遇到的问题" defaultValue={value("challenges")} placeholder="哪些问题影响了进度或质量？" />
        <Field name="lessons" label="经验教训" defaultValue={value("lessons")} placeholder="下次应该怎样做得更好？" />
        <Field name="nextSteps" label="后续行动" defaultValue={value("nextSteps")} placeholder="需要落实的改进事项和负责人？" />
      </div>
      {state && <p role="alert" className="text-sm text-high">{state.error}</p>}
      <button disabled={pending} className="ac-btn">
        {pending ? "保存中…" : initial ? "保存修改" : "保存复盘草稿"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
}) {
  return (
    <label className="block text-sm text-ink-soft">
      {label}
      <textarea name={name} defaultValue={defaultValue} rows={4} className="ac-field resize-y" placeholder={placeholder} />
    </label>
  );
}
