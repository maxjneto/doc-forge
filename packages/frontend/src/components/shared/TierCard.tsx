import type { CSSProperties, ReactNode } from "react";
import type { Tier } from "@/utils/api";

/** Shared by the public Pricing page and the signed-in Billing page. */
export function TierGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      {children}
    </div>
  );
}

export function TierCard({ tier, current, cta }: { tier: Tier; current?: boolean; cta: ReactNode }) {
  const pill = current ? "Current plan" : tier.highlight ? "Best option" : null;
  return (
    <div
      style={{
        padding: "28px 24px",
        background: tier.highlight ? "rgba(255,77,0,0.04)" : "rgba(13,14,15,0.6)",
        border: `1px solid ${current || tier.highlight ? "rgba(255,77,0,0.25)" : "var(--df-outline)"}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        position: "relative",
      }}
    >
      {pill && (
        <span
          className={`df-pill ${current ? "df-pill-steel" : "df-pill-heat"}`}
          style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}
        >
          {pill}
        </span>
      )}

      <div>
        <span
          className="df-mono"
          style={{
            display: "block",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: tier.highlight ? "var(--df-amber-300)" : "var(--df-faint)",
            marginBottom: 6,
          }}
        >
          {tier.name}
        </span>
        <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{tier.credits}</span>
      </div>

      <p style={{ fontSize: 13, color: "var(--df-dim)", lineHeight: 1.55, margin: 0 }}>{tier.description}</p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {tier.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14, color: "var(--df-amber-300)", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span style={{ color: "var(--df-dim)" }}>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto" }}>{cta}</div>
    </div>
  );
}

export const tierCtaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 18px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  letterSpacing: "0.02em",
  width: "100%",
  fontFamily: "inherit",
  cursor: "pointer",
  border: "1px solid var(--df-outline-md)",
  color: "var(--df-dim)",
  background: "transparent",
};

/** Non-interactive CTA for tiers that can't be bought yet or are already active. */
export function TierCtaInert({ children }: { children: ReactNode }) {
  return (
    <span style={{ ...tierCtaStyle, color: "var(--df-faint)", borderStyle: "dashed", cursor: "default" }}>
      {children}
    </span>
  );
}
