import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button, textStyle } from "@/components/ui";
import { CommentComposer, CommentFilter, CommentThread, type CommentMessage, type CommentThreadData } from "@/components/document";
import { useI18n } from "@/i18n";
import type { FeedbackItem } from "@/types";
import { apiCreateFeedback, apiListFeedback, apiReplyFeedback, apiUpdateFeedback } from "@/utils/api";

export interface CommentAnchor {
  quote?: string;
  heading?: string;
}

interface EditorCommentsPanelProps {
  documentId: string;
  refreshTick: number;
  canComment: boolean;
  /** What the next comment is about, picked from the text; null when not writing one. */
  pending: CommentAnchor | null;
  onStartComment: () => void;
  onCancelPending: () => void;
  /** Take the reader to the passage a comment points at. */
  onGoTo: (anchor: CommentAnchor) => void;
  onOpenCountChange?: (count: number) => void;
  onChanged?: () => void;
}

interface Thread extends CommentThreadData {
  anchor: CommentAnchor | null;
  fromRejection: boolean;
}

function message(f: FeedbackItem): CommentMessage {
  return { id: f.id, text: f.content, createdAt: f.createdAt, author: { name: f.authorName, agent: f.byAgent, harness: f.harness, me: f.isMine } };
}

/** Feedback rows as threads: roots oldest first, each with its replies. */
export function threadsOf(items: FeedbackItem[]): Thread[] {
  const replies = new Map<string, FeedbackItem[]>();
  for (const f of items) if (f.parentId) replies.set(f.parentId, [...(replies.get(f.parentId) ?? []), f]);
  return items
    .filter((f) => !f.parentId)
    .map((root) => ({
      root: message(root),
      replies: (replies.get(root.id) ?? []).map(message),
      forAgent: root.forAgent,
      resolved: root.status !== "open",
      resolutionNote: root.resolutionNote,
      anchor: root.anchor && (root.anchor.quote || root.anchor.heading) ? root.anchor : null,
      fromRejection: Boolean(root.suggestionId),
    }));
}

/**
 * Comments on the text, as conversations between people and agents: the same
 * threads the layout editor has, anchored to a passage (and the heading it was
 * under) instead of a block. Agents read them through `get_pending_feedback`,
 * requests addressed to them first, and answer with `reply_feedback`.
 */
export function EditorCommentsPanel({ documentId, refreshTick, canComment, pending, onStartComment, onCancelPending, onGoTo, onOpenCountChange, onChanged }: EditorCommentsPanelProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [filter, setFilter] = useState<"open" | "resolved">("open");

  const load = useCallback(async () => {
    try {
      setItems(await apiListFeedback(documentId, getToken));
    } catch {
      setItems([]);
    }
  }, [documentId, getToken]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const threads = useMemo(() => threadsOf(items ?? []), [items]);
  const open = threads.filter((th) => !th.resolved);
  const list = filter === "open" ? open : threads.filter((th) => th.resolved);

  useEffect(() => {
    onOpenCountChange?.(open.length);
  }, [open.length, onOpenCountChange]);

  const after = async () => {
    await load();
    onChanged?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {canComment && !pending && (
        <Button variant="ghost" icon="add_comment" iconPosition="start" onClick={onStartComment}>
          {t("layout.comments.new")}
        </Button>
      )}
      {pending && (
        <CommentComposer
          about={<AnchorView anchor={pending} />}
          onCancel={onCancelPending}
          onSubmit={async (text, forAgent) => {
            await apiCreateFeedback(documentId, text, null, getToken, { anchor: pending, forAgent });
            onCancelPending();
            setFilter("open");
            await after();
          }}
        />
      )}

      <CommentFilter value={filter} openCount={open.length} onChange={setFilter} />

      {items === null && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("common.loading")}</span>}
      {items !== null && list.length === 0 && (
        <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{filter === "open" ? t("doc.comments.emptyOpen") : t("layout.comments.emptyResolved")}</span>
      )}
      {list.map((thread) => (
        <CommentThread
          key={thread.root.id}
          thread={thread}
          canComment={canComment}
          anchor={
            thread.anchor ? (
              <AnchorView anchor={thread.anchor} onGo={() => onGoTo(thread.anchor as CommentAnchor)} />
            ) : thread.fromRejection ? (
              <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("doc.comments.fromRejection")}</span>
            ) : null
          }
          onReply={async (text) => {
            await apiReplyFeedback(thread.root.id, text, getToken);
            await after();
          }}
          onStatus={async (status) => {
            await apiUpdateFeedback(thread.root.id, { status }, getToken);
            await after();
          }}
          onToggleAgent={async (on) => {
            await apiUpdateFeedback(thread.root.id, { forAgent: on }, getToken);
            await after();
          }}
        />
      ))}
    </div>
  );
}

function AnchorView({ anchor, onGo }: { anchor: CommentAnchor; onGo?: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {anchor.heading && (
        <button type="button" className="df-comment__anchor" onClick={onGo} disabled={!onGo} title={onGo ? t("doc.comments.goTo") : undefined}>
          <span className="material-symbols-outlined" aria-hidden>
            tag
          </span>
          {anchor.heading}
        </button>
      )}
      {anchor.quote && (
        <blockquote className="df-quote" onClick={onGo} style={onGo ? { cursor: "pointer" } : undefined}>
          {anchor.quote}
        </blockquote>
      )}
      {!anchor.heading && !anchor.quote && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("doc.comments.wholeDocument")}</span>}
    </div>
  );
}
