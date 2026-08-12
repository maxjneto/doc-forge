#!/usr/bin/env node
/**
 * Design-token guard (docs/product/design-system-consolidation.md §3.1).
 *
 * Two rules:
 *
 *  1. HARD — no `var(--df-x, fallback)` anywhere. A fallback duplicates the
 *     value at the call site, so redefining the token stops changing the
 *     screen. This is the defect that made the previous ramp powerless
 *     (429 occurrences before the migration). Must stay at zero.
 *
 *  2. RATCHET — raw colour literals in components may not increase. There are
 *     still plenty from before the migration; they come out in step 6 of the
 *     plan. Until then the count may only go down. Lower BASELINE whenever it
 *     drops so the ratchet keeps tightening.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const COMPONENTS = join(SRC, "components");

/** Raw colour literals may only ever go down. */
const BASELINE = 279;

/** Files where literal colour is the point, not a shortcut. */
const ALLOW = [
  // mermaid theme config has to hand hex to a third-party library
  "shared/MarkdownRenderer.tsx",
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const FALLBACK = /var\(\s*--df-[a-z0-9-]+\s*,/g;
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;

const fallbacks = [];
let literals = 0;

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");

  for (const m of text.matchAll(FALLBACK)) {
    const line = text.slice(0, m.index).split("\n").length;
    fallbacks.push(`${rel}:${line}  ${m[0]}…)`);
  }

  if (file.startsWith(COMPONENTS) && !ALLOW.some((a) => rel.endsWith(a))) {
    literals += (text.match(LITERAL) ?? []).length;
  }
}

let failed = false;

if (fallbacks.length > 0) {
  failed = true;
  console.error(
    `\n✗ ${fallbacks.length} token fallback(s) found. Use var(--df-x), not var(--df-x, value):\n`,
  );
  for (const f of fallbacks.slice(0, 25)) console.error(`    ${f}`);
  if (fallbacks.length > 25) console.error(`    … and ${fallbacks.length - 25} more`);
}

if (literals > BASELINE) {
  failed = true;
  console.error(
    `\n✗ raw colour literals in components: ${literals} (baseline ${BASELINE}).` +
      `\n  Use a semantic token from index.css instead of a hex/rgba literal.\n`,
  );
} else if (literals < BASELINE) {
  console.log(
    `✓ raw colour literals: ${literals} (baseline ${BASELINE}) — ` +
      `lower BASELINE in scripts/check-tokens.mjs to lock the gain in.`,
  );
} else {
  console.log(`✓ raw colour literals: ${literals} (at baseline)`);
}

if (!failed) console.log("✓ no token fallbacks");
process.exit(failed ? 1 : 0);
