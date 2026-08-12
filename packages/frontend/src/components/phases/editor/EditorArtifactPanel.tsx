import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Artifact, ArtifactKind } from "@/types";
import { apiFetchArtifacts } from "@/utils/api";
import { MarkdownRenderer } from "@/components/shared";
import { Card, Button, Pill } from "@/components/ui";
import { ScrollFadeContainer } from "./ScrollFadeContainer";

const GLYPH: Record<ArtifactKind, string> = {
  diagram: "◇",
  table: "▤",
  decision: "◈",
};

const KIND_LABEL: Record<ArtifactKind, string> = {
  diagram: "DIAGRAMA",
  table: "TABELA",
  decision: "DECISÃO",
};

interface EditorArtifactPanelProps {
  documentId: string;
  refreshTick: number;
  onCountChange?: (count: number) => void;
  /** Opens the artifact full-screen in the centre panel. */
  onOpen?: (artifact: Artifact) => void;
  /** Ask the agent for one — becomes feedback it reads. */
  onRequestArtifact?: () => void;
}

/**
 * The ARTEFATOS tab — diagrams, tables and decision notes that agents create
 * to hold up the text.
 *
 * This is the fix for "the agent keeps doing its best work in the terminal":
 * it writes there because the terminal is unconstrained and DocForge only
 * accepted document content. Giving the apparatus a home flips the incentive.
 */
export function EditorArtifactPanel({
  documentId,
  refreshTick,
  onCountChange,
  onOpen,
  onRequestArtifact,
}: EditorArtifactPanelProps) {
  const { getToken } = useAuth();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refetch = useCallback(() => {
    let cancelled = false;
    apiFetchArtifacts(documentId, getToken)
      .then((a) => {
        if (!cancelled) setArtifacts(a);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [documentId, getToken]);

  useEffect(() => refetch(), [refetch, refreshTick]);
  useEffect(() => onCountChange?.(artifacts.length), [artifacts.length, onCountChange]);

  if (artifacts.length === 0) {
    return (
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--df-faint)", margin: 0 }}>
          Nenhum artefato ainda. Diagramas, tabelas e notas de decisão que os agentes criam para
          sustentar o texto aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flexShrink: 0,
          padding: 16,
          borderBottom: "1px solid var(--df-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--df-on-surface)" }}>
          {artifacts.length} {artifacts.length === 1 ? "artefato" : "artefatos"} neste documento
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--df-dim)" }}>
          Diagramas, tabelas e notas de decisão que os agentes criam para sustentar o texto.
        </div>
      </div>

      <ScrollFadeContainer fadeColor="var(--df-surface)">
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {artifacts.map((a) => (
            <Card
              key={a.id}
              tone={selected === a.id ? "heat" : "sunken"}
              padded={false}
              onClick={() => {
                setSelected(a.id);
                onOpen?.(a);
              }}
              style={{
                padding: "12px 13px",
                display: "flex",
                alignItems: "center",
                gap: 11,
                // No directive points at it — the SEM ÂNCORA state from the mock.
                borderStyle: a.anchored ? "solid" : "dashed",
                opacity: a.anchored ? 1 : 0.7,
              }}
            >
              <div
                className="df-mono"
                style={{
                  width: 34,
                  height: 26,
                  flexShrink: 0,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--df-outline-md)",
                  background: "var(--df-surface-high)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--df-faint)",
                }}
              >
                {GLYPH[a.kind]}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--df-on-surface)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.title}
                </span>
                <span
                  className="df-mono"
                  style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--df-faint)" }}
                >
                  {KIND_LABEL[a.kind]} · {a.anchored ? `::${a.key}` : "SEM ÂNCORA"} ·{" "}
                  {(a.author ?? "VOCÊ").toUpperCase()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </ScrollFadeContainer>

      {onRequestArtifact && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--df-outline)", padding: "14px 16px" }}>
          <Button onClick={onRequestArtifact} style={{ width: "100%" }}>
            Pedir artefato ao agente
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Inline card for a `::artefato[key]` directive, rendered where the directive
 * sits in the document.
 */
export function ArtifactInlineCard({
  artifact,
  onOpen,
}: {
  artifact: Artifact | undefined;
  onOpen?: () => void;
}) {
  if (!artifact) return null;

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "14px 0",
        border: "1px solid var(--df-outline-md)",
        borderRadius: "var(--radius-md)",
        background: "linear-gradient(180deg, var(--df-surface-mid), var(--df-surface))",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        className="df-mono"
        style={{
          width: 46,
          height: 34,
          flexShrink: 0,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--df-outline-md)",
          background: "var(--df-surface-high)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--df-faint)",
        }}
      >
        {GLYPH[artifact.kind]}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--df-on-surface)" }}>
          {artifact.title}
        </span>
        <span
          className="df-mono"
          style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--df-faint)" }}
        >
          {KIND_LABEL[artifact.kind]} · {(artifact.author ?? "VOCÊ").toUpperCase()}
        </span>
      </div>
      {onOpen && (
        <Button variant="primary" onClick={onOpen} style={{ padding: "6px 12px", fontSize: 11 }}>
          Abrir →
        </Button>
      )}
    </div>
  );
}

