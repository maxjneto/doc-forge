import { useState } from "react";
import posthog from "posthog-js";

const CONSENT_KEY = "docforge_cookie_consent";

interface CookieConsentBannerProps {
  onOptIn?: () => void;
}

export default function CookieConsentBanner({ onOptIn }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(CONSENT_KEY) === null
  );

  if (!visible) return null;

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    posthog.opt_in_capturing();
    posthog.startSessionRecording();
    onOptIn?.();
    setVisible(false);
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    posthog.opt_out_capturing();
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-surface border-t border-outline/20 px-6 py-4 shadow-lg">
      <p className="text-sm text-on-surface/80">
        We use analytics to understand how DocForge is used and improve the product.
        No document content is shared.
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={handleDecline}
          className="rounded-md px-4 py-2 text-sm text-on-surface/60 hover:text-on-surface transition-colors"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
