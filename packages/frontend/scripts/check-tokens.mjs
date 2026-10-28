#!/usr/bin/env node
/**
 * Design-token guard (rules in docs/architecture/frontend.md, design system).
 *
 * HARD rules — must stay at zero:
 *
 *  1. No legacy `--df-*` names. The ramp in index.css is the only vocabulary.
 *  2. No `var(--x, fallback)`. A fallback duplicates the value at the call
 *     site, so redefining the token stops changing the screen (429 of these
 *     made the first ramp powerless).
 *  3. Every token a file references must exist in index.css — a typo or a
 *     retired name (`heat-08`) silently renders as nothing. Token names are
 *     never assembled at runtime (`var(--color-${tone}-tint)`): Tailwind
 *     prunes theme variables it cannot see literally.
 *  4. No retired Material classes (`bg-primary`, `text-on-surface`…).
 *  5. Type, radius, tracking and stacking come from the scale:
 *     numeric `fontSize` only on the scale (icons excepted), no numeric
 *     `borderRadius` but 0, no positive `letterSpacing` in em that is not a
 *     tracking token, no `zIndex` above 2 that is not a layer token.
 *
 * RATCHET — raw colour literals in components/ and pages/ may only go down.
 * Lower BASELINE whenever the count drops so the gain is locked in.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));

/** Raw colour literals in components/ + pages/ may only ever go down. */
const BASELINE = 0;

/** Files where literal colour is the point, not a shortcut. */
const ALLOW = [
  // mermaid theme config has to hand hex to a third-party library
  "components/shared/MarkdownRenderer.tsx",
  // palettes of the printed layout document (its own tokens), not app colours
  "components/layout-doc/themes.ts",
];

/** The type scale (index.css `--text-*`). Larger numbers are hero/display art. */
const FONT_SCALE = new Set([10, 11.5, 12.5, 13, 14, 17, 21, 28]);
const FONT_ART_MIN = 30;

const MATERIAL =
  /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:primary(?:-[a-z]+)*|on-primary(?:-[a-z]+)*|secondary|tertiary|surface-container(?:-[a-z]+)*|surface-variant|on-surface(?:-variant)?|background|outline-variant|error-container|on-error(?:-container)?|forge-orange)\b/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** True when the JSX element that owns `idx` is a Material Symbols icon. */
function inIcon(text, idx) {
  const lt = text.lastIndexOf("<", idx);
  const seg = text.slice(lt, idx);
  return seg.includes("material-symbols") && !seg.includes(">");
}

// Tokens defined in index.css (any custom property declared anywhere in it).
const css = readFileSync(join(SRC, "index.css"), "utf8");
const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const TOKEN_REF = /var\(\s*(--(?:color|radius|text|tracking|shadow|z|duration|gradient|font|ease)-[a-z0-9-]+)/g;

const RULES = [
  { name: "legacy --df-* name", re: /--df-[a-z0-9-]+/g },
  { name: "var() fallback", re: /var\(\s*--[a-z0-9-]+\s*,/g },
  // Tailwind v4 only emits theme variables it can read literally in source;
  // `var(--color-${tone}-tint)` compiles to a variable that may not exist.
  { name: "token name built at runtime", re: /var\(--[a-z0-9-]*\$\{/g },
  { name: "retired Material class", re: MATERIAL },
  { name: ".df-pill class (use <Pill>)", re: /\bdf-pill(?:-[a-z]+)?\b/g, skipCss: true },
  {
    name: "fontSize off the scale",
    re: /fontSize:\s*([0-9]+(?:\.[0-9]+)?)\b(?!%)/g,
    bad: (m, text) => {
      const n = parseFloat(m[1]);
      return !FONT_SCALE.has(n) && n < FONT_ART_MIN && !inIcon(text, m.index);
    },
  },
  { name: "numeric borderRadius (use --radius-*)", re: /borderRadius:\s*([0-9.]+)\b(?![%.])/g, bad: (m) => parseFloat(m[1]) !== 0 },
  {
    name: "letterSpacing off the scale (use --tracking-*)",
    re: /letterSpacing:\s*["'](0?\.[0-9]+)em["']/g,
    bad: (m) => parseFloat(m[1]) > 0.025,
  },
  { name: "zIndex off the layers (use --z-*)", re: /zIndex:\s*([0-9]+)\b/g, bad: (m) => parseInt(m[1], 10) > 2 },
];

const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;

const violations = [];
let literals = 0;
const literalFiles = new Map();

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const isCss = file.endsWith(".css");

  for (const rule of RULES) {
    if (rule.skipCss && isCss) continue;
    for (const m of text.matchAll(rule.re)) {
      if (rule.bad && !rule.bad(m, text)) continue;
      violations.push(`${rule.name}  ${rel}:${lineOf(text, m.index)}  ${m[0]}`);
    }
  }

  for (const m of text.matchAll(TOKEN_REF)) {
    if (!defined.has(m[1])) violations.push(`undefined token  ${rel}:${lineOf(text, m.index)}  ${m[1]}`);
  }

  const counted = /^(components|pages)\//.test(rel) && !ALLOW.includes(rel);
  if (counted) {
    const n = (text.match(LITERAL) ?? []).length;
    if (n) literalFiles.set(rel, n);
    literals += n;
  }
}

let failed = false;

if (violations.length > 0) {
  failed = true;
  console.error(`\n✗ ${violations.length} token violation(s):\n`);
  for (const v of violations.slice(0, 400)) console.error(`    ${v}`);
  if (violations.length > 60) console.error(`    … and ${violations.length - 60} more`);
}

if (literals > BASELINE) {
  failed = true;
  console.error(
    `\n✗ raw colour literals in components/ + pages/: ${literals} (baseline ${BASELINE}).` +
      `\n  Use a semantic token from index.css instead of a hex/rgba literal.\n`,
  );
  for (const [f, n] of [...literalFiles].sort((a, b) => b[1] - a[1])) console.error(`    ${n}  ${f}`);
} else if (literals < BASELINE) {
  console.log(
    `✓ raw colour literals: ${literals} (baseline ${BASELINE}) — ` +
      `lower BASELINE in scripts/check-tokens.mjs to lock the gain in.`,
  );
} else {
  console.log(`✓ raw colour literals: ${literals} (at baseline)`);
}

if (!failed) console.log("✓ no token violations");
process.exit(failed ? 1 : 0);
