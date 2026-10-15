import { useEffect, useState } from "react";
import type { ApplyResult, Component, ComponentGeometry, LayoutDocument, LayoutResult, Tokens } from "@docforge/layout";
import { Button, IconButton, Input, Pill, Switch, Tab, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { TYPE_ICON } from "../defaults";
import { displayName, widthLabel } from "../names";
import { ContentEditor } from "./ContentEditor";
import { Field, Row, SectionTitle } from "./fields";
import { StyleEditor } from "./StyleEditor";

export type ComponentTab = "content" | "style";

interface ComponentPanelProps {
  doc: LayoutDocument;
  component: Component;
  geometry: ComponentGeometry | undefined;
  layout: LayoutResult;
  tokens: Tokens;
  families: string[];
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  tab: ComponentTab;
  onTab: (tab: ComponentTab) => void;
  onRemoved: () => void;
  /** Back to the structure list (clears the selection). */
  onBack: () => void;
}

export function ComponentPanel({ doc, component, geometry, layout, tokens, families, commit, readOnly, tab, onTab, onRemoved, onBack }: ComponentPanelProps) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <button
        type="button"
        className="df-row"
        onClick={onBack}
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", marginLeft: -4, background: "transparent", border: 0, color: "var(--color-dim)", cursor: "pointer", borderRadius: "var(--radius-xs)", ...textStyle.caption }}
      >
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
          arrow_back
        </span>
        {t("layout.structure.back")}
      </button>
      <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
        <Row gap={10} style={{ alignItems: "center", minWidth: 0 }}>
          <span
            className="material-symbols-outlined"
            aria-hidden
            style={{ fontSize: 18, color: "var(--color-text)", width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: "var(--radius-sm)", background: "var(--color-surface-high)", flexShrink: 0 }}
          >
            {TYPE_ICON[component.type]}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ ...textStyle.title, fontSize: "var(--text-body)", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={component.id}>
              {displayName(component, t)}
            </span>
            <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
              {t(`layout.type.${component.type}`)}
              {geometry ? ` · ${t("layout.structure.page", { n: geometry.box.page })} · ${widthLabel(geometry.box, layout, t)}` : ""}
            </span>
          </div>
        </Row>
        {!readOnly && (
          <IconButton
            icon="delete"
            label={t("layout.editor.remove")}
            onClick={() => {
              if (commit([{ op: "remove", component: component.id }]).ok) onRemoved();
            }}
          />
        )}
      </Row>
      <div role="tablist" style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-outline)" }}>
        {(["content", "style"] as const).map((key) => (
          <Tab key={key} plain label={t(`layout.panel.${key}`)} active={tab === key} onClick={() => onTab(key)} />
        ))}
      </div>
      {tab === "content" && <ContentEditor key={component.id} component={component} commit={commit} readOnly={readOnly} />}
      {tab === "style" && (
        <>
          {geometry ? (
            <StyleEditor doc={doc} component={component} geometry={geometry} tokens={tokens} families={families} commit={commit} readOnly={readOnly} />
          ) : (
            <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.editor.unplaced")}</span>
          )}
          <details className="df-disclosure" open={!component.at || undefined}>
            <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.panel.position")}</summary>
            <div style={{ paddingTop: 10 }}>
              <PositionEditor doc={doc} component={component} geometry={geometry} layout={layout} commit={commit} readOnly={readOnly} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function NumberField({ label, value, min = 0, onCommit, disabled }: { label: string; value: number; min?: number; onCommit: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const flush = () => {
    const n = Math.round(Number(draft));
    if (Number.isFinite(n) && n >= min && n !== value) onCommit(n);
    else setDraft(String(value));
  };
  return (
    <Field label={label} style={{ flex: 1 }}>
      <Input
        type="number"
        min={min}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={flush}
        onKeyDown={(e) => e.key === "Enter" && flush()}
      />
    </Field>
  );
}

function PositionEditor({
  doc,
  component,
  geometry,
  layout,
  commit,
  readOnly,
}: {
  doc: LayoutDocument;
  component: Component;
  geometry: ComponentGeometry | undefined;
  layout: LayoutResult;
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const at = component.at;
  const [newClass, setNewClass] = useState("");
  const place = (patch: Record<string, unknown>) => commit([{ op: "place", component: component.id, at: patch }]);
  const classes = component.labels ?? [];
  const known = Object.keys(doc.styles?.labels ?? {}).filter((name) => !classes.includes(name));
  const setClasses = (labels: string[]) => commit([{ op: "update", component: component.id, labels }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {!at && <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{t("layout.editor.unplaced")}</span>}
      {at && (
        <>
          <SectionTitle>{t("layout.position.declared")}</SectionTitle>
          <Row>
            <NumberField label={t("layout.position.page")} value={at.page} min={1} disabled={readOnly} onCommit={(page) => place({ page })} />
            <NumberField label="x" value={at.x} disabled={readOnly} onCommit={(x) => place({ x })} />
            <NumberField label="y" value={at.y} disabled={readOnly} onCommit={(y) => place({ y })} />
          </Row>
          <Row>
            <NumberField label={t("layout.position.width")} value={at.w} min={1} disabled={readOnly} onCommit={(w) => place({ w })} />
            {at.h !== undefined ? (
              <NumberField label={t("layout.position.minHeight")} value={at.h} min={1} disabled={readOnly} onCommit={(h) => place({ h })} />
            ) : (
              <Field label={t("layout.position.minHeight")} style={{ flex: 1 }}>
                <span style={{ ...textStyle.caption, color: "var(--color-dim)", padding: "6px 0" }}>{t("layout.position.auto")}</span>
              </Field>
            )}
          </Row>
          {!readOnly && (
            <Switch
              checked={at.h === undefined}
              onChange={(auto) => place({ h: auto ? null : (geometry?.box.h ?? 10) })}
              label={t("layout.position.autoHeight")}
            />
          )}
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.position.unitsHint")}</span>
        </>
      )}

      {geometry && (
        <>
          <SectionTitle>{t("layout.position.drawn")}</SectionTitle>
          <span style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>
            {geometry.pieces.map((p) => t("layout.structure.page", { n: p.page })).join(" + ")} · {widthLabel(geometry.box, layout, t)}
          </span>
          <span className="df-mono" style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
            {geometry.pieces.map((p) => `x${p.x} y${p.y} · ${p.w}×${p.h}`).join(" + ")}
          </span>
          {geometry.shifted > 0 && (
            <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>
              {geometry.pushedBy ? t("layout.position.pushedBy", { rows: geometry.shifted, by: geometry.pushedBy }) : t("layout.position.pageBreak", { rows: geometry.shifted })}
            </span>
          )}
          {geometry.grew > 0 && <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{t("layout.position.grew", { rows: geometry.grew })}</span>}
          {geometry.pieces.length > 1 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.position.split", { count: geometry.pieces.length })}</span>}
          {geometry.clamped && <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{t("layout.position.clamped")}</span>}
          {!readOnly && geometry.shifted > 0 && (
            <Button variant="ghost" icon="push_pin" iconPosition="start" onClick={() => place({ page: geometry.box.page, y: geometry.box.y })}>
              {t("layout.position.keepHere")}
            </Button>
          )}
        </>
      )}

      <SectionTitle>{t("layout.position.classes")}</SectionTitle>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.position.classesHint")}</span>
      <Row gap={6} style={{ flexWrap: "wrap", alignItems: "center" }}>
        {classes.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.position.noClasses")}</span>}
        {classes.map((name) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <Pill compact tone="steel" dot={false}>
              {name}
            </Pill>
            {!readOnly && <IconButton icon="close" label={t("layout.position.removeClass", { name })} onClick={() => setClasses(classes.filter((c) => c !== name))} />}
          </span>
        ))}
      </Row>
      {!readOnly && (
        <Row>
          <Field label={t("layout.position.addClass")} style={{ flex: 1 }}>
            <Input
              list={`classes-${component.id}`}
              value={newClass}
              placeholder={known[0] ?? "destaque"}
              onChange={(e) => setNewClass(e.target.value.replace(/[^\w-]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newClass) {
                  setClasses([...classes, newClass]);
                  setNewClass("");
                }
              }}
            />
            <datalist id={`classes-${component.id}`}>
              {known.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </Field>
          <Button
            disabled={!newClass || classes.includes(newClass)}
            onClick={() => {
              setClasses([...classes, newClass]);
              setNewClass("");
            }}
          >
            {t("layout.position.add")}
          </Button>
        </Row>
      )}
    </div>
  );
}
