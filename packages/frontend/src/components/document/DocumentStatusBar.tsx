import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import type { Presence } from "@/types";
import { relativeTime } from "@/utils/time";

export type SaveTone = "quiet" | "busy" | "warn" | "error";

interface DocumentStatusBarProps {
  /** Whether the person's work is safe: "saved 12s ago", "saving…", "not saved". */
  save: { text: string; tone: SaveTone } | null;
  presence: Presence | null;
  /** Facts about the document on the right: pages, revision… */
  children?: ReactNode;
}

/**
 * The line at the bottom of every document: is my work saved, and which agents
 * are working on it right now. Until it existed the layout editor had a dot in
 * its toolbar and the Markdown editor its own footer.
 */
export function DocumentStatusBar({ save, presence, children }: DocumentStatusBarProps) {
  const { t, dateLocale } = useI18n();
  const [, tick] = useState(0);

  // "2 min ago" keeps counting.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const agents = presence?.agents ?? [];
  return (
    <footer className="df-doc-status" aria-label={t("doc.status")}>
      {save && (
        <span className="df-doc-status__save" data-tone={save.tone} aria-live="polite">
          <span aria-hidden className="df-doc-status__dot" />
          {save.text}
        </span>
      )}
      {agents.map((a) => (
        <span key={a.id} className="df-doc-status__agent">
          <span aria-hidden className="df-doc-status__dot" />
          {t("doc.status.agentWrote", { name: a.name, when: relativeTime(a.lastSeen, dateLocale) })}
        </span>
      ))}
      <span style={{ flex: 1 }} />
      {children}
    </footer>
  );
}
