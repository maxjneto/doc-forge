import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEngine, reviewLayout, type Engine } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";
import { loadRegistry } from "@/components/layout-doc/fonts";
import demo from "./demo/report-demo.json";
import { track } from "@/analytics";

/**
 * The Home's live demo: the report template built step by step with the same
 * ops an agent sends, by the real layout engine in the browser. Step "more"
 * spills onto a second page, the review says so, and `fit` brings it back to
 * one page. The theme buttons apply the built-in themes' own ops. Nothing is
 * saved and no model is called. Loaded lazily, only once the section is on screen.
 */

const COPY = {
  en: {
    prompt: "Q3 report on one A4 page",
    create: "A4 · report template",
    title: "title",
    kpis: "row: 3 KPIs",
    body: "row: text and chart",
    more: "table, steps and timeline",
    fit: "fit to 1 page, same height in the row",
    review: (pages: number, findings: number) =>
      `${pages} ${pages === 1 ? "page" : "pages"} · ${findings} ${findings === 1 ? "warning" : "warnings"}`,
    replay: "Build again",
    theme: "Theme",
    loading: "Loading the layout engine…",
    frame: "The document being built",
  },
  "pt-BR": {
    prompt: "relatório do Q3 em uma página A4",
    create: "A4 · modelo relatório",
    title: "título",
    kpis: "row: 3 indicadores",
    body: "row: texto e gráfico",
    more: "tabela, passos e cronograma",
    fit: "fit em 1 página, mesma altura na linha",
    review: (pages: number, findings: number) =>
      `${pages} ${pages === 1 ? "página" : "páginas"} · ${findings} ${findings === 1 ? "aviso" : "avisos"}`,
    replay: "Montar de novo",
    theme: "Tema",
    loading: "Carregando o motor de layout…",
    frame: "O documento sendo montado",
  },
} as const;

interface Beat { state: number; tool: string; detail: string; tone?: "warn" | "ok" }

const STEP_MS = 1100;

