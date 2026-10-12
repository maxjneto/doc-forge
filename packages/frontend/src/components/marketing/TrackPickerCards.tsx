import { useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useI18n } from "@/i18n";

import { Pill } from "@/components/ui";
type Variant = "hero" | "picker";

export function TrackPickerCards({ variant = "hero" }: { variant?: Variant }) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const { t } = useI18n();

  function startForger() {
    if (variant === "hero") {
      navigate("/how-it-works");
    } else if (isSignedIn) {
      navigate("/home");
    } else {
      openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
    }
  }
  function connectAgent() {
    if (variant === "hero") {
      navigate("/how-it-works#mcp");
    } else {
      const el = document.getElementById("mcp");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 18,
        marginTop: variant === "hero" ? 42 : 0,
        width: "100%",
        maxWidth: variant === "hero" ? 920 : undefined,
        marginLeft: variant === "hero" ? "auto" : undefined,
        marginRight: variant === "hero" ? "auto" : undefined,
      }}
    >
      <TrackCard
        primary
        eyebrow={t("track.agentEyebrow")}
        chip={<Pill tone="heat">{t("track.recommended")}</Pill>}
        title={t("track.agentTitle")}
        body={t("track.agentBody")}
        illustration={<Terminal />}
        meta="MCP · Streamable HTTP"
        cta={t(variant === "hero" ? "track.connectAgent" : "track.connectYourAgent")}
        onClick={connectAgent}
      />
      <TrackCard
        primary={false}
        eyebrow={t("track.guidedEyebrow")}
        chip={<Pill tone="ghost">{t("track.noAgent")}</Pill>}
        title={t("track.guidedTitle")}
        body={t("track.guidedBody")}
        illustration={<MiniTrail />}
        meta={t("track.noSetup")}
        cta={t(variant === "hero" ? "track.startForge" : "track.walkPhases")}
        onClick={variant === "hero" ? startForger : () => {
          const el = document.getElementById("forger");
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </div>
  );
}

function TrackCard({
  primary,
  eyebrow,
  chip,
  title,
  body,
  illustration,
  meta,
  cta,
  onClick,
}: {
  primary: boolean;
  eyebrow: string;
  chip: React.ReactNode;
  title: string;
  body: string;
  illustration: React.ReactNode;
  meta: string;
  cta: string;
  onClick: () => void;
}) {
  const baseBorder = primary ? "var(--color-heat-line)" : "var(--color-steel-strong)";
  const hoverBorder = primary ? "var(--color-heat-line)" : "var(--color-steel-line)";
  const hoverShadow = primary
    ? "0 12px 36px -8px var(--color-heat-strong)"
    : "0 12px 36px -8px var(--color-steel-strong)";
  const bg = primary
    ? "linear-gradient(180deg, var(--color-heat-tint), var(--color-veil))"
    : "linear-gradient(180deg, var(--color-steel-tint), var(--color-veil))";
  const arrowColor = primary ? "var(--color-heat-soft)" : "var(--color-steel-hi)";

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "24px 26px",
        border: `1px solid ${baseBorder}`,
        borderRadius: "var(--radius-lg)",
        background: bg,
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "all 0.2s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        color: "inherit",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-2px)";
        el.style.borderColor = hoverBorder;
        el.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(0)";
        el.style.borderColor = baseBorder;
        el.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11.5,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: primary ? "var(--color-heat-hi)" : "var(--color-steel-hi)",
            fontWeight: 600,
          }}
        >
          {eyebrow}
        </span>
        {chip}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: "-0.015em" }}>{title}</h3>
      <p style={{ fontSize: 13, color: "var(--color-dim)", margin: 0, lineHeight: 1.55 }}>{body}</p>
      <div
        style={{
          height: 74,
          marginTop: 6,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-outline)",
          padding: 10,
          background: "var(--color-sink)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflow: "hidden",
        }}
      >
        {illustration}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <span className="df-mono" style={{ fontSize: 11.5, color: "var(--color-faint)" }}>
          {meta}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: arrowColor }}>
          {cta}
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </span>
      </div>
    </button>
  );
}

function MiniTrail() {
  const dots = ["done", "done", "now", "future", "future", "future"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, justifyContent: "center" }}>
      {dots.map((state, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            className={state === "now" ? "animate-df-pulse" : undefined}
            style={{
              width: 7,
              height: 7,
              borderRadius: "var(--radius-pill)",
              background:
                state === "now"
                  ? "var(--color-heat)"
                  : state === "done"
                  ? "var(--color-heat-line)"
                  : "var(--color-outline)",
              border: state === "future" ? "1px solid var(--color-mute)" : "none",
              boxShadow: state === "now" ? "0 0 0 3px var(--color-heat-strong), 0 0 10px var(--color-heat-line)" : "none",
            }}
          />
          {i < dots.length - 1 && (
            <span
              style={{
                width: 18,
                height: 1,
                background:
                  state === "done" || (state === "now" && dots[i + 1] === "done")
                    ? "var(--color-heat-line)"
                    : "var(--color-mute)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Terminal() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-bg)",
        border: "1px solid var(--color-outline)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        color: "var(--color-steel-hi)",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--color-heat-hi)" }}>$</span>
        <span>claude mcp add docforge</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--color-steel)" }}>✓</span>
        <span style={{ color: "var(--color-dim)" }}>authenticated as you</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--color-steel)" }}>✓</span>
        <span style={{ color: "var(--color-dim)" }}>workspace ready · 1 doc shared</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--color-heat-hi)" }}>›</span>
        <span>agent connected · ready to forge</span>
      </div>
    </div>
  );
}
