/**
 * The GCD component types the marketing pages list. Kept here instead of importing
 * COMPONENT_TYPES from @docforge-lib/layout, so the eagerly loaded marketing pages do
 * not carry the whole library; test/marketing.test.ts fails when the library gains a
 * type this list lacks.
 */
export const GCD_COMPONENT_TYPES = [
  "text",
  "flow",
  "list",
  "table",
  "code",
  "steps",
  "timeline",
  "card",
  "callout",
  "kpi",
  "chart",
  "progress",
  "tags",
  "image",
  "cover",
  "toc",
  "divider",
] as const;
