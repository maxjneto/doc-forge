import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createEngine, type ComponentType, type Engine, type LayoutDocument, type Surface } from "@docforge-lib/layout";
import { Button, Dialog, IconButton, Pill, Switch, textStyle } from "@/components/ui";
import { ActivityPanel, DocumentBar, DocumentSidebar, DocumentStatusBar, PresenceStack, type DocumentRole, type SideTab as SideTabDef } from "@/components/document";
import { usePresence } from "@/hooks/usePresence";
import {
  apiCreateLayoutAnnotation,
  apiGetLayout,
  apiGetLayoutPublication,
  apiListLayoutNotes,
  apiReplyLayoutNote,
  apiUpdateLayoutNote,
  type LayoutNote,
  type LayoutPublication,
  type LayoutRect,
  type LayoutState,
} from "@/utils/api";
import { useI18n } from "@/i18n";
import { ADDABLE_TYPES, addOp, newComponentId, starterComponent, TYPE_ICON } from "./defaults";
import { loadRegistry } from "./fonts";
import { PageCanvas, type PageCanvasHandle } from "./PageCanvas";
import { ComponentPanel, type ComponentTab } from "./panels/ComponentPanel";
import { CommentsPanel } from "./panels/CommentsPanel";
import { DesignPanel, type DesignDraft } from "./panels/DesignPanel";
import { HistoryPanel, type ViewingVersion } from "./panels/HistoryPanel";
import { PagePanel } from "./panels/PagePanel";
import { ReviewPanel } from "./panels/ReviewPanel";
import { StructurePanel } from "./panels/StructurePanel";
import { PresentMode } from "./PresentMode";
import { PublishDialog } from "./PublishDialog";
import { SlideRail } from "./SlideRail";
import { blockOf, parseClipboard, pasteOps, serializeComponent, type Pasted } from "./clipboard";
import { describeOps, threadsOf, type Thread } from "./history";
import { useLayoutEditor, type EditorWords } from "./useLayoutEditor";
import { useThemes } from "./useThemes";
import { displayName } from "./names";
import { withDraft } from "./themes";
import { extendAnalyticsContext, track } from "@/analytics";
import { relativeTime } from "@/utils/time";

interface LayoutDocumentViewProps {
  documentId: string;
  title: string;
  /** Given when the viewer may rename the document. */
  onRenameTitle?: (title: string) => Promise<void>;
  role: DocumentRole;
  /** The pills every document shows: the viewer's role, the agent via MCP. */
  context: ReactNode;
  /** Bumped on every SSE event for the document; an agent write triggers a refetch. */
  sseTick: number;
  /** Bumped when someone opens or closes the document. */
  presenceTick: number;
}

/**
 * A layout document: the pages, rendered in the browser with the same library
 * and fonts the backend's layout service measured with, and — for editors — an
 * editing layer and panels that send the same operations agents send. Loaded on
 * demand: fontkit stays out of the main bundle.
 */
export default function LayoutDocumentView({ documentId, sseTick, ...shell }: LayoutDocumentViewProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [state, setState] = useState<LayoutState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRegistry()
      .then((registry) => !cancelled && setEngine(createEngine({ registry })))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    apiGetLayout(documentId, getToken)
      .then((next) => !cancelled && setState(next))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [documentId, getToken]);

  if (error) {
    return (
      <Centered>
        <span style={{ ...textStyle.caption, color: "var(--color-error)" }}>{t("layout.loadFailed")}</span>
      </Centered>
    );
  }
  if (!engine || !state) {
    return (
      <Centered>
        <span className="animate-pulse" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
          {engine ? t("document.loading") : t("layout.loadingFonts")}
        </span>
      </Centered>
    );
  }
  return <LayoutWorkspace key={documentId} engine={engine} initial={state} documentId={documentId} sseTick={sseTick} {...shell} />;
}

type SideTab = "structure" | "review" | "design" | "page" | "comments" | "history" | "activity";
const ZOOMS = [0.5, 0.6, 0.75, 1, 1.25];

