import { useEffect, useState } from "react";
import type { Component, ComponentType } from "@docforge-lib/layout";
import { textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { starterComponent } from "../defaults";
import { displayName } from "../names";
import { Field, ItemActions, move, Row, Select, TextArea } from "./fields";

type Block = string | Record<string, unknown>;

/** The markdown-like prefixes a string block may start with, and the role each gives. */
const PREFIXES = [
  ["### ", "title-3"],
  ["## ", "title-2"],
  ["# ", "title-1"],
  ["> ", "quote"],
] as const;
type StringRole = "body" | "title-1" | "title-2" | "title-3" | "quote";

export function splitPrefix(block: string): { role: StringRole; text: string } {
  for (const [prefix, role] of PREFIXES) if (block.startsWith(prefix)) return { role, text: block.slice(prefix.length) };
  return { role: "body", text: block };
}
export function joinPrefix(role: StringRole, text: string): string {
  const prefix = PREFIXES.find(([, r]) => r === role)?.[0] ?? "";
  return `${prefix}${text}`;
}

/** Blocks a person can add from the panel; strings first, then the usual components. */
const ADD: ("paragraph" | "heading" | "break" | ComponentType)[] = ["paragraph", "heading", "list", "table", "callout", "code", "chart", "image", "tags", "progress", "break"];

/** One non-text block as JSON, applied when it parses (the rest of the flow keeps working while it does not). */
function BlockJson({ value, onChange }: { value: Block; onChange: (next: Block) => void }) {
  const { t } = useI18n();
  const source = JSON.stringify(value, null, 2);
  const [text, setText] = useState(source);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setText(source);
    setBad(false);
  }, [source]);
  return (
    <>
      <TextArea
        mono
        rows={Math.min(12, source.split("\n").length)}
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value) as Block);
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
      {bad && <span style={{ ...textStyle.caption, color: "var(--color-error)" }}>{t("layout.content.jsonInvalid")}</span>}
    </>
  );
}

/**
 * A flow edited as its list of blocks: paragraphs and titles as text, a page break as a
 * marker, every other block as its own JSON. Blocks move and go away like list items.
 */
export function FlowBlocksEditor({ blocks, onChange }: { blocks: Block[]; onChange: (next: Block[]) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const labels = { up: t("layout.content.moveUp"), down: t("layout.content.moveDown"), remove: t("layout.content.remove") };
  const sample = (key: string) => t(key);
  const write = (i: number, next: Block) => onChange(blocks.map((b, j) => (j === i ? next : b)));

  const add = (kind: (typeof ADD)[number]) => {
    const block: Block =
      kind === "paragraph"
        ? t("layout.sample.paragraph")
        : kind === "heading"
          ? joinPrefix("title-2", t("layout.sample.title"))
          : kind === "break"
            ? { type: "break" }
            : (({ id: _id, ...rest }) => rest)(starterComponent(kind, "x", sample));
    onChange([...blocks, block]);
    if (typeof block !== "string" && kind !== "break") setOpen(blocks.length);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {blocks.map((block, i) => {
        const actions = <ItemActions index={i} count={blocks.length} labels={labels} onMove={(a, b) => onChange(move(blocks, a, b))} onRemove={(j) => onChange(blocks.filter((_, k) => k !== j))} />;
        if (typeof block === "string") {
          const { role, text } = splitPrefix(block);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
              <Row gap={4} style={{ alignItems: "center" }}>
                <Select
                  label={t("layout.content.blockRole")}
                  value={role}
                  onChange={(r) => write(i, joinPrefix(r as StringRole, text))}
                  options={(["body", "title-1", "title-2", "title-3", "quote"] as const).map((r) => ({ value: r, label: t(`layout.role.${r}`) }))}
                  style={{ flex: 1 }}
                />
                {actions}
              </Row>
              <TextArea aria-label={t("layout.content.text")} rows={role === "body" ? 3 : 1} value={text} onChange={(e) => write(i, joinPrefix(role, e.target.value))} />
            </div>
          );
        }
        const type = String(block.type ?? "");
        if (type === "break") {
          return (
            <Row key={i} gap={4} style={{ alignItems: "center", paddingBottom: 8, borderBottom: "1px dashed var(--color-outline)" }}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-faint)" }}>
                insert_page_break
              </span>
              <span style={{ ...textStyle.caption, color: "var(--color-dim)", flex: 1 }}>{t("layout.content.pageBreak")}</span>
              {actions}
            </Row>
          );
        }
        const name = displayName({ id: String(block.id ?? `block-${i}`), ...block } as unknown as Component, t);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
            <Row gap={4} style={{ alignItems: "center" }}>
              <button type="button" className="df-row" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "4px 6px", ...textStyle.label }}>
                {name}
              </button>
              {actions}
            </Row>
            {open === i && (
              <Field label={t("layout.content.blockJson")} hint={t("layout.content.blockJsonHint")}>
                <BlockJson value={block} onChange={(next) => write(i, next)} />
              </Field>
            )}
          </div>
        );
      })}
      <Field label={t("layout.content.addBlock")}>
        <Select
          value=""
          onChange={(kind) => kind && add(kind as (typeof ADD)[number])}
          options={[{ value: "", label: t("layout.content.addBlockPick") }, ...ADD.map((k) => ({ value: k, label: k === "paragraph" ? t("layout.role.body") : k === "heading" ? t("layout.content.heading") : k === "break" ? t("layout.content.pageBreak") : t(`layout.type.${k}`) }))]}
        />
      </Field>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.content.flowHint")}</span>
    </div>
  );
}
