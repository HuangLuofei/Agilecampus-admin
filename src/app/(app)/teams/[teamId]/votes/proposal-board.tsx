"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addProposalCommentAction,
  castProposalVoteAction,
  closeProposalPollAction,
  createProposalPollAction,
  deleteProposalCommentAction,
  deleteProposalPollAction,
  type ProposalActionState,
} from "./actions";

type Category = "topic" | "design" | "technical";

const CATEGORY_LABELS: Record<Category, string> = {
  topic: "选题",
  design: "设计稿",
  technical: "技术方案",
};

type ProposalOptionView = {
  id: string;
  label: string;
  description: string;
  voteCount: number;
};

type ProposalCommentView = {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
};

export type ProposalPollView = {
  id: string;
  createdById: string | null;
  creatorName: string | null;
  title: string;
  category: Category;
  description: string;
  referenceUrl: string | null;
  closesAt: Date | null;
  status: "open" | "closed";
  effectiveOpen: boolean;
  finalOptionId: string | null;
  finalOptionLabel: string | null;
  createdAt: Date;
  myOptionId: string | null;
  totalVotes: number;
  options: ProposalOptionView[];
  comments: ProposalCommentView[];
};

type EditableOption = {
  label: string;
  description: string;
};

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

export function CreateProposalPollForm({ teamId }: { teamId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [options, setOptions] = useState<EditableOption[]>([
    { label: "", description: "" },
    { label: "", description: "" },
  ]);
  const [closesAt, setClosesAt] = useState("");
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(
    async (previous, formData) => {
      const result = await createProposalPollAction(previous, formData);
      if (result && "ok" in result) {
        formRef.current?.reset();
        setOptions([
          { label: "", description: "" },
          { label: "", description: "" },
        ]);
        setClosesAt("");
      }
      return result;
    },
    null,
  );

  const closesAtIso = closesAt ? new Date(closesAt).toISOString() : "";
  const optionsComplete = options.every((option) => option.label.trim().length > 0);

  const updateOption = (index: number, field: keyof EditableOption, value: string) => {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      ),
    );
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="options" value={JSON.stringify(options)} />
      <input type="hidden" name="closesAt" value={closesAtIso} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="space-y-1 text-sm text-ink-soft">
          投票主题
          <input
            name="title"
            required
            maxLength={140}
            className="ac-field"
            placeholder="例如：课程项目最终选题"
          />
        </label>
        <label className="space-y-1 text-sm text-ink-soft">
          评审类型
          <select name="category" defaultValue="topic" className="ac-field">
            <option value="topic">选题</option>
            <option value="design">设计稿</option>
            <option value="technical">技术方案</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm text-ink-soft">
        背景与评审标准
        <textarea
          name="description"
          maxLength={5000}
          rows={3}
          className="ac-field"
          placeholder="说明要解决的问题、比较维度或评审重点"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-ink-soft">
          参考链接
          <input
            name="referenceUrl"
            type="url"
            maxLength={2048}
            className="ac-field"
            placeholder="设计稿、文档或代码仓库地址（可选）"
          />
        </label>
        <label className="space-y-1 text-sm text-ink-soft">
          截止时间
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
            className="ac-field"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-medium text-ink-soft">候选方案（2–8 项）</legend>
          <button
            type="button"
            disabled={options.length >= 8}
            onClick={() =>
              setOptions((current) => [...current, { label: "", description: "" }])
            }
            className="ac-btn-ghost px-2.5 py-1 text-xs"
          >
            ＋ 添加选项
          </button>
        </div>
        {options.map((option, index) => (
          <div
            key={index}
            className="grid gap-2 rounded border border-line bg-sunken/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]"
          >
            <label className="space-y-1 text-xs text-ink-soft">
              选项 {index + 1}
              <input
                required
                maxLength={100}
                value={option.label}
                onChange={(event) => updateOption(index, "label", event.target.value)}
                className="ac-field"
                placeholder={index === 0 ? "例如：校园闲置交易平台" : "另一个候选方案"}
              />
            </label>
            <label className="space-y-1 text-xs text-ink-soft">
              简要说明
              <input
                maxLength={500}
                value={option.description}
                onChange={(event) => updateOption(index, "description", event.target.value)}
                className="ac-field"
                placeholder="用户对象、亮点或风险（可选）"
              />
            </label>
            <button
              type="button"
              disabled={options.length <= 2}
              onClick={() =>
                setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))
              }
              className="self-end rounded px-2 py-2 text-xs text-ink-faint hover:text-high disabled:opacity-40"
              aria-label={`删除选项 ${index + 1}`}
            >
              删除
            </button>
          </div>
        ))}
      </fieldset>

      {state && "error" in state && (
        <p role="alert" className="text-sm text-high">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p role="status" className="text-sm text-done">
          {state.message ?? "投票已发布"}
        </p>
      )}

      <div className="flex justify-end">
        <button
          disabled={pending || !optionsComplete || options.length < 2}
          className="ac-btn"
        >
          {pending ? "发布中…" : "发布投票"}
        </button>
      </div>
    </form>
  );
}