export default function GcdDemo() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const [beat, setBeat] = useState(0);
  const [theme, setTheme] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadRegistry()
      .then((registry) => { if (!cancelled) setEngine(createEngine({ registry })); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // The document after each step: [empty page, title, KPIs, body, more, fit].
  const states = useMemo(() => {
    if (!engine) return null;
    const docs: unknown[] = [demo.base];
    let doc: unknown = demo.base;
    for (const step of demo.steps) {
      const result = engine.apply(doc, step.ops);
      if (!result.ok || !result.doc) return null;
      doc = result.doc;
      docs.push(doc);
    }
    return docs;
  }, [engine]);

  const summaries = useMemo(() => {
    if (!engine || !states) return null;
    return states.map((doc) => {
      const layout = engine.layout(doc);
      return { pages: layout.pages.length, findings: reviewLayout(layout).findings.length };
    });
  }, [engine, states]);

  const beats: Beat[] = useMemo(() => {
    const review = (i: number) => (summaries ? copy.review(summaries[i]!.pages, summaries[i]!.findings) : "");
    return [
      { state: 0, tool: "create_layout_document", detail: copy.create },
      { state: 1, tool: "apply_layout_ops", detail: copy.title },
      { state: 2, tool: "apply_layout_ops", detail: copy.kpis },
      { state: 3, tool: "apply_layout_ops", detail: copy.body },
      { state: 4, tool: "apply_layout_ops", detail: copy.more },
      { state: 4, tool: "review_layout", detail: review(4), tone: "warn" },
      { state: 5, tool: "apply_layout_ops", detail: copy.fit },
      { state: 5, tool: "review_layout", detail: review(5), tone: "ok" },
    ];
  }, [copy, summaries]);
  const last = beats.length - 1;

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setBeat(last);
      return;
    }
    setBeat(0);
    for (let i = 1; i <= last; i++) timers.current.push(window.setTimeout(() => setBeat(i), i * STEP_MS));
  }, [last]);

  useEffect(() => {
    if (states) play();
    return () => timers.current.forEach(clearTimeout);
  }, [states, play]);

  const html = useMemo(() => {
    if (!engine || !states) return null;
    const doc = states[beats[beat]!.state];
    const themed = engine.apply(doc, demo.themes[theme]!.ops).doc ?? doc;
    return engine.render(themed, { screen: true, backdrop: null }).page;
  }, [engine, states, beats, beat, theme]);

  if (failed || (engine && !states)) return null;

  return (
    <div className="df-mk-split" style={{ alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          aria-live="polite"
          className="df-mono"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-lg)", padding: "18px 20px", minHeight: 260, fontSize: 13, lineHeight: 1.75, display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div><span style={{ color: "var(--color-heat-hi)" }}>&gt; </span>{copy.prompt}</div>
          {html ? beats.slice(0, beat + 1).map((b, i) => (
            <div key={i} className="df-mk-pop" style={{ color: b.tone === "warn" ? "var(--color-warn)" : b.tone === "ok" ? "var(--color-ok)" : "var(--color-steel)" }}>
              ● {b.tool} <span style={{ color: "var(--color-faint)" }}>{b.detail}</span>
            </div>
          )) : <div style={{ color: "var(--color-faint)" }}>{copy.loading}</div>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button type="button" className="df-btn df-btn--secondary" style={{ minHeight: 44 }} onClick={() => { track("demo_interacted", { action: "replay" }); play(); }} disabled={!html}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>replay</span>
            {copy.replay}
          </button>
          <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-dim)", marginLeft: 8 }}>{copy.theme}:</span>
          {demo.themes.map((t, i) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={i === theme}
              onClick={() => { track("demo_interacted", { action: "theme", theme: t.id }); setTheme(i); }}
              style={{ minHeight: 44, padding: "0 16px", borderRadius: "var(--radius-pill)", border: `1px solid ${i === theme ? "var(--color-heat)" : "var(--color-outline-md)"}`, background: i === theme ? "var(--color-heat-wash)" : "transparent", color: "var(--color-text)", fontSize: "var(--text-body-sm)", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <PageFrame html={html} title={copy.frame} />
    </div>
  );
}

/** The rendered page, scaled to the column; at most a page and a third tall, so a spill onto page 2 shows. */
function PageFrame({ html, title }: { html: string | null; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState({ w: 820, h: 1160, page: 1160 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = width ? Math.min(1, width / size.w) : 0.5;
  const height = Math.min(size.h, size.page * 1.3) * scale;

  return (
    <div ref={box} style={{ width: "100%", maxWidth: 520, justifySelf: "center", position: "relative", height: html ? height : 520, overflow: "hidden", borderRadius: "var(--radius-sm)", transition: "height 0.4s ease", boxShadow: "var(--shadow-modal)", background: "var(--color-surface-high)" }}>
      {html && (
        <iframe
          ref={frame}
          title={title}
          srcDoc={html}
          tabIndex={-1}
          // Sized to its pages and clipped by the box: never a scrollbar of its own.
          scrolling="no"
          // No script runs inside; same origin lets the fonts load and the size be read.
          sandbox="allow-same-origin"
          onLoad={() => {
            const doc = frame.current?.contentDocument;
            if (!doc) return;
            // Measured from the pages themselves: scrollWidth/Height never drop below the
            // iframe's current size, so they would not shrink when a step removes a page.
            const pages = doc.querySelectorAll<HTMLElement>(".dfl-page");
            const first = pages[0]?.getBoundingClientRect();
            const lastPage = pages[pages.length - 1]?.getBoundingClientRect();
            if (!first || !lastPage) return;
            setSize({ w: first.right + first.left, h: lastPage.bottom + first.top, page: first.bottom });
          }}
          style={{ position: "absolute", top: 0, left: 0, width: size.w, height: size.h, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}
        />
      )}
      {html && size.h > size.page * 1.3 && (
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: "linear-gradient(transparent, var(--color-bg))" }} />
      )}
    </div>
  );
}
