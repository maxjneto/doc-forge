// Screenshot every screen of the running preview (scripts/preview/up.sh).
//
//   node scripts/preview/shoot.mjs [outDir] [--mobile] [--only=home,doc-guided-audit] [--locale=en-US]
//
// Writes one full-page PNG per screen and prints each path. Browser console
// errors and failed API calls are listed at the end, since a screen can look
// fine while half its requests 500.
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Playwright is not a project dependency: use a local install if present,
// otherwise the global one (preinstalled in Claude Code cloud sessions).
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const globalRoot = execSync("npm root -g").toString().trim();
    return createRequire(join(globalRoot, "noop.js"))("playwright");
  }
}
const { chromium } = await loadPlaywright();
const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith("--")) ?? join(HERE, ".preview-state", "shots"));
const mobile = args.includes("--mobile");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
// Default to the owner's browser locale so locale-dependent formatting shows up.
const locale = args.find((a) => a.startsWith("--locale="))?.slice(9) ?? "pt-BR";
const BASE = "http://localhost:5173";
const API = "http://localhost:8000/api";

const py = join(HERE, "..", "..", "packages", "backend", ".venv", "bin", "python");
const token = execFileSync(py, ["dev_auth.py", "token"], { cwd: HERE }).toString().trim();
const res = await fetch(`${API}/documents`, { headers: { Authorization: `Bearer ${token}` } });
const { documents } = await res.json();

const screens = [
  { name: "landing", path: "/", signedOut: true },
  { name: "how-it-works", path: "/how-it-works", signedOut: true },
  { name: "pricing", path: "/pricing", signedOut: true },
  { name: "legal-privacy", path: "/legal/privacy", signedOut: true },
  { name: "home", path: "/home" },
  { name: "mcp", path: "/mcp" },
  { name: "billing", path: "/billing" },
  { name: "customize", path: "/customize" },
  { name: "doc-new", path: "/document/new" },
  ...documents.map((d) => ({
    name: `doc-${d.document_mode}-${d.current_phase}${d.error_message ? "-error" : ""}-${d.title
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
    path: `/document/${d.id}`,
  })),
].filter((s) => !only || only.some((o) => s.name.startsWith(o)));

mkdirSync(outDir, { recursive: true });

// Google Fonts through the sandbox proxy flake (ERR_TOO_MANY_RETRIES), and
// without the icon font every icon renders as its ligature name. Cache font
// responses on disk after the first good fetch.
const fontCache = join(HERE, ".preview-state", "font-cache");
mkdirSync(fontCache, { recursive: true });
async function serveFont(route) {
  const url = route.request().url();
  const key = join(fontCache, createHash("sha1").update(url).digest("hex"));
  if (existsSync(key)) {
    const meta = JSON.parse(readFileSync(`${key}.json`, "utf8"));
    return route.fulfill({ status: 200, headers: meta, body: readFileSync(key) });
  }
  for (let i = 0; i < 4; i++) {
    try {
      const res = await route.fetch({ timeout: 15000 });
      if (res.ok()) {
        const body = await res.body();
        const headers = { "content-type": res.headers()["content-type"] ?? "", "access-control-allow-origin": "*" };
        writeFileSync(key, body);
        writeFileSync(`${key}.json`, JSON.stringify(headers));
        return route.fulfill({ status: 200, headers, body });
      }
    } catch { /* retry */ }
  }
  return route.abort();
}

let browser = await chromium.launch();
const problems = [];

for (const screen of screens) {
  if (!browser.isConnected()) browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }
               : { viewport: { width: 1440, height: 900 } }),
    // Sandboxed sessions reach Google Fonts through a TLS-intercepting proxy.
    ignoreHTTPSErrors: true,
    locale,
    timezoneId: "America/Sao_Paulo",
  });
  await ctx.addInitScript((signedOut) => {
    localStorage.setItem("df-dev-signed-out", signedOut ? "1" : "0");
    localStorage.setItem("docforge_cookie_consent", "declined");
  }, Boolean(screen.signedOut));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, serveFont);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && problems.push(`[${screen.name}] console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`[${screen.name}] pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.url().startsWith(API) && r.status() >= 400) problems.push(`[${screen.name}] ${r.status()} ${r.url()}`);
  });
  const file = join(outDir, `${screen.name}${mobile ? "-mobile" : ""}.png`);
  try {
    await page.goto(BASE + screen.path, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
    // Fonts come from Google through the proxy and occasionally drop; without
    // them icons render as their ligature names. Reload once if missing.
    const iconsOk = () => page.evaluate(async () => {
      await document.fonts.ready;
      if (!document.querySelector(".material-symbols-outlined")) return true;
      return document.fonts.check('18px "Material Symbols Outlined"');
    });
    if (!(await iconsOk())) {
      await page.reload({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
      if (!(await iconsOk())) problems.push(`[${screen.name}] icon font failed to load`);
    }
    await page.waitForTimeout(1200); // entry animations
    await page.screenshot({ path: file, fullPage: true, timeout: 20000 });
    console.log(file);
  } catch (e) {
    problems.push(`[${screen.name}] screenshot failed: ${e.message.split("\n")[0]}`);
  }
  await ctx.close().catch(() => {});
}

await browser.close();
if (problems.length) {
  console.log("\n── problems ──");
  for (const p of [...new Set(problems)]) console.log(p);
}
