import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, IconButton, Pill, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { fullDate, relativeTime } from "@/utils/time";
import { ActorLabel, type Actor } from "./Actor";

/** One message in a thread, whatever document it lives on. */
export interface CommentMessage {
  id: string;
  author: Actor;
  text: string;
  createdAt: string | null;
}

/** A comment and its replies, as both editors show them. */
export interface CommentThreadData {
  root: CommentMessage;
  replies: CommentMessage[];
  forAgent: boolean;
  resolved: boolean;
  resolutionNote: string | null;
  /** The number on the page's pin (layout); 0 for none. */
  number?: number;
}

function Message({ message, before, after }: { message: CommentMessage; before?: ReactNode; after?: ReactNode }) {
  const { dateLocale } = useI18n();
  return (
    <>
      <span className="df-comment__head">
        {before}
        <ActorLabel actor={message.author} />
        {message.createdAt && (
          <span title={fullDate(message.createdAt, dateLocale)} style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
            {relativeTime(message.createdAt, dateLocale)}
          </span>
        )}
        {after}
      </span>
      <p className="df-comment__text">{message.text}</p>
    </>
  );
}

/**
 * A conversation between people and agents about one place in a document: reply,
 * resolve, and hand it to the agent ("ask the agent"), which reads those first
 * through MCP and answers here.
 */
export function CommentThread({
  thread,
  anchor,
  focused = false,
  canComment,
  onFocus,
  onReply,
  onStatus,
  onToggleAgent,
}: {
  thread: CommentThreadData;
  /** Where the comment points (a block, an area, a passage); the caller draws it. */
  anchor?: ReactNode;
  focused?: boolean;
  canComment: boolean;
  onFocus?: (id: string | null) => void;
  onReply: (message: string) => Promise<void>;
  onStatus: (status: "resolved" | "open") => Promise<void>;
  onToggleAgent: (on: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

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

  return (
    <article
      ref={card}
      className="df-comment"
      data-focused={focused || undefined}
      data-resolved={thread.resolved || undefined}
      onMouseEnter={() => onFocus?.(thread.root.id)}
      onMouseLeave={() => onFocus?.(null)}
    >
      <Message
        message={thread.root}
        before={(thread.number ?? 0) > 0 && <span className="df-pin df-pin--static">{thread.number}</span>}
        after={
          thread.forAgent && (
            <Pill compact tone="steel" dot={false}>
              {t("layout.comments.forAgent")}
            </Pill>
          )
        }
      />
      {anchor}
      {thread.replies.map((r) => (
        <div key={r.id} className="df-comment__reply">
          <Message message={r} />
        </div>
      ))}
      {thread.resolved && thread.resolutionNote && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>✓ {thread.resolutionNote}</span>}
      {canComment && (
        <>
          <div className="df-comment__composer">
            <textarea
              rows={1}
              className="df-input"
              style={{ resize: "vertical", minHeight: 0 }}
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
            {thread.resolved ? (
              <Button variant="ghost" icon="undo" iconPosition="start" onClick={() => void onStatus("open")}>
                {t("layout.comments.reopen")}
              </Button>
            ) : (
              <Button variant="ghost" icon="check" iconPosition="start" onClick={() => void onStatus("resolved")}>
                {t("layout.notes.resolve")}
              </Button>
            )}
            {!thread.resolved && (
              <Button variant="ghost" icon="smart_toy" iconPosition="start" aria-pressed={thread.forAgent} onClick={() => void onToggleAgent(!thread.forAgent)}>
                {thread.forAgent ? t("layout.comments.unaskAgent") : t("layout.comments.askAgentShort")}
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

/** Writing a new comment: what it is about, the message, and whether the agent should act on it. */
export function CommentComposer({ about, onSubmit, onCancel }: { about: ReactNode; onSubmit: (message: string, forAgent: boolean) => Promise<void>; onCancel: () => void }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [forAgent, setForAgent] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      await onSubmit(message.trim(), forAgent);
      setMessage("");
      setForAgent(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="df-callout df-callout--warn">
      {about}
      <textarea
        autoFocus
        rows={3}
        className="df-input"
        style={{ resize: "vertical", minHeight: 0 }}
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
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/** Open / resolved, the filter both comment panels start with. */
export function CommentFilter({ value, openCount, onChange }: { value: "open" | "resolved"; openCount: number; onChange: (value: "open" | "resolved") => void }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t("layout.comments.filter")} className="df-seg">
      <button type="button" role="radio" aria-checked={value === "open"} aria-pressed={value === "open"} onClick={() => onChange("open")}>
        {t("layout.comments.open", { count: openCount })}
      </button>
      <button type="button" role="radio" aria-checked={value === "resolved"} aria-pressed={value === "resolved"} onClick={() => onChange("resolved")}>
        {t("layout.comments.resolved")}
      </button>
    </div>
  );
}
