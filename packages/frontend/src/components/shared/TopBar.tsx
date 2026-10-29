import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { ApiKeyPanel } from "@/components/shared/ApiKeyPanel";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

// ─── TopBar ──────────────────────────────────────────────────

interface TopBarProps {
  credits?: number;
  /** Show the dashboard-style nav row (signed-in pages that are not a document). */
  dashboardNav?: boolean;
}

export function TopBar({ credits, dashboardNav }: TopBarProps) {
  const { t } = useI18n();
  const [showApiKeys, setShowApiKeys] = useState(false);
  return (
    <>
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "var(--color-chrome)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--color-outline)",
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 18,
        zIndex: "var(--z-popover)",
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        to="/home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <img
          src="/assets/docforge-logo.png"
          alt="DocForge"
          style={{ height: 28, width: "auto" }}
        />
        <span
          className="df-mono"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "var(--tracking-label)",
            color: "var(--color-text)",
          }}
        >
          DOCFORGE
        </span>
      </Link>

      {/* Dashboard nav row */}
      {dashboardNav && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { to: "/home", label: t("nav.dashboard") },
            { to: "/how-it-works", label: t("nav.howItWorks") },
            { to: "/mcp", label: "DocForge MCP" },
            { to: "/billing", label: t("nav.billing") },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              style={({ isActive }) => ({
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12.5,
                color: isActive ? "var(--color-text)" : "var(--color-dim)",
                background: isActive ? "var(--color-hover)" : "transparent",
                textDecoration: "none",
                letterSpacing: "0.02em",
                transition: "color 0.15s, background 0.15s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* API Keys */}
        <button
          onClick={() => setShowApiKeys(true)}
          title={t("nav.manageApiKeys")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-outline)",
            background: "transparent",
            color: "var(--color-faint)",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-dim)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-faint)"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>key</span>
          <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{t("nav.apiKeys")}</span>
        </button>

        <LanguageSwitcher compact />

        {/* Credits */}
        {credits !== undefined ? (
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "var(--tracking-label)",
              textTransform: "uppercase",
              color: "var(--color-dim)",
              border: "1px solid var(--color-outline)",
              borderRadius: "var(--radius-xs)",
              padding: "4px 10px",
            }}
          >
            CREATIONS ·{" "}
            <b style={{ color: "var(--color-heat-hi)" }}>{credits}</b>
          </span>
        ) : null}

        <UserButton />
      </div>
    </header>
    {showApiKeys && <ApiKeyPanel onClose={() => setShowApiKeys(false)} />}
    </>
  );
}
