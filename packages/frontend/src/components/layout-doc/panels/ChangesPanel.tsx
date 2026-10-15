import { useEffect, useState } from "react";
import type { ApplyResult, Comparison, Engine, LayoutDocument } from "@docforge/layout";
import { Button, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import {
  apiAnswerLayoutReview,
  apiGetLayoutRevision,
  apiListLayoutRevisions,
  apiUpdateLayoutNote,
  type LayoutNote,
  type LayoutRevisionItem,
} from "@/utils/api";
import { relativeTime } from "@/utils/time";
import { describeChange } from "../changes";
import { displayName } from "../names";
import { track } from "../track";
import type { ExternalChange } from "../useLayoutEditor";
import { SectionTitle, TextArea } from "./fields";

type GetToken = () => Promise<string | null>;

interface ChangesPanelProps {
  documentId: string;
  engine: Engine;
  doc: LayoutDocument;
  external: ExternalChange | null;
  comparison: Comparison | null;
  requests: LayoutNote[];
  commit: (ops: unknown[]) => ApplyResult;
  replaceAll: (content: LayoutDocument) => void;
  onDismissExternal: () => void;
  onAnswered: () => void;
  onShow: (id: string) => void;
  canEdit: boolean;
  canComment: boolean;
  getToken: GetToken;
}

/** Descriptions the server writes by itself; anything else is the writer's "why". */
const GENERIC = /^(\d+ layout operations?|Created|Layout replaced)$/;

/**
 * What an agent did and asked, next to the page: its questions with one-click answers,
 * then each change it made (numbered like the marks on the page), what the layout
 * moved as a consequence, and the versions before. Every change can be undone alone.
 */
export function ChangesPanel(props: ChangesPanelProps) {
  const { documentId, engine, doc, external, comparison, requests, commit, replaceAll, onDismissExternal, onAnswered, onShow, canEdit, canComment, getToken } = props;
  const { t, locale } = useI18n();
  const [revisions, setRevisions] = useState<LayoutRevisionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiListLayoutRevisions(documentId, getToken)
      .then((list) => !cancelled && setRevisions(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [documentId, getToken, external?.toRevision]);

  const byId = new Map([...(external?.before.components ?? []), ...doc.components].map((c) => [c.id, c] as const));
  const nameOf = (id: string) => {
    const c = byId.get(id);
    return c ? displayName(c, t) : id;
  };
  const reasons = external
    ? revisions.filter((r) => r.revision > external.fromRevision && r.revision <= external.toRevision && r.description && !GENERIC.test(r.description))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {requests.map((request) => (
        <ReviewRequest key={request.id} documentId={documentId} request={request} nameOf={nameOf} onShow={onShow} onAnswered={onAnswered} canComment={canComment} getToken={getToken} />
      ))}

      {external && comparison && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SectionTitle
            action={
              <Button
                variant="ghost"
                onClick={() => {
                  // What the person kept of the agent's work when done reviewing.
                  track("layout_agent_changes_reviewed", { kept: comparison.edits.length, effects: comparison.effects.length });
                  onDismissExternal();
                }}
              >
                {t("layout.changes.accept")}
              </Button>
            }
          >
            {t("layout.changes.title", { count: comparison.edits.length })}
          </SectionTitle>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.changes.revisions", { from: external.fromRevision, to: external.toRevision })}</span>
          {reasons.map((r) => (
            <span key={r.revision} style={{ ...textStyle.bodySm, color: "var(--color-text)", padding: "8px 10px", borderRadius: "var(--radius-sm)", background: "var(--color-steel-wash)" }}>
              “{r.description}”
            </span>
          ))}
          {comparison.edits.map((edit, i) => {
            const undo = canEdit ? engine.restore(external.before, doc, edit.component) : [];
            return (
              <div key={edit.component} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 10 }}>
                <span className="df-change-mark">{i + 1}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <span style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>
                    {edit.kinds.map((k) => t(`layout.changes.kind.${k}`)).join(", ")} <b style={{ fontWeight: 600 }}>“{nameOf(edit.component)}”</b>
                  </span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {!edit.kinds.includes("removed") && (
                      <Button variant="ghost" icon="my_location" iconPosition="start" onClick={() => onShow(edit.component)}>
                        {t("layout.notes.show")}
                      </Button>
                    )}
                    {undo.length > 0 && (
                      <Button
                        variant="ghost"
                        icon="undo"
                        iconPosition="start"
                        onClick={() => {
                          if (commit(undo).ok) track("layout_agent_change_undone", { kinds: edit.kinds.join(","), type: edit.type });
                        }}
                      >
                        {t("layout.changes.undo")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {comparison.document.length > 0 && (
            <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
              {t("layout.changes.document", { what: comparison.document.map((d) => t(`layout.changes.doc.${d}`)).join(", ") })}
            </span>
          )}
          {comparison.effects.filter((e) => e.component).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
              <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.changes.effects")}</span>
              {comparison.effects
                .filter((e) => e.component)
                .map((e, i) => (
                  <span key={i} style={{ ...textStyle.caption, color: "var(--color-dim)", display: "flex", gap: 8 }}>
                    <span className="df-change-mark df-change-mark--effect" aria-hidden />
                    {describeChange(e, t, nameOf)}
                  </span>
                ))}
            </div>
          )}
          {comparison.edits.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.changes.none")}</span>}
          {canEdit && comparison.edits.length > 1 && (
            <Button
              variant="ghost"
              icon="history"
              iconPosition="start"
              onClick={() => {
                track("layout_agent_changes_undone_all", { count: comparison.edits.length });
                replaceAll(external.before);
              }}
            >
              {t("layout.changes.undoAll")}
            </Button>
          )}
        </section>
      )}

      <details className="df-disclosure">
        <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.changes.history")}</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 10 }}>
          {revisions.map((r) => (
            <div key={r.revision} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-outline)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ ...textStyle.caption, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.description && !GENERIC.test(r.description) ? r.description : t("layout.changes.genericRevision", { count: r.opsCount ?? 0 })}
                </span>
                <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
                  {r.byAgent ? t("layout.notes.byAgent") : t("layout.notes.byPerson")}
                  {r.createdAt ? ` · ${relativeTime(r.createdAt, locale)}` : ""} · {t("layout.revision", { revision: r.revision })}
                </span>
              </div>
              {canEdit && r.revision !== revisions[0]?.revision && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    void apiGetLayoutRevision(documentId, r.revision, getToken).then((past) => {
                      track("layout_version_restored", { back: (revisions[0]?.revision ?? r.revision) - r.revision, by_agent: r.byAgent });
                      replaceAll(past.content as LayoutDocument);
                    });
                  }}
                >
                  {t("layout.changes.restore")}
                </Button>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
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
    <section style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--color-steel-wash)", border: "1px solid var(--color-steel-line)" }}>
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
