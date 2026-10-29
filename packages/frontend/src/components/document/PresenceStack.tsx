import { useI18n } from "@/i18n";
import type { Presence } from "@/types";
import { relativeTime } from "@/utils/time";
import { ActorAvatar } from "./Actor";

const SHOWN = 4;

/**
 * Who else is on the document: people with it open, then agents that wrote in
 * the last few minutes. The viewer is left out — they know they are here.
 */
export function PresenceStack({ presence }: { presence: Presence | null }) {
  const { t, dateLocale } = useI18n();
  if (!presence) return null;
  const others = [
    ...presence.people
      .filter((p) => !p.isMe)
      .map((p) => ({ key: `u${p.id}`, actor: { name: p.name, agent: false }, title: t("doc.presence.viewing", { name: p.name }) })),
    ...presence.agents.map((a) => ({
      key: `k${a.id}`,
      actor: { name: a.name, agent: true, harness: a.harness },
      title: a.onBehalfOf
        ? t("doc.presence.agentFor", { name: a.name, person: a.onBehalfOf, when: relativeTime(a.lastSeen, dateLocale) })
        : t("doc.presence.agent", { name: a.name, when: relativeTime(a.lastSeen, dateLocale) }),
    })),
  ];
  if (others.length === 0) return null;
  const hidden = others.slice(SHOWN);

  return (
    <div className="df-presence" role="group" aria-label={t("doc.presence.label", { count: others.length })}>
      {others.slice(0, SHOWN).map((o) => (
        <span key={o.key} title={o.title} className="df-presence__item">
          <ActorAvatar actor={o.actor} size={26} ring />
          <span className="sr-only">{o.title}</span>
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="df-presence__more" title={hidden.map((o) => o.title).join("\n")}>
          +{hidden.length}
        </span>
      )}
    </div>
  );
}
