import { useEffect, useState } from "react";
import { Button, textStyle } from "@/components/ui";
import { CommentComposer, CommentFilter, CommentThread, type CommentMessage, type CommentThreadData } from "@/components/document";
import { useI18n } from "@/i18n";
import { apiAnswerLayoutReview, apiUpdateLayoutNote, type LayoutNote, type LayoutRect } from "@/utils/api";
import type { Thread } from "../history";
import { track } from "../track";
import { TextArea } from "./fields";

type GetToken = () => Promise<string | null>;

interface CommentsPanelProps {
  documentId: string;
  open: Thread[];
  resolved: Thread[] | null;
  loadResolved: () => void;
  /** An agent's hand-offs: a summary and questions with one-click answers. */
  requests: LayoutNote[];
  onAnswered: () => void;
  canComment: boolean;
  annotating: boolean;
  onToggleAnnotate: () => void;
  /** What the next comment is about: an area drawn on the page or a block. */
  pending: { rect?: LayoutRect; component?: string } | null;
  onCreate: (message: string, forAgent: boolean) => Promise<void>;
  onCancelPending: () => void;
  onReply: (thread: Thread, message: string) => Promise<void>;
  onStatus: (thread: Thread, status: "resolved" | "open") => Promise<void>;
  onToggleAgent: (thread: Thread, on: boolean) => Promise<void>;
  onShow: (id: string) => void;
  /** The thread picked on the page (its pin); scrolled to and marked. */
  focused: string | null;
  onFocus: (id: string | null) => void;
  nameOf: (id: string) => string;
  getToken: GetToken;
}

/**
 * Comments as conversations pinned to the page: each one has a number (the pin on
 * the page), replies from people and agents, and can be handed to the agent ("ask
 * the agent"), which reads those first through MCP and answers here.
 */
export function CommentsPanel(props: CommentsPanelProps) {
  const { documentId, open, resolved, loadResolved, requests, onAnswered, canComment, annotating, onToggleAnnotate, pending, onCreate, onCancelPending, onReply, onStatus, onToggleAgent, onShow, focused, onFocus, nameOf, getToken } =
    props;
  const { t } = useI18n();
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const list = filter === "open" ? open : (resolved ?? []);

  useEffect(() => {
    if (focused) setFilter("open");
  }, [focused]);

  const anchorLabel = pending?.rect
    ? t("layout.notes.areaLabel", { page: pending.rect.page ?? 1, x: pending.rect.x, y: pending.rect.y, w: pending.rect.w, h: pending.rect.h })
    : pending?.component
      ? t("layout.comments.about", { name: nameOf(pending.component) })
      : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {requests.map((request) => (
        <ReviewRequest key={request.id} documentId={documentId} request={request} nameOf={nameOf} onShow={onShow} onAnswered={onAnswered} canComment={canComment} getToken={getToken} />
      ))}

      {canComment && !pending && (
        <Button variant={annotating ? "secondary" : "ghost"} icon={annotating ? "close" : "add_comment"} iconPosition="start" aria-pressed={annotating} onClick={onToggleAnnotate}>
          {annotating ? t("layout.notes.stopAnnotating") : t("layout.comments.new")}
        </Button>
      )}
      {annotating && !pending && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.comments.newHint")}</span>}
      {pending && (
        <CommentComposer about={<span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{anchorLabel}</span>} onSubmit={onCreate} onCancel={onCancelPending} />
      )}

      <CommentFilter
        value={filter}
        openCount={open.length}
        onChange={(value) => {
          setFilter(value);
          if (value === "resolved" && !resolved) loadResolved();
        }}
      />

      {list.length === 0 && (
        <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
          {filter === "open" ? t("layout.comments.emptyOpen") : resolved ? t("layout.comments.emptyResolved") : t("common.loading")}
        </span>
      )}
      {list.map((thread) => {
        const anchor = thread.root.anchor.component ? nameOf(thread.root.anchor.component) : thread.root.anchor.rect ? t("layout.comments.area", { page: thread.root.anchor.rect.page ?? 1 }) : null;
        return (
          <CommentThread
            key={thread.root.id}
            thread={threadData(thread)}
            focused={focused === thread.root.id}
            canComment={canComment}
            onFocus={onFocus}
            anchor={
              anchor && (
                <button type="button" className="df-comment__anchor" onClick={() => thread.root.anchor.component && onShow(thread.root.anchor.component)} disabled={!thread.root.anchor.component}>
                  <span className="material-symbols-outlined" aria-hidden>
                    {thread.root.anchor.component ? "my_location" : "crop_free"}
                  </span>
                  {anchor}
                </button>
              )
            }
            onReply={(text) => onReply(thread, text)}
            onStatus={(status) => onStatus(thread, status)}
            onToggleAgent={(on) => onToggleAgent(thread, on)}
          />
        );
      })}
    </div>
  );
}

