import type { ReactNode } from "react";
import { useBodyScroll } from "@/hooks/useBodyScroll";
import { TopBar } from "./TopBar";
import { AppFooter } from "./AppFooter";

/**
 * Shell for every signed-in page outside a document workspace: top nav,
 * a centred content column, and the footer. Keeps width, spacing, background
 * and scroll behaviour identical across Dashboard, MCP, Customize and Billing.
 */
export function AppPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  /** Dashboard-style pages with a sidebar use the wider column. */
  wide?: boolean;
}) {
  useBodyScroll();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--df-bg)",
        color: "var(--df-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TopBar dashboardNav />
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: wide ? "var(--df-page-wide)" : "var(--df-page)",
          margin: "0 auto",
          padding: "92px var(--df-page-gutter) 80px",
        }}
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        marginBottom: 32,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
        {description && (
          <p style={{ fontSize: 13, color: "var(--df-dim)", margin: "6px 0 0", lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{actions}</div>}
    </div>
  );
}