export function ProposalPollCard({
  poll,
  currentUserId,
  canManage,
}: {
  poll: ProposalPollView;
  currentUserId: string;
  canManage: boolean;
}) {
  const open = poll.effectiveOpen;
  const statusLabel =
    poll.status === "closed" ? "已结束" : open ? "投票中" : "已截止";
  const statusClass =
    poll.status === "closed"
      ? "bg-low-soft text-low"
      : open
        ? "bg-primary-soft text-primary"
        : "bg-alert-soft text-alert";

  return (
    <article className="ac-card space-y-5 p-4 sm:p-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ac-badge bg-primary-soft text-primary">
            {CATEGORY_LABELS[poll.category]}
          </span>
          <span className={`ac-badge ${statusClass}`}>{statusLabel}</span>
          {poll.myOptionId && open && (
            <span className="ac-badge bg-low-soft text-low">你已投票，可改选</span>
          )}
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{poll.title}</h2>
          <p className="mt-1 text-xs text-ink-faint">
            {poll.creatorName ?? "已退出的成员"} 发起 · {formatDateTime(poll.createdAt)}
            {poll.closesAt ? ` · 截止 ${formatDateTime(poll.closesAt)}` : ""}
          </p>
        </div>
        {poll.description && (
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">
            {poll.description}
          </p>
        )}
        {poll.referenceUrl && (
          <a
            href={poll.referenceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex break-all text-sm text-primary hover:underline"
          >
            查看方案资料 ↗
          </a>
        )}
      </header>

      {poll.finalOptionLabel && (
        <section className="rounded border border-primary/25 bg-primary-soft px-4 py-3">
          <p className="text-xs font-semibold text-primary">最终采用方案</p>
          <p className="mt-1 font-display text-base font-semibold text-ink">
            {poll.finalOptionLabel}
          </p>
        </section>
      )}

      <section className="space-y-2" aria-label="投票选项与实时结果">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">候选方案</h3>
          <span className="text-xs text-ink-faint">
            {poll.totalVotes} 人已投票
          </span>
        </div>
        <ul className="space-y-2">
          {poll.options.map((option) => {
            const percentage =
              poll.totalVotes > 0 ? Math.round((option.voteCount / poll.totalVotes) * 100) : 0;
            const selected = poll.myOptionId === option.id;
            const final = poll.finalOptionId === option.id;
            return (
              <li
                key={option.id}
                className={`rounded border p-3 ${
                  selected
                    ? "border-primary bg-primary-soft/60"
                    : final
                      ? "border-primary/40 bg-surface"
                      : "border-line bg-surface"
                }`}
              >
                <VoteOptionButton
                  pollId={poll.id}
                  option={option}
                  percentage={percentage}
                  selected={selected}
                  canVote={open}
                />
                {option.description && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-ink-soft">
                    {option.description}
                  </p>
                )}
                {final && <p className="mt-2 text-xs font-semibold text-primary">最终采用</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {canManage && poll.status === "open" && (
        <details className="rounded border border-line bg-sunken/50 p-3">
          <summary className="cursor-pointer text-sm text-primary">结束投票并确认方案</summary>
          <ClosePollForm poll={poll} />
          <form action={deleteProposalPollAction} className="mt-3 flex justify-end border-t border-line pt-3">
            <input type="hidden" name="pollId" value={poll.id} />
            <button className="text-xs text-high hover:underline">删除整个投票…</button>
          </form>
        </details>
      )}
      {canManage && poll.status === "closed" && (
        <details className="text-right">
          <summary className="cursor-pointer text-xs text-ink-faint">管理</summary>
          <form action={deleteProposalPollAction} className="mt-2">
            <input type="hidden" name="pollId" value={poll.id} />
            <button className="text-xs text-high hover:underline">删除整个投票…</button>
          </form>
        </details>
      )}

      <section className="space-y-3 border-t border-line pt-4" aria-label="方案评审讨论">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">评审意见</h3>
          <span className="text-xs text-ink-faint">{poll.comments.length}</span>
        </div>
        {poll.comments.length > 0 ? (
          <ul className="space-y-2">
            {poll.comments.map((comment) => (
              <li key={comment.id} className="rounded bg-sunken/60 px-3 py-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-faint">
                      <span className="font-medium text-ink-soft">
                        {comment.authorName ?? "已退出的成员"}
                      </span>{" "}
                      · {formatDateTime(comment.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                      {comment.content}
                    </p>
                  </div>
                  {(comment.authorId === currentUserId || canManage) && (
                    <form action={deleteProposalCommentAction}>
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button className="text-xs text-ink-faint hover:text-high" aria-label="删除评审意见">
                        删除
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded bg-sunken/50 px-3 py-2 text-sm text-ink-faint">
            还没有评审意见，补充比较结论或风险点，帮助团队做决定。
          </p>
        )}
        <CommentForm pollId={poll.id} />
      </section>
    </article>
  );
}

function VoteOptionButton({
  pollId,
  option,
  percentage,
  selected,
  canVote,
}: {
  pollId: string;
  option: ProposalOptionView;
  percentage: number;
  selected: boolean;
  canVote: boolean;
}) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(
    castProposalVoteAction,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="pollId" value={pollId} />
      <input type="hidden" name="optionId" value={option.id} />
      <button
        type="submit"
        disabled={!canVote || pending || selected}
        aria-pressed={selected}
        className="flex w-full items-start justify-between gap-3 text-left disabled:cursor-default"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 font-medium text-ink">
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-line-strong text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="break-words">{option.label}</span>
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-ink">
            {percentage}%
          </span>
          <span className="block text-[11px] text-ink-faint">
            {option.voteCount} 票
          </span>
        </span>
      </button>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {canVote && !selected && (
        <span className="block text-[11px] text-primary">
          {pending ? "提交中…" : "点击选择该方案"}
        </span>
      )}
      {state && "error" in state && (
        <span role="alert" className="block text-xs text-high">
          {state.error}
        </span>
      )}
    </form>
  );
}

function ClosePollForm({ poll }: { poll: ProposalPollView }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(
    closeProposalPollAction,
    null,
  );
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="pollId" value={poll.id} />
      <label className="block space-y-1 text-xs text-ink-soft">
        最终采用方案
        <select name="finalOptionId" defaultValue={poll.myOptionId ?? ""} className="ac-field">
          <option value="">暂不指定</option>
          {poll.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ink-faint">
        结束后成员不能再改票，但仍可继续补充评审意见。
      </p>
      {state && "error" in state && (
        <p role="alert" className="text-sm text-high">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p role="status" className="text-sm text-done">
          {state.message ?? "投票已结束"}
        </p>
      )}
      <div className="flex justify-end">
        <button disabled={pending} className="ac-btn">
          {pending ? "结束中…" : "结束投票"}
        </button>
      </div>
    </form>
  );
}

function CommentForm({ pollId }: { pollId: string }) {
  const [state, action, pending] = useActionState<ProposalActionState, FormData>(
    addProposalCommentAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="pollId" value={pollId} />
      <textarea
        name="content"
        required
        maxLength={2000}
        rows={2}
        className="ac-field"
        placeholder="补充支持理由、风险或修改建议…"
      />
      {state && "error" in state && (
        <p role="alert" className="text-sm text-high">
          {state.error}
        </p>
      )}
      {state && "ok" in state && (
        <p role="status" className="text-sm text-done">
          {state.message ?? "评审意见已发布"}
        </p>
      )}
      <div className="flex justify-end">
        <button disabled={pending} className="ac-btn-ghost">
          {pending ? "发布中…" : "发布评审意见"}
        </button>
      </div>
    </form>
  );
}
