import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PostHog's own opt-in flag, as it would be on a fresh browser profile.
const ph = vi.hoisted(() => ({
  optedIn: false,
  optedOut: true,
  init: vi.fn(),
  register: vi.fn(),
  has_opted_in_capturing: vi.fn(() => ph.optedIn),
  has_opted_out_capturing: vi.fn(() => ph.optedOut),
  opt_in_capturing: vi.fn(() => { ph.optedIn = true; ph.optedOut = false; }),
  opt_out_capturing: vi.fn(() => { ph.optedIn = false; ph.optedOut = true; }),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: ph }));

async function start() {
  vi.resetModules();
  const analytics = await import("@/analytics");
  analytics.initAnalytics();
  return analytics;
}

describe("consent on a returning visit", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_DEV", "1");
    ph.optedIn = false;
    ph.optedOut = true;
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("opts in when this browser accepted before, without showing the banner again", async () => {
    localStorage.setItem("docforge_cookie_consent", "accepted");
    await start();
    expect(ph.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(ph.startSessionRecording).toHaveBeenCalled();
  });

  it("does not opt in again when PostHog already knows", async () => {
    localStorage.setItem("docforge_cookie_consent", "accepted");
    ph.optedIn = true;
    ph.optedOut = false;
    await start();
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("opts out when this browser declined, even if PostHog thought otherwise", async () => {
    localStorage.setItem("docforge_cookie_consent", "declined");
    ph.optedIn = true;
    ph.optedOut = false;
    await start();
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
  });

  it("stays opted out with no choice yet", async () => {
    await start();
    expect(ph.opt_in_capturing).not.toHaveBeenCalled();
    expect(ph.startSessionRecording).not.toHaveBeenCalled();
  });
});
