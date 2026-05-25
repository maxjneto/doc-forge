import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document } from "@/types";
import { API_BASE, mapDocument, apiFetchMe, apiUpdateDocumentTitle } from "@/utils/api";
import { TopBar, NewDocumentDialog } from "@/components/shared";
import {
  TwinModeTabs,
  DocTableRow,
  ConnectedAgentsCard,
  RecentActivityCard,
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
    const forger = documents.filter((d) => d.documentMode === "guided").length;
    const mcp = documents.filter((d) => d.documentMode === "editor" && Boolean(d.hasApiKeyActivity)).length;
    return { all: documents.length, forger, mcp };
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (mode === "forger" && d.documentMode !== "guided") return false;
      if (mode === "mcp" && !(d.documentMode === "editor" && d.hasApiKeyActivity)) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, mode, search]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--df-bg, #0a0b0c)",
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
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Documents</h1>
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
                  Credits remaining
                </span>
                <span
                  className="df-mono"
                  style={{ fontSize: 12, color: "var(--df-amber-300)", letterSpacing: "0.04em" }}
                >
                  <b>{credits}</b>
                  <span style={{ color: "var(--df-dim)" }}> of {weeklyCredits} this week</span>
                </span>
              </div>
            )}
            <button
              onClick={() => setShowNewDocDialog(true)}
              disabled={credits === 0}
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
                cursor: credits === 0 ? "not-allowed" : "pointer",
                opacity: credits === 0 ? 0.4 : 1,
                boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
                fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              New document
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24 }}>
          {/* ─── Documents column ─── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <TwinModeTabs value={mode} onChange={setMode} counts={modeCounts} />
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
                  placeholder="Search documents…"
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
                <span>File</span>
                <span>Status</span>
                <span>Last edited</span>
                <span />
              </div>

              {filtered.length === 0 && !error && (
                <div
                  style={{
                    padding: "48px 22px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "var(--df-faint)",
                  }}
                >
                  {search ? "No documents match your search." : "No documents found. Create a new one to get started."}
                </div>
              )}

              {filtered.map((doc) => (
                <DocTableRow
                  key={doc.id}
                  doc={doc}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  onRename={handleRename}
                />
              ))}
            </div>
          </div>

          {/* ─── Sidebar ─── */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <ConnectedAgentsCard />
            <RecentActivityCard />
          </aside>
        </div>
      </main>

      {showNewDocDialog && (
        <NewDocumentDialog credits={credits} onClose={() => setShowNewDocDialog(false)} />
      )}
    </div>
  );
}

