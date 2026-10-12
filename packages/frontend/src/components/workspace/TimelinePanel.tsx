import { useState } from "react";
import posthog from "posthog-js";
import { useWorkspaceStore } from "@/store";
import type { SectionType, SectionVersion } from "@/types";
import { apiUpdateSectionVersion } from "@/utils/api";
import { useAuth } from "@clerk/clerk-react";

import { useI18n } from "@/i18n";
// ─── Version Node ────────────────────────────────────────────

interface VersionNodeProps {
  version: SectionVersion;
  onRestore: (versionId: string) => void;
}

function VersionNode({ version, onRestore }: VersionNodeProps) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const patchVersionLocally = useWorkspaceStore((s) => s.patchVersionLocally);
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(version.versionName);
  const [summaryDraft, setSummaryDraft] = useState(version.changeSummary ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    const newName = nameDraft.trim() || version.versionName;
    const newSummary = summaryDraft.trim() || null;
    const patch: { versionName?: string; changeSummary?: string | null } = {};
    if (newName !== version.versionName) patch.versionName = newName;
    if (newSummary !== version.changeSummary) patch.changeSummary = newSummary;
    if (Object.keys(patch).length > 0) {
      await apiUpdateSectionVersion(version.sectionId, version.id, patch, getToken);
      patchVersionLocally(version.sectionId, version.id, patch);
    }
    setSaving(false);
    setEditOpen(false);
  };

  const editPanel = editOpen ? (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 6,
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-hover)",
        border: "1px solid var(--color-outline-md)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div>
        <div className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-mute)", marginBottom: 4 }}>{t("versions.name").toUpperCase()}</div>
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          maxLength={100}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--color-outline-md)",
            fontSize: 10,
            color: "var(--color-dim)",
            fontFamily: "inherit",
            outline: "none",
            padding: "2px 0",
          }}
        />
      </div>
      <div>
        <div className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-mute)", marginBottom: 4 }}>{t("versions.note").toUpperCase()}</div>
        <input
          value={summaryDraft}
          onChange={(e) => setSummaryDraft(e.target.value)}
          placeholder={t("versions.notePlaceholder")}
          maxLength={500}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--color-outline-md)",
            fontSize: 10,
            color: "var(--color-dim)",
            fontFamily: "inherit",
            outline: "none",
            padding: "2px 0",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={(e) => { e.stopPropagation(); setEditOpen(false); }}
          className="df-mono"
          style={{ fontSize: 10, padding: "3px 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-outline)", background: "transparent", color: "var(--color-faint)", cursor: "pointer" }}
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="df-mono"
          style={{ fontSize: 10, padding: "3px 8px", borderRadius: "var(--radius-xs)", border: "1px solid var(--color-heat-line)", background: "var(--color-heat-wash)", color: "var(--color-heat-soft)", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? t("versions.saving") : t("versions.save")}
        </button>
      </div>
    </div>
  ) : null;

  const pencilButton = (
    <button
      onClick={(e) => { e.stopPropagation(); setEditOpen((v) => !v); setNameDraft(version.versionName); setSummaryDraft(version.changeSummary ?? ""); }}
      title={t("versions.edit")}
      style={{
        display: "flex", alignItems: "center", padding: "2px 4px", marginLeft: "auto",
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--color-mute)", borderRadius: "var(--radius-xs)", transition: "color 0.15s", flexShrink: 0,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-faint)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-mute)"; }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>edit</span>
    </button>
  );

  if (version.isActive) {
    return (
      <div style={{ position: "relative", paddingLeft: 20 }}>
        <div style={{ position: "absolute", left: 0, top: -10, width: 14, height: 20, borderLeft: "1px solid var(--color-outline-md)", borderBottom: "1px solid var(--color-outline-md)", borderRadius: "0 0 0 6px" }} />
        <div style={{ background: "var(--color-heat-tint)", border: "1px solid var(--color-heat-strong)", borderRadius: "var(--radius-sm)", padding: "5px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-heat)", boxShadow: "0 0 6px var(--color-heat)", flexShrink: 0, cursor: "pointer" }} onClick={() => onRestore(version.id)} />
            <span className="df-mono" style={{ fontSize: 10, color: "var(--color-heat-soft)", fontWeight: 500, cursor: "pointer", flex: 1 }} onClick={() => onRestore(version.id)}>
              {version.versionName}
            </span>
            <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", padding: "2px 5px", borderRadius: "var(--radius-xs)", background: "var(--color-heat-strong)", color: "var(--color-heat-hi)", flexShrink: 0 }}>{t("g.ws.active")}</span>
            {pencilButton}
          </div>
          {version.changeSummary && !editOpen && (
            <div style={{ marginTop: 4, paddingLeft: 2 }}>
              <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", display: "block" }}>{version.changeSummary}</span>
            </div>
          )}
          {editPanel}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 20, opacity: editOpen ? 1 : 0.5, transition: "opacity 0.15s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      onMouseLeave={(e) => { if (!editOpen) (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
    >
      <div style={{ position: "absolute", left: 0, top: -10, width: 14, height: 20, borderLeft: "1px solid var(--color-outline)", borderBottom: "1px solid var(--color-outline)", borderRadius: "0 0 0 6px" }} />
      <div style={{ padding: "3px 6px", borderRadius: "var(--radius-xs)", transition: "background 0.15s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-hover)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-mute)", flexShrink: 0, cursor: "pointer" }} onClick={() => onRestore(version.id)} />
          <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", cursor: "pointer", flex: 1 }} onClick={() => onRestore(version.id)}>
            {version.versionName}
          </span>
          {pencilButton}
        </div>
        {version.changeSummary && !editOpen && (
          <div style={{ marginTop: 2, paddingLeft: 11 }}>
            <span className="df-mono" style={{ fontSize: 10, color: "var(--color-mute)", display: "block" }}>{version.changeSummary}</span>
          </div>
        )}
        {editPanel}
      </div>
    </div>
  );
}

