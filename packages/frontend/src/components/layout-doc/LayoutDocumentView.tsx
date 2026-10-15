import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createEngine, type ComponentType, type Diagnostic, type Engine, type LayoutDocument, type LayoutResult, type Surface } from "@docforge/layout";
import { Button, IconButton, Pill, Switch, Tab, textStyle } from "@/components/ui";
import {
  apiCreateLayoutAnnotation,
  apiFetchMembers,
  apiGetLayout,
  apiListLayoutNotes,
  apiUpdateLayoutNote,
  type LayoutNote,
  type LayoutRect,
  type LayoutState,
} from "@/utils/api";
import { useI18n } from "@/i18n";
import { ADDABLE_TYPES, addOp, newComponentId, starterComponent, TYPE_ICON } from "./defaults";
import { loadRegistry } from "./fonts";
import { PageCanvas, type PageCanvasHandle } from "./PageCanvas";
import { ComponentPanel, type ComponentTab } from "./panels/ComponentPanel";
import { DocumentPanel } from "./panels/DocumentPanel";
import { NotesPanel } from "./panels/NotesPanel";
import { HealthSection } from "./panels/HealthSection";
import { ChangesPanel } from "./panels/ChangesPanel";
import { useLayoutEditor } from "./useLayoutEditor";
import { displayName, rowsOf, widthLabel } from "./names";
import { track } from "./track";

interface LayoutDocumentViewProps {
  documentId: string;
  /** Bumped on every SSE event for the document; an agent write triggers a refetch. */
  sseTick: number;
}

type Role = "owner" | "editor" | "commenter" | "viewer";

/**
 * A layout document: the pages, rendered in the browser with the same library
 * and fonts the backend's layout service measured with, and — for editors — an
 * editing layer and panels that send the same operations agents send. Loaded on
 * demand: fontkit stays out of the main bundle.
 */
export default function LayoutDocumentView({ documentId, sseTick }: LayoutDocumentViewProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [state, setState] = useState<LayoutState | null>(null);
  const [role, setRole] = useState<Role | null>(null);
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
    apiFetchMembers(documentId, getToken)
      .then((m) => !cancelled && setRole((m.myRole as Role) ?? "viewer"))
      // Without the members list, read-only is the safe default.
      .catch(() => !cancelled && setRole("viewer"));
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
  if (!engine || !state || !role) {
    return (
      <Centered>
        <span className="animate-pulse" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
          {engine ? t("document.loading") : t("layout.loadingFonts")}
        </span>
      </Centered>
    );
  }
  return <LayoutWorkspace key={documentId} engine={engine} initial={state} documentId={documentId} role={role} sseTick={sseTick} />;
}

type SideTab = "structure" | "changes" | "document" | "notes";
const ZOOMS = [0.5, 0.75, 1, 1.25];

