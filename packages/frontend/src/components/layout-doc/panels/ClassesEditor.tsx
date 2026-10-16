import { useMemo, useState } from "react";
import { STYLE_PROPS, type ApplyResult, type LayoutDocument, type LayoutResult, type StyleProp, type StyleProps } from "@docforge/layout";
import { Button, IconButton, Input, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, Row, SectionTitle, Select } from "./fields";
import { ValueControl } from "./StyleEditor";

/** Classes: shared styles every component listing the class gets (the ones with a style and the ones only used). */
export function ClassesSection({
  doc,
  layout,
  families,
  commit,
  readOnly,
}: {
  doc: LayoutDocument;
  layout: LayoutResult;
  families: string[];
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
}) {
  const classes = useMemo(() => {
    const users = new Map<string, string[]>();
    for (const c of doc.components) for (const l of c.labels ?? []) users.set(l, [...(users.get(l) ?? []), c.id]);
    const names = new Set([...Object.keys(doc.styles?.labels ?? {}), ...users.keys()]);
    return [...names].sort().map((name) => ({ name, users: users.get(name) ?? [], style: doc.styles?.labels?.[name] ?? {} }));
  }, [doc]);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [newClass, setNewClass] = useState("");
  const [addProp, setAddProp] = useState<StyleProp>("color");
  return (
    <ClassesEditor
      classes={classes}
      tokens={layout.tokens}
      families={families}
      layout={layout}
      commit={commit}
      readOnly={readOnly}
      openClass={openClass}
      setOpenClass={setOpenClass}
      newClass={newClass}
      setNewClass={setNewClass}
      addProp={addProp}
      setAddProp={setAddProp}
    />
  );
}

function ClassesEditor({
  classes,
  tokens,
  families,
  layout,
  commit,
  readOnly,
  openClass,
  setOpenClass,
  newClass,
  setNewClass,
  addProp,
  setAddProp,
}: {
  classes: { name: string; users: string[]; style: StyleProps }[];
  tokens: LayoutResult["tokens"];
  families: string[];
  layout: LayoutResult;
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  openClass: string | null;
  setOpenClass: (name: string | null) => void;
  newClass: string;
  setNewClass: (name: string) => void;
  addProp: StyleProp;
  setAddProp: (prop: StyleProp) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <SectionTitle>{t("layout.doc.classes")}</SectionTitle>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.doc.classesHint")}</span>
      {classes.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.doc.noClasses")}</span>}
      {classes.map((cls) => (
        <div key={cls.name} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
          <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              className="df-row"
              aria-expanded={openClass === cls.name}
              onClick={() => setOpenClass(openClass === cls.name ? null : cls.name)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}
            >
              <Pill compact tone="steel" dot={false}>
                {cls.name}
              </Pill>
              <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
                {t("layout.doc.classUsage", { count: cls.users.length, props: Object.keys(cls.style).length })}
              </span>
            </button>
            {!readOnly && <IconButton icon="delete" label={t("layout.doc.deleteClass", { name: cls.name })} onClick={() => commit([{ op: "setStyle", layer: "label", label: cls.name, style: null }])} />}
          </Row>
          {openClass === cls.name && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
              {(Object.keys(cls.style) as StyleProp[]).map((prop) => (
                <div key={prop} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t(`layout.style.prop.${prop}`)}</span>
                    {!readOnly && (
                      <IconButton
                        icon="close"
                        label={t("layout.doc.removeProp")}
                        onClick={() => {
                          const rest = { ...cls.style };
                          delete rest[prop];
                          commit([
                            { op: "setStyle", layer: "label", label: cls.name, style: null },
                            { op: "setStyle", layer: "label", label: cls.name, style: rest },
                          ]);
                        }}
                      />
                    )}
                  </Row>
                  {!readOnly && (
                    <ValueControl
                      prop={prop}
                      written={cls.style[prop]}
                      value={cls.style[prop]}
                      tokens={tokens}
                      families={families}
                      onChange={(v) => commit([{ op: "setStyle", layer: "label", label: cls.name, style: { [prop]: v } }])}
                    />
                  )}
                </div>
              ))}
              {!readOnly && (
                <Row>
                  <Select
                    label={t("layout.doc.addProp")}
                    value={addProp}
                    onChange={(v) => setAddProp(v as StyleProp)}
                    options={STYLE_PROPS.filter((p) => !(p in cls.style)).map((p) => ({ value: p, label: t(`layout.style.prop.${p}`) }))}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={() => {
                      const prop = (STYLE_PROPS as StyleProp[]).includes(addProp) && !(addProp in cls.style) ? addProp : STYLE_PROPS.find((p) => !(p in cls.style));
                      if (!prop) return;
                      const sample = layout.components[cls.users[0] ?? ""]?.style[prop];
                      const fallback = sample?.written ?? sample?.value ?? defaultFor(prop);
                      commit([{ op: "setStyle", layer: "label", label: cls.name, style: { [prop]: fallback } }]);
                    }}
                  >
                    {t("layout.position.add")}
                  </Button>
                </Row>
              )}
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <Row>
          <Field label={t("layout.doc.newClass")} style={{ flex: 1 }}>
            <Input value={newClass} placeholder="destaque" onChange={(e) => setNewClass(e.target.value.replace(/[^\w-]/g, ""))} />
          </Field>
          <Button
            disabled={!newClass || classes.some((c) => c.name === newClass)}
            onClick={() => {
              commit([{ op: "setStyle", layer: "label", label: newClass, style: {} }]);
              setOpenClass(newClass);
              setNewClass("");
            }}
          >
            {t("layout.doc.createClass")}
          </Button>
        </Row>
      )}
    </>
  );
}

function defaultFor(prop: StyleProp): string | number | boolean {
  switch (prop) {
    case "italic":
      return true;
    case "align":
      return "left";
    case "fontWeight":
      return 600;
    case "borderWidth":
      return 1;
    case "fontFamily":
      return "$font.sans";
    case "fontSize":
      return "$size.m";
    case "lineHeight":
      return "$lineHeight.normal";
    case "radius":
      return "$radius.m";
    case "padding":
    case "gap":
      return "$space.3";
    default:
      return "$color.primary";
  }
}
