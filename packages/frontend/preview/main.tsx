/**
 * Design preview entry: every screen of the app, signed in, against fixture
 * data. Run with `npm run dev:preview` and open any route (/home,
 * /document/doc-copasim, /mcp, /billing…).
 */
import { installMockApi } from "./mock-api";

installMockApi();

try {
  // Keep the cookie banner out of screenshots.
  localStorage.setItem("docforge_cookie_consent", "declined");
} catch {
  /* storage blocked — the banner just shows */
}

await import("../src/main.tsx");
