import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document } from "@/types";
import { API_BASE, mapDocument, apiFetchMe } from "@/utils/api";
import { TopBar, Icon, NewDocumentDialog, AppFooter } from "@/components/shared";

const PHASE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  alignment: "Alignment",
  generation: "Generation",
  refinement: "Refinement",
  audit: "Audit",
  completed: "Completed",
};

export function HomePage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const token = await getToken();
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/documents`, { headers });
        if (!res.ok) throw new Error("Failed to fetch documents");
        const data = await res.json();
        setDocuments(
          (data.documents as Record<string, unknown>[]).map(mapDocument)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load documents");
      }
    }

    async function fetchUser() {
      try {
        const user = await apiFetchMe(getToken);
        setCredits(user.credits);
      } catch {
        // non-critical
      }
    }

    fetchDocs();
    fetchUser();
  }, [getToken]);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col">
      <TopBar credits={credits} />

      <main className="flex-grow pt-[70px] pb-32 px-4 md:px-8 w-full max-w-[1000px] mx-auto flex flex-col gap-6">
        {/* Page header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-8 mb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              Documents
            </h1>
            <p className="text-sm text-secondary mt-1">
              Quick access to your recent files and workflows.
            </p>
          </div>
          <button
            onClick={() => setShowNewDocDialog(true)}
            disabled={credits === 0}
            title={credits === 0 ? "No credits remaining. Resets weekly." : undefined}
            className="flex items-center gap-2 px-4 py-2 bg-primary-container text-white rounded self-start sm:self-auto hover:shadow-[0_0_15px_rgba(255,87,26,0.4)] transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            <Icon name="add" className="text-[18px]" />
            <span className="text-xs uppercase tracking-wider font-medium">
              New Document
            </span>
          </button>
        </header>

        {error && (
          <p className="text-xs text-red-400/80">{error}</p>
        )}

        {/* Document list */}
        <section className="flex flex-col border-t border-inverse-on-surface">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_1fr] gap-4 py-3 px-4 border-b border-surface-variant bg-surface-container-low/50">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-secondary">
              File Name
            </span>
            <span className="hidden md:block text-[11px] font-semibold uppercase tracking-widest text-secondary text-right">
              Status
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-secondary text-right">
              Last Edited
            </span>
          </div>

          {documents.length === 0 && !error && (
            <p className="py-12 text-center text-sm text-on-surface-variant/50">
              No documents found. Create a new one to get started.
            </p>
          )}

          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/document/${doc.id}`)}
              className="group grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1fr_1fr] items-center gap-4 py-4 px-4 border-b border-inverse-on-surface hover:bg-surface-container-low transition-colors duration-200 w-full text-left"
            >
              <div className="flex items-center gap-3">
                <Icon
                  name="description"
                  className="text-secondary group-hover:text-primary-container transition-colors font-light"
                />
                <span className="text-base font-medium text-on-surface group-hover:text-white transition-colors">
                  {doc.title}
                </span>
              </div>

              <div className="hidden md:flex justify-end items-center">
                {doc.currentPhase === "completed" ? (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-container border border-surface-variant rounded h-6">
                    <span
                      className="material-symbols-outlined text-[12px] text-emerald-500"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide text-on-surface-variant">
                      Done
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-container border border-primary-container/30 rounded h-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
                    <span className="text-[11px] font-semibold tracking-wide text-primary-container">
                      {PHASE_LABELS[doc.currentPhase] ?? doc.currentPhase}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="text-[13px] font-mono text-secondary opacity-60">
                  {new Date(doc.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </button>
          ))}
        </section>
      </main>

      {showNewDocDialog && (
        <NewDocumentDialog onClose={() => setShowNewDocDialog(false)} />
      )}

      <AppFooter />
    </div>
  );
}

