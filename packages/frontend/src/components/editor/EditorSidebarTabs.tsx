import { useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { EditorGatePanel } from "./EditorGatePanel";
import { EditorSuggestionPanel } from "./EditorSuggestionPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";
import { EditorArtifactPanel } from "./EditorArtifactPanel";
import { EditorCommentsPanel, type CommentAnchor } from "./EditorCommentsPanel";
import { ActivityPanel, DocumentSidebar, type SideTab } from "@/components/document";
import { DocumentOutline } from "@/components/shared";
import type { Artifact, AuditFinding, Suggestion } from "@/types";
import type { Heading, SectionCounts } from "@/utils/documentStructure";
import { useI18n } from "@/i18n";

export type EditorSideTab = "structure" | "changes" | "review" | "comments" | "artifacts" | "history" | "activity";

interface EditorSidebarTabsProps {
  documentId: string;
  sectionId: string;
  currentContent: string;
  refreshTick: number;
  canEdit: boolean;
  canComment: boolean;
  side: EditorSideTab;
  open: boolean;
  onSide: (tab: EditorSideTab) => void;
  onOpenChange: (open: boolean) => void;
  headings: Heading[];
  activeSlug: string | null;
  /** Pending changes per section, tallied next to each heading. */
  counts: SectionCounts;
  onNavigate: (slug: string) => void;
  onSuggestionResolved: () => void;
  onVersionSwitch: (content: string) => void;
  /** Pending suggestions, lifted so the outline can tally changes per section. */
  onPendingChange?: (suggestions: Suggestion[]) => void;
  /** Opens an artifact full-screen in the centre panel. */
  onArtifactOpen?: (artifact: Artifact) => void;
  /** Per-hunk triage state, owned by the layout and shown in the Changes footer. */
  triage?: TriageState;
  /** Blocking gate findings, lifted so the document bar can refuse publishing. */
  onGateBlockingChange?: (count: number) => void;
  /** Open findings, so the centre panel can draw them inside the text. */
  onFindingsChange?: (findings: AuditFinding[]) => void;
  onGoToFinding?: (finding: AuditFinding) => void;
  onRequestArtifact?: () => void;
  pendingComment: CommentAnchor | null;
  onStartComment: () => void;
  onCancelComment: () => void;
  onGoToComment: (anchor: CommentAnchor) => void;
}

export interface TriageState {
  total: number;
  decided: number;
  accepted: number;
  error: string | null;
  onDecide: (decision: "accept" | "reject") => void;
  onSave: () => void;
}

/**
 * The Markdown document's side: the same rail and panel the layout editor has.
 * Every panel stays mounted (hidden when another is open) so background refreshes
 * keep the rail's badges current and switching never re-fetches. On the first
 * load it opens whatever needs attention: changes to review, else a blocking gate.
 */
export function EditorSidebarTabs(props: EditorSidebarTabsProps) {
  const {
    documentId,
    sectionId,
    currentContent,
    refreshTick,
    canEdit,
    canComment,
    side,
    open,
    onSide,
    onOpenChange,
    headings,
    activeSlug,
    counts,
    onNavigate,
    onSuggestionResolved,
    onVersionSwitch,
    onPendingChange,
    onArtifactOpen,
    triage,
    onGateBlockingChange,
    onFindingsChange,
    onGoToFinding,
    onRequestArtifact,
  } = props;
  const { t } = useI18n();
  const { getToken } = useAuth();
  const [reviewCount, setReviewCount] = useState(0);
  const [gateStatus, setGateStatus] = useState({ openFindings: 0, blocking: false });
  const [artifactCount, setArtifactCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const defaultApplied = useRef(false);

  function applyDefault(reviewN: number, blocking: boolean) {
    if (defaultApplied.current) return;
    defaultApplied.current = true;
    if (reviewN > 0) onSide("changes");
    else if (blocking) onSide("review");
  }

  const tabs: SideTab<EditorSideTab>[] = [
    { id: "structure", icon: "account_tree", label: t("editor.structure"), short: t("layout.side.structure.short") },
    { id: "changes", icon: "difference", label: t("doc.side.changes"), short: t("doc.side.changes.short"), badge: reviewCount },
    { id: "review", icon: "fact_check", label: t("doc.side.gate"), short: t("layout.side.review.short"), badge: gateStatus.openFindings },
    { id: "comments", icon: "forum", label: t("layout.side.comments"), short: t("layout.side.comments.short"), badge: commentCount },
    { id: "artifacts", icon: "attachment", label: t("editor.artifacts"), short: t("editor.artifacts"), badge: artifactCount },
    { id: "history", icon: "history", label: t("layout.side.history"), short: t("layout.side.history.short") },
    { id: "activity", icon: "timeline", label: t("editor.activity"), short: t("editor.activity") },
  ];

  const pane = (tab: EditorSideTab, children: ReactNode, padded = false) => (
    <div
      className={padded ? "df-scroll-thin" : undefined}
      style={{
        flex: 1,
        minHeight: 0,
        display: side === tab ? "flex" : "none",
        flexDirection: "column",
        ...(padded ? { overflowY: "auto", padding: 16, gap: 16 } : {}),
      }}
    >
      {children}
    </div>
  );

  return (
    <DocumentSidebar tabs={tabs} active={side} open={open} body="flush" onSelect={(tab) => (onSide(tab), onOpenChange(true))} onClose={() => onOpenChange(false)}>
      {pane(
        "structure",
        <DocumentOutline headings={headings} activeSlug={activeSlug} counts={counts} onNavigate={onNavigate} emptyText={t("editor.headingHint")} />,
        true,
      )}
      {pane(
        "changes",
        <EditorSuggestionPanel
          triage={triage}
          documentId={documentId}
          refreshTick={refreshTick}
          readOnly={!canEdit}
          onSuggestionResolved={onSuggestionResolved}
          onCountChange={(n) => {
            setReviewCount(n);
            applyDefault(n, gateStatus.blocking);
          }}
          onPendingChange={onPendingChange}
        />,
      )}
      {pane(
        "review",
        <EditorGatePanel
          documentId={documentId}
          refreshTick={refreshTick}
          onStatusChange={(openFindings, blocking) => {
            setGateStatus({ openFindings, blocking });
            onGateBlockingChange?.(blocking ? openFindings : 0);
            applyDefault(reviewCount, blocking);
          }}
          onFindingsChange={onFindingsChange}
          onGoToFinding={onGoToFinding}
        />,
      )}
      {pane(
        "comments",
        <EditorCommentsPanel
          documentId={documentId}
          refreshTick={refreshTick}
          canComment={canComment}
          pending={props.pendingComment}
          onStartComment={props.onStartComment}
          onCancelPending={props.onCancelComment}
          onGoTo={props.onGoToComment}
          onOpenCountChange={setCommentCount}
        />,
        true,
      )}
      {pane(
        "artifacts",
        <EditorArtifactPanel documentId={documentId} refreshTick={refreshTick} onCountChange={setArtifactCount} onOpen={onArtifactOpen} onRequestArtifact={onRequestArtifact} />,
      )}
      {pane(
        "history",
        <EditorVersionPanel sectionId={sectionId} documentId={documentId} currentContent={currentContent} refreshTick={refreshTick} onVersionSwitch={onVersionSwitch} />,
      )}
      {pane("activity", <ActivityPanel documentId={documentId} getToken={getToken} refreshTick={refreshTick} />, true)}
    </DocumentSidebar>
  );
}
