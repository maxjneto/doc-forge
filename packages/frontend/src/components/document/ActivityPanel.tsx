import { useCallback, useEffect, useState } from "react";
import { textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { DocumentActivity } from "@/types";
import { apiFetchActivity } from "@/utils/api";
import { fullDate, relativeTime } from "@/utils/time";
import { ActorAvatar, useActorName } from "./Actor";

type GetToken = () => Promise<string | null>;

const ENTRY_LIMIT = 50;

/** Descriptions the server writes by itself; the action type says as much, so they are not shown. */
export const GENERIC_ACTIVITY = /^(\d+ layout operations?|Layout replaced|Created|Layout document created|(You|Agent) wrote [\d.,]+ characters.*)$/;

/** Actions that come in bursts (every save of an editing session) and read better as one line. */
const EDITS = new Set<DocumentActivity["actionType"]>(["write", "layout_updated"]);

/**
 * Consecutive edits by the same actor, close in time, become one group: forty
 * nudges read as "40 edits", and two people taking turns stay two lines.
 */
export function groupActivity(entries: DocumentActivity[], gapMinutes = 15): DocumentActivity[][] {
  const groups: DocumentActivity[][] = [];
  const time = (e: DocumentActivity) => Date.parse(e.createdAt);
  for (const e of entries) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    const close = prev && Math.abs(time(prev) - time(e)) <= gapMinutes * 60_000;
    if (last && prev && prev.actorId === e.actorId && EDITS.has(prev.actionType) && EDITS.has(e.actionType) && close) last.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** Who did what, newest first, the same for every kind of document. */
export function ActivityPanel({ documentId, getToken, refreshTick }: { documentId: string; getToken: GetToken; refreshTick: number }) {
  const { t, dateLocale } = useI18n();
  const nameOf = useActorName();
  const [entries, setEntries] = useState<DocumentActivity[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setEntries(await apiFetchActivity(documentId, getToken, ENTRY_LIMIT));
    } catch {
      setEntries([]);
    }
  }, [documentId, getToken]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  /** The writer's own words when there are any; otherwise what the action type says. */
  const describe = (e: DocumentActivity) => {
    if (e.description && !GENERIC_ACTIVITY.test(e.description)) return e.description;
    const key = `activity.${e.actionType}`;
    const text = t(key);
    return text === key ? e.actionType.replace(/_/g, " ") : text;
  };
  const when = (e: DocumentActivity) => (
    <time dateTime={e.createdAt} title={fullDate(e.createdAt, dateLocale)}>
      {relativeTime(e.createdAt, dateLocale)}
    </time>
  );

  if (entries === null) return <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("editor.loading")}</span>;
  if (entries.length === 0) return <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("editor.noActivity")}</span>;

  const groups = groupActivity(entries);
  return (
    <ol className="df-activity">
      {groups.map((group, i) => {
        const first = group[0] as DocumentActivity;
        const actor = { name: first.actorName, agent: first.isAgent, harness: first.harness, me: first.isMe };
        // Consecutive groups by the same actor share one avatar, so a turn reads as one turn.
        const continued = i > 0 && groups[i - 1]?.[0]?.actorId === first.actorId;
        const expanded = open.has(first.id);
        const who = !continued && (
          <b data-agent={first.isAgent || undefined}>
            {nameOf(actor)}
            {first.isAgent && first.onBehalfOf && <span className="df-actor__for"> {t("doc.actor.for", { name: first.onBehalfOf })}</span>}
          </b>
        );
        return (
          <li key={first.id} className="df-activity__row" data-continued={continued || undefined}>
            <span className="df-activity__mark">{!continued && <ActorAvatar actor={actor} size={22} />}</span>
            <span className="df-activity__text">
              {who}
              {group.length === 1 ? (
                <>
                  <span>{describe(first)}</span>
                  {when(first)}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="df-activity__burst"
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpen((current) => {
                        const next = new Set(current);
                        if (next.has(first.id)) next.delete(first.id);
                        else next.add(first.id);
                        return next;
                      })
                    }
                  >
                    {t("activity.edits", { count: group.length })}
                    <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 15 }}>
                      {expanded ? "expand_less" : "expand_more"}
                    </span>
                  </button>
                  {when(first)}
                  {expanded && (
                    <ol className="df-activity__burst-items">
                      {group.map((e) => (
                        <li key={e.id}>
                          <span>{describe(e)}</span>
                          {when(e)}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
