// The UI copy is English, so dates are pinned to en-US instead of following
// the browser locale — otherwise a pt-BR browser mixes "25/09/2026" into
// screens that say "Last edited".
const LOCALE = "en-US";

/**
 * Most backend timestamps are naive UTC (`DateTime` columns without tz), so
 * they serialize without an offset and `new Date()` would read them as local
 * time — 3h off for a user in Brazil. Treat offset-less ISO strings as UTC.
 */
export function parseServerDate(iso: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasZone || !iso.includes("T") ? iso : `${iso}Z`);
}

export function formatDate(iso: string, opts: { year?: boolean } = {}): string {
  return parseServerDate(iso).toLocaleDateString(LOCALE, {
    month: "short",
    day: "numeric",
    ...(opts.year ? { year: "numeric" } : {}),
  });
}

export function formatDateTime(iso: string): string {
  return parseServerDate(iso).toLocaleString(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - parseServerDate(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso, { year: parseServerDate(iso).getFullYear() !== new Date().getFullYear() });
}
