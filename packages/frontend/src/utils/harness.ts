export type Harness = "claude_code" | "codex" | "cursor" | "generic";

/**
 * Agents are steel (colour grammar R2: came from outside). The vendor logo
 * carries the identity, so no client gets its own brand colour here.
 */
export const HARNESS_META: Record<Harness, {
  label: string; logo: string; fallbackIcon: string;
  fg: string; bg: string; border: string;
}> = {
  claude_code: {
    label: "Claude Code", logo: "/assets/claudecode.svg", fallbackIcon: "terminal",
    fg: "var(--color-steel-hi)", bg: "var(--color-steel-wash)", border: "var(--color-steel-line)",
  },
  codex: {
    label: "Codex", logo: "/assets/codex.svg", fallbackIcon: "smart_toy",
    fg: "var(--color-steel-hi)", bg: "var(--color-steel-wash)", border: "var(--color-steel-line)",
  },
  cursor: {
    label: "Cursor", logo: "/assets/cursor.svg", fallbackIcon: "mouse",
    fg: "var(--color-steel-hi)", bg: "var(--color-steel-wash)", border: "var(--color-steel-line)",
  },
  generic: {
    label: "Generic", logo: "/assets/robot.svg", fallbackIcon: "settings",
    fg: "var(--color-steel-hi)", bg: "var(--color-steel-wash)", border: "var(--color-steel-line)",
  },
};

export function isHarness(value: string | null | undefined): value is Harness {
  return value === "claude_code" || value === "codex" || value === "cursor" || value === "generic";
}
