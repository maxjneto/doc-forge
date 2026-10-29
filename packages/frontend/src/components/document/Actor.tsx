import { useI18n } from "@/i18n";
import { HARNESS_META, isHarness } from "@/utils/harness";

/** Someone who acts on a document: a person, or an agent through its API key. */
export interface Actor {
  name: string | null;
  agent: boolean;
  harness?: string | null;
  /** The viewer themself. */
  me?: boolean;
  /** For an agent: the person whose key it used. */
  onBehalfOf?: string | null;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0] as string;
  const last = words.length > 1 ? (words[words.length - 1] as string) : "";
  return (first[0] + (last[0] ?? first[1] ?? "")).toUpperCase();
}

/** An actor's display name, with "you" and "agent" when the server sent none. */
export function useActorName() {
  const { t } = useI18n();
  return (actor: Actor): string => {
    if (actor.me && !actor.agent) return t("doc.actor.you");
    return actor.name || (actor.agent ? t("doc.actor.agent") : t("doc.actor.someone"));
  };
}

/**
 * A round mark per actor. People get their initials; agents are steel (they came
 * from outside, R2) and carry their client's logo when it is known.
 */
export function ActorAvatar({ actor, size = 20, ring }: { actor: Actor; size?: number; ring?: boolean }) {
  const harness = actor.agent && isHarness(actor.harness) ? HARNESS_META[actor.harness] : null;
  return (
    <span
      className="df-avatar"
      data-agent={actor.agent || undefined}
      data-me={(actor.me && !actor.agent) || undefined}
      data-ring={ring || undefined}
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {harness ? (
        <img src={harness.logo} width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} alt="" />
      ) : actor.agent ? (
        <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.62) }}>
          smart_toy
        </span>
      ) : (
        initials(actor.name || "?")
      )}
    </span>
  );
}

/** Avatar and name on one line, as comments, history and activity show who acted. */
export function ActorLabel({ actor, size = 20 }: { actor: Actor; size?: number }) {
  const { t } = useI18n();
  const nameOf = useActorName();
  return (
    <span className="df-actor">
      <ActorAvatar actor={actor} size={size} />
      <b data-agent={actor.agent || undefined}>{nameOf(actor)}</b>
      {actor.agent && actor.onBehalfOf && <span className="df-actor__for">{t("doc.actor.for", { name: actor.onBehalfOf })}</span>}
    </span>
  );
}
