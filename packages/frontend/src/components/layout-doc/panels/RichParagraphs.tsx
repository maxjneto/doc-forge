import { useRef } from "react";
import type { TextRole, Tokens } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";
import { ParagraphsEditable, type Paragraph, type ParagraphsHandle } from "../ParagraphsEditable";

/** The panel's look for each role: the page's hierarchy at the panel's scale. */
const ROLE_CSS: Record<TextRole, string> = {
  "title-1": "font:700 15px/1.35 var(--font-sans);color:var(--color-text)",
  "title-2": "font:600 14px/1.35 var(--font-sans);color:var(--color-text)",
  "title-3": "font:600 13px/1.4 var(--font-sans);color:var(--color-text)",
  subtitle: "font:400 13px/1.45 var(--font-sans);color:var(--color-dim)",
  body: "font:400 12.5px/1.5 var(--font-sans);color:var(--color-text)",
  quote: "font:italic 400 12.5px/1.5 var(--font-sans);color:var(--color-dim);padding-left:10px;border-left:2px solid var(--color-outline-md)",
  caption: "font:400 11px/1.4 var(--font-sans);color:var(--color-dim)",
};

interface RichParagraphsProps {
  value: Paragraph[];
  defaultRole: TextRole;
  tokens: Tokens;
  onChange: (paragraphs: Paragraph[]) => void;
}

/**
 * The text block's paragraphs as one editor in the panel: the role shows in the
 * margin, the floating bar formats runs and changes the role. The same engine as
 * the editor on the page, so both read and write the same thing.
 */
export function RichParagraphs({ value, defaultRole, tokens, onChange }: RichParagraphsProps) {
  const { t } = useI18n();
  const handle = useRef<ParagraphsHandle>(null);
  return (
    <ParagraphsEditable
      ref={handle}
      paragraphs={value}
      defaultRole={defaultRole}
      tokens={tokens}
      css={(role) => ROLE_CSS[role] ?? ROLE_CSS.body}
      className="df-input df-rich"
      aria-label={t("layout.content.text")}
      onInput={() => {
        const next = handle.current?.read();
        if (next) onChange(next);
      }}
    />
  );
}