/** Full view of one artifact: the rendered content plus where it lands. */
export function ArtifactDetail({
  artifact,
  documentContent = "",
  currentSection,
  onAnchor,
  onMoveAnchor,
}: {
  artifact: Artifact;
  /** Body text, used to show the prose the artifact sits after. */
  documentContent?: string;
  /** Section the reader is currently on — the target for "Inserir em". */
  currentSection?: { slug: string; text: string; line: number } | null;
  /** Insert `::artefato[key]` into the body at the current section. */
  onAnchor?: (artifact: Artifact) => void;
  /** Remove the existing directive so it can be placed somewhere else. */
  onMoveAnchor?: (artifact: Artifact) => void;
}) {
  // The paragraph immediately before the directive, so the reader can see the
  // artifact in the context it was placed in.
  const directive = `::artefato[${artifact.key}]`;
  const at = documentContent.indexOf(directive);
  const preceding =
    at > 0
      ? documentContent
          .slice(0, at)
          .trimEnd()
          .split("\n\n")
          .filter((p) => p.trim())
          .pop() ?? null
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "30px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div className="df-mono" style={{ fontSize: 44, lineHeight: 1, color: "var(--df-mute)" }}>
            {GLYPH[artifact.kind]}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              className="df-mono"
              style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--df-amber-300)" }}
            >
              › ARTEFATO · {KIND_LABEL[artifact.kind]}
            </div>
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.25,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--df-on-surface)",
              }}
            >
              {artifact.title}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--df-faint)" }}>
              criado por{" "}
              <b style={{ color: "var(--df-amber-300)", fontWeight: 600 }}>
                {artifact.author ?? "você"}
              </b>{" "}
              · v{artifact.revision}
            </div>
          </div>
          <Pill tone={artifact.anchored ? "ok" : "ghost"} dot={artifact.anchored}>
            {artifact.anchored ? "ancorado" : "sem âncora"}
          </Pill>
        </div>

        <div
          style={{
            border: "1px solid var(--df-outline)",
            borderRadius: "var(--radius-md)",
            background: "var(--df-surface-mid)",
            padding: 20,
          }}
        >
          <MarkdownRenderer content={artifact.content} variant="editor" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            className="df-mono"
            style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--df-faint)" }}
          >
            › ONDE APARECE NO DOCUMENTO
          </div>
          <div
            style={{
              border: "1px solid var(--df-outline)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              background: "var(--df-surface-mid)",
            }}
          >
            {artifact.anchored ? (
              <>
                <div
                  className="df-mono"
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--df-outline)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    color: "var(--df-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  {preceding ? "depois do parágrafo abaixo" : "no início do documento"}
                </div>
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  {preceding && (
                    <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "var(--df-faint)" }}>
                      …{preceding.slice(-220)}
                    </div>
                  )}
                  <ArtifactInlineCard artifact={artifact} />
                </div>
              </>
            ) : (
              <div style={{ padding: "18px 20px", fontSize: 12.5, lineHeight: 1.6, color: "var(--df-faint)" }}>
                Nada no texto aponta para este artefato ainda. Insira{" "}
                <code className="df-mono" style={{ color: "var(--df-amber-300)" }}>
                  {directive}
                </code>{" "}
                onde ele deve aparecer.
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 60,
          flexShrink: 0,
          borderTop: "1px solid var(--df-outline)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 40px",
          background: "var(--color-card-footer)",
        }}
      >
        <span style={{ flex: 1 }} />
        {artifact.anchored && onMoveAnchor && (
          <Button variant="secondary" onClick={() => onMoveAnchor(artifact)}>
            Mover âncora
          </Button>
        )}
        {!artifact.anchored && onAnchor && (
          <Button variant="primary" onClick={() => onAnchor(artifact)}>
            {currentSection ? `Inserir em ${currentSection.text}` : "Inserir no documento"}
          </Button>
        )}
      </div>
    </div>
  );
}
