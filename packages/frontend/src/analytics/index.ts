/**
 * Product analytics: the one way the frontend talks to PostHog.
 *
 * Nothing is sent before cookie consent (opt-out by default). Every event carries
 * the environment and app version, and, inside a document, which document and
 * what kind it is (setAnalyticsContext). Event names are `object_action` in the
 * past tense; who acted goes in properties, not in the name. The catalogue lives
 * in docs/architecture/analytics.md.
 */
import posthog from "posthog-js";
import { BLOCK_SELECTOR, MASK_TEXT_SELECTOR, isPublicPath, scrubEvent } from "./privacy";

export { maskForRecording, SENSITIVE_CLASS, NO_CAPTURE_CLASS } from "./privacy";

type Primitive = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, Primitive>;

export interface AnalyticsContext {
  document_id?: string;
  /** markdown | layout */
  document_mode?: string;
  /** page | slides (layout only) */
  document_kind?: string;
  /** owner | editor | commenter | viewer */
  role?: string;
}

const CONSENT_KEY = "docforge_cookie_consent";
export type Consent = "accepted" | "declined";

export function environment(): "production" | "staging" | "development" {
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  if (host === "doc-forge.dev" || host.endsWith(".doc-forge.dev")) return "production";
  if (!host || host === "localhost" || host === "127.0.0.1" || import.meta.env.DEV) return "development";
  return "staging";
}

let enabled = false;
let context: AnalyticsContext = {};

/** Start PostHog if there is a key. Local runs stay out of the project unless VITE_POSTHOG_DEV=1. */
export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  const env = environment();
  if (!key || (env === "development" && import.meta.env.VITE_POSTHOG_DEV !== "1")) return;

  posthog.init(key, {
    // In production this is the /ingest proxy on our own domain, so blockers that
    // drop *.posthog.com don't erase most of a developer audience.
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com",
    ui_host: (import.meta.env.VITE_POSTHOG_UI_HOST as string) || "https://us.posthog.com",
    person_profiles: "identified_only",
    opt_out_capturing_by_default: true,
    // A single-page app: every route change is a pageview, not only the first load.
    capture_pageview: "history_change",
    capture_pageleave: true,
    enable_heatmaps: true,
    capture_performance: { web_vitals: true, network_timing: true },
    capture_exceptions: true,
    // Public links: the URL is the credential, so there is no recording to begin with.
    disable_session_recording: isPublicPath(window.location.pathname),
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: MASK_TEXT_SELECTOR,
      blockSelector: BLOCK_SELECTOR,
    },
    before_send: scrubEvent,
    loaded: (ph) => {
      ph.register({ environment: env, app_version: (import.meta.env.VITE_APP_VERSION as string) || "dev", app: "web" });
    },
  });
  enabled = true;
  applyStoredConsent();
}

/**
 * A choice made on an earlier visit holds on this one. The banner only shows (and
 * only calls setConsent) when there is no choice yet, and PostHog's own opt-in flag
 * can be missing or stale (cleared storage, a choice made before this build), so
 * without this a returning visitor who accepted would stay opted out for good.
 */
function applyStoredConsent(): void {
  const consent = readConsent();
  if (consent === "accepted") {
    if (!posthog.has_opted_in_capturing()) posthog.opt_in_capturing();
    if (!isPublicPath(window.location.pathname)) posthog.startSessionRecording();
  } else if (consent === "declined" && !posthog.has_opted_out_capturing()) {
    posthog.opt_out_capturing();
  }
}

export function analyticsEnabled(): boolean {
  return enabled;
}

function readConsent(): Consent | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function storedConsent(): Consent | null {
  return readConsent();
}

/** True when this browser accepted analytics cookies, now or on an earlier visit. */
export function hasAnalyticsConsent(): boolean {
  return readConsent() === "accepted";
}

export function setConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage blocked: the choice holds for this page only.
  }
  if (!enabled) return;
  if (consent === "accepted") {
    posthog.opt_in_capturing();
    if (!isPublicPath(window.location.pathname)) posthog.startSessionRecording();
  } else {
    posthog.opt_out_capturing();
  }
}

/** Inside a document: what every event from here on is about. Null when leaving it. */
export function setAnalyticsContext(next: AnalyticsContext | null): void {
  context = next ? { ...next } : {};
}

/** Add what only a deeper view knows (the layout editor knows page vs slides). */
export function extendAnalyticsContext(more: AnalyticsContext): void {
  context = { ...context, ...more };
}

export function setAnalyticsLocale(locale: string): void {
  if (enabled) posthog.register({ locale });
}

export function track(event: string, properties: AnalyticsProps = {}): void {
  if (!enabled) return;
  try {
    posthog.capture(event, { ...context, ...properties });
  } catch {
    // Analytics never breaks the product.
  }
}

const lastSent = new Map<string, number>();

/** Like track(), but at most once per `key` every `ms` (sliders and colour drags fire on every input). */
export function trackThrottled(event: string, properties: AnalyticsProps, key: string, ms = 3000): void {
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < ms) return;
  lastSent.set(key, now);
  track(event, properties);
}

/** Public pages: stop recording while on them, resume (with consent) after. */
export function pauseRecording(): () => void {
  if (!enabled) return () => {};
  posthog.stopSessionRecording();
  return () => {
    if (hasAnalyticsConsent()) posthog.startSessionRecording();
  };
}

export function identify(userId: string, properties: AnalyticsProps): void {
  if (enabled) posthog.identify(userId, properties);
}

export function resetIdentity(): void {
  if (enabled) posthog.reset();
}
