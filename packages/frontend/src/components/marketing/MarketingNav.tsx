import { Link } from "react-router-dom";
import { useAuth, useClerk, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "@/components/shared";
import { useI18n } from "@/i18n";

type NavKey = "how-it-works" | "pricing" | null;

export function MarketingNav({ active = null }: { active?: NavKey }) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const { t } = useI18n();

  function handleCta() {
    if (isSignedIn) navigate("/home");
    else openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
  }

  return (
    <nav
      className="df-marketing-nav"
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--color-outline)",
        position: "sticky",
        top: 0,
        zIndex: "var(--z-modal)",
        background: "var(--color-chrome)",
        backdropFilter: "blur(14px)",
      }}
    >
      <BrandMark />
      <div className="df-marketing-nav__right" style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
        <span className="df-marketing-nav__links" style={{ display: "contents" }}>
          <NavLinkItem to="/how-it-works" active={active === "how-it-works"}>{t("nav.howItWorks")}</NavLinkItem>
          <NavLinkItem to="/pricing" active={active === "pricing"}>{t("nav.pricing")}</NavLinkItem>
        </span>
        <LanguageSwitcher compact />
        <button
          onClick={handleCta}
          className="df-marketing-nav__cta"
          style={{
            borderRadius: "var(--radius-sm)",
            background: "var(--color-heat)",
            color: "var(--color-on-heat)",
            fontWeight: 600,
            fontSize: 12.5,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            boxShadow: "0 0 0 1px var(--color-heat-strong), 0 4px 14px var(--color-heat-strong)",
          }}
        >
          {isSignedIn ? t("nav.openWorkspace") : t("nav.startForging")}
        </button>
        {isSignedIn && <UserButton />}
      </div>
    </nav>
  );
}

function NavLinkItem({ to, active, children }: { to: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: 12.5,
        color: active ? "var(--color-text)" : "var(--color-dim)",
        textDecoration: "none",
        letterSpacing: "0.02em",
        transition: "color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-text)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = active ? "var(--color-text)" : "var(--color-dim)"; }}
    >
      {children}
    </Link>
  );
}
