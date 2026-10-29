import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import posthog from "posthog-js";

/** An account this new is a sign-up: the first identify after creating it marks the start of the funnel. */
const NEW_ACCOUNT_MS = 30 * 60 * 1000;

export function useClerkPosthogIdentity(consentGiven?: boolean) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (!consentGiven) return;
    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      });
      const created = user.createdAt?.getTime();
      const key = `docforge.signup-tracked.${user.id}`;
      try {
        if (created && Date.now() - created < NEW_ACCOUNT_MS && !localStorage.getItem(key)) {
          posthog.capture("user_signed_up", { created_at: new Date(created).toISOString() });
          localStorage.setItem(key, "1");
        }
      } catch {
        // Storage blocked: the funnel then starts at the first event instead.
      }
    } else if (isSignedIn === false) {
      posthog.reset();
    }
  }, [isSignedIn, user, consentGiven]);
}