/** The largest zoom at which a page this wide fits beside the panels (slides are wide). */
function fitZoom(pageWidth: number): number {
  const room = (typeof window === "undefined" ? 1440 : window.innerWidth) - 172 - 340 - 64 - 24;
  return [...ZOOMS].reverse().find((z) => (pageWidth + 48) * z <= room) ?? (ZOOMS[0] as number);
}
const TAB_ICON: Record<SideTab, string> = {
  structure: "account_tree",
  review: "fact_check",
  design: "palette",
  page: "description",
  comments: "forum",
  history: "history",
  activity: "timeline",
};

function LayoutWorkspace({
  engine,
  initial,
  documentId,
  role,
  sseTick,
  presenceTick,
  title,
  onRenameTitle,
  context,
}: { engine: Engine; initial: LayoutState; documentId: string; sseTick: number } & Omit<LayoutDocumentViewProps, "documentId" | "sseTick">) {
  const { t, dateLocale } = useI18n();
  const { getToken } = useAuth();
  const presence = usePresence(documentId, getToken, presenceTick + sseTick);
  const [publication, setPublication] = useState<LayoutPublication | null>(null);
  useEffect(() => {
    apiGetLayoutPublication(documentId, getToken)
      .then(setPublication)
      // The state pill is a courtesy; the document works without it.
      .catch(() => {});
  }, [documentId, getToken]);
  const canEdit = role === "owner" || role === "editor";
  const canComment = canEdit || role === "commenter";
  // What each write is called in the history and the activity, in the reader's language.
  const words = useMemo<EditorWords>(
    () => ({
      describe: (ops, before) =>
        describeOps(ops, t, (id) => {
          const c = before.components.find((x) => x.id === id);
          return c ? displayName(c, t) : id;
        }),
      undo: t("layout.history.undoNote"),
      redo: t("layout.history.redoNote"),
      restore: t("layout.history.restoreNote"),
    }),
    [t],
  );
  const editor = useLayoutEditor(engine, documentId, initial, getToken, sseTick, words);
  const doc = editor.content;
  const canvas = useRef<PageCanvasHandle>(null);
  const library = useThemes(getToken);

  const primary = doc.surfaces[0] as Surface;
  const deck = primary.kind === "page" && primary.size === "Slide";
  const [editing, setEditing] = useState(canEdit);
  const [surfaceId, setSurfaceId] = useState<string | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(() => (deck ? fitZoom(1280) : 1));
  const [selected, setSelected] = useState<string | null>(null);
  const [side, setSide] = useState<SideTab>("structure");
  const [panelOpen, setPanelOpen] = useState(true);
  const [componentTab, setComponentTab] = useState<ComponentTab>("content");
  const [annotating, setAnnotating] = useState(false);
  const [pending, setPending] = useState<{ rect?: LayoutRect; component?: string } | null>(null);
  const [notes, setNotes] = useState<LayoutNote[]>([]);
  const [resolvedNotes, setResolvedNotes] = useState<LayoutNote[] | null>(null);
  const [focusedThread, setFocusedThread] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<DesignDraft | null>(null);
  const [viewing, setViewing] = useState<ViewingVersion | null>(null);
  const [visiblePage, setVisiblePage] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const clearSaveRequest = useCallback(() => setSaveRequested(false), []);
  /** The part of the selected block being styled (picked on the page or in the panel). */
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  /** A document shown without being applied (hovering a ready-made look). */
  const [previewDoc, setPreviewDoc] = useState<LayoutDocument | null>(null);

  const surfaces = doc.surfaces;
  const activeSurface = surfaceId && surfaces.some((s) => s.id === surfaceId) ? surfaceId : surfaces[0]?.id;
  const slides = deck && activeSurface === primary.id;
  useEffect(() => extendAnalyticsContext({ document_kind: deck ? "slides" : "page" }), [deck]);
  // What the page shows: a past version, or the document with the design draft over it.
  const shown = useMemo(() => (viewing ? viewing.content : withDraft(previewDoc ?? doc, draft?.tokens ?? null)), [viewing, doc, draft, previewDoc]);
  useEffect(() => setPreviewDoc(null), [doc]);
  /** A part picked on the page: the panel opens on its look. */
  const pickPart = useCallback((part: string | null) => {
    setSelectedPart(part);
    if (part) {
      setComponentTab("style");
      setSide("structure");
      setPanelOpen(true);
    }
  }, []);
  const output = useMemo(() => engine.render(shown, { surfaceId: activeSurface, grid: showGrid, backdrop: null }), [engine, shown, activeSurface, showGrid]);
  const layout = output.layout;
  const current = useMemo(() => (shown === doc ? layout : engine.layout(doc, activeSurface)), [engine, doc, shown, layout, activeSurface]);
  const families = useMemo(() => engine.registry.families(), [engine]);
  const problems = current.diagnostics.filter((d) => d.severity !== "info");
  // The same composition review agents get from review_layout, computed here with the same library.
  const findings = useMemo(() => engine.review(doc, { surfaceId: activeSurface }).findings, [engine, doc, activeSurface]);
  const attention = problems.length + findings.filter((f) => f.severity === "warning").length;
  const selectedComponent = selected ? doc.components.find((c) => c.id === selected) : undefined;
  const editable = canEdit && editing && !viewing;
  const nameOf = useCallback(
    (id: string) => {
      const c = doc.components.find((x) => x.id === id) ?? viewing?.content.components.find((x) => x.id === id);
      return c ? displayName(c, t) : id;
    },
    [doc, viewing, t],
  );

  // Notes: on open, after every save (writes create notices) and on SSE events.
  const loadNotes = useCallback(async () => {
    try {
      setNotes(await apiListLayoutNotes(documentId, getToken));
    } catch {
      // Notes are secondary: the document stays usable without them.
    }
  }, [documentId, getToken]);
  const loadResolved = useCallback(async () => {
    try {
      setResolvedNotes(await apiListLayoutNotes(documentId, getToken, "resolved", "annotation"));
    } catch {
      setResolvedNotes([]);
    }
  }, [documentId, getToken]);
  useEffect(() => {
    const timer = setTimeout(() => void loadNotes(), 400);
    return () => clearTimeout(timer);
  }, [loadNotes, editor.revision, sseTick]);
  const refreshComments = useCallback(async () => {
    await loadNotes();
    if (resolvedNotes) await loadResolved();
  }, [loadNotes, loadResolved, resolvedNotes]);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setSelectedPart(null);
    if (id) {
      setSide((s) => (s === "comments" || s === "design" ? s : "structure"));
      setPanelOpen(true);
    }
  }, []);
  const openSide = useCallback((tab: SideTab) => {
    setSide(tab);
    setPanelOpen(true);
    track("layout_panel_opened", { panel: tab });
  }, []);

  /** The selected block as clipboard text, with the size it has on the page. */
  const clipText = useCallback(() => {
    if (!selectedComponent) return null;
    const g = layout.components[selectedComponent.id];
    return serializeComponent(selectedComponent, { w: g?.box.w ?? 0, h: g?.declared.h ?? undefined });
  }, [selectedComponent, layout]);

  /** Put a block (or text) below the selected block, else at the end of the visible page. */
  const pasteInto = useCallback(
    (pasted: Pasted, how: "pasted" | "duplicated") => {
      const below = selected && layout.components[selected] ? selected : null;
      const page = slides ? visiblePage : Math.max(1, layout.pages.length);
      const { ops, select: id } = pasteOps(doc, pasted, below, page, (key) => t(key));
      const result = editor.commit(ops);
      if (!result.ok) {
        setAnnouncement(t("layout.editor.refused"));
        return;
      }
      select(id);
      setAnnouncement(t(how === "pasted" ? "layout.editor.announcePasted" : "layout.editor.announceDuplicated", { id }));
      track(how === "pasted" ? "layout_block_pasted" : "layout_block_duplicated", { type: "block" in pasted ? String(pasted.block.component.type) : "text" });
      requestAnimationFrame(() => canvas.current?.reveal(id));
    },
    [selected, layout, slides, visiblePage, doc, editor, t, select],
  );

  // Shortcuts from anywhere but a field being typed in (it keeps the browser's own keys); Esc leaves a past version.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && e.key === "/") {
        e.preventDefault();
        track("layout_shortcut_used", { key: "mod+/" });
        setShortcutsOpen((open) => !open);
        return;
      }
      if (mod && key === "s" && canEdit) {
        e.preventDefault();
        track("layout_shortcut_used", { key: "mod+s" });
        setSaveRequested(true);
        openSide("history");
        return;
      }
      if (fieldKeepsKeys(target)) return;
      if (e.key === "Escape" && viewing) {
        setViewing(null);
        return;
      }
      // Esc with a part picked (from the bar or the panel, where the block itself has no focus) goes back to the whole block.
      if (e.key === "Escape" && selectedPart) {
        setSelectedPart(null);
        return;
      }
      if (!mod || !editable) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        track("layout_undo", { via: "shortcut" });
        editor.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        track("layout_redo", { via: "shortcut" });
        editor.redo();
      } else if (key === "d" && selectedComponent) {
        e.preventDefault();
        track("layout_shortcut_used", { key: "mod+d", type: selectedComponent.type });
        const g = layout.components[selectedComponent.id];
        pasteInto({ block: blockOf(selectedComponent, { w: g?.box.w ?? 0, h: g?.declared.h ?? undefined }) }, "duplicated");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, canEdit, editor, viewing, selectedComponent, selectedPart, layout, pasteInto, openSide]);

  // Copy, cut and paste blocks through the system clipboard (as JSON text, so it also travels to a chat or an agent).
  useEffect(() => {
    if (!editable) return;
    const onCopy = (e: ClipboardEvent) => {
      if (isField(e.target as HTMLElement | null) || !selectedComponent) return;
      const text = clipText();
      if (!text || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", text);
      e.preventDefault();
      setAnnouncement(t("layout.editor.announceCopied", { id: nameOf(selectedComponent.id) }));
      track("layout_block_copied", { type: selectedComponent.type });
    };
    const onCut = (e: ClipboardEvent) => {
      if (isField(e.target as HTMLElement | null) || !selectedComponent) return;
      onCopy(e);
      if (!e.defaultPrevented) return;
      const result = editor.commit([{ op: "remove", component: selectedComponent.id }]);
      if (result.ok) {
        select(null);
        setAnnouncement(t("layout.editor.announceCut", { id: nameOf(selectedComponent.id) }));
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isField(e.target as HTMLElement | null)) return;
      const pasted = parseClipboard(e.clipboardData?.getData("text/plain") ?? "");
      if (!pasted) return;
      e.preventDefault();
      pasteInto(pasted, "pasted");
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [editable, selectedComponent, clipText, editor, select, nameOf, t, pasteInto]);

  const add = (type: ComponentType) => {
    setAddOpen(false);
    const id = newComponentId(doc, type);
    const component = starterComponent(type, id, (key) => t(key));
    const page = slides ? visiblePage : Math.max(1, layout.pages.length);
    const below = selected && layout.components[selected] ? selected : null;
    const result = editor.commit([addOp(component, type, below, page)]);
    if (result.ok) {
      select(id);
      setComponentTab("content");
      setAnnouncement(t("layout.editor.announceAdded", { id }));
      requestAnimationFrame(() => canvas.current?.reveal(id));
    } else {
      setAnnouncement(t("layout.editor.refused"));
    }
  };

  const noticeText = editor.notice
    ? editor.notice.kind === "external"
      ? t("layout.editor.externalChange")
      : editor.notice.kind === "conflict-dropped"
        ? t("layout.editor.conflictDropped")
        : t("layout.editor.saveFailed")
    : null;

  const openNotes = notes.filter((n) => n.status === "open");
  // An agent's hand-off: shown with its questions in Comments, not as a loose note.
  const requests = openNotes.filter((n) => n.code === "review-request");
  const notices = openNotes.filter((n) => n.kind === "notice");
  const threads = useMemo(() => threadsOf(openNotes), [openNotes]);
  const resolvedThreads = useMemo(() => (resolvedNotes ? threadsOf(resolvedNotes) : null), [resolvedNotes]);
  const external = editor.external;
  const comparison = useMemo(() => (external ? engine.compare(external.before, doc, { surfaceId: activeSurface }) : null), [engine, external, doc, activeSurface]);
  const highlights = useMemo(
    () => (side === "history" && comparison && !viewing ? new Map(comparison.edits.filter((e) => !e.kinds.includes("removed")).map((e, i) => [e.component, i + 1] as const)) : undefined),
    [side, comparison, viewing],
  );
  const badges: Partial<Record<SideTab, number>> = {
    review: attention,
    comments: threads.length + requests.length,
    history: comparison?.edits.length ?? 0,
  };

  const show = (id: string) => {
    setSelected(id);
    canvas.current?.reveal(id);
  };
  const startComment = (anchor: { rect?: LayoutRect; component?: string }) => {
    setPending(anchor);
    setAnnotating(false);
    setSide("comments");
    setPanelOpen(true);
  };

  const publishedBehind = publication?.published && publication.revision !== null && editor.revision > publication.revision;
  const sideTabs: SideTabDef<SideTab>[] = (Object.keys(TAB_ICON) as SideTab[]).map((tab) => ({
    id: tab,
    icon: tab === "page" && deck ? "slideshow" : TAB_ICON[tab],
    label: t(`layout.side.${tab}`),
    short: t(`layout.side.${tab}.short`),
    badge: badges[tab],
    dot: tab === "design" && draft ? t("layout.design.draft") : undefined,
  }));

  return (
    <div className="df-doc-shell">
      <DocumentBar
        title={title}
        onRenameTitle={onRenameTitle}
        status={
          <>
            {publishedBehind ? (
              <Pill tone="heat" dot>
                {t("editor.unpublishedChanges")}
              </Pill>
            ) : publication?.published ? (
              <Pill tone="steel">{t("editor.published")}</Pill>
            ) : (
              <Pill tone="ghost">{t("common.draft")}</Pill>
            )}
            {context}
          </>
        }
        presence={<PresenceStack presence={presence} />}
        actions={
          <>
            {slides && (
              <Button
                variant="secondary"
                icon="slideshow"
                iconPosition="start"
                onClick={() => {
                  track("layout_presented", { slides: layout.pages.length });
                  setPresenting(true);
                }}
              >
                {t("layout.slides.present")}
              </Button>
            )}
            <Button
              variant="secondary"
              icon="download"
              iconPosition="start"
              onClick={() => {
                track("document_exported", { format: "pdf", pages: layout.pages.length });
                canvas.current?.print();
              }}
            >
              {t("layout.print")}
            </Button>
            {role === "owner" && (
              <Button
                variant={viewing ? "secondary" : "primary"}
                icon="public"
                iconPosition="start"
                onClick={() => {
                  track("layout_publish_opened");
                  setPublishing(true);
                }}
              >
                {t("layout.publish.button")}
              </Button>
            )}
          </>
        }
      />
      <div className="df-doc-shell__main">
      <div className="df-doc-shell__work">
        <div role="toolbar" aria-label={t("layout.editor.toolbar")} className="df-doc-toolbar">
          {canEdit && <Switch checked={editing} onChange={setEditing} label={t("layout.editor.editMode")} />}
          {surfaces.length > 1 && (
            <select className="df-input" aria-label={t("layout.surface")} value={activeSurface ?? ""} onChange={(e) => setSurfaceId(e.target.value)} style={{ width: "auto", padding: "4px 8px" }}>
              {surfaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {surfaceName(s, t)}
                </option>
              ))}
            </select>
          )}
          <select className="df-input" aria-label={t("layout.editor.zoom")} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: "auto", padding: "4px 8px" }}>
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
          <Switch checked={showGrid} onChange={setShowGrid} label={t("layout.grid")} />
          {editable && (
            <>
              <span aria-hidden className="df-doc-toolbar__sep" />
              <IconButton icon="undo" label={t("layout.editor.undo")} disabled={!editor.canUndo} onClick={editor.undo} />
              <IconButton icon="redo" label={t("layout.editor.redo")} disabled={!editor.canRedo} onClick={editor.redo} />
              <IconButton icon="keyboard" label={t("layout.shortcuts.open")} onClick={() => setShortcutsOpen(true)} />
              <div style={{ position: "relative" }}>
                <Button icon="add" iconPosition="start" aria-haspopup="menu" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>
                  {t("layout.editor.add")}
                </Button>
                {addOpen && <AddMenu onPick={add} onClose={() => setAddOpen(false)} />}
              </div>
            </>
          )}
          {canComment && !viewing && (
            <Button
              variant={annotating ? "secondary" : "ghost"}
              icon="add_comment"
              iconPosition="start"
              aria-pressed={annotating}
              onClick={() => {
                setAnnotating(!annotating);
                setPending(null);
                setSide("comments");
                setPanelOpen(true);
              }}
            >
              {annotating ? t("layout.notes.stopAnnotating") : t("layout.comments.comment")}
            </Button>
          )}
        </div>
        {noticeText && !viewing && (
          <div role="status" className="df-doc-banner df-doc-banner--steel">
            <span className="material-symbols-outlined" aria-hidden>
              smart_toy
            </span>
            <span style={{ ...textStyle.caption, color: "var(--color-text)", flex: 1 }}>
              {editor.notice?.kind === "external" && comparison ? t("layout.changes.banner", { count: comparison.edits.length }) : noticeText}
            </span>
            {editor.notice?.kind === "external" && external && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSide("history");
                  setPanelOpen(true);
                  editor.dismissNotice();
                }}
              >
                {t("layout.changes.review")}
              </Button>
            )}
            <IconButton icon="close" label={t("common.close")} onClick={editor.dismissNotice} />
          </div>
        )}
        {viewing && (
          <div role="status" className="df-doc-banner df-doc-banner--heat">
            <span className="material-symbols-outlined" aria-hidden>
              history
            </span>
            <span style={{ ...textStyle.caption, color: "var(--color-text)", flex: 1 }}>
              {t("layout.history.viewing", { label: viewing.label, when: viewing.createdAt ? relativeTime(viewing.createdAt, dateLocale) : "", revision: viewing.revision })}
            </span>
            {canEdit && (
              <Button
                variant="primary"
                icon="restore"
                iconPosition="start"
                onClick={() => {
                  track("version_restored", { back: editor.revision - viewing.revision });
                  editor.replaceAll(viewing.content);
                  setViewing(null);
                  setAnnouncement(t("layout.history.restored", { revision: viewing.revision }));
                }}
              >
                {t("layout.history.restore")}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setViewing(null)}>
              {t("layout.history.back")}
            </Button>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          {slides && !viewing && (
            <SlideRail
              engine={engine}
              doc={doc}
              layout={layout}
              current={visiblePage}
              onGo={(n) => canvas.current?.goToPage(n)}
              commit={editor.commit}
              editable={editable}
              onAdded={(id, page) => {
                setSelected(id);
                requestAnimationFrame(() => canvas.current?.goToPage(page));
              }}
            />
          )}
          <PageCanvas
            ref={canvas}
            engine={engine}
            content={shown}
            surfaceId={activeSurface}
            layout={layout}
            html={output.page}
            editable={editable && !annotating}
            selected={viewing ? null : selected}
            onSelect={select}
            selectedPart={viewing ? null : selectedPart}
            onSelectPart={pickPart}
            commit={editor.commit}
            preview={editor.preview}
            annotating={annotating && !viewing}
            onAnnotate={(rect) => startComment({ rect })}
            onAnnotateComponent={(id) => startComment({ component: id })}
            threads={viewing ? [] : threads}
            focusedThread={focusedThread}
            onPinClick={(id) => {
              setFocusedThread(id);
              setSide("comments");
              setPanelOpen(true);
            }}
            onCommentBlock={canComment ? (id) => startComment({ component: id }) : undefined}
            onVisiblePage={setVisiblePage}
            highlights={highlights}
            zoom={zoom}
            announce={setAnnouncement}
            onOpenContent={() => {
              setSide("structure");
              setPanelOpen(true);
              setComponentTab("content");
            }}
          />
        </div>
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>

      <DocumentSidebar tabs={sideTabs} active={side} open={panelOpen} onSelect={openSide} onClose={() => setPanelOpen(false)}>
            {side === "structure" &&
              (selectedComponent && !viewing ? (
                <ComponentPanel
                  doc={doc}
                  component={selectedComponent}
                  geometry={current.components[selectedComponent.id]}
                  layout={current}
                  tokens={current.tokens}
                  families={families}
                  commit={editor.commit}
                  readOnly={!editable}
                  tab={componentTab}
                  onTab={setComponentTab}
                  onRemoved={() => select(null)}
                  onBack={() => select(null)}
                  part={selectedPart}
                  onPart={setSelectedPart}
                  preview={editor.preview}
                  onPreview={setPreviewDoc}
                />
              ) : (
                <StructurePanel doc={shown} layout={layout} slides={slides} map={() => engine.map(doc, { level: 1, surfaceId: activeSurface }).text} onPick={(id) => (viewing ? canvas.current?.reveal(id) : (select(id), canvas.current?.reveal(id)))} />
              ))}
            {side === "review" && (
              <ReviewPanel doc={doc} layout={current} problems={problems} findings={findings} commit={editor.commit} preview={editor.preview} readOnly={!editable} onShow={(id) => (select(id), canvas.current?.reveal(id))} />
            )}
            {side === "design" && (
              <DesignPanel doc={doc} layout={viewing ? current : layout} families={families} library={library} draft={draft} setDraft={setDraft} commit={editor.commit} readOnly={!editable} slide={deck} />
            )}
            {side === "page" && <PagePanel doc={doc} layout={current} commit={editor.commit} preview={editor.preview} readOnly={!editable} />}
            {side === "comments" && (
              <CommentsPanel
                documentId={documentId}
                open={threads}
                resolved={resolvedThreads}
                loadResolved={() => void loadResolved()}
                requests={requests}
                onAnswered={() => void loadNotes()}
                canComment={canComment}
                annotating={annotating}
                onToggleAnnotate={() => setAnnotating(!annotating)}
                pending={pending}
                onCreate={async (message, forAgent) => {
                  if (!pending) return;
                  await apiCreateLayoutAnnotation(documentId, message, pending, getToken, { forAgent });
                  setPending(null);
                  await loadNotes();
                }}
                onCancelPending={() => setPending(null)}
                onReply={async (thread: Thread, message: string) => {
                  await apiReplyLayoutNote(documentId, thread.root.id, message, getToken);
                  await refreshComments();
                }}
                onStatus={async (thread, status) => {
                  await apiUpdateLayoutNote(thread.root.id, status, getToken);
                  await loadNotes();
                  await loadResolved();
                }}
                onToggleAgent={async (thread, on) => {
                  await apiUpdateLayoutNote(thread.root.id, null, getToken, undefined, { forAgent: on });
                  await loadNotes();
                }}
                onShow={show}
                focused={focusedThread}
                onFocus={setFocusedThread}
                nameOf={nameOf}
                getToken={getToken}
              />
            )}
            {side === "history" && (
              <HistoryPanel
                documentId={documentId}
                engine={engine}
                doc={doc}
                revision={editor.revision}
                external={external}
                comparison={comparison}
                commit={editor.commit}
                replaceAll={editor.replaceAll}
                onDismissExternal={editor.dismissExternal}
                onShow={show}
                viewing={viewing}
                onView={setViewing}
                notices={notices}
                onDismissNotices={(list) => {
                  void Promise.all(list.map((n) => apiUpdateLayoutNote(n.id, "resolved", getToken))).then(() => loadNotes());
                }}
                nameOf={nameOf}
                canEdit={canEdit}
                surfaceId={activeSurface}
                getToken={getToken}
                saveRequested={saveRequested}
                onSaveRequested={clearSaveRequest}
              />
            )}
            {side === "activity" && <ActivityPanel documentId={documentId} getToken={getToken} refreshTick={sseTick + editor.revision} />}
      </DocumentSidebar>
      </div>

      <DocumentStatusBar
        save={{
          text: editor.status === "saving" ? t("layout.status.saving") : editor.status === "error" ? t("layout.editor.notSaved") : t("layout.status.saved"),
          tone: editor.status === "saving" ? "busy" : editor.status === "error" ? "error" : "quiet",
        }}
        presence={presence}
      >
        <span title={t("layout.revision", { revision: editor.revision })}>
          {slides ? t("layout.slides.count", { count: layout.pages.length }) : t("layout.pages", { count: layout.pages.length })} · {t("layout.revision", { revision: editor.revision })}
        </span>
      </DocumentStatusBar>

      {publishing && <PublishDialog documentId={documentId} saving={editor.status === "saving"} onChange={setPublication} onClose={() => setPublishing(false)} />}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {presenting && <PresentMode html={output.page} pages={layout.pages.length} width={layout.pages[0]?.width ?? 1280} height={layout.pages[0]?.height ?? 720} start={visiblePage} onClose={() => setPresenting(false)} />}
    </div>
  );
}

function AddMenu({ onPick, onClose }: { onPick: (type: ComponentType) => void; onClose: () => void }) {
  const { t } = useI18n();
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onDown = (e: MouseEvent) => {
      if (menu.current && !menu.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return (
    <div
      ref={menu}
      role="menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        }
      }}
      style={{
        position: "absolute",
        top: "calc(100% + 4px)",
        left: 0,
        zIndex: "var(--z-popover)",
        minWidth: 200,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface-high)",
        border: "1px solid var(--color-outline-md)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {ADDABLE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="menuitem"
          className="df-nav-item"
          onClick={() => onPick(type)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "transparent", border: 0, color: "var(--color-text)", textAlign: "left", cursor: "pointer" }}
        >
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
            {TYPE_ICON[type]}
          </span>
          <span style={textStyle.caption}>{t(`layout.type.${type}`)}</span>
        </button>
      ))}
    </div>
  );
}

