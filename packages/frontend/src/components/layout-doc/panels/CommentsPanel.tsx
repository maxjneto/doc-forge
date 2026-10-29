import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Pill, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { apiAnswerLayoutReview, apiUpdateLayoutNote, type LayoutNote, type LayoutRect } from "@/utils/api";
import { fullDate, relativeTime } from "@/utils/time";
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
  const [message, setMessage] = useState("");
  const [forAgent, setForAgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const list = filter === "open" ? open : (resolved ?? []);

  useEffect(() => {
    if (focused) setFilter("open");
  }, [focused]);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      await onCreate(message.trim(), forAgent);
      setMessage("");
      setForAgent(false);
    } finally {
      setSaving(false);
    }
  };

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
        <div className="df-callout df-callout--warn">
          <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{anchorLabel}</span>
          <TextArea
            autoFocus
            rows={3}
            aria-label={t("layout.notes.message")}
            placeholder={t("layout.comments.placeholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
            }}
          />
          <Switch checked={forAgent} onChange={setForAgent} label={t("layout.comments.askAgent")} />
          {forAgent && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.comments.askAgentHint")}</span>}
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="primary" disabled={!message.trim() || saving} onClick={() => void submit()}>
              {saving ? t("common.saving") : t("layout.comments.post")}
            </Button>
            <Button variant="ghost" onClick={onCancelPending}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div role="radiogroup" aria-label={t("layout.comments.filter")} className="df-seg">
        <button type="button" role="radio" aria-checked={filter === "open"} aria-pressed={filter === "open"} onClick={() => setFilter("open")}>
          {t("layout.comments.open", { count: open.length })}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={filter === "resolved"}
          aria-pressed={filter === "resolved"}
          onClick={() => {
            setFilter("resolved");
            if (!resolved) loadResolved();
          }}
        >
          {t("layout.comments.resolved")}
        </button>
      </div>

      {list.length === 0 && (
        <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
          {filter === "open" ? t("layout.comments.emptyOpen") : resolved ? t("layout.comments.emptyResolved") : t("common.loading")}
        </span>
      )}
      {list.map((thread) => (
        <ThreadCard
          key={thread.root.id}
          thread={thread}
          focused={focused === thread.root.id}
          canComment={canComment}
          nameOf={nameOf}
          onShow={onShow}
          onFocus={onFocus}
          onReply={(text) => onReply(thread, text)}
          onStatus={(status) => onStatus(thread, status)}
          onToggleAgent={(on) => onToggleAgent(thread, on)}
        />
      ))}
    </div>
  );
}

function Author({ note }: { note: LayoutNote }) {
  const { t, dateLocale } = useI18n();
  return (
    <span className="df-comment__author">
      <span className="df-comment__avatar" data-agent={note.byAgent || undefined} aria-hidden>
        <span className="material-symbols-outlined">{note.byAgent ? "smart_toy" : "person"}</span>
      </span>
      <b>{note.byAgent ? t("layout.history.agent") : t("layout.history.person")}</b>
      {note.createdAt && (
        <span title={fullDate(note.createdAt, dateLocale)} style={{ color: "var(--color-faint)" }}>
          {relativeTime(note.createdAt, dateLocale)}
        </span>
      )}
    </span>
  );
}

function ThreadCard({
  thread,
  focused,
  canComment,
  nameOf,
  onShow,
  onFocus,
  onReply,
  onStatus,
  onToggleAgent,
}: {
  thread: Thread;
  focused: boolean;
  canComment: boolean;
  nameOf: (id: string) => string;
  onShow: (id: string) => void;
  onFocus: (id: string | null) => void;
  onReply: (message: string) => Promise<void>;
  onStatus: (status: "resolved" | "open") => Promise<void>;
  onToggleAgent: (on: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const { root, replies, number } = thread;
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);
  const resolvedThread = root.status === "resolved";
  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await onReply(reply.trim());
      setReply("");
    } finally {
      setSending(false);
    }
  };
  const anchor = root.anchor.component ? nameOf(root.anchor.component) : root.anchor.rect ? t("layout.comments.area", { page: root.anchor.rect.page ?? 1 }) : null;

  return (
    <article
      ref={card}
      className="df-comment"
      data-focused={focused || undefined}
      data-resolved={resolvedThread || undefined}
      onMouseEnter={() => onFocus(root.id)}
      onMouseLeave={() => onFocus(null)}
    >
      <header className="df-comment__head">
        {number > 0 && <span className="df-pin df-pin--static">{number}</span>}
        <Author note={root} />
        {root.forAgent && (
          <Pill compact tone="steel" dot={false}>
            {t("layout.comments.forAgent")}
          </Pill>
        )}
      </header>
      {anchor && (
        <button type="button" className="df-comment__anchor" onClick={() => root.anchor.component && onShow(root.anchor.component)} disabled={!root.anchor.component}>
          <span className="material-symbols-outlined" aria-hidden>
            {root.anchor.component ? "my_location" : "crop_free"}
          </span>
          {anchor}
        </button>
      )}
      <p className="df-comment__text">{root.message}</p>
      {replies.map((r) => (
        <div key={r.id} className="df-comment__reply">
          <Author note={r} />
          <p className="df-comment__text">{r.message}</p>
        </div>
      ))}
      {resolvedThread && root.resolutionNote && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>✓ {root.resolutionNote}</span>}
      {canComment && (
        <>
          <div className="df-comment__composer">
            <TextArea
              rows={1}
              aria-label={t("layout.comments.reply")}
              placeholder={t("layout.comments.reply")}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <IconButton icon="send" label={t("layout.comments.send")} disabled={!reply.trim() || sending} onClick={() => void send()} />
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {resolvedThread ? (
              <Button variant="ghost" icon="undo" iconPosition="start" onClick={() => void onStatus("open")}>
                {t("layout.comments.reopen")}
              </Button>
            ) : (
              <Button variant="ghost" icon="check" iconPosition="start" onClick={() => void onStatus("resolved")}>
                {t("layout.notes.resolve")}
              </Button>
            )}
            {!resolvedThread && (
              <Button variant="ghost" icon="smart_toy" iconPosition="start" aria-pressed={root.forAgent} onClick={() => void onToggleAgent(!root.forAgent)}>
                {root.forAgent ? t("layout.comments.unaskAgent") : t("layout.comments.askAgentShort")}
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
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
