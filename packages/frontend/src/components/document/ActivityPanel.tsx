import { useCallback, useEffect, useState } from "react";
import { textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { DocumentActivity } from "@/types";
import { apiFetchActivity } from "@/utils/api";
import { fullDate, relativeTime } from "@/utils/time";
import { ActorAvatar, useActorName } from "./Actor";

type GetToken = () => Promise<string | null>;

const ENTRY_LIMIT = 50;

/** Who did what, newest first, the same for every kind of document. */
export function ActivityPanel({ documentId, getToken, refreshTick }: { documentId: string; getToken: GetToken; refreshTick: number }) {
  const { t, dateLocale } = useI18n();
  const nameOf = useActorName();
  const [entries, setEntries] = useState<DocumentActivity[] | null>(null);

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

  const describe = (actionType: string) => {
    const key = `activity.${actionType}`;
    const text = t(key);
    return text === key ? actionType.replace(/_/g, " ") : text;
  };

  if (entries === null) return <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("editor.loading")}</span>;
  if (entries.length === 0) return <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("editor.noActivity")}</span>;

  return (
    <ol className="df-activity">
      {entries.map((e, i) => {
        const actor = { name: e.actorName, agent: e.isAgent, harness: e.harness, me: e.isMe };
        // Consecutive entries by the same actor share one avatar, so a burst reads as one turn.
        const continued = i > 0 && entries[i - 1]?.actorId === e.actorId;
        return (
          <li key={e.id} className="df-activity__row" data-continued={continued || undefined}>
            <span className="df-activity__mark">{!continued && <ActorAvatar actor={actor} size={22} />}</span>
            <span className="df-activity__text">
              {!continued && (
                <b data-agent={e.isAgent || undefined}>
                  {nameOf(actor)}
                  {e.isAgent && e.onBehalfOf && <span className="df-actor__for"> {t("doc.actor.for", { name: e.onBehalfOf })}</span>}
                </b>
              )}
              <span>{describe(e.actionType)}</span>
              <time dateTime={e.createdAt} title={fullDate(e.createdAt, dateLocale)}>
                {relativeTime(e.createdAt, dateLocale)}
              </time>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
