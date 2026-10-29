import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document, Folder, SharedDocument } from "@/types";
import {
  apiListDocuments,
  apiFetchMe,
  apiUpdateDocumentTitle,
  apiFetchSharedDocuments,
  apiMoveDocument,
  apiCreateFolder,
  apiUpdateFolder,
  apiSetDocumentArchived,
} from "@/utils/api";
import { TopBar, NewDocumentDialog } from "@/components/shared";
import {
  DocTableRow,
  FolderRail,
  FolderTableRow,
  MoveDocumentDialog,
  FolderDragOverlay,
  DocumentDragOverlay,
  ShareDialog,
  LIBRARY_GRID,
  type LibraryView,
} from "@/components/dashboard";
import { Button, IconButton, Input, Meter, Page, PageHeader, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { fullDate, relativeTime } from "@/utils/time";

export function HomePage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentCreations, setDocumentCreations] = useState<number | undefined>(undefined);
  const [weeklyDocumentCreations, setWeeklyDocumentCreations] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [showingShared, setShowingShared] = useState(false);
  const [showingArchived, setShowingArchived] = useState(false);
  const [shared, setShared] = useState<SharedDocument[]>([]);
  const [folderTick, setFolderTick] = useState(0);
  const [sharing, setSharing] = useState<Document | null>(null);
  const [movingDocument, setMovingDocument] = useState<Document | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [libraryView, setLibraryView] = useState<LibraryView>("all");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolderPending, setCreatingFolderPending] = useState(false);

  /** Move a document into a folder (or to the root) and refresh the counts. */
  const handleMove = async (docId: string, target: string | null) => {
    await apiMoveDocument(docId, target, getToken);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, folderId: target } : d)));
    setFolderTick((n) => n + 1);
  };

  const handleRename = async (docId: string, title: string) => {
    await apiUpdateDocumentTitle(docId, title, getToken);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, title } : d)));
  };

  const handleArchive = async (docId: string) => {
    await apiSetDocumentArchived(docId, true, getToken);
    setDocuments((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, archivedAt: new Date().toISOString() } : doc)));
  };

  const handleRestore = async (docId: string) => {
    await apiSetDocumentArchived(docId, false, getToken);
    setDocuments((prev) => prev.map((doc) => (doc.id === docId ? { ...doc, archivedAt: null } : doc)));
  };

  const handleCreateFolder = async (name: string) => {
    const created = await apiCreateFolder(name, folderId, getToken);
    setFolders((current) => [...current, created]);
    setFolderTick((n) => n + 1);
  };

  const submitFolder = async () => {
    const name = folderName.trim();
    if (!name || creatingFolderPending) return;
    setCreatingFolderPending(true);
    setError(null);
    try {
      await handleCreateFolder(name);
      setFolderName("");
      setCreatingFolder(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("folder.createError"));
    } finally {
      setCreatingFolderPending(false);
    }
  };

  const handleMoveFolder = async (movingFolderId: string, parentId: string | null) => {
    await apiUpdateFolder(movingFolderId, { parentId }, getToken);
    setFolders((current) => current.map((folder) => (
      folder.id === movingFolderId ? { ...folder, parentId } : folder
    )));
    setFolderTick((n) => n + 1);
  };

  useEffect(() => {
    async function fetchDocs() {
      try {
        setDocuments(await apiListDocuments(getToken, true));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("folder.loadError"));
      }
    }
    async function fetchUser() {
      try {
        const user = await apiFetchMe(getToken);
        setDocumentCreations(user.document_creations_remaining);
        setWeeklyDocumentCreations(user.weekly_document_creations);
      } catch {
        // non-critical
      }
    }
    async function fetchShared() {
      try {
        setShared(await apiFetchSharedDocuments(getToken));
      } catch {
        // non-critical
      }
    }
    fetchDocs();
    fetchUser();
    fetchShared();
  }, [getToken]);

  const libraryCounts = useMemo(() => ({
    all: documents.filter((doc) => !doc.archivedAt).length,
    drafts: documents.filter((doc) => !doc.archivedAt && (!doc.publishedAt || doc.hasUnpublishedChanges)).length,
    published: documents.filter((doc) => !doc.archivedAt && Boolean(doc.publishedAt)).length,
  }), [documents]);

  const breadcrumb = useMemo(() => {
    if (folderId === null) return [];
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const path: Folder[] = [];
    const seen = new Set<string>();
    let current = byId.get(folderId);
    while (current && !seen.has(current.id)) {
      path.unshift(current);
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  }, [folderId, folders]);

  const childFolders = useMemo(
    () => folders.filter((folder) => folder.parentId === folderId),
    [folderId, folders],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (showingArchived !== Boolean(d.archivedAt)) return false;
      if (libraryView === "all" && d.folderId !== folderId) return false;
      if (libraryView === "drafts" && d.publishedAt && !d.hasUnpublishedChanges) return false;
      if (libraryView === "published" && !d.publishedAt) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, search, folderId, libraryView, showingArchived]);

  const visibleFolders = useMemo(() => {
    if (showingShared || showingArchived || libraryView !== "all") return [];
    const q = search.trim().toLowerCase();
    return childFolders.filter((folder) => !q || folder.name.toLowerCase().includes(q));
  }, [childFolders, libraryView, search, showingShared, showingArchived]);

  const archivedCount = documents.filter((doc) => doc.archivedAt).length;

  /** "Arquitetura / Decisões" for a row listed outside its own folder. */
  const folderPath = (id: string | null) => {
    if (!id) return null;
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const names: string[] = [];
    let current = byId.get(id);
    while (current && names.length < 4) {
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names.join(" / ") || null;
  };
  const showLocation = libraryView !== "all" || showingArchived || Boolean(search.trim());

  const viewTitle = showingShared
    ? t("dashboard.sharedWithMe")
    : showingArchived
      ? t("dashboard.archive")
      : libraryView === "drafts"
        ? t("dashboard.drafts")
        : libraryView === "published"
          ? t("dashboard.publishedView")
          : null;

  const itemCount = showingShared ? shared.length : filtered.length + visibleFolders.length;
  const canCreateFolder = !showingShared && !showingArchived && libraryView === "all";

  const emptyMessage = search
    ? t("dashboard.emptySearch")
    : showingShared
      ? t("dashboard.emptyShared")
      : showingArchived
        ? t("dashboard.emptyArchive")
        : libraryView === "drafts"
          ? t("dashboard.emptyDrafts")
          : libraryView === "published"
            ? t("dashboard.emptyPublished")
            : folderId
              ? t("dashboard.emptyFolder")
              : t("dashboard.emptyLibrary");
  const isEmpty = showingShared ? shared.length === 0 : filtered.length === 0 && visibleFolders.length === 0 && !creatingFolder;

  const goRoot = () => { setFolderId(null); setLibraryView("all"); setShowingShared(false); setShowingArchived(false); };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopBar dashboardNav />
      <FolderDragOverlay />
      <DocumentDragOverlay />

      <Page width="wide">
        <PageHeader
          title={t("dashboard.libraryTitle")}
          lead={t("dashboard.libraryLead")}
          actions={
            <>
              {documentCreations !== undefined && (
                <CapacityMeter left={documentCreations} total={weeklyDocumentCreations} />
              )}
              <Button variant="primary" icon="add" iconPosition="start" onClick={() => setShowNewDocDialog(true)}>
                {t("dashboard.newDocument")}
              </Button>
            </>
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: "232px minmax(0,1fr)", gap: 32, alignItems: "start" }}>
          <aside style={{ position: "sticky", top: 80 }}>
            <FolderRail
              selected={showingShared || showingArchived ? null : folderId}
              onSelect={(id) => {
                setFolderId(id);
                setLibraryView("all");
                setShowingShared(false);
                setShowingArchived(false);
              }}
              refreshTick={folderTick}
              sharedCount={shared.length}
              sharedSelected={showingShared}
              onSelectShared={() => {
                setShowingShared(true);
                setFolderId(null);
                setShowingArchived(false);
              }}
              archivedCount={archivedCount}
              archivedSelected={showingArchived}
              onSelectArchived={() => {
                setShowingArchived(true);
                setShowingShared(false);
                setFolderId(null);
                setLibraryView("all");
              }}
              onFoldersChange={setFolders}
              activeView={libraryView}
              onSelectView={(view) => {
                setLibraryView(view);
                setFolderId(null);
                setShowingShared(false);
                setShowingArchived(false);
              }}
              viewCounts={libraryCounts}
            />
          </aside>

          {/* ─── Documents column ─── */}
          <section style={{ minWidth: 0 }}>
            {/* Toolbar: where you are · how much is here · search · new folder */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", minHeight: 34, marginBottom: 14 }}>
              <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
                {viewTitle ? (
                  <span style={{ color: "var(--color-text)" }}>{viewTitle}</span>
                ) : (
                  <>
                    <button
                      onClick={goRoot}
                      style={{ padding: 0, border: 0, background: "transparent", color: breadcrumb.length ? "var(--color-faint)" : "var(--color-text)", font: "inherit", cursor: "pointer" }}
                    >
                      {t("dashboard.libraryShort")}
                    </button>
                    {breadcrumb.map((folder, index) => (
                      <span key={folder.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span aria-hidden style={{ color: "var(--color-mute)", fontWeight: 400 }}>/</span>
                        <button
                          onClick={() => setFolderId(folder.id)}
                          style={{ padding: 0, border: 0, background: "transparent", color: index === breadcrumb.length - 1 ? "var(--color-text)" : "var(--color-faint)", font: "inherit", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {folder.name}
                        </button>
                      </span>
                    ))}
                  </>
                )}
                <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 400, color: "var(--color-faint)", fontVariantNumeric: "tabular-nums" }}>
                  {itemCount === 1 ? t("dashboard.itemCount") : t("dashboard.itemsCount", { count: itemCount })}
                </span>
              </nav>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", width: 240 }}>
                  <span className="material-symbols-outlined" aria-hidden style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--color-faint)", pointerEvents: "none" }}>search</span>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("dashboard.searchDocuments")}
                    aria-label={t("dashboard.searchDocuments")}
                    style={{ paddingLeft: 32 }}
                  />
                </div>
                {canCreateFolder && (
                  <Button icon="create_new_folder" iconPosition="start" onClick={() => setCreatingFolder(true)}>
                    {t("dashboard.newFolder")}
                  </Button>
                )}
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 12.5, color: "var(--color-error)", margin: "0 0 12px" }}>{error}</p>
            )}

            <div
              style={{
                border: "1px solid var(--color-outline)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                background: "var(--color-surface)",
              }}
            >
              <div
                style={{
                  ...textStyle.label,
                  display: "grid",
                  gridTemplateColumns: LIBRARY_GRID,
                  alignItems: "center",
                  gap: 16,
                  padding: "11px 16px 11px 18px",
                  color: "var(--color-faint)",
                }}
              >
                <span style={{ paddingLeft: 32 }}>{t("dashboard.name")}</span>
                <span>{showingShared ? t("share.role") : t("dashboard.status")}</span>
                <span>{t("dashboard.agent")}</span>
                <span>{t("dashboard.modified")}</span>
                <span />
              </div>

              {creatingFolder && canCreateFolder && (
                <div style={{ display: "grid", gridTemplateColumns: LIBRARY_GRID, alignItems: "center", gap: 16, minHeight: 56, padding: "8px 16px 8px 18px", borderTop: "1px solid var(--color-outline)", background: "var(--color-heat-tint)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 20, color: "var(--color-heat-hi)", fontVariationSettings: "'FILL' 1" }}>create_new_folder</span>
                    <Input
                      autoFocus
                      value={folderName}
                      onChange={(event) => setFolderName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submitFolder();
                        if (event.key === "Escape") { setCreatingFolder(false); setFolderName(""); }
                      }}
                      placeholder={t("folder.createPrompt")}
                      aria-label={t("folder.createPrompt")}
                      style={{ maxWidth: 360 }}
                    />
                  </div>
                  <span />
                  <span />
                  <span />
                  <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 4 }}>
                    <Button variant="primary" onClick={() => void submitFolder()} disabled={!folderName.trim() || creatingFolderPending}>
                      {creatingFolderPending ? t("common.creating") : t("common.create")}
                    </Button>
                    <IconButton icon="close" label={t("common.cancel")} onClick={() => { setCreatingFolder(false); setFolderName(""); }} />
                  </div>
                </div>
              )}

              {!showingShared && visibleFolders.map((folder) => (
                <FolderTableRow
                  key={folder.id}
                  folder={folder}
                  childFolderCount={folders.filter((candidate) => candidate.parentId === folder.id).length}
                  onOpen={() => setFolderId(folder.id)}
                  onDropFolder={handleMoveFolder}
                />
              ))}

              {!showingShared &&
                filtered.map((doc) => (
                  <DocTableRow
                    key={doc.id}
                    doc={doc}
                    location={showLocation ? folderPath(doc.folderId ?? null) : null}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    onRename={handleRename}
                    onShare={() => setSharing(doc)}
                    onMoveToFolder={(target) => void handleMove(doc.id, target)}
                    onRequestMove={showingArchived ? undefined : () => setMovingDocument(doc)}
                    onArchive={showingArchived ? undefined : () => { void handleArchive(doc.id); }}
                    onRestore={showingArchived ? () => { void handleRestore(doc.id); } : undefined}
                  />
                ))}

              {showingShared &&
                shared.map((doc) => (
                  <div
                    key={doc.id}
                    className="df-row"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") navigate(`/document/${doc.id}`); }}
                    style={{ display: "grid", gridTemplateColumns: LIBRARY_GRID, alignItems: "center", gap: 16, minHeight: 56, padding: "8px 16px 8px 18px", borderTop: "1px solid var(--color-outline)", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 20, color: "var(--color-faint)" }}>description</span>
                      <span style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                    </div>
                    <div><Pill compact>{t(`share.${doc.role}`)}</Pill></div>
                    <span style={{ color: "var(--color-mute)", fontSize: 12.5 }}>—</span>
                    <span title={fullDate(doc.updatedAt, dateLocale)} style={{ fontSize: 12.5, color: "var(--color-faint)", whiteSpace: "nowrap" }}>{relativeTime(doc.updatedAt, dateLocale)}</span>
                    <div style={{ justifySelf: "end", display: "flex" }}>
                      <span className="material-symbols-outlined df-row-chevron" aria-hidden style={{ fontSize: 18 }}>chevron_right</span>
                    </div>
                  </div>
                ))}

              {isEmpty && !error && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "56px 24px", borderTop: "1px solid var(--color-outline)", textAlign: "center" }}>
                  <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 28, color: "var(--color-mute)" }}>
                    {search ? "search_off" : showingArchived ? "inventory_2" : showingShared ? "group" : "draft"}
                  </span>
                  <p style={{ ...textStyle.bodySm, margin: 0, maxWidth: 380, color: "var(--color-faint)" }}>{emptyMessage}</p>
                  {canCreateFolder && !search && (
                    <Button icon="add" iconPosition="start" onClick={() => setShowNewDocDialog(true)}>{t("dashboard.newDocument")}</Button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </Page>

      {sharing && (
          <ShareDialog
            documentId={sharing.id}
            documentTitle={sharing.title}
            publishedAt={sharing.publishedAt}
            layout={sharing.documentMode === "layout"}
            onClose={() => setSharing(null)}
        />
      )}

      {movingDocument && (
        <MoveDocumentDialog
          documentTitle={movingDocument.title}
          currentFolderId={movingDocument.folderId ?? null}
          folders={folders}
          onMove={(target) => handleMove(movingDocument.id, target)}
          onClose={() => setMovingDocument(null)}
        />
      )}

      {showNewDocDialog && (
        <NewDocumentDialog remaining={documentCreations} weeklyLimit={weeklyDocumentCreations} onClose={() => setShowNewDocDialog(false)} />
      )}
    </div>
  );
}

/** This week's document creations: the number and a thin bar, nothing more. */
function CapacityMeter({ left, total }: { left: number; total: number }) {
  const { t } = useI18n();
  const used = Math.max(0, total - left);
  const exhausted = left <= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 168 }} title={t("dashboard.creationsValue", { left, total })}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...textStyle.label, color: "var(--color-faint)" }}>{t("dashboard.creationsLabel")}</span>
        <span className="df-mono" style={{ fontSize: 12.5, color: exhausted ? "var(--color-error)" : "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
          {left}<span style={{ color: "var(--color-faint)" }}>/{total}</span>
        </span>
      </div>
      <Meter value={used} max={total} />
    </div>
  );
}
