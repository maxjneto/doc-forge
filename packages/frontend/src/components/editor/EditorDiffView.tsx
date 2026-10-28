import { useEffect, useRef } from "react";
import { CHANGE_LABEL, wordDiff, type DiffRow, type Hunk } from "@/utils/diff";
import { IconButton, Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

const KIND_WORD: Record<string, string> = {
  rewrite: "reescrita",
  addition: "adição",
  removal: "remoção",
};

/**
 * A row of the unified diff. Only the words that actually differ are painted —
 * the previous review UI ran a character-level diff and dumped it into a 340px
 * column, which is why large documents were unreadable.
 */
function Row({ row, counterpart }: { row: DiffRow; counterpart?: DiffRow }) {
  const isAdd = row.kind === "add";
  const isDel = row.kind === "del";

  const tone = isAdd
    ? {
        background: "var(--color-diff-add-bg)",
        bar: "var(--color-ok)",
        gutter: "var(--color-diff-add-gutter)",
        text: "var(--color-diff-add-fg)",
        sign: "+",
      }
    : isDel
      ? {
          background: "var(--color-diff-del-bg)",
          bar: "var(--color-error)",
          gutter: "var(--color-diff-del-gutter)",
          text: "var(--color-diff-del-fg)",
          sign: "−",
        }
      : {
          background: "transparent",
          bar: "transparent",
          gutter: "var(--color-mute)",
          text: "var(--color-faint)",
          sign: "",
        };

  // When a line was replaced rather than added or removed outright, highlight
  // just the words that moved.
  let parts: { text: string; changed: boolean }[] | null = null;
  if (counterpart && (isAdd || isDel)) {
    const [left, right] = wordDiff(
      isDel ? row.text : counterpart.text,
      isDel ? counterpart.text : row.text,
    );
    parts = isDel ? left : right;
  }

  return (
    <div
      style={{
        display: "flex",
        padding: "2px 20px",
        background: tone.background,
        boxShadow: tone.bar === "transparent" ? undefined : `inset 2px 0 0 ${tone.bar}`,
      }}
    >
      <span
        className="df-mono"
        style={{ width: 40, flexShrink: 0, fontSize: 12.5, lineHeight: 1.8, color: tone.gutter }}
      >
        {row.newLine ?? row.oldLine ?? ""}
      </span>
      <span
        className="df-mono"
        style={{
          width: 14,
          flexShrink: 0,
          fontSize: 12.5,
          lineHeight: 1.8,
          fontWeight: 500,
          color: tone.bar === "transparent" ? "transparent" : tone.bar,
        }}
      >
        {tone.sign}
      </span>
      <span
        className="df-mono"
        style={{
          fontSize: 12.5,
          lineHeight: 1.8,
          color: tone.text,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minWidth: 0,
        }}
      >
        {parts
          ? parts.map((p, i) => (
              <span
                key={i}
                style={{
                  background: p.changed
                    ? isAdd
                      ? "var(--color-diff-add-bg)"
                      : "var(--color-diff-del-bg)"
                    : undefined,
                  color: p.changed ? undefined : "var(--color-faint)",
                }}
              >
                {p.text}
              </span>
            ))
          : row.text || " "}
      </span>
    </div>
  );
}

export type HunkDecision = "accept" | "reject";

interface HunkBlockProps {
  hunk: Hunk;
  active: boolean;
  decision?: HunkDecision;
  onSelect: () => void;
}

function HunkBlock({ hunk, active, decision, onSelect }: HunkBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  const range =
    hunk.newStart === hunk.newEnd ? `linha ${hunk.newStart}` : `linhas ${hunk.newStart}‑${hunk.newEnd}`;

  return (
    <div
      ref={ref}
      onClick={onSelect}
      style={{
        cursor: "pointer",
        marginBottom: 12,
        // Decided hunks recede so the eye goes to what still needs a call.
        opacity: decision ? 0.45 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <div
        className="df-mono"
        style={{
          padding: "5px 20px",
          fontSize: 10,
          lineHeight: 1.6,
          color: active ? "var(--color-heat-hi)" : "var(--color-faint)",
          background: "var(--color-surface-mid)",
          borderTop: "1px solid var(--color-outline)",
          borderBottom: "1px solid var(--color-outline)",
        }}
      >
        @@ {range} · {KIND_WORD[hunk.kind]}
        {hunk.heading ? ` · ${hunk.heading.text}` : ""}
        {decision && (
          <span
            style={{
              marginLeft: 10,
              color: decision === "accept" ? "var(--color-ok)" : "var(--color-error)",
            }}
          >
            {decision === "accept" ? "✓ ACEITA" : "✕ RECUSADA"}
          </span>
        )}
      </div>
      {hunk.rows.map((row, i) => {
        // Pair a deletion with the addition that replaced it, so word-level
        // highlighting has something to compare against.
        const next = hunk.rows[i + 1];
        const prev = hunk.rows[i - 1];
        const counterpart =
          row.kind === "del" && next?.kind === "add"
            ? next
            : row.kind === "add" && prev?.kind === "del"
              ? prev
              : undefined;
        return <Row key={i} row={row} counterpart={counterpart} />;
      })}
    </div>
  );
}

interface EditorDiffViewProps {
  hunks: Hunk[];
  activeIndex: number;
  decisions?: Record<number, HunkDecision>;
  onSelect: (index: number) => void;
}

export function EditorDiffView({ hunks, activeIndex, decisions = {}, onSelect }: EditorDiffViewProps) {
  if (hunks.length === 0) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 12.5, color: "var(--color-faint)", margin: 0, lineHeight: 1.6 }}>
          Nada pendente de revisão. Mudanças propostas por agentes aparecem aqui como diff.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 0" }}>
      {hunks.map((hunk) => (
        <HunkBlock
          key={hunk.index}
          hunk={hunk}
          active={hunk.index === activeIndex}
          decision={decisions[hunk.index]}
          onSelect={() => onSelect(hunk.index)}
        />
      ))}
    </div>
  );
}

/** `CHANGE 3 OF 12` bar with the section label and ↑↓, per the v4 mock. */
export function EditorChangeBar({
  hunks,
  activeIndex,
  onPrev,
  onNext,
}: {
  hunks: Hunk[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const active = hunks.find((h) => h.index === activeIndex);
  if (!active) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderBottom: "1px solid var(--color-outline)",
      }}
    >
      <Pill tone="heat">{t("editor.changeOf", { n: activeIndex, total: hunks.length })}</Pill>

      <span
        style={{
          fontSize: 11.5,
          color: "var(--color-faint)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {active.heading ? `${active.heading.text} · ` : ""}
        {CHANGE_LABEL[active.kind].toLowerCase()}
        {active.added > 0 ? ` +${active.added}` : ""}
        {active.removed > 0 ? ` −${active.removed}` : ""}
      </span>

      <span style={{ flex: 1 }} />

      <div style={{ display: "flex", gap: 2 }}>
        <IconButton icon="keyboard_arrow_up" label="Mudança anterior" onClick={onPrev} />
        <IconButton icon="keyboard_arrow_down" label="Próxima mudança" onClick={onNext} />
      </div>
    </div>
  );
}
