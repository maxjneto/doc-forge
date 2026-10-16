import { BUNDLED_FONTS, createBrowserRegistry, type BundledFontFile, type FontRegistry } from "@docforge/layout";
import interBold from "@docforge/layout/fonts/Inter-Bold.ttf?url";
import interBoldItalic from "@docforge/layout/fonts/Inter-BoldItalic.ttf?url";
import interItalic from "@docforge/layout/fonts/Inter-Italic.ttf?url";
import interMedium from "@docforge/layout/fonts/Inter-Medium.ttf?url";
import interRegular from "@docforge/layout/fonts/Inter-Regular.ttf?url";
import interSemiBold from "@docforge/layout/fonts/Inter-SemiBold.ttf?url";
import interSemiBoldItalic from "@docforge/layout/fonts/Inter-SemiBoldItalic.ttf?url";
import monoRegular from "@docforge/layout/fonts/JetBrainsMono-Regular.ttf?url";
import monoSemiBold from "@docforge/layout/fonts/JetBrainsMono-SemiBold.ttf?url";
import serifBold from "@docforge/layout/fonts/SourceSerif4-Bold.ttf?url";
import serifItalic from "@docforge/layout/fonts/SourceSerif4-Italic.ttf?url";
import serifRegular from "@docforge/layout/fonts/SourceSerif4-Regular.ttf?url";
import serifSemiBold from "@docforge/layout/fonts/SourceSerif4-SemiBold.ttf?url";
import groteskBold from "@docforge/layout/fonts/SpaceGrotesk-Bold.ttf?url";
import groteskMedium from "@docforge/layout/fonts/SpaceGrotesk-Medium.ttf?url";
import groteskRegular from "@docforge/layout/fonts/SpaceGrotesk-Regular.ttf?url";
import groteskSemiBold from "@docforge/layout/fonts/SpaceGrotesk-SemiBold.ttf?url";

// Vite renames assets, so the library gets a file → URL map. It measures with
// these bytes and the rendered page loads the same files through @font-face, so
// what the agent was told fits is what is drawn.
const URLS: Record<BundledFontFile, string> = {
  "Inter-Regular.ttf": interRegular,
  "Inter-Medium.ttf": interMedium,
  "Inter-SemiBold.ttf": interSemiBold,
  "Inter-Bold.ttf": interBold,
  "Inter-Italic.ttf": interItalic,
  "Inter-SemiBoldItalic.ttf": interSemiBoldItalic,
  "Inter-BoldItalic.ttf": interBoldItalic,
  "JetBrainsMono-Regular.ttf": monoRegular,
  "JetBrainsMono-SemiBold.ttf": monoSemiBold,
  "SourceSerif4-Regular.ttf": serifRegular,
  "SourceSerif4-SemiBold.ttf": serifSemiBold,
  "SourceSerif4-Bold.ttf": serifBold,
  "SourceSerif4-Italic.ttf": serifItalic,
  "SpaceGrotesk-Regular.ttf": groteskRegular,
  "SpaceGrotesk-Medium.ttf": groteskMedium,
  "SpaceGrotesk-SemiBold.ttf": groteskSemiBold,
  "SpaceGrotesk-Bold.ttf": groteskBold,
};

let registry: Promise<FontRegistry> | null = null;

/** One registry for the whole app: fonts are fetched once, on the first layout document opened. */
export function loadRegistry(): Promise<FontRegistry> {
  registry ??= createBrowserRegistry(URLS).catch((error: unknown) => {
    registry = null; // let the next attempt retry
    throw error;
  });
  return registry;
}

let appFonts: Promise<void> | null = null;

/**
 * The document's fonts in the app itself (not only inside the rendered page), under
 * the names the renderer uses ("DFL Inter"…), so theme previews show real type.
 */
export function loadAppFonts(): Promise<void> {
  appFonts ??= Promise.all(
    BUNDLED_FONTS.map((f) => {
      const face = new FontFace(`DFL ${f.family}`, `url(${URLS[f.file]})`, { weight: String(f.weight), style: f.style });
      document.fonts.add(face);
      return face.load().catch(() => undefined);
    }),
  ).then(() => undefined);
  return appFonts;
}

/** CSS font-family for one of the document's families, as loaded by loadAppFonts. */
export const docFont = (family: string) => `'DFL ${family}', var(--font-sans)`;
