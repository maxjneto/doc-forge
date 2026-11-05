import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth, useClerk, UserButton } from "@clerk/clerk-react";
import { BrandMark } from "@/components/marketing/BrandMark";
import { IconButton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { track } from "@/analytics";
import { ApiKeyPanel } from "./ApiKeyPanel";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** Matches `.df-doc-shell`'s top padding, which clears the header in the editor. */
export const SITE_HEADER_HEIGHT = 60;

interface SiteHeaderProps {
  /**
   * Pinned over the page instead of sitting in its flow. Only the document
   * editor wants this: its shell fills the screen and pads itself under the bar.
   */
  fixed?: boolean;
}

/**
 * The one header of every screen. The links depend only on whether someone is
 * signed in — never on the page — so they stay put as you move around.
 */
export function SiteHeader({ fixed = false }: SiteHeaderProps) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const { pathname } = useLocation();
  const { t } = useI18n();
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  const links = isSignedIn
    ? [
        { to: "/home", label: t("nav.dashboard") },
        { to: "/mcp", label: "DocForge MCP" },
        { to: "/billing", label: t("nav.billing") },
        { to: "/how-it-works", label: t("nav.howItWorks") },
      ]
    : [
        { to: "/", label: t("nav.home") },
        { to: "/pricing", label: t("nav.pricing") },
        { to: "/how-it-works", label: t("nav.howItWorks") },
      ];

  function handleStart() {
    track("cta_clicked", { target: "start", location: "nav", page: pathname, signed_in: false });
    openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
  }

  const linkItems = links.map((item) => (
    <NavLink key={item.to} to={item.to} end className="df-site-nav__link">
      {item.label}
    </NavLink>
  ));

  return (
    <>
      <header
        className="df-site-nav"
        style={{
          height: SITE_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--color-outline)",
          position: fixed ? "fixed" : "sticky",
          top: 0,
          left: 0,
          right: 0,
          zIndex: "var(--z-modal)",
          background: "var(--color-chrome)",
          backdropFilter: "blur(14px)",
          flexShrink: 0,
        }}
      >
        <BrandMark to={isSignedIn ? "/home" : "/"} />
        <div className="df-site-nav__right">
          <nav className="df-site-nav__links" aria-label={t("nav.main")}>
            {linkItems}
          </nav>
          {isSignedIn && (
            <IconButton icon="key" label={t("nav.manageApiKeys")} onClick={() => setShowApiKeys(true)} />
          )}
          <LanguageSwitcher compact />
          {isSignedIn ? (
            <UserButton />
          ) : (
            <button type="button" onClick={handleStart} className="df-btn df-btn--primary df-site-nav__cta">
              {t("nav.startForging")}
            </button>
          )}
          <span className="df-site-nav__menu">
            <IconButton
              icon={menuOpen ? "close" : "menu"}
              label={t("nav.menu")}
              active={menuOpen}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            />
          </span>
        </div>
        {menuOpen && (
          <nav className="df-site-nav__sheet" aria-label={t("nav.main")}>
            {linkItems}
          </nav>
        )}
      </header>
      {showApiKeys && <ApiKeyPanel onClose={() => setShowApiKeys(false)} />}
    </>
  );
}
