import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiListDocumentTypes } from "@/utils/api";
import type { DocumentType } from "@/types";

const ICON_MAP: Record<string, string> = {
  rfc: "rate_review",
  prd: "list_alt",
  "tech-spec": "schema",
  adr: "account_tree",
};

interface NewDocumentDialogProps {
  onClose: () => void;
}

export function NewDocumentDialog({ onClose }: NewDocumentDialogProps) {
  const navigate = useNavigate();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiListDocumentTypes()
      .then((types) => {
        setDocTypes(types);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  function handleSelect(doc: DocumentType) {
    onClose();
    navigate("/document/new", { state: { documentTypeSlug: doc.slug } });
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

        {/* Body */}
        {loading && (
          <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
            Loading document types…
          </div>
        )}

        {error && (
          <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
            Could not load document types. Please try again.
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {docTypes.map((doc) => (
              <DocTypeCard key={doc.id} doc={doc} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocTypeCard({ doc, onSelect }: { doc: DocumentType; onSelect: (d: DocumentType) => void }) {
  const icon = ICON_MAP[doc.slug] ?? "description";

  return (
    <div
      onClick={() => onSelect(doc)}
      style={{
        position: "relative",
        background: "linear-gradient(to bottom, #1a1b1b, #111212)",
        border: "1px solid rgba(255,77,0,0.25)",
        borderRadius: "0.375rem",
        padding: "20px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.6)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 16px rgba(255,77,0,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.25)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "22px", color: "#FF4D00" }}
        >
          {icon}
        </span>
        <span style={{
          fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "#e3e2e2",
        }}>
          {doc.name}
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
            key={s.id}
            style={{
              fontSize: "10px", fontWeight: 500, letterSpacing: "0.01em",
              color: "rgba(200,198,197,0.38)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "3px", padding: "2px 6px",
            }}
          >
            {s.displayName}
          </span>
        ))}
      </div>
    </div>
  );
}