// ─── Section Node ────────────────────────────────────────────

interface SectionNodeProps {
  sectionType: SectionType;
  status: "pending" | "drafting" | "refining" | "finalized";
  isActive: boolean;
  versionCount?: number;
  currentVersionIndex?: number;
  onClick: () => void;
}

function SectionNode({ sectionType, status, isActive, versionCount, currentVersionIndex, onClick }: SectionNodeProps) {
  const { t } = useI18n();
  const label = t(`section.${sectionType}`);
  const showVersion = versionCount != null && currentVersionIndex != null;

  const dotColor = status === "finalized"
    ? "var(--color-ok)"
    : isActive
    ? "var(--color-heat)"
    : "var(--color-mute)";

  const labelColor = status === "finalized"
    ? "var(--color-steel-hi)"
    : isActive
    ? "var(--color-heat-soft)"
    : "var(--color-faint)";

  const dotGlow = status === "finalized"
    ? "0 0 6px var(--color-ok-line)"
    : isActive
    ? "0 0 8px var(--color-heat-line), 0 0 0 3px var(--color-heat-strong)"
    : "none";

  return (
    <div
      style={{ position: "relative", paddingLeft: 28, cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget.querySelector(".sn-label") as HTMLElement | null)?.style.setProperty("color", "var(--color-dim)");
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget.querySelector(".sn-label") as HTMLElement | null)?.style.setProperty("color", labelColor);
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: status === "finalized"
            ? "var(--color-ok-wash)"
            : isActive
            ? "var(--color-chrome)"
            : "var(--color-surface)",
          border: `1.5px solid ${dotColor}`,
          boxShadow: dotGlow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {status === "finalized" && (
          <span className="material-symbols-outlined" style={{ fontSize: 8, color: "var(--color-ok)", fontVariationSettings: "'FILL' 1" }}>
            check
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span
          className="sn-label"
          style={{
            fontSize: 12.5,
            fontWeight: isActive ? 500 : 400,
            color: labelColor,
            transition: "color 0.15s",
          }}
        >
          {label}
        </span>
        {showVersion && (
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "var(--tracking-label)",
              color: isActive ? "var(--color-heat)" : "var(--color-mute)",
              padding: "1px 5px",
              borderRadius: "var(--radius-xs)",
              border: `1px solid ${isActive ? "var(--color-heat-line)" : "var(--color-outline)"}`,
              background: isActive ? "var(--color-heat-tint)" : "transparent",
            }}
          >
            v{currentVersionIndex} / {versionCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Panel ──────────────────────────────────────────

export function TimelinePanel() {
  const { t } = useI18n();
  const sections = useWorkspaceStore((s) => s.sections);
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSection);
  const versions = useWorkspaceStore((s) => s.getActiveSectionVersions());
  const restoreVersion = useWorkspaceStore((s) => s.restoreVersion);
  const finalizeSection = useWorkspaceStore((s) => s.finalizeSection);
  const createVersionSnapshot = useWorkspaceStore((s) => s.createVersionSnapshot);
  const saveActiveContent = useWorkspaceStore((s) => s.saveActiveContent);
  const getActiveSection = useWorkspaceStore((s) => s.getActiveSection);
  const getActiveVersionContent = useWorkspaceStore((s) => s.getActiveVersionContent);
  const viewMode = useWorkspaceStore((s) => s.getActiveViewMode());
  const documentId = useWorkspaceStore((s) => s.documentId);

  const isAwaitingAgent = useWorkspaceStore((s) => s.getActiveSectionIsAwaitingAgent());
  const isSendingMessage = useWorkspaceStore((s) => s.getActiveSectionIsSendingMessage());
  const isAIPending = isAwaitingAgent || isSendingMessage;
  const [saving, setSaving] = useState(false);

  const currentSection = getActiveSection();

  const handleRestore = (versionId: string) => {
    if (!currentSection || viewMode !== "editing") return;
    restoreVersion(currentSection.id, versionId);
    posthog.capture("refinement_version_restored", {
      document_id: documentId,
      section_id: currentSection.id,
      version_id: versionId,
    });
  };

  const handleFinalize = () => {
    if (!currentSection) return;
    finalizeSection(currentSection.id);
  };

  const handleNewVersion = () => {
    if (!currentSection || viewMode !== "editing" || isAIPending) return;
    posthog.capture("refinement_version_branched", { document_id: documentId, section_id: currentSection.id });
    void createVersionSnapshot(currentSection.id);
  };

  const handleSaveChanges = async () => {
    if (!currentSection || viewMode !== "editing" || saving) return;
    setSaving(true);
    try {
      await saveActiveContent();
      posthog.capture("refinement_changes_saved", {
        document_id: documentId,
        section_id: currentSection.id,
        content_length: getActiveVersionContent().length,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside
      style={{
        width: "20%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--color-outline)",
        background: "var(--color-chrome)",
        backdropFilter: "blur(4px)",
        padding: "0",
        zIndex: "var(--z-raised)",
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "14px 20px 12px",
          borderBottom: "1px solid var(--color-outline)",
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-faint)",
          }}
        >
          › {t("g.ws.versionGraph")}
        </span>
      </div>

      {/* Section list + versions */}
      <div
        className="hide-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}
      >
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

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {sections.map((section) => {
              const isActive = section.sectionType === activeSection;
              return (
                <div key={section.id}>
                  <SectionNode
                    sectionType={section.sectionType}
                    status={section.status}
                    isActive={isActive}
                    versionCount={section.versionCount}
                    currentVersionIndex={section.currentVersionIndex}
                    onClick={() => setActiveSection(section.sectionType)}
                  />
                  {isActive && versions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, marginLeft: 28 }}>
                      {versions.map((v) => (
                        <VersionNode key={v.id} version={v} onRestore={handleRestore} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {currentSection && viewMode === "editing" && currentSection.status !== "finalized" && (
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid var(--color-outline)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 11.5,
              fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--color-outline-md)",
              color: saving ? "var(--color-mute)" : "var(--color-faint)",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.5 : 1,
              transition: "all 0.15s",
              fontFamily: "var(--font-mono)",
              letterSpacing: "var(--tracking-data)",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { if (!saving) { (e.currentTarget as HTMLElement).style.color = "var(--color-dim)"; } }}
            onMouseLeave={(e) => { if (!saving) { (e.currentTarget as HTMLElement).style.color = "var(--color-faint)"; } }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
            {saving ? t("versions.saving") : t("versions.saveChanges")}
          </button>

          <button
            onClick={handleNewVersion}
            disabled={isAIPending}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 11.5,
              fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--color-outline-md)",
              color: isAIPending ? "var(--color-mute)" : "var(--color-faint)",
              cursor: isAIPending ? "not-allowed" : "pointer",
              opacity: isAIPending ? 0.5 : 1,
              transition: "all 0.15s",
              fontFamily: "var(--font-mono)",
              letterSpacing: "var(--tracking-data)",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { if (!isAIPending) { (e.currentTarget as HTMLElement).style.color = "var(--color-dim)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--color-outline-md)"; } }}
            onMouseLeave={(e) => { if (!isAIPending) { (e.currentTarget as HTMLElement).style.color = "var(--color-faint)"; } }}
          >
            <span
              className={`material-symbols-outlined ${isAIPending ? "animate-spin" : ""}`}
              style={{ fontSize: 14 }}
            >
              {isAIPending ? "autorenew" : "fork_right"}
            </span>
            {t("versions.new")}
          </button>

          <button
            onClick={handleFinalize}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 11.5,
              fontWeight: 600,
              background: "var(--color-heat-wash)",
              border: "1px solid var(--color-heat-line)",
              color: "var(--color-heat-soft)",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--font-mono)",
              letterSpacing: "var(--tracking-data)",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-heat-wash)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px var(--color-heat-strong)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-heat-wash)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
            {t("g.ws.finish")}
          </button>
        </div>
      )}

    </aside>
  );
}
