import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui";
import { useI18n } from "@/i18n";

/** Page gaps and shadows off: the slides sit one under the other, exactly one slide tall each. */
const STAGE_CSS = "<style>html,body{background:transparent!important;overflow:hidden!important}.dfl-doc{padding:0!important}.dfl-page{margin:0!important;box-shadow:none!important}</style>";

/**
 * Full-screen presentation of a deck: one slide at a time, scaled to the screen.
 * The rendered document is loaded once; changing slides only moves it, so there is
 * no reload between slides. Arrows, space and Page Up/Down move; Esc leaves.
 */
export function PresentMode({ html, pages, width, height, start, onClose }: { html: string; pages: number; width: number; height: number; start: number; onClose: () => void }) {
  const { t } = useI18n();
  const stage = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(Math.min(Math.max(1, start), pages));
  const [scale, setScale] = useState(1);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, height]);

  useEffect(() => {
    const el = stage.current;
    el?.requestFullscreen?.().catch(() => undefined);
    const onChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [onClose]);

  const go = useCallback((n: number) => setPage(Math.min(pages, Math.max(1, n))), [pages]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        setPage((p) => Math.min(pages, p + 1));
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        setPage((p) => Math.max(1, p - 1));
      } else if (e.key === "Home") go(1);
      else if (e.key === "End") go(pages);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages, go, onClose]);

  useEffect(() => {
    setIdle(false);
    const timer = setTimeout(() => setIdle(true), 2200);
    return () => clearTimeout(timer);
  }, [page]);

  const srcDoc = html.replace("</head>", `${STAGE_CSS}</head>`);
  return createPortal(
    <div ref={stage} className="df-present" data-idle={idle || undefined} onMouseMove={() => setIdle(false)} role="dialog" aria-label={t("layout.slides.presenting")}>
      <div className="df-present__frame" style={{ width: width * scale, height: height * scale }} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0", overflow: "hidden" }}>
          <iframe
            title={t("layout.slides.presenting")}
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            scrolling="no"
            tabIndex={-1}
            style={{ width, height: height * pages, border: 0, display: "block", transform: `translateY(${-(page - 1) * height}px)`, pointerEvents: "none" }}
          />
        </div>
      </div>
      <div className="df-present__bar">
        <IconButton icon="chevron_left" label={t("layout.slides.previous")} disabled={page <= 1} onClick={() => go(page - 1)} />
        <span className="df-mono">
          {page} / {pages}
        </span>
        <IconButton icon="chevron_right" label={t("layout.slides.next")} disabled={page >= pages} onClick={() => go(page + 1)} />
        <IconButton icon="close" label={t("layout.slides.exit")} onClick={onClose} />
      </div>
    </div>,
    document.body,
  );
}
