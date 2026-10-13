import { createBrowserRegistry, type BundledFontFile, type FontRegistry } from "@docforge/layout";
import interBold from "@docforge/layout/fonts/Inter-Bold.ttf?url";
import interBoldItalic from "@docforge/layout/fonts/Inter-BoldItalic.ttf?url";
import interItalic from "@docforge/layout/fonts/Inter-Italic.ttf?url";
import interMedium from "@docforge/layout/fonts/Inter-Medium.ttf?url";
import interRegular from "@docforge/layout/fonts/Inter-Regular.ttf?url";
import interSemiBold from "@docforge/layout/fonts/Inter-SemiBold.ttf?url";
import interSemiBoldItalic from "@docforge/layout/fonts/Inter-SemiBoldItalic.ttf?url";
import monoRegular from "@docforge/layout/fonts/JetBrainsMono-Regular.ttf?url";
import monoSemiBold from "@docforge/layout/fonts/JetBrainsMono-SemiBold.ttf?url";

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