function LayoutWorkspace({ engine, initial, documentId, role, sseTick }: { engine: Engine; initial: LayoutState; documentId: string; role: Role; sseTick: number }) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const canEdit = role === "owner" || role === "editor";
  const canComment = canEdit || role === "commenter";
  const editor = useLayoutEditor(engine, documentId, initial, getToken, sseTick);
  const doc = editor.content;
  const canvas = useRef<PageCanvasHandle>(null);

  const [editing, setEditing] = useState(canEdit);
  const [surfaceId, setSurfaceId] = useState<string | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [side, setSide] = useState<SideTab>("structure");
  const [componentTab, setComponentTab] = useState<ComponentTab>("content");
  const [annotating, setAnnotating] = useState(false);
  const [pendingRect, setPendingRect] = useState<LayoutRect | null>(null);
  const [notes, setNotes] = useState<LayoutNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const surfaces = doc.surfaces;
  const activeSurface = surfaceId && surfaces.some((s) => s.id === surfaceId) ? surfaceId : surfaces[0]?.id;
  const output = useMemo(() => engine.render(doc, { surfaceId: activeSurface, grid: showGrid, backdrop: null }), [engine, doc, activeSurface, showGrid]);
  const layout = output.layout;
  const families = useMemo(() => engine.registry.families(), [engine]);
  const problems = layout.diagnostics.filter((d) => d.severity !== "info");
  // The same composition review agents get from review_layout, computed here with the same library.
  const findings = useMemo(() => engine.review(doc, { surfaceId: activeSurface }).findings, [engine, doc, activeSurface]);
  const attention = problems.length + findings.filter((f) => f.severity === "warning").length;
  const selectedComponent = selected ? doc.components.find((c) => c.id === selected) : undefined;
  const editable = canEdit && editing;

  // Notes: on open, after every save (writes create notices) and on SSE events.
  const loadNotes = useCallback(async () => {
    try {
      setNotes(await apiListLayoutNotes(documentId, getToken));
    } catch {
      // Notes are secondary: the document stays usable without them.
    } finally {
      setNotesLoading(false);
    }
  }, [documentId, getToken]);
  useEffect(() => {
    const timer = setTimeout(() => void loadNotes(), 400);
    return () => clearTimeout(timer);
  }, [loadNotes, editor.revision, sseTick]);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    if (id) setSide("structure");
  }, []);

  // Undo / redo from anywhere but text fields (they keep their own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !editable) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, editor]);

  const add = (type: ComponentType) => {
    setAddOpen(false);
    const id = newComponentId(doc, type);
    const component = starterComponent(type, id, (key) => t(key));
    const page = Math.max(1, layout.pages.length);
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
  // An agent's hand-off: shown with its questions in Changes, not as a loose note.
  const requests = openNotes.filter((n) => n.code === "review-request");
  const external = editor.external;
  const comparison = useMemo(() => (external ? engine.compare(external.before, doc, { surfaceId: activeSurface }) : null), [engine, external, doc, activeSurface]);
  const changeCount = (comparison?.edits.length ?? 0) + requests.length;
  const showChanges = Boolean(external) || requests.length > 0;
  const highlights = useMemo(
    () => (side === "changes" && comparison ? new Map(comparison.edits.filter((e) => !e.kinds.includes("removed")).map((e, i) => [e.component, i + 1] as const)) : undefined),
    [side, comparison],
  );
  // The tab counts what needs a look: people's annotations and warnings, not every box that moved.
  const notesBadge = openNotes.filter((n) => n.code !== "review-request" && (n.kind === "annotation" || n.severity === "warning")).length;

  return (
    <div style={{ height: "100%", paddingTop: 56, display: "flex", overflow: "hidden", background: "var(--color-bg)" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          role="toolbar"
          aria-label={t("layout.editor.toolbar")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            borderBottom: "1px solid var(--color-outline)",
            background: "var(--color-surface)",
            flexWrap: "wrap",
          }}
        >
          {canEdit && <Switch checked={editing} onChange={setEditing} label={t("layout.editor.editMode")} />}
          <select
            className="df-input"
            aria-label={t("layout.surface")}
            value={activeSurface ?? ""}
            onChange={(e) => setSurfaceId(e.target.value)}
            style={{ width: "auto", padding: "4px 8px" }}
          >
            {surfaces.map((s) => (
              <option key={s.id} value={s.id}>
                {surfaceName(s, t)}
              </option>
            ))}
          </select>
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
              <span aria-hidden style={{ width: 1, height: 20, background: "var(--color-outline)" }} />
              <IconButton icon="undo" label={t("layout.editor.undo")} disabled={!editor.canUndo} onClick={editor.undo} />
              <IconButton icon="redo" label={t("layout.editor.redo")} disabled={!editor.canRedo} onClick={editor.redo} />
              <div style={{ position: "relative" }}>
                <Button icon="add" iconPosition="start" aria-haspopup="menu" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>
                  {t("layout.editor.add")}
                </Button>
                {addOpen && <AddMenu onPick={add} onClose={() => setAddOpen(false)} />}
              </div>
            </>
          )}
          {canComment && (
            <Button
              variant={annotating ? "secondary" : "ghost"}
              icon="edit_note"
              iconPosition="start"
              aria-pressed={annotating}
              onClick={() => {
                setAnnotating(!annotating);
                setSide("notes");
              }}
            >
              {annotating ? t("layout.notes.stopAnnotating") : t("layout.notes.annotate")}
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <span
            style={{ ...textStyle.caption, display: "inline-flex", alignItems: "center", gap: 6, color: editor.status === "error" ? "var(--color-error)" : "var(--color-dim)" }}
            aria-live="polite"
            title={t("layout.revision", { revision: editor.revision })}
          >
            <span
              aria-hidden
              style={{ width: 6, height: 6, borderRadius: "50%", background: editor.status === "error" ? "var(--color-error)" : editor.status === "saving" ? "var(--color-warn)" : "var(--color-ok)" }}
            />
            {editor.status === "saving" ? t("layout.status.saving") : editor.status === "error" ? t("layout.editor.notSaved") : t("layout.status.saved")}
            <span style={{ color: "var(--color-faint)" }}>· {t("layout.pages", { count: layout.pages.length })}</span>
          </span>
          <Button
            variant="secondary"
            icon="download"
            iconPosition="start"
            onClick={() => {
              track("document_exported", { document_id: documentId, mode: "layout", format: "pdf", pages: layout.pages.length });
              canvas.current?.print();
            }}
          >
            {t("layout.print")}
          </Button>
        </div>
        {noticeText && (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px", background: "var(--color-steel-wash)", borderBottom: "1px solid var(--color-steel-line)" }}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-steel)" }}>
              smart_toy
            </span>
            <span style={{ ...textStyle.caption, color: "var(--color-text)", flex: 1 }}>
              {editor.notice?.kind === "external" && comparison ? t("layout.changes.banner", { count: comparison.edits.length }) : noticeText}
            </span>
            {editor.notice?.kind === "external" && external && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSide("changes");
                  editor.dismissNotice();
                }}
              >
                {t("layout.changes.review")}
              </Button>
            )}
            <IconButton icon="close" label={t("common.close")} onClick={editor.dismissNotice} />
          </div>
        )}
        <PageCanvas
          ref={canvas}
          engine={engine}
          content={doc}
          surfaceId={activeSurface}
          layout={layout}
          html={output.page}
          editable={editable && !annotating}
          selected={selected}
          onSelect={select}
          commit={editor.commit}
          preview={editor.preview}
          annotating={annotating}
          onAnnotate={(rect) => {
            setPendingRect(rect);
            setSide("notes");
          }}
          notes={openNotes}
          highlights={highlights}
          zoom={zoom}
          announce={setAnnouncement}
          onOpenContent={() => {
            setSide("structure");
            setComponentTab("content");
          }}
        />
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
      </div>

      <aside
        aria-label={t("layout.editor.panel")}
        style={{
          width: 360,
          flexShrink: 0,
          borderLeft: "1px solid var(--color-outline)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div role="tablist" style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid var(--color-outline)" }}>
          <Tab plain label={t("layout.side.structure")} count={attention || undefined} active={side === "structure"} onClick={() => setSide("structure")} />
          {showChanges && <Tab plain label={t("layout.side.changes")} count={changeCount || undefined} active={side === "changes"} onClick={() => setSide("changes")} />}
          <Tab plain label={t("layout.side.document")} active={side === "document"} onClick={() => setSide("document")} />
          <Tab plain label={t("layout.side.notes")} count={notesBadge || undefined} active={side === "notes"} onClick={() => setSide("notes")} />
        </div>
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {side === "structure" &&
            (selectedComponent ? (
              <ComponentPanel
                doc={doc}
                component={selectedComponent}
                geometry={layout.components[selectedComponent.id]}
                layout={layout}
                tokens={layout.tokens}
                families={families}
                commit={editor.commit}
                readOnly={!editable}
                tab={componentTab}
                onTab={setComponentTab}
                onRemoved={() => select(null)}
                onBack={() => select(null)}
              />
            ) : (
              <StructurePanel
                doc={doc}
                layout={layout}
                problems={problems}
                health={
                  <HealthSection
                    doc={doc}
                    findings={findings}
                    commit={editor.commit}
                    preview={editor.preview}
                    readOnly={!editable}
                    onShow={(id) => {
                      select(id);
                      canvas.current?.reveal(id);
                    }}
                  />
                }
                map={() => engine.map(doc, { level: 1, surfaceId: activeSurface }).text}
                onPick={(id) => {
                  select(id);
                  canvas.current?.reveal(id);
                }}
              />
            ))}
          {side === "changes" && (
            <ChangesPanel
              documentId={documentId}
              engine={engine}
              doc={doc}
              external={external}
              comparison={comparison}
              requests={requests}
              commit={editor.commit}
              replaceAll={editor.replaceAll}
              onDismissExternal={() => {
                editor.dismissExternal();
                if (!requests.length) setSide("structure");
              }}
              onAnswered={() => void loadNotes()}
              onShow={(id) => {
                setSelected(id);
                canvas.current?.reveal(id);
              }}
              canEdit={editable}
              canComment={canComment}
              getToken={getToken}
            />
          )}
          {side === "document" && (
            <DocumentPanel doc={doc} layout={layout} families={families} commit={editor.commit} preview={editor.preview} readOnly={!editable} />
          )}
          {side === "notes" && (
            <NotesPanel
              notes={openNotes.filter((n) => n.code !== "review-request")}
              nameOf={(id) => {
                const c = doc.components.find((x) => x.id === id);
                return c ? displayName(c, t) : id;
              }}
              loading={notesLoading}
              canComment={canComment}
              annotating={annotating}
              onToggleAnnotate={() => setAnnotating(!annotating)}
              pendingRect={pendingRect}
              pendingComponent={!pendingRect && annotating ? selected : null}
              onCreate={async (message) => {
                const anchor = pendingRect ? { rect: pendingRect } : { component: selected ?? undefined };
                const note = await apiCreateLayoutAnnotation(documentId, message, anchor, getToken);
                setNotes((list) => [...list, note]);
                setPendingRect(null);
                setAnnotating(false);
                void loadNotes();
              }}
              onCancelPending={() => setPendingRect(null)}
              onResolve={async (note) => {
                await apiUpdateLayoutNote(note.id, "resolved", getToken);
                setNotes((list) => list.filter((n) => n.id !== note.id));
              }}
              onResolveAll={async (list) => {
                await Promise.all(list.map((note) => apiUpdateLayoutNote(note.id, "resolved", getToken)));
                const done = new Set(list.map((n) => n.id));
                setNotes((all) => all.filter((n) => !done.has(n.id)));
              }}
              onShow={(id) => {
                select(id);
                canvas.current?.reveal(id);
              }}
            />
          )}
        </div>
      </aside>
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

