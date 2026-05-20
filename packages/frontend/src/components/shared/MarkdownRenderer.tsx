import { Children, isValidElement, useEffect, useRef } from "react";
import mermaid from "mermaid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/utils/cn";

type MarkdownVariant = "chat" | "editor";

interface MarkdownRendererProps {
  content: string;
  variant?: MarkdownVariant;
  className?: string;
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
}: MarkdownRendererProps) {
  const isEditor = variant === "editor";

  return (
    <article className={cn("w-full", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={cn(
                "font-semibold tracking-tight text-on-surface",
                isEditor ? "text-2xl mb-6 mt-8 first:mt-0" : "text-base mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                "font-semibold tracking-tight text-on-surface",
                isEditor ? "text-lg mt-10 mb-4" : "text-sm mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                "font-semibold tracking-tight text-on-surface",
                isEditor ? "text-base mt-8 mb-3" : "text-sm mb-2 mt-3 first:mt-0"
              )}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={cn(
                "text-on-surface-variant leading-relaxed",
                isEditor ? "text-on-surface-variant/90 mb-3" : "mb-2 last:mb-0"
              )}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={cn("list-disc pl-5 mb-3 space-y-1", isEditor ? "text-on-surface-variant/80" : "")}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className={cn("list-decimal pl-5 mb-3 space-y-1", isEditor ? "text-on-surface-variant/80" : "")}>{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic text-on-surface-variant/80 mb-3">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-primary/60 underline-offset-2 hover:text-primary"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left border border-outline-variant/30 bg-surface-container-high/40 px-2 py-1 font-semibold text-on-surface">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-outline-variant/20 px-2 py-1 text-on-surface-variant/90">
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
                  "font-mono text-[12px] border border-outline-variant/20 rounded-md overflow-x-auto mb-3",
                  isEditor
                    ? "bg-surface-container-high/30 p-6 border-l border-primary/50 rounded-r-lg"
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
                <code className={cn("font-mono text-[12px]", isEditor ? "text-primary-fixed-dim/90" : "text-on-surface-variant/80")}>
                  {normalizedCode}
                </code>
              );
            }

            return (
              <code className="font-mono text-[12px] bg-black/25 px-1 py-0.5 rounded">
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