const messageOf = (note: LayoutNote): CommentMessage => ({
  id: note.id,
  text: note.message,
  createdAt: note.createdAt,
  author: { name: note.authorName, agent: note.byAgent, harness: note.harness },
});

function threadData(thread: Thread): CommentThreadData {
  return {
    root: messageOf(thread.root),
    replies: thread.replies.map(messageOf),
    forAgent: thread.root.forAgent,
    resolved: thread.root.status === "resolved",
    resolutionNote: thread.root.resolutionNote,
    number: thread.number,
  };
}

function ReviewRequest({
  documentId,
  request,
  nameOf,
  onShow,
  onAnswered,
  canComment,
  getToken,
}: {
  documentId: string;
  request: LayoutNote;
  nameOf: (id: string) => string;
  onShow: (id: string) => void;
  onAnswered: () => void;
  canComment: boolean;
  getToken: GetToken;
}) {
  const { t } = useI18n();
  const questions = (request.data?.questions as { text: string; options?: string[] }[] | undefined) ?? [];
  const focus = (request.data?.focus as string[] | undefined) ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const lines = questions.map((q, i) => (answers[i] ? `${q.text} → ${answers[i]}` : null)).filter(Boolean) as string[];
      if (comment.trim()) lines.push(comment.trim());
      const message = lines.join("\n") || t("layout.review.seen");
      await apiAnswerLayoutReview(documentId, request, answers, message, getToken);
      track("layout_review_answer_sent", { answered: Object.keys(answers).length, questions: questions.length, comment: Boolean(comment.trim()) });
      await apiUpdateLayoutNote(request.id, "resolved", getToken, message);
      onAnswered();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="df-callout df-callout--steel">
      <span style={{ ...textStyle.fieldLabel, color: "var(--color-steel)" }}>{request.byAgent ? t("layout.review.fromAgent") : t("layout.review.fromPerson")}</span>
      <span style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>{request.message}</span>
      {focus.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {focus.map((id) => (
            <button key={id} type="button" className="df-chip" onClick={() => onShow(id)}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 14 }}>
                my_location
              </span>
              {nameOf(id)}
            </button>
          ))}
        </div>
      )}
      {questions.map((q, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...textStyle.bodySm, color: "var(--color-text)", fontWeight: 500 }}>{q.text}</span>
          {(q.options ?? []).length > 0 && (
            <div role="radiogroup" aria-label={q.text} className="df-seg">
              {(q.options ?? []).map((option) => (
                <button key={option} type="button" role="radio" aria-checked={answers[i] === option} aria-pressed={answers[i] === option} disabled={!canComment} onClick={() => setAnswers((a) => ({ ...a, [i]: option }))}>
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {canComment && (
        <>
          <TextArea rows={2} aria-label={t("layout.review.comment")} placeholder={t("layout.review.comment")} value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button variant="primary" disabled={sending} onClick={() => void send()}>
            {sending ? t("common.saving") : t("layout.review.send")}
          </Button>
        </>
      )}
    </section>
  );
}
