import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document, Folder, SharedDocument } from "@/types";
import {
  API_BASE,
  mapDocument,
  apiFetchMe,
  apiUpdateDocumentTitle,
  apiFetchSharedDocuments,
  apiMoveDocument,
  apiCreateFolder,
  apiUpdateFolder,
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
  type LibraryView,
} from "@/components/dashboard";
import { useI18n } from "@/i18n";

export function HomePage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [weeklyCredits, setWeeklyCredits] = useState<number>(5);
  const [guidedCost, setGuidedCost] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [showingShared, setShowingShared] = useState(false);
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
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/documents`, { headers });
        if (!res.ok) throw new Error("Failed to fetch documents");
        const data = await res.json();
        setDocuments((data.documents as Record<string, unknown>[]).map(mapDocument));
      } catch (err) {
        setError(err instanceof Error ? err.message : t("folder.loadError"));
      }
    }
    async function fetchUser() {
      try {
        const user = await apiFetchMe(getToken);
        setCredits(user.credits);
        setWeeklyCredits(user.weekly_credits);
        setGuidedCost(user.credit_costs.guided_document);
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
    all: documents.length,
    drafts: documents.filter((doc) => doc.documentMode !== "guided" && (!doc.publishedAt || doc.hasUnpublishedChanges)).length,
    published: documents.filter((doc) => Boolean(doc.publishedAt)).length,
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
      if (libraryView === "all" && d.folderId !== folderId) return false;
      if (libraryView === "drafts" && (d.documentMode === "guided" || (d.publishedAt && !d.hasUnpublishedChanges))) return false;
      if (libraryView === "published" && !d.publishedAt) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, search, folderId, libraryView]);

  const visibleFolders = useMemo(() => {
    if (showingShared || libraryView !== "all") return [];
    const q = search.trim().toLowerCase();
    return childFolders.filter((folder) => !q || folder.name.toLowerCase().includes(q));
  }, [childFolders, libraryView, search, showingShared]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--df-bg)",
        color: "#e3e2e2",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <TopBar
        credits={credits}
        dashboardNav
      />
      <FolderDragOverlay />
      <DocumentDragOverlay />

      <main style={{ flex: 1, paddingTop: 56 + 36, paddingBottom: 80, paddingLeft: 56, paddingRight: 56 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{t("dashboard.library")}</h1>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--df-faint)" }}>
              {t("dashboard.libraryDescription")}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {credits !== undefined && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.10em",
                    color: "var(--df-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  {t("dashboard.creditsRemaining")}
                </span>
                <span
                  className="df-mono"
                  style={{ fontSize: 12, color: "var(--df-amber-300)", letterSpacing: "0.04em" }}
                >
                  <b>{credits}</b>
                  <span style={{ color: "var(--df-dim)" }}> {t("dashboard.creditsThisWeek", { total: weeklyCredits })}</span>
                </span>
              </div>
            )}
            <button
              onClick={() => setShowNewDocDialog(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.04em",
                border: "1px solid var(--df-amber-500)",
                background: "var(--df-amber-500)",
                color: "#fff",
                cursor: "pointer",
                boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
                fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              {t("dashboard.newDocument")}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 26 }}>
          <FolderRail
            selected={folderId}
            onSelect={(id) => {
              setFolderId(id);
              setLibraryView("all");
              setShowingShared(false);
            }}
            refreshTick={folderTick}
            sharedCount={shared.length}
            sharedSelected={showingShared}
            onSelectShared={() => {
              setShowingShared(true);
              setFolderId(null);
            }}
            onFoldersChange={setFolders}
            activeView={libraryView}
            onSelectView={(view) => {
              setLibraryView(view);
              setFolderId(null);
              setShowingShared(false);
            }}
            viewCounts={libraryCounts}
          />

          {/* ─── Documents column ─── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 26, marginBottom: 10, color: "var(--df-faint)", fontSize: 11.5 }}>
              <button
                onClick={() => { setFolderId(null); setLibraryView("all"); setShowingShared(false); }}
                style={{ padding: 0, border: 0, background: "transparent", color: breadcrumb.length ? "var(--df-faint)" : "var(--df-on-surface)", font: "inherit", cursor: "pointer" }}
              >
                {t("dashboard.libraryShort")}
              </button>
              {!showingShared && libraryView !== "all" && <><span>/</span><span style={{ color: "var(--df-on-surface)" }}>{libraryView === "drafts" ? t("dashboard.drafts") : t("common.published")}</span></>}
              {showingShared && <><span>/</span><span style={{ color: "var(--df-on-surface)" }}>{t("dashboard.sharedWithMe")}</span></>}
              {!showingShared && breadcrumb.map((folder, index) => (
                <span key={folder.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>/</span>
                  <button
                    onClick={() => setFolderId(folder.id)}
                    style={{ padding: 0, border: 0, background: "transparent", color: index === breadcrumb.length - 1 ? "var(--df-on-surface)" : "var(--df-faint)", font: "inherit", cursor: "pointer" }}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--df-on-surface)" }}>
                  {showingShared
                    ? t("dashboard.sharedDocuments")
                    : folderId
                      ? t("dashboard.folderContent")
                      : libraryView === "drafts"
                        ? t("dashboard.drafts")
                        : libraryView === "published"
                          ? t("dashboard.publishedDocuments")
                          : t("dashboard.libraryContent")}
                </h2>
                {libraryView === "all" && !showingShared && (
                  <span style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "var(--df-faint)" }}>
                    {t("dashboard.locationHint")}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
                  {showingShared ? shared.length : filtered.length + visibleFolders.length} {t((showingShared ? shared.length : filtered.length + visibleFolders.length) === 1 ? "common.item" : "common.items")}
                </span>
                {!showingShared && libraryView === "all" && (
                  <button
                    onClick={() => setCreatingFolder(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 9px", border: "1px solid var(--df-outline)", borderRadius: 6, background: "var(--color-white-03)", color: "var(--df-dim)", font: "inherit", fontSize: 11, cursor: "pointer" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>create_new_folder</span>
                    {t("dashboard.newFolder")}
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 14 }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 10px",
                  border: "1px solid var(--df-outline)",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.02)",
                  width: 200,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--df-faint)" }}>search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("dashboard.searchDocuments")}
                  style={{
                    background: "transparent", border: "none", color: "#e3e2e2",
                    outline: "none", font: "12px / 1 'Inter', sans-serif",
                    flex: 1, minWidth: 0, fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="df-mono" style={{ fontSize: 11, color: "var(--df-error)", marginBottom: 12 }}>
                {error}
              </p>
            )}

            <div
              style={{
                border: "1px solid var(--df-outline)",
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(18,20,20,0.4)",
              }}
            >
              <div
                className="df-mono"
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px minmax(0,1fr) 280px 130px 130px",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 22px",
                  borderBottom: "1px solid var(--df-outline)",
                  background: "rgba(255,255,255,0.02)",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--df-faint)",
                  fontWeight: 600,
                }}
              >
                <span />
                <span>{t("dashboard.name")}</span>
                <span>{t("dashboard.statusContent")}</span>
                <span>{t("dashboard.modified")}</span>
                <span />
              </div>

              {creatingFolder && !showingShared && libraryView === "all" && (
                <div style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr) 280px 130px 130px", alignItems: "center", gap: 16, minHeight: 67, padding: "12px 22px", borderTop: "1px solid var(--df-outline)", background: "var(--color-white-03)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 21, color: "var(--df-amber-300)", fontVariationSettings: "'FILL' 1" }}>folder</span>
                  <input
                    autoFocus
                    value={folderName}
                    onChange={(event) => setFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submitFolder();
                      if (event.key === "Escape") { setCreatingFolder(false); setFolderName(""); }
                    }}
                    placeholder={t("folder.createPrompt")}
                    style={{ minWidth: 0, padding: "5px 0", border: 0, borderBottom: "1px solid var(--df-outline-md)", outline: 0, background: "transparent", color: "var(--df-on-surface)", font: "500 13px 'Inter', sans-serif" }}
                  />
                  <span className="df-mono" style={{ fontSize: 10, color: "var(--df-faint)" }}>{t("dashboard.newFolderLabel").toUpperCase()}</span>
                  <span />
                  <div style={{ justifySelf: "end", display: "flex", gap: 6 }}>
                    <button onClick={() => void submitFolder()} disabled={!folderName.trim() || creatingFolderPending} style={{ padding: "6px 9px", border: 0, borderRadius: 5, background: "var(--df-amber-500)", color: "var(--df-on-primary)", font: "inherit", fontSize: 10.5, cursor: "pointer", opacity: !folderName.trim() || creatingFolderPending ? 0.5 : 1 }}>
                      {creatingFolderPending ? t("common.creating") : t("common.create")}
                    </button>
                    <button onClick={() => { setCreatingFolder(false); setFolderName(""); }} aria-label={t("common.cancel")} style={{ padding: 5, border: 0, background: "transparent", color: "var(--df-faint)", cursor: "pointer" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
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

              {filtered.length === 0 && visibleFolders.length === 0 && !creatingFolder && !error && !showingShared && (
                <div
                  style={{
                    padding: "48px 22px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--df-faint)",
                  }}
                >
                  {search ? t("dashboard.emptySearch") : t("dashboard.empty")}
                </div>
              )}

              {!showingShared &&
                filtered.map((doc) => (
                  <DocTableRow
                    key={doc.id}
                    doc={doc}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    onRename={handleRename}
                    onShare={() => setSharing(doc)}
                    onMoveToFolder={(target) => void handleMove(doc.id, target)}
                    onRequestMove={() => setMovingDocument(doc)}
                  />
                ))}

              {showingShared &&
                shared.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 22px",
                      borderBottom: "1px solid var(--df-outline)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--df-on-surface)" }}>
                      {doc.title}
                    </span>
                    <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
                      {doc.role.toUpperCase()}
                    </span>
                  </div>
                ))}
            </div>
          </div>

        </div>
      </main>

      {sharing && (
          <ShareDialog
            documentId={sharing.id}
            documentTitle={sharing.title}
            publishedAt={sharing.publishedAt}
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
        <NewDocumentDialog credits={credits} guidedCost={guidedCost} onClose={() => setShowNewDocDialog(false)} />
      )}
    </div>
  );
}

