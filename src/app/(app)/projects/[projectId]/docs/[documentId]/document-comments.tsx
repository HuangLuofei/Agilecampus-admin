"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  createDocumentCommentAction,
  deleteDocumentCommentAction,
  resolveDocumentCommentAction,
  updateDocumentCommentAction,
  type CommentFormState,
} from "./comment-actions";

type CommentItem = {
  id: string;
  authorId: string;
  authorName: string;
  quote: string | null;
  content: string;
  resolvedAt: Date | string | null;
  resolvedByName: string | null;
  createdAt: Date | string;
};

export function DocumentComments({
  projectId,
  documentId,
  teamId,
  currentUserId,
  comments,
  canResolve,
}: {
  projectId: string;
  documentId: string;
  teamId?: string | null;
  currentUserId: string;
  comments: CommentItem[];
  canResolve: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createState, createAction, creating] = useActionState<CommentFormState, FormData>(createDocumentCommentAction, null);
  const [updateState, updateAction, updating] = useActionState<CommentFormState, FormData>(updateDocumentCommentAction, null);
  const [deleteState, deleteAction, deleting] = useActionState<CommentFormState, FormData>(async (_prev, formData) => {
    await deleteDocumentCommentAction(formData);
    return null;
  }, null);
  const [resolveState, resolveAction, resolving] = useActionState<CommentFormState, FormData>(async (_prev, formData) => {
    await resolveDocumentCommentAction(formData);
    return null;
  }, null);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-medium text-ink">文档讨论 {comments.length > 0 && `(${comments.length})`}</h2>
          <p className="mt-1 text-sm text-ink-faint">针对正文提出问题、建议或需要确认的内容。</p>
        </div>
      </div>
      {comments.length === 0 ? (
        <div className="ac-card p-5 text-sm text-ink-faint">还没有讨论，留下第一条评论吧。</div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className={`ac-card space-y-3 p-4 ${comment.resolvedAt ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-ink">{comment.authorName}</span>
                  <time className="ml-2 text-xs text-ink-faint">{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
                  {comment.resolvedAt && <span className="ml-2 ac-badge bg-done-soft text-done">已解决</span>}
                </div>
                {comment.authorId === currentUserId && editingId !== comment.id && (
                  <button type="button" className="text-xs text-ink-faint hover:text-primary" onClick={() => setEditingId(comment.id)}>编辑</button>
                )}
              </div>
              {comment.quote && <blockquote className="border-l-2 border-primary/40 pl-3 text-sm text-ink-soft">“{comment.quote}”</blockquote>}
              {editingId === comment.id ? (
                <form action={updateAction} className="space-y-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="documentId" value={documentId} />
                  {teamId && <input type="hidden" name="team" value={teamId} />}
                  <input type="hidden" name="commentId" value={comment.id} />
                  <textarea name="content" defaultValue={comment.content} rows={3} className="ac-field text-sm" />
                  {updateState && <p className="text-xs text-high">{updateState.error}</p>}
                  <div className="flex gap-2">
                    <button disabled={updating} className="ac-btn text-xs">保存</button>
                    <button type="button" className="ac-btn-ghost text-xs" onClick={() => setEditingId(null)}>取消</button>
                  </div>
                </form>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">{comment.content}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-faint">
                {comment.authorId === currentUserId && editingId !== comment.id && (
                  <form action={deleteAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="documentId" value={documentId} />
                    {teamId && <input type="hidden" name="team" value={teamId} />}
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button disabled={deleting} className="hover:text-high">删除</button>
                  </form>
                )}
                {canResolve && (
                  <form action={resolveAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="documentId" value={documentId} />
                    {teamId && <input type="hidden" name="team" value={teamId} />}
                    <input type="hidden" name="commentId" value={comment.id} />
                    <input type="hidden" name="resolved" value={comment.resolvedAt ? "false" : "true"} />
                    <button disabled={resolving} className="hover:text-primary">{comment.resolvedAt ? "重新打开" : "标记已解决"}</button>
                  </form>
                )}
                {comment.resolvedAt && comment.resolvedByName && <span>由 {comment.resolvedByName} 处理</span>}
              </div>
            </article>
          ))}
        </div>
      )}
      {(deleteState || resolveState) && <p className="text-xs text-high">操作失败，请刷新后重试。</p>}
      <form action={createAction} className="ac-card space-y-3 p-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="documentId" value={documentId} />
        {teamId && <input type="hidden" name="team" value={teamId} />}
        <h3 className="text-sm font-medium text-ink">发起讨论</h3>
        <input name="quote" maxLength={1000} className="ac-field text-sm" placeholder="引用正文片段（选填）" />
        <textarea name="content" required rows={3} maxLength={2000} className="ac-field text-sm" placeholder="写下问题、建议或需要确认的内容…" />
        {createState && <p className="text-xs text-high">{createState.error}</p>}
        <button disabled={creating} className="ac-btn text-xs">{creating ? "发送中…" : "发表评论"}</button>
      </form>
    </section>
  );
}
