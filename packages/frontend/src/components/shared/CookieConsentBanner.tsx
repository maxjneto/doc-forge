import { useState } from "react";
import { setConsent, storedConsent, type Consent } from "@/analytics";
import { useI18n } from "@/i18n";

interface CookieConsentBannerProps {
  onChoice?: (consent: Consent) => void;
}

export default function CookieConsentBanner({ onChoice }: CookieConsentBannerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => storedConsent() === null);

  if (!visible) return null;

  function choose(consent: Consent) {
    setConsent(consent);
    onChoice?.(consent);
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-surface border-t border-outline px-6 py-4 shadow-lg">
      <p className="text-body text-text">
        {t("cookie.message")}
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => choose("declined")}
          className="rounded-md px-4 py-2 text-body text-dim hover:text-text transition-colors"
        >
          {t("cookie.decline")}
        </button>
        <button
          onClick={() => choose("accepted")}
          className="rounded-md bg-heat px-4 py-2 text-body font-medium text-on-heat hover:bg-heat-hi transition-colors"
        >
          {t("cookie.accept")}
        </button>
      </div>
    </div>
  );
}
