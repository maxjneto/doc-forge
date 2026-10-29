import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { SectionVersion } from "@/types";
import {
  apiFetchVersions,
  apiCreateVersionSnapshot,
  apiRestoreVersion,
  apiUpdateSectionVersion,
  apiUpdateSectionContent,
} from "@/utils/api";
import { ScrollFadeContainer } from "./ScrollFadeContainer";
import { diffHunks, type Hunk } from "@/utils/diff";
import { Button, Eyebrow, IconButton, Input, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { fullDate, relativeTime } from "@/utils/time";

// ─── Version item ─────────────────────────────────────────────

interface VersionItemProps {
  version: SectionVersion;
  isSelected: boolean;
  currentContent: string;
  onSelect: () => void;
  onSwitch: (v: SectionVersion) => void;
  onPatch: (id: string, patch: { versionName?: string; changeSummary?: string | null }) => void;
}

function VersionItem({ version, isSelected, currentContent, onSelect, onSwitch, onPatch }: VersionItemProps) {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(version.versionName);
  const [noteDraft, setNoteDraft] = useState(version.changeSummary ?? "");
  const [saving, setSaving] = useState(false);

  const openEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameDraft(version.versionName);
    setNoteDraft(version.changeSummary ?? "");
    setEditOpen(true);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen(false);
  };

  const handleSaveMeta = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    const patch: { versionName?: string; changeSummary?: string | null } = {};
    const newName = nameDraft.trim() || version.versionName;
    const newNote = noteDraft.trim() || null;
    if (newName !== version.versionName) patch.versionName = newName;
    if (newNote !== version.changeSummary) patch.changeSummary = newNote;
    if (Object.keys(patch).length > 0) {
      await apiUpdateSectionVersion(version.sectionId, version.id, patch, getToken);
      onPatch(version.id, patch);
    }
    setSaving(false);
    setEditOpen(false);
  };

  const showDiff = isSelected && !version.isActive;

  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      {/* L-connector to the trunk */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: -10,
          width: 14,
          height: 22,
          borderLeft: "1px solid var(--color-outline-md)",
          borderBottom: "1px solid var(--color-outline-md)",
          borderRadius: "0 0 0 var(--radius-sm)",
        }}
      />

      <div
        className="df-row"
        role="button"
        tabIndex={0}
        aria-expanded={isSelected}
        onClick={onSelect}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) onSelect(); }}
        style={{
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: version.isActive ? "var(--color-heat-tint)" : isSelected ? "var(--color-hover)" : undefined,
          boxShadow: version.isActive ? "inset 2px 0 0 var(--color-heat)" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12.5,
              fontWeight: version.isActive ? 600 : 500,
              color: version.isActive || isSelected ? "var(--color-text)" : "var(--color-dim)",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {version.versionName}
          </span>
          {version.isActive && <Pill tone="heat" compact>{t("versions.current")}</Pill>}
          {version.isPublished && <Pill tone="steel" compact dot={false}>{t("versions.published")}</Pill>}
          <div className="df-row-actions">
            <IconButton icon="edit" label={t("versions.edit")} onClick={openEdit} style={{ width: 24, height: 24 }} />
          </div>
        </div>

        {version.changeSummary && !editOpen && (
          <div style={{ marginTop: 3, fontSize: 11.5, lineHeight: 1.45, color: "var(--color-faint)" }}>
            {version.changeSummary}
          </div>
        )}

        {!editOpen && (
          <div
            title={fullDate(version.createdAt, dateLocale)}
            style={{ marginTop: 3, fontSize: 11.5, color: "var(--color-mute)", fontVariantNumeric: "tabular-nums" }}
          >
            {relativeTime(version.createdAt, dateLocale)}
          </div>
        )}

        {editOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...textStyle.label, color: "var(--color-faint)" }}>{t("versions.name")}</span>
              <Input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={100} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ ...textStyle.label, color: "var(--color-faint)" }}>{t("versions.note")}</span>
              <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={t("versions.notePlaceholder")} maxLength={500} />
            </label>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={cancelEdit}>{t("common.cancel")}</Button>
              <Button onClick={handleSaveMeta} disabled={saving}>{saving ? t("versions.saving") : t("versions.save")}</Button>
            </div>
          </div>
        )}

        {showDiff && (
          <Button
            icon="swap_horiz"
            iconPosition="start"
            onClick={(e) => { e.stopPropagation(); onSwitch(version); }}
            style={{ marginTop: 10 }}
          >
            {t("versions.restore")}
          </Button>
        )}
      </div>

      {/* Diff pane — inline, the tab's single outer scroll owns it */}
      {showDiff && (
        <div
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-mid)",
            border: "1px solid var(--color-outline)",
          }}
        >
          <Eyebrow style={{ marginBottom: 8 }}>{t("versions.diffVsCurrent")}</Eyebrow>
          <DiffView oldText={currentContent} newText={version.content} />
        </div>
      )}
    </div>
  );
}

// ─── Change summary ───────────────────────────────────────────

/**
 * What changed between two versions — sections first, detail on demand.
 *
 * The old view ran a character-level diff over the whole document and printed
 * it into this 340px column, which for a long document was a wall of text. A
 * version comparison should start by answering "which parts moved", and only
 * then show the lines.
 */
function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const hunks = diffHunks(oldText, newText);

  const bySection = hunks.reduce<Record<string, Hunk[]>>((acc, h) => {
    const key = h.heading?.text ?? "(sem seção)";
    (acc[key] ??= []).push(h);
    return acc;
  }, {});
  const sections = Object.entries(bySection);

  if (hunks.length === 0) {
    return (
      <div style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.6 }}>
        Idêntica à versão atual.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
        {hunks.length} {hunks.length === 1 ? "MUDANÇA" : "MUDANÇAS"} EM {sections.length}{" "}
        {sections.length === 1 ? "SEÇÃO" : "SEÇÕES"}
      </div>

      {sections.map(([section, list]) => (
        <SectionChanges key={section} section={section} hunks={list} />
      ))}
    </div>
  );
}

