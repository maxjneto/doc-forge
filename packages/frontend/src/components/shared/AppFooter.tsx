import { NavLink } from "react-router-dom";
import { useI18n } from "@/i18n";

/**
 * Footer of every screen except the document editor, which ends in its own
 * status bar.
 */
export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer className="df-site-footer">
      <div className="df-site-footer__row">
        {/* A brand line, not interface copy: it stays in English in every locale. */}
        <span className="df-site-footer__status">
          <span className="df-site-footer__dot" aria-hidden />
          Forge system ready
        </span>
        <nav className="df-site-footer__links" aria-label={t("footer.legal")}>
          <NavLink to="/legal/privacy">{t("footer.privacy")}</NavLink>
          <NavLink to="/legal/terms">{t("footer.terms")}</NavLink>
          <NavLink to="/contact">{t("footer.contact")}</NavLink>
        </nav>
      </div>
    </footer>
  );
}
