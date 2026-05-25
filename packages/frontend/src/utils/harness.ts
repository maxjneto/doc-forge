export type Harness = "claude_code" | "codex" | "cursor" | "generic";

export const HARNESS_META: Record<Harness, {
  label: string; logo: string; fallbackIcon: string;
  fg: string; bg: string; border: string;
}> = {
  claude_code: {
    label: "Claude Code", logo: "/assets/claudecode.svg", fallbackIcon: "terminal",
    fg: "#ff8d4a", bg: "rgba(255,77,0,0.10)", border: "rgba(255,77,0,0.30)",
  },
  codex: {
    label: "Codex", logo: "/assets/codex.svg", fallbackIcon: "smart_toy",
    fg: "#a855f7", bg: "rgba(168,85,247,0.10)", border: "rgba(168,85,247,0.30)",
  },
  cursor: {
    label: "Cursor", logo: "/assets/cursor.svg", fallbackIcon: "mouse",
    fg: "#e3e2e2", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)",
  },
  generic: {
    label: "Generic", logo: "/assets/robot.svg", fallbackIcon: "settings",
    fg: "var(--df-steel-100)", bg: "var(--df-steel-bg)", border: "var(--df-steel-border)",
  },
};

export function isHarness(value: string | null | undefined): value is Harness {
  return value === "claude_code" || value === "codex" || value === "cursor" || value === "generic";
}
