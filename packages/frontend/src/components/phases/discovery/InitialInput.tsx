import { useState } from "react";

import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";
interface InitialInputProps {
  onSubmit: (context: string, preferences: string) => void;
}

export function InitialInput({ onSubmit }: InitialInputProps) {
  const { t } = useI18n();
  const [context, setContext] = useState("");
  const [preferences, setPreferences] = useState("");
  const [activeField, setActiveField] = useState<"context" | "preferences" | null>(null);

  const canSubmit = context.trim().length > 10;

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Pill tone="heat" style={{ marginBottom: 16 }}>
          {t("g.in.pill")}
        </Pill>
        <h2
          style={{
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: "var(--color-text)",
            margin: "0 0 8px",
          }}
        >
          {t("g.in.title")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-dim)", margin: 0 }}>
          {t("g.in.lead")}
        </p>
      </div>

      {/* Two-column cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, width: "100%" }}>
        {/* Context Card */}
        <div
          style={{
            background: "var(--color-chrome)",
            border: `1px solid ${activeField === "context" ? "var(--color-heat-line)" : "var(--color-outline)"}`,
            borderRadius: "var(--radius-md)",
            padding: "20px 22px",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, color: "var(--color-heat-hi)" }}
            >
              description
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "var(--tracking-eyebrow)",
                textTransform: "uppercase",
                color: "var(--color-heat-hi)",
              }}
            >
              {t("section.context")}
            </span>
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--color-faint)",
              marginBottom: 12,
              lineHeight: 1.55,
              marginTop: 0,
            }}
          >
            {t("g.in.contextHelp")}
          </p>
          <textarea
            data-ph-mask
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onFocus={() => setActiveField("context")}
            onBlur={() => setActiveField(null)}
            placeholder={t("g.in.contextPh")}
            style={{
              width: "100%",
              height: 160,
              background: "var(--color-sink)",
              border: `1px solid ${activeField === "context" ? "var(--color-heat-line)" : "var(--color-outline)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 13,
              color: "var(--color-text)",
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
            background: "var(--color-chrome)",
            border: `1px solid ${activeField === "preferences" ? "var(--color-heat-line)" : "var(--color-outline)"}`,
            borderRadius: "var(--radius-md)",
            padding: "20px 22px",
            transition: "border-color 0.15s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 15, color: "var(--color-heat-hi)" }}
            >
              tune
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "var(--tracking-eyebrow)",
                textTransform: "uppercase",
                color: "var(--color-heat-hi)",
              }}
            >
              {t("g.in.prefs")}
            </span>
          </div>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--color-faint)",
              marginBottom: 12,
              lineHeight: 1.55,
              marginTop: 0,
            }}
          >
            {t("g.in.prefsHelp")}
          </p>
          <textarea
            data-ph-mask
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            onFocus={() => setActiveField("preferences")}
            onBlur={() => setActiveField(null)}
            placeholder={t("g.in.prefsPh")}
            style={{
              width: "100%",
              height: 160,
              background: "var(--color-sink)",
              border: `1px solid ${activeField === "preferences" ? "var(--color-heat-line)" : "var(--color-outline)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 13,
              color: "var(--color-text)",
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
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.3,
            letterSpacing: "0.02em",
          }}
        >
          <span>{t("g.in.submit")}</span>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
