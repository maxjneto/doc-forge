import { useEffect, useMemo, useState } from "react";
import type { ApplyResult, Comparison, Engine, LayoutDocument } from "@docforge-lib/layout";
import { Button, IconButton, Input, Pill, textStyle } from "@/components/ui";
import { ActorAvatar, useActorName } from "@/components/document";
import { useI18n } from "@/i18n";
import { apiGetLayoutRevision, apiListLayoutRevisions, apiSaveLayoutVersion, apiUpdateLayoutRevision, type LayoutNote, type LayoutRevisionItem } from "@/utils/api";
import { fullDate, relativeTime } from "@/utils/time";
import { describeChange } from "../changes";
import { describeRevision, GENERIC_DESCRIPTION, groupTimeline } from "../history";
import { track } from "../track";
import type { ExternalChange } from "../useLayoutEditor";
import { SectionTitle } from "./fields";

type GetToken = () => Promise<string | null>;

/** A past revision shown on the page instead of the current one. */
export interface ViewingVersion {
  revision: number;
  content: LayoutDocument;
  label: string;
  createdAt: string | null;
}

interface HistoryPanelProps {
  documentId: string;
  engine: Engine;
  doc: LayoutDocument;
  /** The current revision: the list reloads when it moves. */
  revision: number;
  external: ExternalChange | null;
  comparison: Comparison | null;
  commit: (ops: unknown[]) => ApplyResult;
  replaceAll: (content: LayoutDocument) => void;
  onDismissExternal: () => void;
  onShow: (id: string) => void;
  viewing: ViewingVersion | null;
  onView: (version: ViewingVersion | null) => void;
  notices: LayoutNote[];
  onDismissNotices: (notes: LayoutNote[]) => void;
  nameOf: (id: string) => string;
  canEdit: boolean;
  surfaceId: string | undefined;
  getToken: GetToken;
}

/**
 * What happened to the document: an agent's changes waiting for a look, the versions
 * someone saved on purpose (like the Markdown editor's), and every edit in a timeline
 * grouped by who made it. Any point can be opened on the page, compared with now and
 * brought back; bringing one back is a new edit, so nothing is ever lost.
 */
