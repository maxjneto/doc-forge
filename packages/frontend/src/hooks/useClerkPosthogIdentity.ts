import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import posthog from "posthog-js";

export function useClerkPosthogIdentity(consentGiven?: boolean) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (!consentGiven) return;
    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
      });
    } else if (isSignedIn === false) {
      posthog.reset();
    }
  }, [isSignedIn, user, consentGiven]);
}
