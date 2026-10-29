import { useEffect, useState } from "react";
import type { LayoutDocument, LayoutResult } from "@docforge-lib/layout";
import { Button, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { TYPE_ICON } from "../defaults";
import { displayName, rowsOf, widthLabel } from "../names";

/**
 * With nothing selected: the document as people read it (pages or slides, then
 * blocks side by side, each named by its own words). Picking one selects it on the
 * page; it is also the keyboard path to every block. Problems and suggestions live
 * in their own tab (Review), so the structure is never pushed down.
 */
export function StructurePanel({ doc, layout, slides, map, onPick }: { doc: LayoutDocument; layout: LayoutResult; slides: boolean; map: () => string; onPick: (id: string) => void }) {
  const { t } = useI18n();
  const byId = new Map(doc.components.map((c) => [c.id, c] as const));
  const rows = rowsOf(layout);
  const unplaced = doc.components.filter((c) => !layout.components[c.id]);

  const item = (id: string, nested: boolean) => {
    const c = byId.get(id);
    const g = layout.components[id];
    if (!c) return null;
    return (
      <button
        key={id}
        type="button"
        className="df-row"
        onClick={() => onPick(id)}
        title={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: nested ? "6px 8px 6px 30px" : "6px 8px",
          background: "transparent",
          border: 0,
          color: "var(--color-text)",
          textAlign: "left",
          cursor: "pointer",
          borderRadius: "var(--radius-xs)",
          minWidth: 0,
        }}
      >
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
          {TYPE_ICON[c.type]}
        </span>
        <span style={{ ...textStyle.bodySm, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(c, t)}</span>
        {g && <span style={{ ...textStyle.caption, color: "var(--color-faint)", whiteSpace: "nowrap" }}>{widthLabel(g.box, layout, t)}</span>}
        {g && g.shifted > 0 && (
          <Pill compact tone="warn" dot={false}>
            ↓
          </Pill>
        )}
      </button>
    );
  };

  const pages = [...new Set(rows.map((r) => r.page))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {doc.components.length === 0 ? (
        <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.structure.empty")}</span>
      ) : (
        <nav aria-label={t("layout.side.structure")} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {pages.map((page, pi) => (
            <div key={page} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-faint)", padding: pi === 0 ? "0 8px 4px" : "12px 8px 4px" }}>
                {slides ? t("layout.slides.slide", { n: page }) : t("layout.structure.page", { n: page })}
              </span>
              {rows
                .filter((row) => row.page === page)
                .map((row) =>
                  row.ids.length === 1 ? (
                    item(row.ids[0] as string, false)
                  ) : (
                    <div key={row.ids.join("|")} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ ...textStyle.caption, color: "var(--color-dim)", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 2px" }}>
                        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
                          view_column
                        </span>
                        {t("layout.structure.row", { count: row.ids.length })}
                      </span>
                      {row.ids.map((id) => item(id, true))}
                    </div>
                  ),
                )}
            </div>
          ))}
          {unplaced.length > 0 && (
            <>
              <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-faint)", padding: "12px 8px 4px" }}>{t("layout.editor.unplacedShort")}</span>
              {unplaced.map((c) => item(c.id, false))}
            </>
          )}
        </nav>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: "1px solid var(--color-outline)" }}>
        <CopyMapButton text={map} />
        <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.agentHint")}</span>
      </div>
    </div>
  );
}

function CopyMapButton({ text }: { text: () => string }) {
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
        void navigator.clipboard.writeText(text()).then(() => setCopied(true));
      }}
    >
      {copied ? t("layout.copied") : t("layout.copyForAgent")}
    </Button>
  );
}
