import { useRef, useState } from "react";
import { EditorGatePanel } from "./EditorGatePanel";
import { EditorSuggestionPanel } from "./EditorSuggestionPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";

type Tab = "gate" | "review" | "versions";

interface EditorSidebarTabsProps {
  documentId: string;
  sectionId: string;
  currentContent: string;
  refreshTick: number;
  onSuggestionResolved: () => void;
  onVersionSwitch: (content: string) => void;
}

/** Tab bar for Quality Gate + Review + Versions, each getting the full
 * height of the sidebar column when active — one scroll region per tab, no
 * fixed-percentage stacking (that's what used to clip the Accept/Reject
 * buttons). Defaults to whichever needs attention: Review if there are
 * pending suggestions, else Quality Gate if it's blocking, else Versions. */
export function EditorSidebarTabs({
  documentId,
  sectionId,
  currentContent,
  refreshTick,
  onSuggestionResolved,
  onVersionSwitch,
}: EditorSidebarTabsProps) {
  const [tab, setTab] = useState<Tab>("versions");
  const [reviewCount, setReviewCount] = useState(0);
  const [gateStatus, setGateStatus] = useState({ openFindings: 0, blocking: false });
  const defaultApplied = useRef(false);

  function applyDefault(reviewN: number, blocking: boolean) {
    if (defaultApplied.current) return;
    defaultApplied.current = true;
    if (reviewN > 0) setTab("review");
    else if (blocking) setTab("gate");
  }

  function handleReviewCount(count: number) {
    setReviewCount(count);
    applyDefault(count, gateStatus.blocking);
  }

  function handleGateStatus(openFindings: number, blocking: boolean) {
    setGateStatus({ openFindings, blocking });
    applyDefault(reviewCount, blocking);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          flexShrink: 0,
        }}
      >
        <TabButton
          label="Gate"
          count={gateStatus.openFindings}
          badgeTone={gateStatus.blocking ? "danger" : "warn"}
          active={tab === "gate"}
          accent="#ffd25e"
          onClick={() => setTab("gate")}
        />
        <TabButton
          label="Review"
          count={reviewCount}
          badgeTone="info"
          active={tab === "review"}
          accent="#8aa8ff"
          onClick={() => setTab("review")}
        />
        <TabButton
          label="Versions"
          active={tab === "versions"}
          accent="var(--df-amber-300, #ff8d4a)"
          onClick={() => setTab("versions")}
        />
      </div>

      {/* Active tab content — all three stay mounted (display:none when
          inactive) so background refreshes keep tab badges current even
          while looking at a different tab, and switching tabs never re-fetches. */}
      <div style={{ flex: 1, minHeight: 0, display: tab === "gate" ? "flex" : "none" }}>
        <EditorGatePanel
          documentId={documentId}
          refreshTick={refreshTick}
          onStatusChange={handleGateStatus}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: tab === "review" ? "flex" : "none" }}>
        <EditorSuggestionPanel
          documentId={documentId}
          refreshTick={refreshTick}
          onSuggestionResolved={onSuggestionResolved}
          onCountChange={handleReviewCount}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: tab === "versions" ? "flex" : "none" }}>
        <EditorVersionPanel
          sectionId={sectionId}
          documentId={documentId}
          currentContent={currentContent}
          refreshTick={refreshTick}
          onVersionSwitch={onVersionSwitch}
        />
      </div>
    </div>
  );
}

function TabButton({
  label,
  count,
  badgeTone = "info",
  active,
  accent,
  onClick,
}: {
  label: string;
  count?: number;
  badgeTone?: "info" | "warn" | "danger";
  active: boolean;
  accent: string;
  onClick: () => void;
}) {
  const badgeColors = {
    info: { bg: "rgba(120,160,255,0.15)", fg: "#b8c8ff" },
    warn: { bg: "rgba(255,196,0,0.15)", fg: "#ffd25e" },
    danger: { bg: "rgba(232,100,100,0.2)", fg: "#e88" },
  }[badgeTone];

  return (
    <button
      onClick={onClick}
      className="df-mono"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "12px 10px",
        fontSize: 10.5,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: active ? 600 : 400,
        color: active ? accent : "var(--df-faint, rgba(227,226,226,0.38))",
        background: active ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? accent : "transparent"}`,
        cursor: "pointer",
      }}
    >
      {label}
      {Boolean(count) && (
        <span
          style={{
            fontSize: 9,
            padding: "1px 6px",
            borderRadius: 8,
            background: badgeColors.bg,
            color: badgeColors.fg,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