export function HistoryPanel(props: HistoryPanelProps) {
  const { documentId, engine, doc, revision, external, comparison, commit, replaceAll, onDismissExternal, onShow, viewing, onView, notices, onDismissNotices, nameOf, canEdit, surfaceId, getToken } = props;
  const { t, dateLocale: locale } = useI18n();
  const actorName = useActorName();
  const [revisions, setRevisions] = useState<LayoutRevisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ name: string; note: string } | null>(null);
  const [editing, setEditing] = useState<{ revision: number; name: string; note: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<number | null>(null);

  const reload = useMemo(
    () => () =>
      apiListLayoutRevisions(documentId, getToken, 120)
        .then(setRevisions)
        .catch(() => undefined)
        .finally(() => setLoading(false)),
    [documentId, getToken],
  );
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 300);
    return () => clearTimeout(timer);
  }, [reload, revision]);

  const named = revisions.filter((r) => r.name);
  const groups = useMemo(() => groupTimeline(revisions), [revisions]);
  const latest = revisions[0]?.revision ?? revision;
  const reasons = external
    ? revisions.filter((r) => r.revision > external.fromRevision && r.revision <= external.toRevision && r.description && !GENERIC_DESCRIPTION.test(r.description))
    : [];
  const sinceViewing = useMemo(() => (viewing ? engine.compare(viewing.content, doc, { surfaceId }) : null), [engine, viewing, doc, surfaceId]);

  const open = async (r: LayoutRevisionItem) => {
    if (viewing?.revision === r.revision) return onView(null);
    if (r.revision === latest) return onView(null);
    setOpening(r.revision);
    try {
      const past = await apiGetLayoutRevision(documentId, r.revision, getToken);
      track("layout_version_viewed", { back: latest - r.revision, named: Boolean(r.name) });
      onView({ revision: r.revision, content: past.content as LayoutDocument, label: r.name ?? describeRevision(r, t, nameOf), createdAt: r.createdAt });
    } finally {
      setOpening(null);
    }
  };
  const saveVersion = async () => {
    if (!saving?.name.trim()) return;
    await apiSaveLayoutVersion(documentId, saving.name.trim(), saving.note.trim() || null, getToken);
    track("layout_version_saved_ui", { has_note: Boolean(saving.note.trim()) });
    setSaving(null);
    void reload();
  };
  const saveEdit = async () => {
    if (!editing) return;
    await apiUpdateLayoutRevision(documentId, editing.revision, { name: editing.name.trim() || null, note: editing.note.trim() || null }, getToken);
    setEditing(null);
    void reload();
  };

  const when = (iso: string | null) => (iso ? relativeTime(iso, locale) : "");
  const row = (r: LayoutRevisionItem, nested: boolean) => {
    const on = viewing?.revision === r.revision;
    const current = r.revision === latest;
    return (
      <button
        key={r.revision}
        type="button"
        className="df-tl-item"
        data-on={on || undefined}
        data-nested={nested || undefined}
        aria-pressed={on}
        disabled={opening !== null}
        onClick={() => void open(r)}
        title={r.createdAt ? fullDate(r.createdAt, locale) : undefined}
      >
        <span className="df-tl-item__dot" data-agent={r.byAgent || undefined} data-named={r.name ? true : undefined} aria-hidden />
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          <span className="df-tl-item__text">
            {r.name && (
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 14, color: "var(--color-heat)" }}>
                bookmark
              </span>
            )}
            {r.name ?? describeRevision(r, t, nameOf)}
          </span>
          <span className="df-tl-item__meta">
            {when(r.createdAt)} · {t("layout.revision", { revision: r.revision })}
            {current ? ` · ${t("layout.history.now")}` : ""}
          </span>
        </span>
        {opening === r.revision && <span className="animate-pulse" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>…</span>}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {external && comparison && (
        <section className="df-callout df-callout--steel" style={{ gap: 10 }}>
          <SectionTitle
            action={
              <Button
                variant="ghost"
                onClick={() => {
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
          {reasons.map((r) => (
            <span key={r.revision} style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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

      {viewing && sinceViewing && (
        <section className="df-callout" style={{ gap: 8 }}>
          <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.history.sinceTitle", { count: sinceViewing.edits.length })}</span>
          {sinceViewing.edits.slice(0, 12).map((edit) => (
            <span key={edit.component} style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
              · {edit.kinds.map((k) => t(`layout.changes.kind.${k}`)).join(", ")} “{nameOf(edit.component)}”
            </span>
          ))}
          {sinceViewing.document.length > 0 && (
            <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
              · {t("layout.changes.document", { what: sinceViewing.document.map((d) => t(`layout.changes.doc.${d}`)).join(", ") })}
            </span>
          )}
          {sinceViewing.edits.length === 0 && sinceViewing.document.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.history.same")}</span>}
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle
          action={
            canEdit && !saving ? (
              <Button variant="secondary" icon="bookmark_add" iconPosition="start" onClick={() => setSaving({ name: "", note: "" })}>
                {t("layout.history.save")}
              </Button>
            ) : undefined
          }
        >
          {t("layout.history.versions")}
        </SectionTitle>
        {saving && (
          <form
            className="df-callout"
            onSubmit={(e) => {
              e.preventDefault();
              void saveVersion();
            }}
          >
            <Input autoFocus aria-label={t("versions.name")} placeholder={t("layout.history.namePlaceholder")} value={saving.name} maxLength={120} onChange={(e) => setSaving({ ...saving, name: e.target.value })} />
            <Input aria-label={t("versions.note")} placeholder={t("versions.notePlaceholder")} value={saving.note} maxLength={2000} onChange={(e) => setSaving({ ...saving, note: e.target.value })} />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setSaving(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={!saving.name.trim()}>
                {t("versions.save")}
              </Button>
            </div>
          </form>
        )}
        {named.length === 0 && !saving && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.history.noVersions")}</span>}
        {named.map((r) =>
          editing?.revision === r.revision ? (
            <form
              key={r.revision}
              className="df-callout"
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
            >
              <Input autoFocus aria-label={t("versions.name")} value={editing.name} maxLength={120} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input aria-label={t("versions.note")} placeholder={t("versions.notePlaceholder")} value={editing.note} maxLength={2000} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="primary">
                  {t("versions.save")}
                </Button>
              </div>
            </form>
          ) : (
            <div key={r.revision} className="df-version" data-on={viewing?.revision === r.revision || undefined}>
              <button type="button" className="df-version__main" onClick={() => void open(r)} aria-pressed={viewing?.revision === r.revision}>
                <span className="df-version__name">
                  <span className="material-symbols-outlined" aria-hidden>
                    bookmark
                  </span>
                  {r.name}
                  {r.revision === latest && (
                    <Pill compact tone="heat">
                      {t("versions.current")}
                    </Pill>
                  )}
                </span>
                {r.note && <span className="df-version__note">{r.note}</span>}
                <span className="df-tl-item__meta">
                  {actorName({ name: r.authorName, agent: r.byAgent })} · {when(r.createdAt)} · {t("layout.revision", { revision: r.revision })}
                </span>
              </button>
              {canEdit && (
                <div className="df-version__actions">
                  <IconButton icon="edit" label={t("versions.edit")} onClick={() => setEditing({ revision: r.revision, name: r.name ?? "", note: r.note ?? "" })} />
                  <IconButton
                    icon="bookmark_remove"
                    label={t("layout.history.unsave")}
                    onClick={() => void apiUpdateLayoutRevision(documentId, r.revision, { name: null }, getToken).then(() => reload())}
                  />
                </div>
              )}
            </div>
          ),
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SectionTitle>{t("layout.history.timeline")}</SectionTitle>
        {loading && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("common.loading")}</span>}
        <div className="df-timeline">
          {groups.map((g) => {
            if (g.items.length === 1 || g.byAgent) {
              return (
                <div key={g.key} className="df-tl-group">
                  <span className="df-tl-group__who" data-agent={g.byAgent || undefined}>
                    <ActorAvatar actor={{ name: g.authorName, agent: g.byAgent, harness: g.harness }} size={18} />
                    {actorName({ name: g.authorName, agent: g.byAgent })}
                  </span>
                  {g.items.map((r) => row(r, false))}
                </div>
              );
            }
            const expanded = openGroups.has(g.key);
            return (
              <div key={g.key} className="df-tl-group">
                <button
                  type="button"
                  className="df-tl-group__who df-tl-group__toggle"
                  aria-expanded={expanded}
                  onClick={() => setOpenGroups((s) => (s.has(g.key) ? new Set([...s].filter((k) => k !== g.key)) : new Set([...s, g.key])))}
                >
                  <ActorAvatar actor={{ name: g.authorName, agent: false }} size={18} />
                  {g.authorName ? `${g.authorName} · ` : ""}
                  {t("layout.history.session", { count: g.items.length, when: when(g.to) })}
                  <span className="material-symbols-outlined" aria-hidden style={{ marginLeft: "auto" }}>
                    {expanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {(expanded ? g.items : g.items.slice(0, 1)).map((r) => row(r, true))}
              </div>
            );
          })}
        </div>
      </section>

      {notices.length > 0 && (
        <details className="df-disclosure">
          <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.notes.notices", { count: notices.length })}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10 }}>
            <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.notes.noticesHint")}</span>
            {notices.map((n) => (
              <span key={n.id} style={{ ...textStyle.caption, color: "var(--color-dim)", display: "flex", gap: 8, alignItems: "baseline" }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: n.severity === "warning" ? "var(--color-warn)" : "var(--color-faint)" }} />
                <span style={{ flex: 1 }}>{describeChange({ ...n, component: n.anchor.component ?? null }, t, nameOf)}</span>
                {n.anchor.component && (
                  <IconButton icon="my_location" label={t("layout.notes.show")} onClick={() => onShow(n.anchor.component as string)} />
                )}
              </span>
            ))}
            {canEdit && (
              <Button variant="ghost" icon="done_all" iconPosition="start" onClick={() => onDismissNotices(notices)}>
                {t("layout.notes.dismissAll")}
              </Button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
