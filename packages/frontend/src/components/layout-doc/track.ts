import posthog from "posthog-js";

/**
 * Usage events of the layout editor (what people do by hand, next to what agents do
 * through MCP, which the backend records). PostHog only sends after cookie consent;
 * before that, and in tests, this does nothing.
 */
export function track(event: string, properties: Record<string, string | number | boolean | null | undefined> = {}): void {
  try {
    posthog.capture(event, { surface: "layout_editor", ...properties });
  } catch {
    // Analytics never breaks editing.
  }
}
