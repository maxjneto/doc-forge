import { useRef, useState } from "react";
import { EditorGatePanel } from "./EditorGatePanel";
import { EditorSuggestionPanel } from "./EditorSuggestionPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";
import type { Suggestion } from "@/types";
import { Tab } from "@/components/ui";
import { EditorArtifactPanel } from "./EditorArtifactPanel";
import type { Artifact, AuditFinding } from "@/types";
import { useI18n } from "@/i18n";

type Tab = "gate" | "review" | "artifacts" | "versions";

interface EditorSidebarTabsProps {
  documentId: string;
  sectionId: string;
  currentContent: string;
  refreshTick: number;
  onSuggestionResolved: () => void;
  onVersionSwitch: (content: string) => void;
  /** Pending suggestions, lifted so the nav can tally changes per section. */
  onPendingChange?: (suggestions: Suggestion[]) => void;
  /** Opens an artifact full-screen in the centre panel. */
  onArtifactOpen?: (artifact: Artifact) => void;
  /** Per-hunk triage state, owned by the layout and shown in the Review footer. */
  triage?: TriageState;
  /** Blocking gate findings, lifted so the document bar can refuse publishing. */
  onGateBlockingChange?: (count: number) => void;
  /** Open findings, so the centre panel can draw them inside the text. */
  onFindingsChange?: (findings: AuditFinding[]) => void;
  onGoToFinding?: (finding: AuditFinding) => void;
  onRequestArtifact?: () => void;
}

export interface TriageState {
  total: number;
  decided: number;
  accepted: number;
  error: string | null;
  onDecide: (decision: "accept" | "reject") => void;
  onSave: () => void;
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
  onPendingChange,
  onArtifactOpen,
  triage,
  onGateBlockingChange,
  onFindingsChange,
  onGoToFinding,
  onRequestArtifact,
}: EditorSidebarTabsProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("versions");
  const [reviewCount, setReviewCount] = useState(0);
  const [gateStatus, setGateStatus] = useState({ openFindings: 0, blocking: false });
  const [artifactCount, setArtifactCount] = useState(0);
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
    onGateBlockingChange?.(blocking ? openFindings : 0);
    applyDefault(reviewCount, blocking);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-outline)",
          flexShrink: 0,
        }}
      >
        <Tab label={t("editor.gate")} count={gateStatus.openFindings} active={tab === "gate"} onClick={() => setTab("gate")} />
        <Tab label={t("editor.review")} count={reviewCount} active={tab === "review"} onClick={() => setTab("review")} />
        <Tab
          label={t("editor.artifacts")}
          count={artifactCount}
          active={tab === "artifacts"}
          onClick={() => setTab("artifacts")}
        />
        <Tab label={t("editor.versions")} active={tab === "versions"} onClick={() => setTab("versions")} />
      </div>

      {/* Active tab content — all three stay mounted (display:none when
          inactive) so background refreshes keep tab badges current even
          while looking at a different tab, and switching tabs never re-fetches. */}
      <div style={{ flex: 1, minHeight: 0, display: tab === "gate" ? "flex" : "none" }}>
        <EditorGatePanel
          documentId={documentId}
          refreshTick={refreshTick}
          onStatusChange={handleGateStatus}
          onFindingsChange={onFindingsChange}
          onGoToFinding={onGoToFinding}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: tab === "review" ? "flex" : "none" }}>
        <EditorSuggestionPanel
          triage={triage}
          documentId={documentId}
          refreshTick={refreshTick}
          onSuggestionResolved={onSuggestionResolved}
          onCountChange={handleReviewCount}
          onPendingChange={onPendingChange}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: tab === "artifacts" ? "flex" : "none" }}>
        <EditorArtifactPanel
          documentId={documentId}
          refreshTick={refreshTick}
          onCountChange={setArtifactCount}
          onOpen={onArtifactOpen}
          onRequestArtifact={onRequestArtifact}
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

