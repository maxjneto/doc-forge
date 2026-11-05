import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Eyebrow } from "@/components/ui";
import { apiCreateCheckoutSession } from "@/utils/api";
import { track } from "@/analytics";

/**
 * Pieces shared by the marketing pages (Home, How it works, Pricing). Layout
 * classes (`df-mk-*`) live in index.css so the grids collapse on a phone.
 */

/** Marketing pages scroll the window (the app shell does not), and share one "get started" action. */
export function useMarketingPage() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const start = () => {
    track("cta_clicked", { target: "start", page: window.location.pathname, signed_in: Boolean(isSignedIn) });
    return isSignedIn ? navigate("/home") : openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
  };
  return { isSignedIn: Boolean(isSignedIn), start, navigate };
}

/** "Get Pro": the Stripe checkout when signed in, else sign in and come back to the pricing page. */
export function useProCheckout(errorMessage: string) {
  const { isSignedIn, getToken } = useAuth();
  const { openSignIn } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async () => {
    track("cta_clicked", { target: "pro_checkout", page: window.location.pathname, signed_in: Boolean(isSignedIn) });
    if (!isSignedIn) {
      openSignIn({ afterSignInUrl: "/pricing", afterSignUpUrl: "/pricing" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.location.href = await apiCreateCheckoutSession("pro", getToken);
    } catch {
      setError(errorMessage);
      setBusy(false);
    }
  };
  return { upgrade, busy, error };
}

export const h2Style: CSSProperties = { margin: 0, fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1.07, letterSpacing: "-.038em", fontWeight: 600 };
export const leadStyle: CSSProperties = { margin: 0, fontSize: 17, lineHeight: 1.6, color: "var(--color-dim)" };

/** Kicker, title and lead of a section. */
export function SectionHead({ eyebrow, tone = "heat", title, lead, center = false, maxWidth = 780 }: {
  eyebrow?: string; tone?: "heat" | "steel"; title: ReactNode; lead?: ReactNode; center?: boolean; maxWidth?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth, margin: center ? "0 auto" : undefined, textAlign: center ? "center" : "left" }}>
      {eyebrow && (
        <Eyebrow tone={tone === "heat" ? "heat" : "faint"} align={center ? "center" : "start"} style={tone === "steel" ? { color: "var(--color-steel-hi)" } : undefined}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2 style={h2Style}>{title}</h2>
      {lead && <p style={leadStyle}>{lead}</p>}
    </div>
  );
}

/** A screenshot of the product in a window frame. */
export function Shot({ src, alt, glow = false, style }: { src: string; alt: string; glow?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--color-outline-md)",
        background: "var(--color-bg)",
        boxShadow: glow ? "var(--shadow-modal), 0 0 140px var(--color-heat-strong)" : "var(--shadow-modal)",
        ...style,
      }}
    >
      <div aria-hidden style={{ display: "flex", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--color-outline)", background: "var(--color-surface)" }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: "var(--color-surface-high)" }} />)}
      </div>
      <img src={src} alt={alt} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
    </div>
  );
}

/** A command or snippet with a copy button. */
export function CodeBlock({ code, copyLabel, copiedLabel, prompt = false, style }: {
  code: string; copyLabel: string; copiedLabel: string; prompt?: boolean; style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    // Marketing snippets are our own text; the first words say which one it was.
    track("snippet_copied", { page: window.location.pathname, snippet: code.trim().split(/\s+/).slice(0, 3).join(" ") });
    navigator.clipboard?.writeText(code.replace(/\\\n\s*/g, "")).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };
  return (
    <div style={{ position: "relative", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-md)", background: "var(--color-sink)", minWidth: 0, ...style }}>
      <pre className="df-mono" style={{ margin: 0, padding: "14px 52px 14px 16px", fontSize: "var(--text-body-sm)", lineHeight: 1.7, color: "var(--color-text)", whiteSpace: "pre", overflowX: "auto" }}>
        {prompt && <span style={{ color: "var(--color-heat-hi)" }}>$ </span>}
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? copiedLabel : copyLabel}
        title={copied ? copiedLabel : copyLabel}
        style={{ position: "absolute", top: 7, right: 7, width: 36, height: 36, display: "grid", placeItems: "center", background: "var(--color-bg)", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-sm)", color: copied ? "var(--color-ok)" : "var(--color-dim)", cursor: "pointer" }}
      >
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>{copied ? "check" : "content_copy"}</span>
      </button>
    </div>
  );
}

/** A plain card surface. */
export function Panel({ children, accent = false, className, style }: { children: ReactNode; accent?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={className} style={{ background: "var(--color-surface)", border: `1px solid ${accent ? "var(--color-heat-line)" : "var(--color-outline-md)"}`, borderRadius: "var(--radius-lg)", ...style }}>
      {children}
    </div>
  );
}

/** The closing call to action, on the GCD grid. */
export function ClosingCta({ title, cta, onClick }: { title: string; cta: string; onClick: () => void }) {
  return (
    <section className="df-mk-wrap" style={{ paddingTop: 48, paddingBottom: 104 }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-heat-line)", background: "var(--color-surface)", padding: "64px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 22 }}>
        <div className="df-mk-gridbg" aria-hidden />
        <h2 style={{ ...h2Style, position: "relative", maxWidth: 720 }}>{title}</h2>
        <button type="button" className="df-btn df-btn--primary df-btn--lg" style={{ position: "relative" }} onClick={onClick}>{cta}</button>
      </div>
    </section>
  );
}