function SectionChanges({ section, hunks }: { section: string; hunks: Hunk[] }) {
  const [open, setOpen] = useState(false);
  const added = hunks.reduce((n, h) => n + h.added, 0);
  const removed = hunks.reduce((n, h) => n + h.removed, 0);

  return (
    <div
      style={{
        border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-mid)",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 11.5,
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {section}
        </span>
        {added > 0 && (
          <span className="df-mono" style={{ fontSize: 10, color: "var(--color-ok)" }}>
            +{added}
          </span>
        )}
        {removed > 0 && (
          <span className="df-mono" style={{ fontSize: 10, color: "var(--color-error)" }}>
            −{removed}
          </span>
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--color-outline)" }}>
          {hunks.map((h) =>
            h.rows
              .filter((r) => r.kind !== "context")
              .map((r, i) => (
                <div
                  key={`${h.index}-${i}`}
                  className="df-mono"
                  style={{
                    display: "flex",
                    gap: 6,
                    padding: "1px 10px",
                    fontSize: 11.5,
                    lineHeight: 1.6,
                    background:
                      r.kind === "add" ? "var(--color-diff-add-bg)" : "var(--color-diff-del-bg)",
                    color:
                      r.kind === "add" ? "var(--color-diff-add-fg)" : "var(--color-diff-del-fg)",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{r.kind === "add" ? "+" : "−"}</span>
                  <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", minWidth: 0 }}>
                    {r.text || " "}
                  </span>
                </div>
              )),
          )}
        </div>
      )}
    </div>
  );
}

// ─── Version Panel ────────────────────────────────────────────

interface EditorVersionPanelProps {
  sectionId: string;
  documentId: string;
  currentContent: string;
  refreshTick: number;
  onVersionSwitch: (switchedContent: string) => void;
}

/** Versions tab content — full height; the tab bar carries the "Versions"
 * label, so no own header here. */
export function EditorVersionPanel({ sectionId, documentId, currentContent, refreshTick, onVersionSwitch }: EditorVersionPanelProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [versions, setVersions] = useState<SectionVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      apiFetchVersions(sectionId, () => Promise.resolve(token))
        .then((vs) => { if (!cancelled) setVersions(vs.slice().reverse()); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [sectionId, getToken, refreshTick]);

  async function handleSaveChanges() {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await apiUpdateSectionContent(sectionId, currentContent, getToken);
      setVersions((prev) =>
        prev.map((v) => (v.isActive ? { ...v, content: updated.content } : v))
      );
      posthog.capture("editor_changes_saved", {
        document_id: documentId,
        section_id: sectionId,
        content_length: currentContent.length,
      });
    } finally {
      setSaving(false);
    }
  }

  async function refetchVersions() {
    const fresh = await apiFetchVersions(sectionId, getToken);
    setVersions(fresh.slice().reverse());
    return fresh;
  }

  async function handleSnapshot() {
    if (snapshotting) return;
    setSnapshotting(true);
    try {
      await apiCreateVersionSnapshot(sectionId, getToken);
      posthog.capture("editor_version_created", { section_id: sectionId });
      // Re-fetch so old versions have their latest auto-saved content in state
      await refetchVersions();
      setSelectedId(null);
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleSwitch(version: SectionVersion) {
    if (switching) return;
    setSwitching(true);
    try {
      await apiRestoreVersion(sectionId, version.id, getToken);
      posthog.capture("editor_version_restored", { section_id: sectionId, version_id: version.id });
      const fresh = await apiFetchVersions(sectionId, getToken);
      setVersions(fresh.slice().reverse());
      const target = fresh.find((v) => v.id === version.id);
      onVersionSwitch(target?.content ?? version.content);
      setSelectedId(null);
    } finally {
      setSwitching(false);
    }
  }

  function handlePatch(id: string, patch: { versionName?: string; changeSummary?: string | null }) {
    setVersions((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              ...(patch.versionName !== undefined && { versionName: patch.versionName }),
              ...(patch.changeSummary !== undefined && { changeSummary: patch.changeSummary }),
            }
          : v
      )
    );
  }

  return (
    <aside
      style={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Version list with tree-style trunk — single scroll region for the tab */}
      <ScrollFadeContainer fadeColor="var(--color-bg)">
        <div style={{ padding: "16px 18px 0" }}>
          {versions.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--color-faint)", lineHeight: 1.55, margin: 0 }}>
              {t("versions.empty")}
            </p>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Vertical trunk */}
              <div
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  bottom: 0,
                  width: 1,
                  background: "var(--color-outline)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {versions.map((v) => (
                  <VersionItem
                    key={v.id}
                    version={v}
                    isSelected={selectedId === v.id}
                    currentContent={currentContent}
                    onSelect={() => setSelectedId(selectedId === v.id ? null : v.id)}
                    onSwitch={handleSwitch}
                    onPatch={handlePatch}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollFadeContainer>

      {/* Action buttons — pinned below the scroll area, always visible */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--color-outline)",
          flexShrink: 0,
        }}
      >
        {/* Both quiet: the document bar already owns the one primary (Publish). */}
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon="save" iconPosition="start" grow onClick={handleSaveChanges} disabled={saving}>
            {saving ? t("versions.saving") : t("versions.saveChanges")}
          </Button>
          <Button icon="fork_right" iconPosition="start" grow onClick={handleSnapshot} disabled={snapshotting}>
            {snapshotting ? t("versions.saving") : t("versions.new")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
