import { useState } from "react";
import { Button, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { LayoutNote, LayoutRect } from "@/utils/api";
import { relativeTime } from "@/utils/time";
import { describeChange } from "../changes";
import { Row, SectionTitle, TextArea } from "./fields";

interface NotesPanelProps {
  notes: LayoutNote[];
  loading: boolean;
  canComment: boolean;
  annotating: boolean;
  onToggleAnnotate: () => void;
  /** The area the person just drew, waiting for its text. */
  pendingRect: LayoutRect | null;
  pendingComponent: string | null;
  onCreate: (message: string) => Promise<void>;
  onCancelPending: () => void;
  onResolve: (note: LayoutNote) => Promise<void>;
  onResolveAll: (notes: LayoutNote[]) => Promise<void>;
  onShow: (componentId: string) => void;
  /** What people call a block, for notices (ids otherwise). */
  nameOf?: (id: string) => string;
}

/**
 * Notices (what the layout did on its own after a write) and annotations (notes
 * people pinned to an area or a component). Agents read the same list through MCP.
 */
export function NotesPanel({
  notes,
  loading,
  canComment,
  annotating,
  onToggleAnnotate,
  pendingRect,
  pendingComponent,
  onCreate,
  onCancelPending,
  onResolve,
  onResolveAll,
  onShow,
  nameOf,
}: NotesPanelProps) {
  const { t, locale } = useI18n();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const annotations = notes.filter((n) => n.kind === "annotation");
  const notices = notes.filter((n) => n.kind === "notice");

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    try {
      await onCreate(message.trim());
      setMessage("");
    } finally {
      setSaving(false);
    }
  };

  const noteRow = (note: LayoutNote) => (
    <div key={note.id} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
      <Row gap={6} style={{ alignItems: "center", flexWrap: "wrap" }}>
        {note.kind === "notice" ? (
          <Pill compact tone={note.severity === "warning" ? "warn" : "ghost"} dot={false}>
            {t(`layout.notes.code.${note.code ?? "other"}`)}
          </Pill>
        ) : (
          <Pill compact tone={note.byAgent ? "steel" : "warn"} dot={false}>
            {note.byAgent ? t("layout.notes.byAgent") : t("layout.notes.byPerson")}
          </Pill>
        )}
        {note.createdAt && (
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }} title={new Date(note.createdAt).toLocaleString(locale)}>
            {relativeTime(note.createdAt, locale)}
          </span>
        )}
      </Row>
      <span style={{ ...textStyle.caption, color: "var(--color-text)" }}>{note.kind === "notice" ? describeChange({ ...note, component: note.anchor.component ?? null }, t, nameOf) : note.message}</span>
      {note.where && <span className="df-mono" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{note.where}</span>}
      <Row gap={4}>
        {note.anchor.component && (
          <Button variant="ghost" icon="my_location" iconPosition="start" onClick={() => onShow(note.anchor.component as string)}>
            {t("layout.notes.show")}
          </Button>
        )}
        {canComment && (
          <Button variant="ghost" icon="check" iconPosition="start" onClick={() => void onResolve(note)}>
            {note.kind === "notice" ? t("layout.notes.dismiss") : t("layout.notes.resolve")}
          </Button>
        )}
      </Row>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {canComment && (
        <>
          <Button variant={annotating ? "secondary" : "ghost"} icon={annotating ? "close" : "edit_note"} iconPosition="start" onClick={onToggleAnnotate} aria-pressed={annotating}>
            {annotating ? t("layout.notes.stopAnnotating") : t("layout.notes.annotateArea")}
          </Button>
          {annotating && !pendingRect && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.notes.annotateHint")}</span>}
          {(pendingRect || pendingComponent) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: "var(--radius-sm)", background: "var(--color-warn-wash)", border: "1px solid var(--color-warn-line)" }}>
              <span className="df-mono" style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
                {pendingRect
                  ? t("layout.notes.areaLabel", { page: pendingRect.page ?? 1, x: pendingRect.x, y: pendingRect.y, w: pendingRect.w, h: pendingRect.h })
                  : t("layout.notes.componentLabel", { id: pendingComponent ?? "" })}
              </span>
              <TextArea autoFocus rows={3} aria-label={t("layout.notes.message")} placeholder={t("layout.notes.placeholder")} value={message} onChange={(e) => setMessage(e.target.value)} />
              <Row>
                <Button variant="secondary" disabled={!message.trim() || saving} onClick={() => void submit()}>
                  {saving ? t("common.saving") : t("layout.notes.save")}
                </Button>
                <Button variant="ghost" onClick={onCancelPending}>
                  {t("common.cancel")}
                </Button>
              </Row>
            </div>
          )}
        </>
      )}

      <SectionTitle>{t("layout.notes.annotations", { count: annotations.length })}</SectionTitle>
      {annotations.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{loading ? t("common.loading") : t("layout.notes.noAnnotations")}</span>}
      {annotations.map(noteRow)}

      <SectionTitle
        action={
          canComment && notices.length > 1 ? (
            <Button variant="ghost" icon="done_all" iconPosition="start" onClick={() => void onResolveAll(notices)}>
              {t("layout.notes.dismissAll")}
            </Button>
          ) : undefined
        }
      >
        {t("layout.notes.notices", { count: notices.length })}
      </SectionTitle>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.notes.noticesHint")}</span>
      {notices.length === 0 && !loading && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.notes.noNotices")}</span>}
      {notices.map(noteRow)}
    </div>
  );
}
