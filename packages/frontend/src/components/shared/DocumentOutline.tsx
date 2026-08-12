import { useEffect, useMemo, useRef } from "react";
import type { Heading, SectionCounts } from "@/utils/documentStructure";
import { useI18n } from "@/i18n";

interface HeadingNode {
  heading: Heading;
  children: HeadingNode[];
}

function buildTree(headings: Heading[]) {
  const roots: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  for (const heading of headings) {
    const node: HeadingNode = { heading, children: [] };
    while (stack.length && stack[stack.length - 1].heading.level >= heading.level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

function OutlineNode({
  node,
  activeSlug,
  counts,
  onNavigate,
}: {
  node: HeadingNode;
  activeSlug: string | null;
  counts: SectionCounts;
  onNavigate: (slug: string) => void;
}) {
  const active = activeSlug === node.heading.slug;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = counts[node.heading.slug] ?? 0;
  const restColor = node.heading.level === 1 ? "var(--df-dim)" : "var(--df-faint)";

  useEffect(() => {
    if (active) buttonRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => onNavigate(node.heading.slug)}
        title={node.heading.text}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", margin: "1px 0", padding: "5px 8px", textAlign: "left", border: 0, borderLeft: `2px solid ${active ? "var(--df-amber-500)" : "transparent"}`, borderRadius: "var(--radius-sm)", background: active ? "var(--color-heat-05)" : "transparent", color: active ? "var(--df-amber-200)" : restColor, font: "inherit", fontSize: node.heading.level === 1 ? 12.5 : 11.5, fontWeight: active ? 600 : node.heading.level === 1 ? 500 : 400, cursor: "pointer", transition: "color 120ms ease, background 120ms ease" }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.heading.text}</span>
        {count > 0 && <span className="df-mono" style={{ flexShrink: 0, fontSize: 9, color: "var(--df-amber-300)" }}>{count}</span>}
      </button>
      {node.children.length > 0 && (
        <div style={{ marginLeft: 10, paddingLeft: 8, borderLeft: "1px solid var(--df-outline)" }}>
          {node.children.map((child) => (
            <OutlineNode key={child.heading.slug} node={child} activeSlug={activeSlug} counts={counts} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentOutline({
  headings,
  activeSlug,
  counts = {},
  onNavigate,
  emptyText,
}: {
  headings: Heading[];
  activeSlug: string | null;
  counts?: SectionCounts;
  onNavigate: (slug: string) => void;
  emptyText?: string;
}) {
  const { t } = useI18n();
  const tree = useMemo(() => buildTree(headings), [headings]);
  if (tree.length === 0) return <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: "var(--df-faint)" }}>{emptyText ?? t("outline.empty")}</p>;
  return <>{tree.map((node) => <OutlineNode key={node.heading.slug} node={node} activeSlug={activeSlug} counts={counts} onNavigate={onNavigate} />)}</>;
}
