import { Link } from "react-router-dom";
import { useAuth, useClerk, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { BrandMark } from "./BrandMark";

type NavKey = "how-it-works" | "pricing" | null;

export function MarketingNav({ active = null }: { active?: NavKey }) {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  function handleCta() {
    if (isSignedIn) navigate("/home");
    else openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
  }

  return (
    <nav
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        padding: "0 40px",
        borderBottom: "1px solid var(--df-outline)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(5,6,8,0.92)",
        backdropFilter: "blur(14px)",
      }}
    >
      <BrandMark />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 24 }}>
        <NavLinkItem to="/how-it-works" active={active === "how-it-works"}>How it works</NavLinkItem>
        <NavLinkItem to="/pricing" active={active === "pricing"}>Pricing</NavLinkItem>
        <button
          onClick={handleCta}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            background: "var(--df-amber-500)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 12.5,
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.02em",
            boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
          }}
        >
          {isSignedIn ? "Open workspace" : "Start forging"}
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
        color: active ? "var(--df-on, #e3e2e2)" : "var(--df-dim)",
        textDecoration: "none",
        letterSpacing: "0.02em",
        transition: "color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e3e2e2"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = active ? "#e3e2e2" : "var(--df-dim)"; }}
    >
      {children}
    </Link>
  );
}
