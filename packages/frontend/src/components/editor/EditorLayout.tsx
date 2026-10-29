import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Artifact, AuditFinding, Section, Suggestion } from "@/types";
import { apiFetchArtifacts, apiTriageSuggestion } from "@/utils/api";
import { useAuth } from "@clerk/clerk-react";
import { parseHeadings, resolveAnchor } from "@/utils/documentStructure";
import { hunkCountsBySection, diffHunks } from "@/utils/diff";
import { apiCreateFeedback } from "@/utils/api";
import { useAutosave } from "@/hooks/useAutosave";
import { EditorNavPanel } from "./EditorNavPanel";
import { EditorCenterPanel, type EditorMode, type EditorCenterHandle } from "./EditorCenterPanel";
import { EditorActivityRail } from "./EditorActivityRail";
import { EditorSidebarTabs } from "./EditorSidebarTabs";
import { EditorDocumentBar } from "./EditorDocumentBar";
import type { HunkDecision } from "./EditorDiffView";

interface EditorLayoutProps {
  documentId: string;
  sections: Section[];
  sseTick: number;
  documentTitle?: string;
  isMcpManaged?: boolean;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  onPublished?: () => void;
  onRenameTitle?: (title: string) => Promise<void>;
}

export function EditorLayout({
  documentId,
  sections,
  sseTick,
  documentTitle = "Documento",
  isMcpManaged = false,
  publishedAt = null,
  hasUnpublishedChanges = false,
  onPublished,
  onRenameTitle,
}: EditorLayoutProps) {
  const bodySection = sections.find((s) => s.sectionType === "body");
  const initialContent = (bodySection?.activeVersionContent ?? "").trim();

  const [content, setContent] = useState(initialContent);
  const [serverContent, setServerContent] = useState(initialContent);
  const [mode, setMode] = useState<EditorMode>("source");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [activeHunk, setActiveHunk] = useState(1);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  const [decisions, setDecisions] = useState<Record<number, HunkDecision>>({});
  const [blockingFindings, setBlockingFindings] = useState(0);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [triageError, setTriageError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const centerRef = useRef<EditorCenterHandle>(null);

  const headings = useMemo(() => parseHeadings(content), [content]);

  // Keep content in sync when sections prop updates (e.g. SSE push)
  const lastSectionContent = useRef(initialContent);
  useEffect(() => {
    const incoming = (bodySection?.activeVersionContent ?? "").trim();
    if (incoming !== lastSectionContent.current) {
      lastSectionContent.current = incoming;
      setContent(incoming);
      setServerContent(incoming);
    }
  }, [bodySection?.activeVersionContent]);

  // Artifacts are resolved here rather than in the panel: the preview needs
  // them to turn `::artefato[key]` into a card where the directive sits.
  useEffect(() => {
    let cancelled = false;
    apiFetchArtifacts(documentId, getToken)
      .then((a) => { if (!cancelled) setArtifacts(a); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [documentId, getToken, sseTick, activityTick]);

  const handleSaved = useCallback((saved: string) => {
    lastSectionContent.current = saved;
    setServerContent(saved);
  }, []);

  const { state: saveState, isDirty } = useAutosave({
    sectionId: bodySection?.id,
    content,
    baseline: serverContent,
    onSaved: handleSaved,
  });

  /**
   * Pending changes per section. Derived from the diff between what is on
   * screen and what each agent proposed — the document itself stays one blob,
   * the grouping is presentation only (revamp plan §2.2).
   */
  const sectionCounts = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of pending) {
      if (!s.proposedContent) continue;
      const counts = hunkCountsBySection(s.currentContent ?? content, s.proposedContent);
      for (const [slug, n] of Object.entries(counts)) {
        totals[slug] = (totals[slug] ?? 0) + n;
      }
    }
    return totals;
  }, [pending, content]);

  const bumpActivity = useCallback(() => setActivityTick((n) => n + 1), []);

  /**
   * The proposal under review. The v4 mock shows one agent proposal at a time
   * ("Copasim propôs a v5"), broken into numbered changes.
   */
  const proposal = pending[0] ?? null;

  const hunks = useMemo(() => {
    if (!proposal?.proposedContent) return [];
    return diffHunks(proposal.currentContent ?? content, proposal.proposedContent);
  }, [proposal, content]);

  // Open the diff the first time changes show up, the way the sidebar already
  // jumps to whichever tab needs attention.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (hunks.length > 0 && !autoOpened.current) {
      autoOpened.current = true;
      setMode("diff");
      setActiveHunk(1);
    }
    if (hunks.length === 0) {
      autoOpened.current = false;
      setMode((m) => (m === "diff" ? "source" : m));
    }
  }, [hunks.length]);

  useEffect(() => {
    setDecisions({});
    setTriageError(null);
  }, [proposal?.id]);

  const decide = useCallback(
    (decision: HunkDecision) => {
      setActiveHunk((i) => {
        setDecisions((d) => ({ ...d, [i]: decision }));
        // Move to the next undecided change, so triage flows without the mouse.
        return i < hunks.length ? i + 1 : i;
      });
    },
    [hunks.length],
  );

  /** `Salvar triagem` — the server recomputes the hunks and applies the subset. */
  const saveTriage = useCallback(async () => {
    if (!proposal) return;
    const accepted = hunks.filter((h) => decisions[h.index] === "accept").map((h) => h.index);
    try {
      setTriageError(null);
      await apiTriageSuggestion(proposal.id, accepted, null, getToken);
      setDecisions({});
      bumpActivity();
    } catch (e) {
      setTriageError(e instanceof Error ? e.message : "Falha ao salvar triagem");
    }
  }, [proposal, hunks, decisions, getToken, bumpActivity]);

  const stepHunk = useCallback(
    (delta: number) => {
      setActiveHunk((i) => {
        if (hunks.length === 0) return 1;
        const next = i + delta;
        if (next < 1) return hunks.length;
        if (next > hunks.length) return 1;
        return next;
      });
    },
    [hunks.length],
  );

  // ↑↓ to walk the changes while reading the diff. A/R live in the review
  // panel, which owns accept/reject.
  useEffect(() => {
    if (mode !== "diff") return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); stepHunk(1); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); stepHunk(-1); }
      if (e.key === "a" || e.key === "A") { e.preventDefault(); decide("accept"); }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); decide("reject"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, stepHunk, decide]);

  /** Jump to a section — staying in whichever mode is open. Clicking a topic
   * used to yank the user out of Source and into Preview. */
  const handleNavigate = useCallback((slug: string) => {
    centerRef.current?.navigateTo(slug);
    setActiveSlug(slug);
  }, []);

  function handleVersionSwitch(switchedContent: string) {
    lastSectionContent.current = switchedContent;
    setContent(switchedContent);
    setServerContent(switchedContent);
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        paddingTop: 56,
        display: "flex",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <EditorNavPanel
        documentId={documentId}
        headings={headings}
        activeSlug={activeSlug}
        counts={sectionCounts}
        onNavigate={handleNavigate}
        activitySlot={
          <EditorActivityRail documentId={documentId} refreshTick={activityTick + sseTick} />
        }
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <EditorDocumentBar
          documentId={documentId}
          title={documentTitle}
          onRenameTitle={onRenameTitle}
          pendingChanges={hunks.length}
          blockingFindings={blockingFindings}
          isMcpManaged={isMcpManaged}
          publishedAt={publishedAt}
          hasUnpublishedChanges={hasUnpublishedChanges}
          savePending={isDirty || saveState.status === "saving" || saveState.status === "error"}
          onPublished={() => {
            bumpActivity();
            onPublished?.();
          }}
        />
        <EditorCenterPanel
          ref={centerRef}
          content={content}
          mode={mode}
          headings={headings}
          saveState={saveState}
          agentLabel={pending.find((s) => s.agentName)?.agentName ?? null}
          hunks={hunks}
          activeHunk={activeHunk}
          onHunkSelect={setActiveHunk}
          onHunkStep={stepHunk}
          decisions={decisions}
          artifacts={artifacts}
          findings={findings}
          openArtifact={openArtifact}
          onCloseArtifact={() => setOpenArtifact(null)}
          onOpenArtifact={setOpenArtifact}
          activeHeading={headings.find((h) => h.slug === activeSlug) ?? null}
          onAnchorArtifact={(a) => {
            // Put the directive at the end of the section the reader is on;
            // the anchor lives in the markdown, so this is a plain text edit.
            const heading = headings.find((h) => h.slug === activeSlug);
            const lines = content.split("\n");
            const at = heading ? heading.endLine + 1 : lines.length;
            lines.splice(at, 0, "", `::artefato[${a.key}]`, "");
            setContent(lines.join("\n"));
            setOpenArtifact(null);
            bumpActivity();
          }}
          onMoveArtifactAnchor={(a) => {
            setContent(
              content
                .split("\n")
                .filter((l) => l.trim() !== `::artefato[${a.key}]`)
                .join("\n"),
            );
            bumpActivity();
          }}
          onModeChange={setMode}
          onChange={setContent}
          onActiveSlugChange={setActiveSlug}
        />
      </div>

      {bodySection && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderLeft: "1px solid var(--color-outline)",
            width: 340,
            overflow: "hidden",
          }}
        >
          <EditorSidebarTabs
            documentId={documentId}
            sectionId={bodySection.id}
            currentContent={content}
            refreshTick={sseTick + activityTick}
            onSuggestionResolved={bumpActivity}
            onPendingChange={setPending}
            onArtifactOpen={setOpenArtifact}
            onRequestArtifact={() => {
              void apiCreateFeedback(
                documentId,
                "Pedido do revisor: um artefato (diagrama, tabela ou nota de decisão) ajudaria a sustentar este documento.",
                null,
                getToken,
              ).then(bumpActivity);
            }}
            onGateBlockingChange={setBlockingFindings}
            onFindingsChange={setFindings}
            onGoToFinding={(f) => {
              // Findings live in the prose, so show the prose.
              setMode("preview");
              setOpenArtifact(null);
              if (f.quote) {
                const r = resolveAnchor(content, { quote: f.quote }, headings);
                if (r.heading) handleNavigate(r.heading.slug);
              }
            }}
            triage={{
              total: hunks.length,
              decided: Object.keys(decisions).length,
              accepted: hunks.filter((h) => decisions[h.index] === "accept").length,
              error: triageError,
              onDecide: decide,
              onSave: saveTriage,
            }}
            onVersionSwitch={(c) => { handleVersionSwitch(c); bumpActivity(); }}
          />
        </div>
      )}
    </div>
  );
}
