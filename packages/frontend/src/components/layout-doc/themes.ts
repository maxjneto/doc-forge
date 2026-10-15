/**
 * Palettes for the printed document (not the app): each one sets the document's
 * color tokens with `setTokens`, so every block that uses a color by name follows.
 * Literal colors are the point here, which is why the token guard allows this file.
 */
export interface DocTheme {
  key: string;
  colors: Record<string, string>;
}

export const DOC_THEMES: DocTheme[] = [
  {
    key: "sober",
    colors: { text: "#1a1c1e", muted: "#5b6168", primary: "#1f4fd8", subtle: "#f3f4f6", border: "#d9dce1", highlight: "#fff3b0", chart1: "#1f4fd8", chart2: "#e8710a" },
  },
  {
    key: "executive",
    colors: { text: "#14213d", muted: "#4a5568", primary: "#14213d", subtle: "#eef1f6", border: "#cfd6e2", highlight: "#fde8b0", chart1: "#14213d", chart2: "#f2a20c" },
  },
  {
    key: "green",
    colors: { text: "#10241c", muted: "#4f6159", primary: "#0b6e4f", subtle: "#eef5f1", border: "#cfe0d7", highlight: "#fdeec4", chart1: "#0b6e4f", chart2: "#d97706" },
  },
  {
    key: "forge",
    colors: { text: "#1b1b1b", muted: "#5c5c5c", primary: "#d94100", subtle: "#f4f2f0", border: "#e0dcd8", highlight: "#ffe8d9", chart1: "#d94100", chart2: "#5a7896" },
  },
];

/** Which theme the document's colors match now (null when they were changed by hand). */
export function currentTheme(colors: Record<string, string>): string | null {
  const theme = DOC_THEMES.find((th) => Object.entries(th.colors).every(([k, v]) => colors[k]?.toLowerCase() === v));
  return theme?.key ?? null;
}

/** Margin presets, in px. */
export const MARGINS = [
  { key: "narrow", px: 24 },
  { key: "normal", px: 40 },
  { key: "wide", px: 64 },
] as const;
