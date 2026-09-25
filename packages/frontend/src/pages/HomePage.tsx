import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document } from "@/types";
import { API_BASE, mapDocument, apiFetchMe, apiUpdateDocumentTitle } from "@/utils/api";
import { AppPage, PageHeader, NewDocumentDialog } from "@/components/shared";
import {
  TwinModeTabs,
  DocTableRow,
  ConnectedAgentsCard,
  RecentActivityCard,
  docGroup,
  DOC_ROW_COLUMNS,
  type DocGroup,
  type TwinMode,
} from "@/components/dashboard";

export function HomePage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [weeklyCredits, setWeeklyCredits] = useState<number>(5);
  const [error, setError] = useState<string | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [mode, setMode] = useState<TwinMode>("all");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  const handleRename = async (docId: string, title: string) => {
    await apiUpdateDocumentTitle(docId, title, getToken);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, title } : d)));
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
        setError(err instanceof Error ? err.message : "Failed to load documents");
      } finally {
        setLoaded(true);
      }
    }
    async function fetchUser() {
      try {
        const user = await apiFetchMe(getToken);
        setCredits(user.credits);
        setWeeklyCredits(user.weekly_credits);
      } catch {
        // non-critical
      }
    }
    fetchDocs();
    fetchUser();
  }, [getToken]);

  const modeCounts = useMemo(() => {
    const count = (m: Document["documentMode"]) => documents.filter((d) => d.documentMode === m).length;
    return { all: documents.length, guided: count("guided"), pipeline: count("pipeline"), editor: count("editor") };
  }, [documents]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = documents.filter((d) => {
      if (mode !== "all" && d.documentMode !== mode) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
    return GROUPS.map((g) => ({ ...g, docs: visible.filter((d) => docGroup(d) === g.key) })).filter(
      (g) => g.docs.length > 0,
    );
  }, [documents, mode, search]);

  const newDocButton = (
    <button
      onClick={() => setShowNewDocDialog(true)}
      disabled={credits === 0}
      className="forge-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        border: "none",
        cursor: credits === 0 ? "not-allowed" : "pointer",
        opacity: credits === 0 ? 0.4 : 1,
        fontFamily: "inherit",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
      New document
    </button>
  );

  return (
    <AppPage wide>
      <PageHeader
        title="Documents"
        description={
          credits !== undefined ? (
            <>
              <b style={{ color: "var(--df-amber-300)" }}>{credits}</b> of {weeklyCredits} credits left this week
            </>
          ) : undefined
        }
        actions={newDocButton}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "start" }}>
        {/* ─── Documents column ─── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <TwinModeTabs value={mode} onChange={setMode} counts={modeCounts} />
            <label
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                border: "1px solid var(--df-outline-md)",
                borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
                width: 220,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--df-faint)" }}>search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                style={{
                  background: "transparent", border: "none", color: "var(--df-text)",
                  outline: "none", fontSize: 12, flex: 1, minWidth: 0, fontFamily: "inherit",
                }}
              />
            </label>
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
                gridTemplateColumns: DOC_ROW_COLUMNS,
                alignItems: "center",
                gap: 16,
                padding: "12px 22px",
                background: "rgba(255,255,255,0.02)",
                fontSize: 9.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--df-faint)",
                fontWeight: 600,
              }}
            >
              <span />
              <span>Document</span>
              <span>Stage</span>
              <span>Updated</span>
              <span />
            </div>

            {loaded && groups.length === 0 && !error && (
              <div style={{ padding: "48px 22px", textAlign: "center", fontSize: 13, color: "var(--df-faint)", borderTop: "1px solid var(--df-outline)" }}>
                {search || mode !== "all"
                  ? "No documents match these filters."
                  : "No documents yet. Create one to get started."}
              </div>
            )}

            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <div
                  className="df-mono"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 22px 8px",
                    borderTop: "1px solid var(--df-outline)",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: g.color,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: g.color }} />
                  {g.label}
                  <span style={{ color: "var(--df-faint)" }}>{g.docs.length}</span>
                  <span style={{ color: "var(--df-faint)", letterSpacing: "0.04em", textTransform: "none", marginLeft: 4 }}>
                    {g.hint}
                  </span>
                </div>
                {g.docs.map((doc) => (
                  <DocTableRow
                    key={doc.id}
                    doc={doc}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    onRename={handleRename}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <ConnectedAgentsCard />
          <RecentActivityCard />
        </aside>
      </div>

      {showNewDocDialog && (
        <NewDocumentDialog credits={credits} onClose={() => setShowNewDocDialog(false)} />
      )}
    </AppPage>
  );
}

const GROUPS: { key: DocGroup; label: string; hint: string; color: string }[] = [
  { key: "attention", label: "Needs you", hint: "waiting on your answer, approval or review", color: "var(--df-amber-300)" },
  { key: "active", label: "In progress", hint: "", color: "var(--df-dim)" },
  { key: "done", label: "Completed", hint: "", color: "var(--df-steel-100)" },
];
