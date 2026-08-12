import { Children, isValidElement, useEffect, useRef } from "react";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/cn";
import { parseHeadings } from "@/utils/documentStructure";

type MarkdownVariant = "chat" | "editor";

interface MarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
  headingIds?: boolean;
}

let mermaidInitialized = false;
const mermaidSvgCache = new Map<string, string>();
const mermaidRenderJobs = new Map<string, Promise<string>>();

function ensureMermaidInitialized() {
  if (mermaidInitialized) return;

  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      primaryColor: "#6750a4",
      primaryTextColor: "#e6e0e9",
      primaryBorderColor: "#cfbcff",
      lineColor: "#948e9c",
      secondaryColor: "#4d4465",
      tertiaryColor: "#2b292f",
      background: "#141218",
      mainBkg: "#211f24",
      nodeBorder: "#cfbcff",
    },
  });

  mermaidInitialized = true;
}

async function renderMermaidSvg(code: string, fallbackId: string): Promise<string> {
  const cached = mermaidSvgCache.get(code);
  if (cached) return cached;

  const existingJob = mermaidRenderJobs.get(code);
  if (existingJob) return existingJob;

  const renderJob = (async () => {
    const { svg } = await mermaid.render(fallbackId, code);
    mermaidSvgCache.set(code, svg);
    return svg;
  })();

  mermaidRenderJobs.set(code, renderJob);

  try {
    return await renderJob;
  } finally {
    mermaidRenderJobs.delete(code);
  }
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`markdown-mermaid-${crypto.randomUUID()}`);

  useEffect(() => {
    let cancelled = false;

    ensureMermaidInitialized();

    async function renderDiagram() {
      if (!containerRef.current) return;

      const cached = mermaidSvgCache.get(code);
      if (cached) {
        containerRef.current.innerHTML = cached;
        return;
      }

      try {
        const svg = await renderMermaidSvg(code, idRef.current);
        document.getElementById(idRef.current)?.remove();
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="text-error/80 text-xs p-3 border border-error/20 rounded bg-error-container/10">
              Failed to render Mermaid diagram
            </div>
          `;
        }
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div
      data-mermaid-block
      ref={containerRef}
      className="my-4 flex justify-center [&>svg]:max-w-full"
    />
  );
}

export function MarkdownRenderer({
  content,
  variant = "chat",
  className,
  headingIds = false,
}: MarkdownRendererProps) {
  const isEditor = variant === "editor";
  const headingSlugs = headingIds ? parseHeadings(content).map((heading) => heading.slug) : [];
  let headingIndex = 0;
  const getHeadingId = () => headingSlugs[headingIndex++];

  return (
    <article
      className={cn(
        "w-full markdown-preview text-[var(--df-on-surface)]",
        isEditor ? "text-[14px] leading-7" : "text-[13px] leading-6",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              id={getHeadingId()}
              className={cn(
                "font-semibold tracking-tight text-[var(--df-on-surface)]",
                isEditor ? "text-2xl mb-6 mt-8 first:mt-0" : "text-base mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              id={getHeadingId()}
              className={cn(
                "font-semibold tracking-tight text-[var(--df-on-surface)]",
                isEditor ? "text-lg mt-10 mb-4" : "text-sm mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              id={getHeadingId()}
              className={cn(
                "font-semibold tracking-tight text-[var(--df-on-surface)]",
                isEditor ? "text-base mt-8 mb-3" : "text-sm mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              id={getHeadingId()}
              className={cn(
                "font-medium tracking-tight text-[var(--df-on-surface)]",
                isEditor ? "text-sm mt-6 mb-2" : "text-sm mb-1 mt-2 first:mt-0"
              )}
            >
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5
              id={getHeadingId()}
              className={cn(
                "font-medium tracking-tight text-[var(--df-dim)]",
                isEditor ? "text-xs mt-4 mb-1" : "text-xs mb-1 mt-2 first:mt-0"
              )}
            >
              {children}
            </h5>
          ),
          p: ({ children }) => (
            <p
              className={cn(
                "text-[var(--df-on-surface)] leading-7",
                isEditor ? "mb-4" : "mb-2 last:mb-0"
              )}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-4 space-y-1 text-[var(--df-on-surface)] marker:text-[var(--df-faint)]">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-4 space-y-1 text-[var(--df-on-surface)] marker:text-[var(--df-faint)]">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--df-steel-border)] pl-4 py-0.5 italic text-[var(--df-dim)] mb-4">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--df-steel-100)] underline decoration-[var(--df-steel-border)] underline-offset-2 transition-colors hover:text-[var(--df-on-surface)]"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left border border-[var(--df-outline-md)] bg-[var(--df-surface-high)] px-3 py-2 font-semibold text-[var(--df-on-surface)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--df-outline)] px-3 py-2 text-[var(--df-dim)]">
              {children}
            </td>
          ),
          pre: ({ children }) => {
            const childNodes = Children.toArray(children);
            const onlyChild = childNodes[0];

            if (
              childNodes.length === 1 &&
              isValidElement<{ "data-mermaid-block"?: boolean }>(onlyChild) &&
              Boolean(onlyChild.props["data-mermaid-block"])
            ) {
              return <>{onlyChild}</>;
            }

            return (
              <pre
                className={cn(
                  "font-mono text-[12px] border border-[var(--df-outline-md)] rounded-md overflow-x-auto mb-4",
                  isEditor
                    ? "bg-[var(--df-surface-mid)] p-5 border-l-2 border-l-[var(--df-steel-300)] rounded-r-lg"
                    : "bg-black/30 px-3 py-2"
                )}
              >
                {children}
              </pre>
            );
          },
          code: ({ className, children }) => {
            const languageMatch = /language-([\w-]+)/.exec(className ?? "");
            const language = languageMatch?.[1]?.toLowerCase();
            const rawCode = String(children);
            const normalizedCode = rawCode.replace(/\n$/, "");
            const isBlockLike = Boolean(language) || rawCode.includes("\n");

            if (language === "mermaid") {
              return <MermaidBlock code={normalizedCode} />;
            }

            if (isBlockLike) {
              return (
                <code className={cn("font-mono text-[12px]", isEditor ? "text-[var(--df-steel-100)]" : "text-[var(--df-dim)]")}>
                  {normalizedCode}
                </code>
              );
            }

            return (
              <code className="font-mono text-[12px] text-[var(--df-steel-100)] bg-[var(--df-steel-bg)] border border-[var(--df-steel-border)] px-1.5 py-0.5 rounded">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
