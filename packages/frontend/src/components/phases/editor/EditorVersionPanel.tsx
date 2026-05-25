import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import DiffMatchPatch from "diff-match-patch";
import type { SectionVersion } from "@/types";
import {
  apiFetchVersions,
  apiCreateVersionSnapshot,
  apiRestoreVersion,
  apiUpdateSectionVersion,
  apiUpdateSectionContent,
} from "@/utils/api";

const dmp = new DiffMatchPatch();

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
          borderLeft: `1px solid ${version.isActive ? "var(--df-outline-md, rgba(255,255,255,0.10))" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
          borderBottom: `1px solid ${version.isActive ? "var(--df-outline-md, rgba(255,255,255,0.10))" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
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
            ? "rgba(255,77,0,0.05)"
            : isSelected
            ? "rgba(255,255,255,0.03)"
            : "transparent",
          border: `1px solid ${version.isActive ? "rgba(255,77,0,0.20)" : isSelected ? "rgba(255,255,255,0.06)" : "transparent"}`,
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
                ? "var(--df-amber-500, #ff4d00)"
                : "var(--df-mute, rgba(227,226,226,0.18))",
              boxShadow: version.isActive ? "0 0 6px var(--df-amber-500)" : "none",
            }}
          />
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              fontWeight: version.isActive ? 600 : 400,
              color: version.isActive
                ? "var(--df-amber-200, #ffb59e)"
                : "var(--df-faint, rgba(227,226,226,0.38))",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {version.versionName}
          </span>
          {version.isActive && (
            <span
              className="df-mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                padding: "1px 5px",
                borderRadius: 3,
                background: "rgba(255,77,0,0.15)",
                color: "var(--df-amber-300, #ff8d4a)",
                flexShrink: 0,
              }}
            >
              Active
            </span>
          )}
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
              color: "var(--df-mute, rgba(227,226,226,0.18))",
              borderRadius: 3,
              flexShrink: 0,
              transition: "color 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint, rgba(227,226,226,0.38))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-mute, rgba(227,226,226,0.18))"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
          </button>
        </div>

        {/* Note */}
        {version.changeSummary && !editOpen && (
          <div style={{ marginTop: 3, paddingLeft: 11 }}>
            <span
              className="df-mono"
              style={{ fontSize: 9, color: "var(--df-mute, rgba(227,226,226,0.18))", display: "block" }}
            >
              {version.changeSummary}
            </span>
          </div>
        )}

        {/* Timestamp */}
        {!editOpen && (
          <div style={{ marginTop: 3, paddingLeft: 11 }}>
            <span className="df-mono" style={{ fontSize: 9, color: "var(--df-mute, rgba(227,226,226,0.18))" }}>
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
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div>
              <div className="df-mono" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--df-mute, rgba(227,226,226,0.18))", marginBottom: 4 }}>NAME</div>
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
                  color: "var(--df-dim, rgba(227,226,226,0.62))",
                  fontFamily: "inherit",
                  outline: "none",
                  padding: "2px 0",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <div className="df-mono" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--df-mute, rgba(227,226,226,0.18))", marginBottom: 4 }}>NOTE</div>
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
                  color: "var(--df-dim, rgba(227,226,226,0.62))",
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
                style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid var(--df-outline, rgba(255,255,255,0.06))", background: "transparent", color: "var(--df-faint, rgba(227,226,226,0.38))", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMeta}
                disabled={saving}
                className="df-mono"
                style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,77,0,0.35)", background: "rgba(255,77,0,0.08)", color: "var(--df-amber-200, #ffb59e)", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
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
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid rgba(255,77,0,0.30)",
              background: "rgba(255,77,0,0.08)",
              color: "var(--df-amber-300, #ff8d4a)",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>swap_horiz</span>
            Switch to version
          </button>
        )}
      </div>

      {/* Diff pane */}
      {showDiff && (
        <div
          style={{
            marginTop: 6,
            padding: "10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            maxHeight: 200,
            overflowY: "auto",
          }}
          className="hide-scrollbar"
        >
          <div className="df-mono" style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(227,226,226,0.25)", marginBottom: 6, textTransform: "uppercase" }}>
            Diff vs current
          </div>
          <DiffView oldText={currentContent} newText={version.content} />
        </div>
      )}
    </div>
  );
}

// ─── Diff view ────────────────────────────────────────────────

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  return (
    <pre
      style={{
        fontFamily: "var(--df-font-mono, monospace)",
        fontSize: 10,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        color: "rgba(227,226,226,0.6)",
      }}
    >
      {diffs.map(([op, text], i) => (
        <span
          key={i}
          style={{
            background: op === 1 ? "rgba(80,200,120,0.15)" : op === -1 ? "rgba(232,100,100,0.15)" : "transparent",
            color: op === 1 ? "#50c878" : op === -1 ? "#e86464" : "rgba(227,226,226,0.45)",
            textDecoration: op === -1 ? "line-through" : "none",
          }}
        >
          {text}
        </span>
      ))}
    </pre>
  );
}

// ─── Version Panel ────────────────────────────────────────────

interface EditorVersionPanelProps {
  sectionId: string;
  currentContent: string;
  refreshTick: number;
  onVersionSwitch: (switchedContent: string) => void;
  onFlushSave: () => Promise<void>;
}

export function EditorVersionPanel({ sectionId, currentContent, refreshTick, onVersionSwitch, onFlushSave }: EditorVersionPanelProps) {
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
      // Flush pending auto-save so the current edit is committed before we switch
      await onFlushSave();
      await apiRestoreVersion(sectionId, version.id, getToken);
      // Re-fetch all versions to get fresh content — auto-save may have written
      // to the old active version since the component first mounted, making the
      // local version.content stale.
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
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(0,0,0,0.20)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px 12px",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-faint, rgba(227,226,226,0.38))",
          }}
        >
          › Versions
        </span>
      </div>

      {/* Version list with tree-style trunk */}
      <div
        className="hide-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "16px 18px 0" }}
      >
        {versions.length === 0 ? (
          <p style={{ fontSize: 11, color: "var(--df-mute, rgba(227,226,226,0.18))", lineHeight: 1.5, margin: 0 }}>
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
                background: "var(--df-outline, rgba(255,255,255,0.06))",
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

      {/* Action buttons */}
      <div
        style={{
          padding: "14px 16px",
          borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
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
            border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
            color: saving ? "var(--df-mute, rgba(227,226,226,0.18))" : "var(--df-faint, rgba(227,226,226,0.38))",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            transition: "all 0.15s",
            fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.color = "var(--df-dim, rgba(227,226,226,0.62))"; }}
          onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.color = "var(--df-faint, rgba(227,226,226,0.38))"; }}
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
            background: "rgba(255,77,0,0.08)",
            border: "1px solid rgba(255,77,0,0.30)",
            color: snapshotting ? "rgba(255,77,0,0.4)" : "var(--df-amber-200, #ffb59e)",
            cursor: snapshotting ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => { if (!snapshotting) { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.14)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,77,0,0.15)"; } }}
          onMouseLeave={(e) => { if (!snapshotting) { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; } }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>fork_right</span>
          {snapshotting ? "Saving…" : "New version"}
        </button>
      </div>
    </aside>
  );
}
