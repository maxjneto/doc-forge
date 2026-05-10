import { useWorkspaceStore, SECTION_LABELS } from "@/store";
import type { SectionType, SectionVersion } from "@/types";

// ─── Version Node ────────────────────────────────────────────

interface VersionNodeProps {
  version: SectionVersion;
  onRestore: (versionId: string) => void;
}

function VersionNode({ version, onRestore }: VersionNodeProps) {
  if (version.isActive) {
    return (
      <div style={{ position: "relative", paddingLeft: 20 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: -10,
            width: 14,
            height: 20,
            borderLeft: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
            borderBottom: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
            borderRadius: "0 0 0 6px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255,77,0,0.05)",
            border: "1px solid rgba(255,77,0,0.25)",
            borderRadius: 6,
            padding: "5px 8px",
            cursor: "pointer",
          }}
          onClick={() => onRestore(version.id)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--df-amber-500, #ff4d00)",
                boxShadow: "0 0 6px var(--df-amber-500)",
              }}
            />
            <span
              className="df-mono"
              style={{ fontSize: 10, color: "var(--df-amber-200, #ffb59e)", fontWeight: 500 }}
            >
              {version.versionName}
            </span>
          </div>
          <span
            className="df-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              padding: "2px 5px",
              borderRadius: 3,
              background: "rgba(255,77,0,0.15)",
              color: "var(--df-amber-300, #ff8d4a)",
            }}
          >
            Active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: "relative", paddingLeft: 20, opacity: 0.5, cursor: "pointer", transition: "opacity 0.15s" }}
      onClick={() => onRestore(version.id)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.5"; }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -10,
          width: 14,
          height: 20,
          borderLeft: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          borderRadius: "0 0 0 6px",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 6px",
          borderRadius: 4,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--df-mute, rgba(227,226,226,0.18))" }} />
        <span className="df-mono" style={{ fontSize: 10, color: "var(--df-faint, rgba(227,226,226,0.38))" }}>
          {version.versionName}
        </span>
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
  const label = SECTION_LABELS[sectionType];
  const showVersion = versionCount != null && currentVersionIndex != null;

  const dotColor = status === "finalized"
    ? "#4ade80"
    : isActive
    ? "var(--df-amber-500, #ff4d00)"
    : "var(--df-mute, rgba(227,226,226,0.18))";

  const labelColor = status === "finalized"
    ? "var(--df-steel-100, #b9c6d4)"
    : isActive
    ? "var(--df-amber-200, #ffb59e)"
    : "var(--df-faint, rgba(227,226,226,0.38))";

  const dotGlow = status === "finalized"
    ? "0 0 6px rgba(74,222,128,0.5)"
    : isActive
    ? "0 0 8px rgba(255,77,0,0.6), 0 0 0 3px rgba(255,77,0,0.15)"
    : "none";

  return (
    <div
      style={{ position: "relative", paddingLeft: 28, cursor: "pointer" }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget.querySelector(".sn-label") as HTMLElement | null)?.style.setProperty("color", "var(--df-dim, rgba(227,226,226,0.62))");
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
            ? "rgba(74,222,128,0.12)"
            : isActive
            ? "rgba(13,14,15,0.9)"
            : "rgba(18,20,20,0.9)",
          border: `1.5px solid ${dotColor}`,
          boxShadow: dotGlow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {status === "finalized" && (
          <span className="material-symbols-outlined" style={{ fontSize: 8, color: "#4ade80", fontVariationSettings: "'FILL' 1" }}>
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
              fontSize: 9,
              letterSpacing: "0.08em",
              color: isActive ? "var(--df-amber-500, #ff4d00)" : "var(--df-mute, rgba(227,226,226,0.18))",
              padding: "1px 5px",
              borderRadius: 4,
              border: `1px solid ${isActive ? "rgba(255,77,0,0.30)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
              background: isActive ? "rgba(255,77,0,0.06)" : "transparent",
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
  const sections = useWorkspaceStore((s) => s.sections);
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSection);
  const versions = useWorkspaceStore((s) => s.getActiveSectionVersions());
  const restoreVersion = useWorkspaceStore((s) => s.restoreVersion);
  const finalizeSection = useWorkspaceStore((s) => s.finalizeSection);
  const createVersionSnapshot = useWorkspaceStore((s) => s.createVersionSnapshot);
  const getActiveSection = useWorkspaceStore((s) => s.getActiveSection);
  const viewMode = useWorkspaceStore((s) => s.getActiveViewMode());

  const isAwaitingAgent = useWorkspaceStore((s) => s.getActiveSectionIsAwaitingAgent());
  const isSendingMessage = useWorkspaceStore((s) => s.getActiveSectionIsSendingMessage());
  const isAIPending = isAwaitingAgent || isSendingMessage;

  const currentSection = getActiveSection();

  const handleRestore = (versionId: string) => {
    if (!currentSection || viewMode !== "editing") return;
    restoreVersion(currentSection.id, versionId);
  };

  const handleFinalize = () => {
    if (!currentSection) return;
    finalizeSection(currentSection.id);
  };

  const handleNewVersion = () => {
    if (!currentSection || viewMode !== "editing" || isAIPending) return;
    void createVersionSnapshot(currentSection.id);
  };

  return (
    <aside
      style={{
        width: "20%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(10,11,12,0.7)",
        backdropFilter: "blur(4px)",
        padding: "0",
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "14px 20px 12px",
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
          › Version Graph
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
              background: "var(--df-outline, rgba(255,255,255,0.06))",
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
            borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleNewVersion}
            disabled={isAIPending}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              background: "transparent",
              border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
              color: isAIPending ? "var(--df-mute, rgba(227,226,226,0.18))" : "var(--df-faint, rgba(227,226,226,0.38))",
              cursor: isAIPending ? "not-allowed" : "pointer",
              opacity: isAIPending ? 0.5 : 1,
              transition: "all 0.15s",
              fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { if (!isAIPending) { (e.currentTarget as HTMLElement).style.color = "var(--df-dim, rgba(227,226,226,0.62))"; (e.currentTarget as HTMLElement).style.borderColor = "var(--df-outline-md, rgba(255,255,255,0.10))"; } }}
            onMouseLeave={(e) => { if (!isAIPending) { (e.currentTarget as HTMLElement).style.color = "var(--df-faint, rgba(227,226,226,0.38))"; } }}
          >
            <span
              className={`material-symbols-outlined ${isAIPending ? "animate-spin" : ""}`}
              style={{ fontSize: 14 }}
            >
              {isAIPending ? "autorenew" : "fork_right"}
            </span>
            New Version
          </button>

          <button
            onClick={handleFinalize}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(255,77,0,0.08)",
              border: "1px solid rgba(255,77,0,0.30)",
              color: "var(--df-amber-200, #ffb59e)",
              cursor: "pointer",
              transition: "all 0.15s",
              fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.14)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,77,0,0.20)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.08)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
            Finish Section
          </button>
        </div>
      )}

      {/* Meta footer */}
      <div
        style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--df-mute, rgba(227,226,226,0.18))" }}
        >
          Demo
        </span>
        <span
          className="df-mono"
          style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--df-mute, rgba(227,226,226,0.18))", display: "flex", alignItems: "center", gap: 5 }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#4ade80",
              boxShadow: "0 0 6px rgba(74,222,128,0.4)",
            }}
          />
          Live
        </span>
      </div>
    </aside>
  );
}
