import { useState } from "react";

interface InitialInputProps {
  onSubmit: (context: string, preferences: string) => void;
}

export function InitialInput({ onSubmit }: InitialInputProps) {
  const [context, setContext] = useState("");
  const [preferences, setPreferences] = useState("");
  const [activeField, setActiveField] = useState<"context" | "preferences" | null>(null);

  const canSubmit = context.trim().length > 10;

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <span className="df-pill df-pill-heat" style={{ marginBottom: 16, display: "inline-block" }}>
          Discovery · Phase 01
        </span>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "#e3e2e2",
            margin: "0 0 8px",
          }}
        >
          Describe your document
        </h2>
        <p style={{ fontSize: 13, color: "var(--df-dim, rgba(227,226,226,0.62))", margin: 0 }}>
          Provide the problem context and your preferences. The forge will do the rest.
        </p>
      </div>

      {/* Two-column cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%" }}>
        {/* Context Card */}
        <div
          style={{
            background: "rgba(13,14,15,0.6)",
            border: `1px solid ${activeField === "context" ? "rgba(255,77,0,0.35)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
            borderRadius: 10,
            padding: "20px 22px",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, color: "var(--df-amber-300, #ff8d4a)" }}
            >
              description
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--df-amber-300, #ff8d4a)",
              }}
            >
              Context
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              marginBottom: 12,
              lineHeight: 1.55,
              marginTop: 0,
            }}
          >
            Describe the problem your document solves. The more detail, the better.
          </p>
          <textarea
            data-ph-mask
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onFocus={() => setActiveField("context")}
            onBlur={() => setActiveField(null)}
            placeholder="E.g.: Our payment system is suffering from latency above 500ms during peak hours. PostgreSQL 14 is not scaling adequately..."
            style={{
              width: "100%",
              height: 160,
              background: "rgba(0,0,0,0.25)",
              border: `1px solid ${activeField === "context" ? "rgba(255,77,0,0.40)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: "#e3e2e2",
              fontFamily: "inherit",
              lineHeight: 1.5,
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
        </div>

        {/* Preferences Card */}
        <div
          style={{
            background: "rgba(13,14,15,0.6)",
            border: `1px solid ${activeField === "preferences" ? "rgba(255,77,0,0.35)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
            borderRadius: 10,
            padding: "20px 22px",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, color: "var(--df-amber-300, #ff8d4a)" }}
            >
              tune
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--df-amber-300, #ff8d4a)",
              }}
            >
              Preferences
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              marginBottom: 12,
              lineHeight: 1.55,
              marginTop: 0,
            }}
          >
            Tone, format, target audience, and any specific instructions.
          </p>
          <textarea
            data-ph-mask
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            onFocus={() => setActiveField("preferences")}
            onBlur={() => setActiveField(null)}
            placeholder="E.g.: Technical tone, target audience is senior engineers. Include Mermaid diagrams. Focus on trade-offs..."
            style={{
              width: "100%",
              height: 160,
              background: "rgba(0,0,0,0.25)",
              border: `1px solid ${activeField === "preferences" ? "rgba(255,77,0,0.40)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              color: "#e3e2e2",
              fontFamily: "inherit",
              lineHeight: 1.5,
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />
        </div>
      </div>

      {/* Submit */}
      <div style={{ textAlign: "center", marginTop: 28 }}>
        <button
          onClick={() => onSubmit(context, preferences)}
          disabled={!canSubmit}
          className="forge-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.3,
            letterSpacing: "0.02em",
          }}
        >
          <span>Submit for analysis</span>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
