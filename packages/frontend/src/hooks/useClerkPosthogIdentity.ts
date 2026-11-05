import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { identify, resetIdentity, track, type Consent } from "@/analytics";
import { apiUpdateAnalyticsConsent } from "@/utils/api";

/** An account this new is a sign-up: the first identify after creating it marks the start of the funnel. */
const NEW_ACCOUNT_MS = 30 * 60 * 1000;

/**
 * Ties analytics to the signed-in person, and tells the backend what they chose:
 * the server's own events about this account are anonymous unless they accepted.
 */
export function useClerkPosthogIdentity(consent: Consent | null) {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !user || !consent) return;
    const key = `${user.id}:${consent}`;
    if (synced.current === key) return;
    synced.current = key;
    apiUpdateAnalyticsConsent(consent, getToken).catch(() => {
      synced.current = null;
    });
  }, [isSignedIn, user, consent, getToken]);

  useEffect(() => {
    if (consent !== "accepted") return;
    if (isSignedIn && user) {
      identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        created_at: user.createdAt?.toISOString(),
      });
      const created = user.createdAt?.getTime();
      const key = `docforge.signup-tracked.${user.id}`;
      try {
        if (created && Date.now() - created < NEW_ACCOUNT_MS && !localStorage.getItem(key)) {
          track("user_signed_up", { created_at: new Date(created).toISOString() });
          localStorage.setItem(key, "1");
        }
      } catch {
        // Storage blocked: the funnel then starts at the first event instead.
      }
    } else if (isSignedIn === false) {
      resetIdentity();
    }
  }, [isSignedIn, user, consent]);
}
