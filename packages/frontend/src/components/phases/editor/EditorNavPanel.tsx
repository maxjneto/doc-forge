export interface Heading {
  level: number;
  text: string;
  slug: string;
}

export function parseHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  const slugCount: Record<string, number> = {};

  for (const line of content.split("\n")) {
    const match = /^[ \t]*(#{1,5})\s+(.+)/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim();
    const base = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    slugCount[base] = (slugCount[base] ?? 0) + 1;
    const slug = slugCount[base] === 1 ? base : `${base}-${slugCount[base] - 1}`;
    headings.push({ level, text, slug });
  }

  return headings;
}

// ─── Tree structure ───────────────────────────────────────────

interface HeadingNode {
  heading: Heading;
  children: HeadingNode[];
}

function buildTree(headings: Heading[]): HeadingNode[] {
  const roots: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const h of headings) {
    const node: HeadingNode = { heading: h, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].heading.level >= h.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

// ─── Tree node ────────────────────────────────────────────────

interface TreeNodeProps {
  node: HeadingNode;
  activeSlug: string | null;
  onNavigate: (slug: string) => void;
  isLast: boolean;
}

function TreeNode({ node, activeSlug, onNavigate, isLast }: TreeNodeProps) {
  const { heading, children } = node;
  const isActive = activeSlug === heading.slug;
  const hasChildren = children.length > 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => onNavigate(heading.slug)}
        title={heading.text}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "5px 8px",
          margin: "1px 0",
          borderRadius: 5,
          fontSize: heading.level === 1 ? 12.5 : 11.5,
          fontWeight: isActive ? 600 : heading.level === 1 ? 500 : 400,
          color: isActive
            ? "var(--df-amber-200, #ffb59e)"
            : heading.level === 1
            ? "var(--df-dim, rgba(227,226,226,0.62))"
            : "var(--df-faint, rgba(227,226,226,0.38))",
          background: isActive ? "rgba(255,77,0,0.05)" : "transparent",
          border: "none",
          borderLeft: `2px solid ${isActive ? "var(--df-amber-500, #ff4d00)" : "transparent"}`,
          cursor: "pointer",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          transition: "color 0.12s, background 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--df-dim, rgba(227,226,226,0.62))";
        }}
        onMouseLeave={(e) => {
          if (!isActive)
            (e.currentTarget as HTMLButtonElement).style.color =
              heading.level === 1
                ? "var(--df-dim, rgba(227,226,226,0.62))"
                : "var(--df-faint, rgba(227,226,226,0.38))";
        }}
      >
        {heading.text}
      </button>

      {hasChildren && (
        <div style={{ position: "relative", paddingLeft: 16 }}>
          {/* Vertical trunk connecting to children */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 0,
              bottom: isLast ? 12 : 0,
              width: 1,
              background: "var(--df-outline, rgba(255,255,255,0.06))",
            }}
          />
          {children.map((child, i) => (
            <div key={child.heading.slug} style={{ position: "relative" }}>
              {/* L-shaped connector */}
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: 12,
                  width: 10,
                  height: 1,
                  background: "var(--df-outline, rgba(255,255,255,0.06))",
                }}
              />
              <TreeNode
                node={child}
                activeSlug={activeSlug}
                onNavigate={onNavigate}
                isLast={i === children.length - 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav Panel ────────────────────────────────────────────────

interface EditorNavPanelProps {
  headings: Heading[];
  activeSlug: string | null;
  onNavigate: (slug: string) => void;
  onExport: () => void;
}

export function EditorNavPanel({ headings, activeSlug, onNavigate, onExport }: EditorNavPanelProps) {
  const tree = buildTree(headings);

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(0,0,0,0.20)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 16px 16px" }} className="hide-scrollbar">
        <div
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "var(--df-faint, rgba(227,226,226,0.38))",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          › Structure
        </div>

        {tree.length === 0 ? (
          <p
            style={{
              fontSize: 11,
              color: "var(--df-faint, rgba(227,226,226,0.28))",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Start typing ## headings to navigate sections.
          </p>
        ) : (
          <div>
            {tree.map((node, i) => (
              <TreeNode
                key={node.heading.slug}
                node={node}
                activeSlug={activeSlug}
                onNavigate={onNavigate}
                isLast={i === tree.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div style={{ padding: "12px 22px 24px", borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))", flexShrink: 0 }}>
        <button
          onClick={onExport}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600,
            color: "var(--df-faint, rgba(227,226,226,0.38))",
            background: "transparent", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
          Export Markdown
        </button>
      </div>
    </nav>
  );
}
