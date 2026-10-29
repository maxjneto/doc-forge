/**
 * "6 min ago" / "há 6 min" for anything recent, a short date after a week.
 * One implementation so every list in the product reads time the same way.
 */
export function relativeTime(iso: string | number, locale: string, style: "short" | "narrow" = "short"): string {
  const ts = typeof iso === "number" ? iso : new Date(iso).getTime();
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style });
  if (s < 45) return rtf.format(0, "second");
  const m = Math.round(s / 60);
  if (m < 60) return rtf.format(-m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return rtf.format(-h, "hour");
  const d = Math.round(h / 24);
  if (d < 7) return rtf.format(-d, "day");
  return shortDate(ts, locale);
}

/** "9 Oct" / "9 de out." — with the year only when it is not this year. */
export function shortDate(iso: string | number, locale: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Full timestamp for a `title` tooltip next to a relative time. */
export function fullDate(iso: string | number, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
