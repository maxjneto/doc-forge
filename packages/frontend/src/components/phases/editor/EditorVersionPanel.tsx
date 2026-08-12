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
      {/* L-connector */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -10,
          width: 14,
          height: 20,
          borderLeft: `1px solid ${version.isActive ? "var(--df-outline-md)" : "var(--df-outline)"}`,
          borderBottom: `1px solid ${version.isActive ? "var(--df-outline-md)" : "var(--df-outline)"}`,
          borderRadius: "0 0 0 6px",
        }}
      />

      <div
        onClick={onSelect}
        style={{
          padding: "6px 8px",
          borderRadius: 6,
          cursor: "pointer",
          background: version.isActive
            ? "var(--color-heat-05)"
            : isSelected
            ? "var(--color-white-03)"
            : "transparent",
          border: `1px solid ${version.isActive ? "var(--color-heat-20)" : isSelected ? "var(--df-outline)" : "transparent"}`,
          transition: "background 0.12s, border-color 0.12s",
          opacity: !version.isActive && !isSelected ? 0.55 : 1,
        }}
        onMouseEnter={(e) => {
          if (!version.isActive && !isSelected)
            (e.currentTarget as HTMLElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          if (!version.isActive && !isSelected)
            (e.currentTarget as HTMLElement).style.opacity = "0.55";
        }}
      >
        {/* Row: dot + name + badge + pencil */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              flexShrink: 0,
              background: version.isActive
                ? "var(--df-amber-500)"
                : "var(--df-mute)",
              boxShadow: version.isActive ? "0 0 6px var(--df-amber-500)" : "none",
            }}
          />
          <span
            className="df-mono"
            style={{
              fontSize: 11,
              fontWeight: version.isActive ? 600 : 400,
              color: version.isActive
                ? "var(--df-amber-200)"
                : "var(--df-faint)",
              flex: 1,
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {version.versionName}
          </span>
          {/* Pencil */}
          <button
            onClick={openEdit}
            title="Edit name / note"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "2px 3px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--df-mute)",
              borderRadius: 3,
              flexShrink: 0,
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-mute)"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
          </button>
        </div>

        {/* Note */}
        {version.changeSummary && !editOpen && (
          <div style={{ marginTop: 3, paddingLeft: 11 }}>
            <span
              className="df-mono"
              style={{ fontSize: 10.5, lineHeight: 1.4, color: "var(--df-faint)", display: "block" }}
            >
              {version.changeSummary}
            </span>
          </div>
        )}

        {/* Timestamp */}
        {!editOpen && (
          <div style={{ marginTop: 3, paddingLeft: 11 }}>
            <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-mute)" }}>
              {new Date(version.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>
        )}

        {/* Inline edit form */}
        {editOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: 8,
              padding: "10px 10px",
              borderRadius: 6,
              background: "var(--color-white-03)",
              border: "1px solid var(--df-outline-md)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>
              <div className="df-mono" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--df-mute)", marginBottom: 4 }}>NAME</div>
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={100}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 10,
                  color: "var(--df-dim)",
                  fontFamily: "inherit",
                  outline: "none",
                  padding: "2px 0",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <div className="df-mono" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--df-mute)", marginBottom: 4 }}>NOTE</div>
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note…"
                maxLength={500}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  fontSize: 10,
                  color: "var(--df-dim)",
                  fontFamily: "inherit",
                  outline: "none",
                  padding: "2px 0",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={cancelEdit}
                className="df-mono"
                style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--df-outline)", background: "transparent", color: "var(--df-faint)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMeta}
                disabled={saving}
                className="df-mono"
                style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,77,0,0.35)", background: "var(--color-heat-08)", color: "var(--df-amber-200)", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Switch button when selected and not active */}
        {showDiff && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwitch(version); }}
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 4,
              border: "1px solid rgba(255,77,0,0.30)",
              background: "var(--color-heat-08)",
              color: "var(--df-amber-300)",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>swap_horiz</span>
            Switch to version
          </button>
        )}
      </div>

      {/* Diff pane — renders inline (no nested scroll: the tab's single
          outer scroll owns this) */}
      {showDiff && (
        <div
          style={{
            marginTop: 6,
            padding: "10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="df-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "rgba(227,226,226,0.3)", marginBottom: 6, textTransform: "uppercase" }}>
            Diff vs current
          </div>
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
      <div style={{ fontSize: 11.5, color: "var(--df-faint)", lineHeight: 1.6 }}>
        Idêntica à versão atual.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
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
        border: "1px solid var(--df-outline)",
        borderRadius: "var(--radius-sm)",
        background: "var(--df-surface-mid)",
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
            color: "var(--df-on-surface)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {section}
        </span>
        {added > 0 && (
          <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-ok)" }}>
            +{added}
          </span>
        )}
        {removed > 0 && (
          <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-error)" }}>
            −{removed}
          </span>
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--df-outline)" }}>
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
                    fontSize: 11,
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
      <ScrollFadeContainer fadeColor="rgba(0,0,0,0.94)">
        <div style={{ padding: "16px 18px 0" }}>
          {versions.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--df-mute)", lineHeight: 1.5, margin: 0 }}>
              No versions yet. Save a snapshot to start tracking history.
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
                  background: "var(--df-outline)",
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
          padding: "14px 16px",
          borderTop: "1px solid var(--df-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Save changes to active version */}
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            background: "transparent",
            border: "1px solid var(--df-outline-md)",
            color: saving ? "var(--df-mute)" : "var(--df-faint)",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            transition: "all 0.15s",
            fontFamily: "var(--df-font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.color = "var(--df-dim)"; }}
          onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.color = "var(--df-faint)"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>save</span>
          {saving ? "Saving…" : "Save changes"}
        </button>

        {/* Create new version snapshot */}
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: "var(--color-heat-08)",
            border: "1px solid rgba(255,77,0,0.30)",
            color: snapshotting ? "rgba(255,77,0,0.4)" : "var(--df-amber-200)",
            cursor: snapshotting ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            fontFamily: "var(--df-font-mono)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => { if (!snapshotting) { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.14)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,77,0,0.15)"; } }}
          onMouseLeave={(e) => { if (!snapshotting) { (e.currentTarget as HTMLElement).style.background = "var(--color-heat-08)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>fork_right</span>
          {snapshotting ? "Saving…" : "New version"}
        </button>
      </div>
    </aside>
  );
}
