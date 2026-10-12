import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { createEngine, type Diagnostic, type Engine } from "@docforge/layout";
import { Button, Pill, Switch, textStyle } from "@/components/ui";
import { apiGetLayout, type LayoutState } from "@/utils/api";
import { useI18n } from "@/i18n";
import { loadRegistry } from "./fonts";

interface LayoutDocumentViewProps {
  documentId: string;
  /** Bumped on every SSE event for the document; an agent write triggers a refetch. */
  sseTick: number;
}

/**
 * Read-only view of a layout document. Rendering happens here, in the browser,
 * with the same library and fonts the backend's layout service measured with,
 * so the pages match the map the agent read. Loaded on demand: fontkit stays
 * out of the main bundle.
 */
export default function LayoutDocumentView({ documentId, sseTick }: LayoutDocumentViewProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [state, setState] = useState<LayoutState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRegistry()
      .then((registry) => !cancelled && setEngine(createEngine({ registry })))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiGetLayout(documentId, getToken)
      .then((next) => !cancelled && setState(next))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [documentId, getToken, sseTick]);

  if (error) {
    return (
      <Centered>
        <span style={{ ...textStyle.caption, color: "var(--color-error)" }}>{t("layout.loadFailed")}</span>
      </Centered>
    );
  }
  if (!engine || !state) {
    return (
      <Centered>
        <span className="animate-pulse" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
          {engine ? t("document.loading") : t("layout.loadingFonts")}
        </span>
      </Centered>
    );
  }
  return <LayoutReader engine={engine} state={state} />;
}

function LayoutReader({ engine, state }: { engine: Engine; state: LayoutState }) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [surfaceId, setSurfaceId] = useState<string | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);

  const surfaces = useMemo(() => {
    const list = (state.content as { surfaces?: { id: string; kind: string }[] } | null)?.surfaces;
    return Array.isArray(list) ? list : [];
  }, [state.content]);
  const activeSurface = surfaceId && surfaces.some((s) => s.id === surfaceId) ? surfaceId : surfaces[0]?.id;

  const output = useMemo(
    () => engine.render(state.content, { surfaceId: activeSurface, grid: showGrid }),
    [engine, state.content, activeSurface, showGrid],
  );
  const mapText = useMemo(
    () => engine.map(state.content, { level: 1, surfaceId: activeSurface }).text,
    [engine, state.content, activeSurface],
  );
  const problems = output.layout.diagnostics.filter((d) => d.severity !== "info");

  return (
    <div style={{ height: "100%", paddingTop: 56, display: "flex", overflow: "hidden", background: "var(--color-bg)" }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid var(--color-outline)",
            background: "var(--color-surface)",
          }}
        >
          <span style={{ ...textStyle.label, color: "var(--color-faint)" }}>{t("layout.surface")}</span>
          <select
            className="df-input"
            value={activeSurface ?? ""}
            onChange={(e) => setSurfaceId(e.target.value)}
            style={{ width: "auto", padding: "4px 8px" }}
          >
            {surfaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.kind}
              </option>
            ))}
          </select>
          <Switch checked={showGrid} onChange={setShowGrid} label={t("layout.grid")} />
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
            {t("layout.pages", { count: output.layout.pages.length })} · {t("layout.revision", { revision: state.revision })}
          </span>
          <div style={{ flex: 1 }} />
          <Button variant="primary" icon="print" iconPosition="start" onClick={() => frame.current?.contentWindow?.print()}>
            {t("layout.print")}
          </Button>
        </div>
        {/* No scripts in the rendered page: same-origin is only there so the
            fonts load and the parent can call print(). */}
        <iframe
          ref={frame}
          title={output.layout.doc?.meta?.title ?? "layout"}
          srcDoc={output.page}
          sandbox="allow-same-origin allow-modals"
          style={{ flex: 1, width: "100%", border: 0, background: "var(--color-sink)" }}
        />
      </div>

      <aside
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--color-outline)",
          background: "var(--color-surface)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ ...textStyle.eyebrow, color: "var(--color-faint)" }}>{t("layout.problems")}</span>
            {problems.length === 0 ? (
              <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.noProblems")}</span>
            ) : (
              problems.map((d, i) => <DiagnosticRow key={i} diagnostic={d} />)
            )}
          </section>
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...textStyle.eyebrow, color: "var(--color-faint)" }}>{t("layout.map")}</span>
              <CopyMapButton text={mapText} />
            </div>
            <pre
              className="df-mono"
              style={{
                ...textStyle.caption,
                margin: 0,
                padding: 10,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--color-dim)",
                background: "var(--color-sink)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {mapText}
            </pre>
          </section>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.agentHint")}</span>
        </div>
      </aside>
    </div>
  );
}

function DiagnosticRow({ diagnostic: d }: { diagnostic: Diagnostic }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={d.severity === "error" ? "error" : "warn"} compact>
          {d.code}
        </Pill>
        {d.component && <span className="df-mono" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{d.component}</span>}
      </div>
      <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{d.message}</span>
    </div>
  );
}

function CopyMapButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="ghost"
      icon={copied ? "check" : "content_copy"}
      iconPosition="start"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? t("layout.copied") : t("layout.copyMap")}
    </Button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ height: "100%", paddingTop: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
}