/** A text field or editable area under the pointer of the keyboard. */
function isField(target: HTMLElement | null): boolean {
  return !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}

/** A field keeps the keys while it is being typed in; a clean content form hands them to the document. */
function fieldKeepsKeys(target: HTMLElement | null): boolean {
  return isField(target) && target?.closest("[data-undo]")?.getAttribute("data-undo") !== "document";
}

const SHORTCUTS: { group: string; items: [keys: string, label: string][] }[] = [
  {
    group: "edit",
    items: [
      ["Ctrl+Z", "undo"],
      ["Ctrl+Y · Ctrl+Shift+Z", "redo"],
      ["Ctrl+S", "save"],
      ["Ctrl+/", "list"],
    ],
  },
  {
    group: "blocks",
    items: [
      ["Ctrl+C · Ctrl+X", "copy"],
      ["Ctrl+V", "paste"],
      ["Ctrl+D", "duplicate"],
      ["← ↑ → ↓", "move"],
      ["Alt+← ↑ → ↓", "resize"],
      ["Enter", "edit"],
      ["/", "insert"],
      ["Delete", "remove"],
      ["Esc", "deselect"],
    ],
  },
  {
    group: "inline",
    items: [
      ["Ctrl+B · Ctrl+I", "bold"],
      ["Ctrl+Enter", "finish"],
      ["Esc", "cancel"],
    ],
  },
];

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog onClose={onClose} title={t("layout.shortcuts.title")} subtitle={t("layout.shortcuts.hint")} width={520} closable>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {SHORTCUTS.map((group) => (
          <section key={group.group} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h3 style={{ ...textStyle.fieldLabel, color: "var(--color-dim)", margin: 0 }}>{t(`layout.shortcuts.group.${group.group}`)}</h3>
            <dl className="df-shortcuts">
              {group.items.map(([keys, label]) => (
                <div key={label} className="df-shortcuts__row">
                  <dt>
                    {keys.split(" · ").map((combo, i) => (
                      <span key={combo}>
                        {i > 0 && <span style={{ color: "var(--color-faint)", margin: "0 4px" }}>·</span>}
                        <kbd className="df-kbd">{combo}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd>{t(`layout.shortcuts.${label}`)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

function surfaceName(surface: Surface, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (surface.kind === "continuous") return t("layout.surfaceName.continuous");
  const size = typeof surface.size === "string" ? (surface.size === "Slide" ? t("layout.page.size.Slide") : surface.size) : `${Math.round(surface.size.width)}×${Math.round(surface.size.height)}`;
  return t("layout.surfaceName.page", { size });
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ height: "100%", paddingTop: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
}
