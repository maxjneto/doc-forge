import { useEffect, useState } from "react";
import { apiFetchPresence } from "@/utils/api";
import type { Presence } from "@/types";

type GetToken = () => Promise<string | null>;

// Agents count as present for a while after their last write; re-read now and
// then so one that went quiet leaves without anyone else having to arrive.
const REFRESH_MS = 60_000;

/**
 * Who is on the document now. `tick` moves when the stream says someone came or
 * went, or when anything was written (an agent's write makes it present).
 */
export function usePresence(documentId: string, getToken: GetToken, tick: number): Presence | null {
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetchPresence(documentId, getToken)
        .then((p) => !cancelled && setPresence(p))
        // Presence is a courtesy: without it the document works the same.
        .catch(() => {});
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [documentId, getToken, tick]);

  return presence;
}
