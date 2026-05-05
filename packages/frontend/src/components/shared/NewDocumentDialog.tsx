import { useNavigate } from "react-router-dom";

interface DocType {
  id: string;
  label: string;
  icon: string;
  description: string;
  sections: string[];
  enabled: boolean;
}

const DOC_TYPES: DocType[] = [
  {
    id: "rfc",
    label: "RFC",
    icon: "rate_review",
    description: "Propose and align on a technical decision or process change.",
    sections: ["Context", "Proposal", "Implementation", "Risks"],
    enabled: true,
  },
  {
    id: "prd",
    label: "PRD",
    icon: "list_alt",
    description: "Define product requirements, goals, and success metrics.",
    sections: ["Overview", "Goals", "User Stories", "Requirements", "Success Metrics", "Timeline"],
    enabled: false,
  },
  {
    id: "tech-spec",
    label: "Tech Spec",
    icon: "schema",
    description: "Detail the technical architecture and implementation design.",
    sections: ["Overview", "Architecture", "Components", "API Design", "Data Models", "Security", "Testing"],
    enabled: false,
  },
  {
    id: "adr",
    label: "ADR",
    icon: "account_tree",
    description: "Record an architectural decision and its rationale.",
    sections: ["Context", "Decision", "Status", "Consequences", "Alternatives"],
    enabled: false,
  },
];

interface NewDocumentDialogProps {
  onClose: () => void;
}

export function NewDocumentDialog({ onClose }: NewDocumentDialogProps) {
  const navigate = useNavigate();

  function handleSelect(doc: DocType) {
    if (!doc.enabled) return;
    onClose();
    navigate("/document/new");
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#121414",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "0.5rem",
          padding: "32px",
          width: "min(1040px, 100%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.03em", color: "#e3e2e2" }}>
              New Document
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(200,198,197,0.5)" }}>
              Choose a document type to get started.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,198,197,0.4)", padding: "4px", lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Cards — single row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {DOC_TYPES.map((doc) => (
            <DocTypeCard key={doc.id} doc={doc} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocTypeCard({ doc, onSelect }: { doc: DocType; onSelect: (d: DocType) => void }) {
  return (
    <div
      onClick={() => onSelect(doc)}
      style={{
        position: "relative",
        background: "linear-gradient(to bottom, #1a1b1b, #111212)",
        border: `1px solid ${doc.enabled ? "rgba(255,77,0,0.25)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: "0.375rem",
        padding: "20px",
        cursor: doc.enabled ? "pointer" : "not-allowed",
        opacity: doc.enabled ? 1 : 0.45,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!doc.enabled) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.6)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 16px rgba(255,77,0,0.15)";
      }}
      onMouseLeave={(e) => {
        if (!doc.enabled) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.25)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Coming soon badge */}
      {!doc.enabled && (
        <div style={{
          position: "absolute", top: "10px", right: "10px",
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "rgba(200,198,197,0.45)",
          border: "1px solid rgba(200,198,197,0.12)", borderRadius: "4px",
          padding: "2px 6px",
        }}>
          Soon
        </div>
      )}

      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "22px", color: doc.enabled ? "#FF4D00" : "rgba(200,198,197,0.45)" }}
        >
          {doc.icon}
        </span>
        <span style={{
          fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: doc.enabled ? "#e3e2e2" : "rgba(200,198,197,0.55)",
        }}>
          {doc.label}
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "rgba(200,198,197,0.5)" }}>
        {doc.description}
      </p>

      {/* Section pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "auto" }}>
        {doc.sections.map((s) => (
          <span
            key={s}
            style={{
              fontSize: "10px", fontWeight: 500, letterSpacing: "0.01em",
              color: "rgba(200,198,197,0.38)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "3px", padding: "2px 6px",
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
