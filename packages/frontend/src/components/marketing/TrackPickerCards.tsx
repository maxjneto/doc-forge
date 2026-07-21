import { useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";

type Variant = "hero" | "picker";

export function TrackPickerCards({ variant = "hero" }: { variant?: Variant }) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

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
        eyebrow="Path A · BYOA"
        chip={<span className="df-pill df-pill-heat">Recommended</span>}
        title="Bring your own agent"
        body="Connect Claude Code, Cursor, Codex, Zed — any MCP client. Your IDE agent drives the whole document; you review each change as a diff, comment, and approve."
        illustration={<Terminal />}
        meta="stdio · 30 sec install"
        cta={variant === "hero" ? "Connect an agent" : "Connect your agent"}
        onClick={connectAgent}
      />
      <TrackCard
        primary={false}
        eyebrow="Path B · Guided"
        chip={<span className="df-pill df-pill-ghost">No agent needed</span>}
        title="Forge in the browser"
        body='No agent yet? A hosted pipeline walks you from "I have an idea" to "ready to merge" — same review, audit and history apply.'
        illustration={<MiniTrail />}
        meta="No setup · in-browser"
        cta={variant === "hero" ? "Start a forge" : "Walk the six phases"}
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
  const baseBorder = primary ? "rgba(255,77,0,0.30)" : "rgba(138,160,184,0.25)";
  const hoverBorder = primary ? "rgba(255,77,0,0.55)" : "rgba(138,160,184,0.50)";
  const hoverShadow = primary
    ? "0 12px 36px -8px rgba(255,77,0,0.20)"
    : "0 12px 36px -8px rgba(138,160,184,0.15)";
  const bg = primary
    ? "linear-gradient(180deg, rgba(255,77,0,0.06), rgba(14,16,17,0.65))"
    : "linear-gradient(180deg, rgba(138,160,184,0.05), rgba(14,16,17,0.65))";
  const arrowColor = primary ? "var(--df-amber-200)" : "var(--df-steel-100)";

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "24px 26px",
        border: `1px solid ${baseBorder}`,
        borderRadius: 14,
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
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: primary ? "var(--df-amber-300)" : "var(--df-steel-100)",
            fontWeight: 600,
          }}
        >
          {eyebrow}
        </span>
        {chip}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: "-0.015em" }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: "var(--df-dim)", margin: 0, lineHeight: 1.55 }}>{body}</p>
      <div
        style={{
          height: 74,
          marginTop: 6,
          borderRadius: 8,
          border: "1px solid var(--df-outline)",
          padding: 10,
          background: "rgba(0,0,0,0.25)",
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
        <span className="df-mono" style={{ fontSize: 11, color: "var(--df-faint)" }}>
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
              borderRadius: 999,
              background:
                state === "now"
                  ? "var(--df-amber-500)"
                  : state === "done"
                  ? "var(--df-amber-trail)"
                  : "rgba(255,255,255,0.06)",
              border: state === "future" ? "1px solid var(--df-mute)" : "none",
              boxShadow: state === "now" ? "0 0 0 3px rgba(255,77,0,0.16), 0 0 10px rgba(255,77,0,0.55)" : "none",
            }}
          />
          {i < dots.length - 1 && (
            <span
              style={{
                width: 18,
                height: 1,
                background:
                  state === "done" || (state === "now" && dots[i + 1] === "done")
                    ? "var(--df-amber-trail)"
                    : "var(--df-mute)",
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
        borderRadius: 6,
        background: "#0a0b0c",
        border: "1px solid var(--df-outline)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        overflow: "hidden",
        fontFamily: "var(--df-font-mono)",
        fontSize: 10.5,
        color: "var(--df-steel-100)",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--df-amber-300)" }}>$</span>
        <span>claude mcp add docforge</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--df-steel-200)" }}>✓</span>
        <span style={{ color: "var(--df-dim)" }}>authenticated as you</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--df-steel-200)" }}>✓</span>
        <span style={{ color: "var(--df-dim)" }}>workspace ready · 1 doc shared</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ color: "var(--df-amber-300)" }}>›</span>
        <span>agent connected · ready to forge</span>
      </div>
    </div>
  );
}