function surfaceName(surface: Surface, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (surface.kind === "continuous") return t("layout.surfaceName.continuous");
  const size = typeof surface.size === "string" ? surface.size : `${Math.round(surface.size.width)}×${Math.round(surface.size.height)}`;
  return t("layout.surfaceName.page", { size });
}

/**
 * With nothing selected: the document as people read it (pages, then blocks side
 * by side, each named by its own words) plus any problem. Picking one selects it on
 * the page; it is also the keyboard path to every block.
 */
function StructurePanel({
  doc,
  layout,
  problems,
  health,
  map,
  onPick,
}: {
  doc: LayoutDocument;
  layout: LayoutResult;
  problems: Diagnostic[];
  health: ReactNode;
  map: () => string;
  onPick: (id: string) => void;
}) {
  const { t } = useI18n();
  const byId = new Map(doc.components.map((c) => [c.id, c] as const));
  const rows = rowsOf(layout);
  const unplaced = doc.components.filter((c) => !layout.components[c.id]);

  const item = (id: string, nested: boolean) => {
    const c = byId.get(id);
    const g = layout.components[id];
    if (!c) return null;
    return (
      <button
        key={id}
        type="button"
        className="df-row"
        onClick={() => onPick(id)}
        title={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: nested ? "6px 8px 6px 30px" : "6px 8px",
          background: "transparent",
          border: 0,
          color: "var(--color-text)",
          textAlign: "left",
          cursor: "pointer",
          borderRadius: "var(--radius-xs)",
          minWidth: 0,
        }}
      >
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
          {TYPE_ICON[c.type]}
        </span>
        <span style={{ ...textStyle.bodySm, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(c, t)}</span>
        {g && <span style={{ ...textStyle.caption, color: "var(--color-faint)", whiteSpace: "nowrap" }}>{widthLabel(g.box, layout, t)}</span>}
        {g && g.shifted > 0 && (
          <Pill compact tone="warn" dot={false}>
            ↓
          </Pill>
        )}
      </button>
    );
  };

  const pages = [...new Set(rows.map((r) => r.page))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {problems.length > 0 && (
        <section
          style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", background: "var(--color-warn-wash)", border: "1px solid var(--color-warn-line)" }}
        >
          <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.problemsCount", { count: problems.length })}</span>
          {problems.map((d, i) => {
            const c = d.component ? byId.get(d.component) : undefined;
            return (
              <DiagnosticRow
                key={i}
                diagnostic={d}
                name={c ? displayName(c, t) : undefined}
                onPick={c && layout.components[c.id] ? () => onPick(c.id) : undefined}
              />
            );
          })}
        </section>
      )}
      {health}
      {doc.components.length === 0 ? (
        <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.structure.empty")}</span>
      ) : (
        <nav aria-label={t("layout.side.structure")} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {pages.map((page, pi) => (
            <div key={page} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-faint)", padding: pi === 0 ? "0 8px 4px" : "12px 8px 4px" }}>
                {t("layout.structure.page", { n: page })}
              </span>
              {rows
                .filter((row) => row.page === page)
                .map((row) =>
                  row.ids.length === 1 ? (
                    item(row.ids[0] as string, false)
                  ) : (
                    <div key={row.ids.join("|")} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ ...textStyle.caption, color: "var(--color-dim)", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 2px" }}>
                        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
                          view_column
                        </span>
                        {t("layout.structure.row", { count: row.ids.length })}
                      </span>
                      {row.ids.map((id) => item(id, true))}
                    </div>
                  ),
                )}
            </div>
          ))}
          {unplaced.length > 0 && (
            <>
              <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-faint)", padding: "12px 8px 4px" }}>{t("layout.editor.unplacedShort")}</span>
              {unplaced.map((c) => item(c.id, false))}
            </>
          )}
        </nav>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: "1px solid var(--color-outline)" }}>
        <CopyMapButton text={map} />
        <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.agentHint")}</span>
      </div>
    </div>
  );
}

function DiagnosticRow({ diagnostic: d, name, onPick }: { diagnostic: Diagnostic; name?: string; onPick?: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: d.severity === "error" ? "var(--color-error)" : "var(--color-warn)", flexShrink: 0 }} />
        {onPick ? (
          <button type="button" className="df-row" onClick={onPick} style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-text)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
            {name ?? d.component}
          </button>
        ) : (
          name && <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-text)" }}>{name}</span>
        )}
      </div>
      <span style={{ ...textStyle.caption, color: "var(--color-dim)" }} title={d.code}>
        {d.message}
      </span>
    </div>
  );
}

function CopyMapButton({ text }: { text: () => string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      icon={copied ? "check" : "content_copy"}
      iconPosition="start"
      onClick={() => {
        void navigator.clipboard.writeText(text()).then(() => setCopied(true));
      }}
    >
      {copied ? t("layout.copied") : t("layout.copyForAgent")}
    </Button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ height: "100%", paddingTop: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
}
