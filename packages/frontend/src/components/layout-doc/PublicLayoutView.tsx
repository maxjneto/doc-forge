import { useEffect, useRef, useState } from "react";
import { createEngine, readDocument } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";
import { loadRegistry } from "./fonts";

/**
 * A published page document, drawn by the same library as the editor (and as any
 * other site that loads it with @docforge-lib/layout). Read only: no editing layer.
 * Loaded lazily, so the Markdown reader does not carry the library.
 */
export default function PublicLayoutView({ content, title }: { content: unknown; title: string }) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    let cancelled = false;
    loadRegistry()
      .then((registry) => {
        const read = readDocument(content, { source: "public link" });
        if (!read.ok || !read.doc) throw new Error(read.notes.join("; "));
        const { page } = createEngine({ registry }).render(read.doc, { screen: true, backdrop: null });
        if (!cancelled) setHtml(page);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (failed) return <p style={{ fontSize: 13, color: "var(--color-faint)" }}>{t("public.invalid")}</p>;
  if (!html) return <p style={{ fontSize: 13, color: "var(--color-faint)" }}>{t("common.loading")}</p>;
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      // No script runs inside; same origin lets the fonts load and the height be read.
      sandbox="allow-same-origin allow-modals"
      onLoad={() => {
        const doc = frame.current?.contentDocument;
        if (doc) setHeight(doc.documentElement.scrollHeight);
      }}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  );
}
