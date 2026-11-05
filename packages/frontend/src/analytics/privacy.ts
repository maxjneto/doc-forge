/**
 * What PostHog must never see: the text people and agents write, and the
 * capability tokens in public links. Session recordings keep the shape of the
 * page (text becomes asterisks, images become grey boxes) so the product can
 * still be studied without reading anyone's document.
 *
 * Three mechanisms, because each covers something the others miss:
 * - MASK_TEXT_SELECTOR: text nodes inside these elements are masked in recordings.
 *   It reaches into the layout iframes too, through the `data-ph-mask` that
 *   maskForRecording() puts on their <body>.
 * - BLOCK_SELECTOR / `ph-no-capture`: the element is not recorded at all. Needed
 *   where the content lives in an attribute (an <img src> holding an SVG of the
 *   slide, a `title` holding a document name), since masking only touches text.
 * - `ph-sensitive` (SENSITIVE_CLASS): autocapture ignores clicks inside, so
 *   `$el_text` never carries document text. Recording is not affected.
 */
import type { CaptureResult } from "posthog-js";

export const SENSITIVE_CLASS = "ph-sensitive";
export const NO_CAPTURE_CLASS = "ph-no-capture";

export const MASK_TEXT_SELECTOR = [
  "[data-ph-mask]",
  // Markdown editor and every rendered Markdown
  ".editor-content",
  ".markdown-preview",
  // The document shell both editors share: title, side panel contents, presence
  ".df-doc-bar__title",
  ".df-doc-bar__rename",
  ".df-side-panel__body",
  ".df-presence",
  // In-place editing on the layout page
  ".df-inline-field",
  ".df-inline-editor",
  ".df-inline-entry",
  // Comments wherever they show
  ".df-comment__text",
].join(", ");

export const BLOCK_SELECTOR = [
  "[data-ph-block]",
  // Slide thumbnails: the slide's text is inside the SVG data URI
  ".df-slide__thumb img",
  // Images people put in documents
  "[data-ph-mask] img",
  ".markdown-preview img",
].join(", ");

/** Mark a rendered layout page (an iframe srcDoc) so its text is masked in recordings. */
export function maskForRecording(html: string): string {
  if (!html) return html;
  const at = html.search(/<body[\s>]/i);
  if (at === -1) return html;
  return `${html.slice(0, at + 5)} data-ph-mask${html.slice(at + 5)}`;
}

const PUBLIC_TOKEN = /\/public\/[^/?#\s"']+/g;

/** A public link's token is the capability to read the document: never send it. */
export function scrubUrl(value: string): string {
  return value.replace(PUBLIC_TOKEN, "/public/:token");
}

export function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/public/");
}

function scrubRecord(record: Record<string, unknown> | undefined): void {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value.includes("/public/")) record[key] = scrubUrl(value);
  }
}

/** before_send: strip public-link tokens from every URL-ish property, including person properties. */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  scrubRecord(event.properties as Record<string, unknown> | undefined);
  scrubRecord(event.$set as Record<string, unknown> | undefined);
  scrubRecord(event.$set_once as Record<string, unknown> | undefined);
  return event;
}
