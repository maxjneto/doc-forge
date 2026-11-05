import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { HomePage, DocumentPage, LandingPage, LegalPage, HowItWorksPage, PricingPage, McpPage, BillingPage, PublicDocumentPage } from "./pages";
import { ProtectedRoute } from "./components/shared";
import CookieConsentBanner from "./components/shared/CookieConsentBanner";
import { useClerkPosthogIdentity } from "./hooks/useClerkPosthogIdentity";
import { I18nProvider, useI18n } from "./i18n";
import { initAnalytics, setAnalyticsLocale, storedConsent } from "./analytics";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

initAnalytics();

function AppInner() {
  // A choice made on an earlier visit counts too, or returning people would never be identified.
  const [consent, setConsent] = useState(storedConsent);
  useClerkPosthogIdentity(consent);
  const { locale } = useI18n();
  useEffect(() => setAnalyticsLocale(locale), [locale]);
  return (
    <>
      <CookieConsentBanner onChoice={setConsent} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/legal/:doc" element={<LegalPage />} />
        <Route path="/contact" element={<LegalPage doc="contact" />} />
        {/* Public read-only view — outside ProtectedRoute on purpose: the
            token in the URL is the capability, not a session. */}
        <Route path="/public/:token" element={<PublicDocumentPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/mcp" element={<McpPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/document/:id" element={<DocumentPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <I18nProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </I18nProvider>
    </ClerkProvider>
  );
}
