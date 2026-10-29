import { useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { HomePage, DocumentPage, LandingPage, LegalPage, HowItWorksPage, PricingPage, McpPage, BillingPage, PublicDocumentPage } from "./pages";
import { ProtectedRoute } from "./components/shared";
import CookieConsentBanner from "./components/shared/CookieConsentBanner";
import { useClerkPosthogIdentity } from "./hooks/useClerkPosthogIdentity";
import { I18nProvider } from "./i18n";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY as string, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string) ?? "https://us.i.posthog.com",
    opt_out_capturing_by_default: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskTextSelector: "[data-ph-mask], .editor-content, .markdown-preview",
    },
  });
}

function AppInner() {
  const [consentGiven, setConsentGiven] = useState(false);
  useClerkPosthogIdentity(consentGiven);
  return (
    <>
      <CookieConsentBanner onOptIn={() => setConsentGiven(true)} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/legal/:doc" element={<LegalPage />} />
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
    <PostHogProvider client={posthog}>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <I18nProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </I18nProvider>
      </ClerkProvider>
    </PostHogProvider>
  );
}
