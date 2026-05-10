import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import type { Document, Phase } from "@/types";
import { API_BASE, mapDocument, apiFetchMe } from "@/utils/api";
import { TopBar, NewDocumentDialog } from "@/components/shared";

type FilterTab = "active" | "forged" | "all";

const PHASE_ORDER: Phase[] = [
  "discovery",
  "alignment",
  "generation",
  "refinement",
  "audit",
  "completed",
];

const PHASE_LABEL: Record<Phase, string> = {
  discovery: "Discovery",
  alignment: "Alignment",
  generation: "Generation",
  refinement: "Refinement",
  audit: "Audit",
  completed: "Forged",
};

function PhaseTrail({ currentPhase }: { currentPhase: Phase }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {PHASE_ORDER.map((phase, i) => {
        const isDone = i < currentIdx;
        const isNow = i === currentIdx;
        const isSteel = phase === "completed" && currentPhase === "completed";

        let bg = "transparent";
        let border = "1px solid var(--df-mute, rgba(227,226,226,0.18))";
        let shadow = "none";

        if (isSteel) {
          bg = "var(--df-steel-200, #8aa0b8)";
          border = "none";
        } else if (isDone) {
          bg = "var(--df-amber-trail, rgba(255,77,0,0.42))";
          border = "none";
        } else if (isNow) {
          bg = "var(--df-amber-500, #ff4d00)";
          border = "none";
          shadow = "0 0 0 3px rgba(255,77,0,0.16), 0 0 10px rgba(255,77,0,0.55)";
        }

        return (
          <div
            key={phase}
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: bg,
              border,
              boxShadow: shadow,
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

function DocRow({ doc, onClick }: { doc: Document; onClick: () => void }) {
  const phase = doc.currentPhase;
  const isForged = phase === "completed";
  const phaseColor = isForged
    ? "var(--df-steel-100, #b9c6d4)"
    : "var(--df-amber-300, #ff8d4a)";

  const ctaLabel = isForged ? "View" : "Resume";
  const ctaStyle = isForged
    ? {
        color: "var(--df-steel-100, #b9c6d4)",
        borderColor: "var(--df-steel-border, rgba(138,160,184,0.35))",
        background: "var(--df-steel-bg, rgba(138,160,184,0.10))",
      }
    : {
        color: "var(--df-amber-200, #ffb59e)",
        borderColor: "rgba(255,77,0,0.30)",
        background: "rgba(255,77,0,0.06)",
      };

  const formattedDate = new Date(doc.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <button
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr 260px 130px 110px",
        alignItems: "center",
        gap: 16,
        padding: "14px 22px",
        borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        fontSize: 14,
        background: "transparent",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.15s",
        border: "none",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
        borderBottomColor: "var(--df-outline, rgba(255,255,255,0.06))",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,77,0,0.025)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      {/* Icon */}
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 18,
          color: isForged
            ? "var(--df-steel-200, #8aa0b8)"
            : "var(--df-amber-300, #ff8d4a)",
        }}
      >
        {isForged ? "verified" : "description"}
      </span>

      {/* Title */}
      <div>
        <div style={{ fontWeight: 500, color: "#e3e2e2" }}>{doc.title}</div>
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PhaseTrail currentPhase={phase} />
        <span
          className="df-mono"
          style={{ fontSize: 10, letterSpacing: "0.10em", color: phaseColor }}
        >
          {PHASE_LABEL[phase]}
        </span>
      </div>

      {/* Last edited */}
      <span
        className="df-mono"
        style={{ fontSize: 11, color: "var(--df-faint, rgba(227,226,226,0.38))" }}
      >
        {formattedDate}
      </span>

      {/* CTA */}
      <div style={{ justifySelf: "end" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid",
            cursor: "pointer",
            letterSpacing: "0.04em",
            ...ctaStyle,
          }}
        >
          {ctaLabel}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            arrow_forward
          </span>
        </span>
      </div>
    </button>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="df-mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "6px 12px",
        borderRadius: 999,
        border: "1px solid",
        cursor: "pointer",
        background: "transparent",
        color: active
          ? "var(--df-amber-200, #ffb59e)"
          : "var(--df-dim, rgba(227,226,226,0.62))",
        borderColor: active
          ? "rgba(255,77,0,0.40)"
          : "var(--df-outline, rgba(255,255,255,0.06))",
        backgroundColor: active ? "rgba(255,77,0,0.08)" : "transparent",
      }}
    >
      {label}{" "}
      <span
        style={{
          color: active
            ? "var(--df-amber-300, #ff8d4a)"
            : "var(--df-faint, rgba(227,226,226,0.38))",
          marginLeft: 6,
          fontWeight: 500,
        }}
      >
        {count}
      </span>
    </button>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showNewDocDialog, setShowNewDocDialog] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("active");

  useEffect(() => {
    async function fetchDocs() {
      try {
        const token = await getToken();
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const res = await fetch(`${API_BASE}/documents`, { headers });
        if (!res.ok) throw new Error("Failed to fetch documents");
        const data = await res.json();
        setDocuments(
          (data.documents as Record<string, unknown>[]).map(mapDocument)
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
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

  const activeCount = documents.filter((d) => d.currentPhase !== "completed").length;
  const forgedCount = documents.filter((d) => d.currentPhase === "completed").length;

  const filtered = documents.filter((d) => {
    if (filter === "active") return d.currentPhase !== "completed";
    if (filter === "forged") return d.currentPhase === "completed";
    return true;
  });

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
      <TopBar credits={credits} />

      <main
        style={{
          flex: 1,
          paddingTop: 56 + 36,
          paddingBottom: 80,
          paddingLeft: 56,
          paddingRight: 56,
        }}
      >
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
            <h1
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "0 0 4px",
                color: "#e3e2e2",
              }}
            >
              Documents
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "var(--df-dim, rgba(227,226,226,0.62))",
                margin: 0,
              }}
            >
              Quick access to your forges.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Credits */}
            {credits !== undefined && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}
              >
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.10em",
                    color: "var(--df-faint, rgba(227,226,226,0.38))",
                    textTransform: "uppercase",
                  }}
                >
                  Credits remaining
                </span>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 12,
                    color: "var(--df-amber-300, #ff8d4a)",
                    letterSpacing: "0.04em",
                  }}
                >
                  <b>{credits}</b>
                  <span
                    style={{
                      color: "var(--df-dim, rgba(227,226,226,0.62))",
                    }}
                  >
                    {" "}
                    of 5 this week
                  </span>
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
                border: "1px solid var(--df-amber-500, #ff4d00)",
                background: "var(--df-amber-500, #ff4d00)",
                color: "#fff",
                cursor: credits === 0 ? "not-allowed" : "pointer",
                opacity: credits === 0 ? 0.4 : 1,
                boxShadow:
                  "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                add
              </span>
              New document
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <FilterChip
            label="Active"
            count={activeCount}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <FilterChip
            label="Forged"
            count={forgedCount}
            active={filter === "forged"}
            onClick={() => setFilter("forged")}
          />
          <FilterChip
            label="All"
            count={documents.length}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </div>

        {error && (
          <p
            className="df-mono"
            style={{ fontSize: 11, color: "var(--df-error, #e86464)", marginBottom: 12 }}
          >
            {error}
          </p>
        )}

        {/* Table */}
        <div
          style={{
            border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            borderRadius: 10,
            overflow: "hidden",
            background: "rgba(18,20,20,0.5)",
          }}
        >
          {/* Header */}
          <div
            className="df-mono"
            style={{
              display: "grid",
              gridTemplateColumns: "22px 1fr 260px 130px 110px",
              alignItems: "center",
              gap: 16,
              padding: "14px 22px",
              borderBottom:
                "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              background: "rgba(255,255,255,0.02)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              fontWeight: 600,
            }}
          >
            <span />
            <span>File name</span>
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
                color: "var(--df-faint, rgba(227,226,226,0.38))",
              }}
            >
              {filter === "active"
                ? "No active documents. Create a new one to get started."
                : filter === "forged"
                ? "No forged documents yet."
                : "No documents found. Create a new one to get started."}
            </div>
          )}

          {filtered.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onClick={() => navigate(`/document/${doc.id}`)}
            />
          ))}
        </div>
      </main>

      {showNewDocDialog && (
        <NewDocumentDialog onClose={() => setShowNewDocDialog(false)} />
      )}
    </div>
  );
}
