import { useEffect, useRef, useState } from "react";

import { Pill } from "@/components/ui";
const PHASES = [
  {
    num: "01",
    name: "Discovery",
    eyebrow: "Phase 01 · Heating",
    title: "Discovery.",
    body: (
      <>
        Paste a paragraph of context. DocForge identifies the document type and the sections it'll need, then asks{" "}
        <strong>up to 2 targeted follow-up questions per section</strong> until it has enough context. As each answer
        lands, the corresponding zone of the ghost document <strong>heats up</strong> — visual proof your input is
        shaping the doc.
      </>
    ),
    mockTitle: "› Discovery · live ghost preview",
    mockPill: "3 of 5 forged",
    Mock: DiscoveryMock,
  },
  {
    num: "02",
    name: "Alignment",
    eyebrow: "Phase 02 · Cooling check",
    title: "Alignment.",
    body: (
      <>
        Before any full content is poured, the Forger generates a <strong>1–3 sentence summary per section</strong>.
        You approve, reject, or rewrite. A structured <strong>Document Contract</strong> — entities, decisions,
        terminology, constraints — is extracted on approval and threaded into every downstream call so nothing drifts.
      </>
    ),
    mockTitle: "› Alignment · 2 forged · 1 in revision · 1 pending",
    mockPill: "65% approved",
    Mock: AlignmentMock,
  },
  {
    num: "03",
    name: "Generation",
    eyebrow: "Phase 03 · Foundry hot",
    title: "Generation.",
    body: (
      <>
        Sections are poured <strong>sequentially</strong> — each one with access to the contract and the sections
        already written. A molten leading edge on every bar means the section is alive, not stuck. If a pour fails,
        the bar cools to deep amber and recasts automatically.
      </>
    ),
    mockTitle: "› Generation · pouring four sections",
    mockPill: "Foundry hot",
    Mock: GenerationMock,
  },
  {
    num: "04",
    name: "Refinement",
    eyebrow: "Phase 04 · Reheat & reshape",
    title: "Refinement.",
    body: (
      <>
        Each section gets its own chat panel and its own version history. Ask for an edit, paste in your own changes,
        or have the agent <strong>analyze a manual rewrite</strong>. Every change is a version you can branch from or
        roll back to. Finalize one section before the next.
      </>
    ),
    mockTitle: "› Refinement · Implementation · v3 of 5",
    mockPill: "Heating",
    Mock: RefinementMock,
  },
  {
    num: "05",
    name: "Audit",
    eyebrow: "Phase 05 · X-ray",
    title: "Audit.",
    body: (
      <>
        Before the document is finalized, the entire document is scanned for{" "}
        <strong>cross-section contradictions, terminology drift, and scope issues</strong>. Findings are reported with
        high or low severity; high findings can block accepting agent suggestions when the quality gate is enabled.
      </>
    ),
    mockTitle: "› Audit · 4 findings · 1 blocker",
    mockPill: "Scanning · Implementation",
    Mock: AuditMock,
  },
  {
    num: "06",
    name: "Completed",
    eyebrow: "Phase 06 · Cooled & set",
    title: "Completed.",
    body: (
      <>
        The guided run ends in a document you can keep editing. Export to <strong>Markdown</strong>, or to PDF and Word
        on supported plans. MCP-managed documents also keep activity, suggestions, artifacts and named versions so the
        review remains traceable after the pipeline is over.
      </>
    ),
    mockTitle: "› Completed · RFC-0142 · v1.0",
    mockPill: "Forged · 4 sections",
    Mock: CompletedMock,
  },
];

export function ScrollNarratedPhases() {
  const [activeIdx, setActiveIdx] = useState(0);
  const panelsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function update() {
      const center = window.innerHeight * 0.4;
      let idx = 0;
      panelsRef.current.forEach((p, i) => {
        if (!p) return;
        const r = p.getBoundingClientRect();
        if (r.top <= center && r.bottom > 80) idx = i;
      });
      setActiveIdx(idx);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const heatPct = ((activeIdx + 1) / PHASES.length) * 100;

  return (
    <section
      id="forger"
      style={{
        borderTop: "1px solid var(--color-outline)",
        padding: "80px 0 100px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px 60px", textAlign: "center" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11.5,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-steel-hi)",
            fontWeight: 600,
          }}
        >
          Path B · The Forger · no agent needed
        </span>
        <h2 style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", margin: "14px 0 14px" }}>
          No agent yet? <em style={{ fontStyle: "normal", color: "var(--color-steel-hi)" }}>The hosted pipeline drives</em>.
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>
          Six phases from idea to merge-ready — the same review, audit and history apply to what it writes. Scroll through; the timeline on the left lights up as each phase comes into view.
        </p>
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 56px",
          display: "grid",
          gridTemplateColumns: "280px minmax(0,1fr)",
          gap: 64,
          alignItems: "flex-start",
        }}
      >
        {/* Sticky rail */}
        <aside
          className="df-timeline-rail"
          style={{ position: "sticky", top: 140, alignSelf: "flex-start", height: "fit-content" }}
        >
          <div
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "var(--tracking-eyebrow)",
              textTransform: "uppercase",
              color: "var(--color-faint)",
              marginBottom: 20,
            }}
          >
            › The Forge Pipeline
          </div>
          <div
            style={{
              height: 5,
              borderRadius: "var(--radius-pill)",
              background: "var(--color-hover)",
              border: "1px solid var(--color-outline)",
              overflow: "hidden",
              marginBottom: 22,
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: "var(--radius-pill)",
                background: "linear-gradient(90deg, var(--color-heat-deep), var(--color-heat) 60%, var(--color-heat-hi))",
                width: `${heatPct}%`,
                transition: "width 0.4s ease-out",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  right: -2,
                  top: -3,
                  bottom: -3,
                  width: 14,
                  background: "linear-gradient(90deg, transparent, var(--color-spark))",
                  filter: "blur(4px)",
                }}
              />
            </div>
          </div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 11,
                top: 14,
                bottom: 14,
                width: 1,
                background: "var(--color-outline)",
              }}
            />
            {PHASES.map((p, i) => {
              const state = i < activeIdx ? "done" : i === activeIdx ? "now" : "future";
              return (
                <li
                  key={p.num}
                  onClick={() => {
                    panelsRef.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: 14,
                    alignItems: "flex-start",
                    padding: "12px 0",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  <span
                    className="df-mono"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: state === "future" ? "1px solid var(--color-mute)" : "none",
                      background:
                        state === "now"
                          ? "var(--color-heat)"
                          : state === "done"
                          ? "var(--color-heat-line)"
                          : "var(--color-bg)",
                      display: "grid",
                      placeItems: "center",
                      zIndex: 2,
                      fontSize: 10,
                      fontWeight: 600,
                      color: state === "future" ? "var(--color-mute)" : state === "done" ? "var(--color-bg)" : "var(--color-on-heat)",
                      boxShadow:
                        state === "now"
                          ? "0 0 0 4px var(--color-heat-strong), 0 0 18px var(--color-heat-line)"
                          : "none",
                      transform: state === "now" ? "scale(1.10)" : "scale(1)",
                      transition: "all 0.4s ease",
                    }}
                  >
                    {p.num}
                  </span>
                  <div style={{ paddingTop: 1 }}>
                    <div
                      className="df-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "var(--tracking-eyebrow)",
                        color:
                          state === "now"
                            ? "var(--color-heat)"
                            : state === "done"
                            ? "var(--color-heat-line)"
                            : "var(--color-mute)",
                        marginBottom: 2,
                        fontWeight: state === "now" ? 700 : 400,
                      }}
                    >
                      PHASE {p.num}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: state === "now" ? 600 : 500,
                        color:
                          state === "now"
                            ? "var(--color-text)"
                            : state === "done"
                            ? "var(--color-dim)"
                            : "var(--color-mute)",
                      }}
                    >
                      {p.name}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
          {PHASES.map((p, i) => (
            <div
              key={p.num}
              ref={(el) => {
                panelsRef.current[i] = el;
              }}
              style={{
                minHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "20px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 12 }}>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 64,
                    fontWeight: 600,
                    color: "var(--color-heat-line)",
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                  }}
                >
                  {p.num}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span
                    className="df-mono"
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "var(--tracking-eyebrow)",
                      textTransform: "uppercase",
                      color: p.num === "06" ? "var(--color-steel-hi)" : "var(--color-heat-hi)",
                      fontWeight: 600,
                    }}
                  >
                    {p.eyebrow}
                  </span>
                  <h3 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.05 }}>
                    {p.title}
                  </h3>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.65, maxWidth: 580, margin: "14px 0 26px" }}>
                {p.body}
              </p>
              <PhaseMock title={p.mockTitle} pill={p.mockPill}>
                <p.Mock />
              </PhaseMock>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PhaseMock({ title, pill, children }: { title: string; pill: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-veil)",
        backdropFilter: "blur(6px)",
        padding: "24px 26px",
        overflow: "hidden",
        boxShadow: "var(--shadow-modal)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 14,
          marginBottom: 16,
          borderBottom: "1px solid var(--color-outline)",
        }}
      >
        <span
          className="df-mono"
          style={{ fontSize: 11.5, color: "var(--color-heat-hi)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase" }}
        >
          {title}
        </span>
        <Pill tone="heat">{pill}</Pill>
      </div>
      {children}
    </div>
  );
}

/* ─── Per-phase mocks ─────────────────────────────────────── */

function Skel({ width, kind = "default" }: { width: string; kind?: "default" | "amber" | "steel" | "dim" | "error" }) {
  const bg = {
    default: "var(--color-hover)",
    amber: "var(--color-heat-strong)",
    steel: "var(--color-steel-strong)",
    dim: "var(--color-hover)",
    error: "var(--color-error-strong)",
  }[kind];
  return (
    <span style={{ display: "block", height: 6, borderRadius: "var(--radius-xs)", background: bg, marginBottom: 6, width }} />
  );
}

function DiscoveryMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <QaCard qn="Q01 · FORGED" q="What problem does this RFC solve?" a="Payment confirmation latency spikes to 2–4s during high-traffic windows…" dim />
        <QaCard qn="Q02 · FORGED" q="Who are the primary consumers?" a="Internal payments engineers and the on-call rotation…" dim />
        <QaCard qn="Q03 · HEATING" q="What constraints must the solution respect?" a="Type your answer…" italic active />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GhostZone label="› CONTEXT" status="FORGED" state="heated" widths={["90%", "74%", "84%"]} />
        <GhostZone label="› PROPOSAL" status="FORGED" state="heated" widths={["84%", "72%"]} />
        <GhostZone label="› IMPLEMENTATION" status="HEATING" state="heating" widths={["78%", "60%", "88%"]} />
        <GhostZone label="› RISKS" status="PRE-HEAT" state="cold" widths={["70%", "82%"]} />
      </div>
    </div>
  );
}

function QaCard({
  qn,
  q,
  a,
  dim,
  italic,
  active,
}: {
  qn: string;
  q: string;
  a: string;
  dim?: boolean;
  italic?: boolean;
  active?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${active ? "var(--color-heat-line)" : "var(--color-outline)"}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        background: active ? "var(--color-heat-tint)" : "var(--color-sink)",
        marginBottom: 8,
        opacity: dim ? 0.6 : 1,
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          color: active ? "var(--color-heat-hi)" : "var(--color-faint)",
          letterSpacing: "var(--tracking-label)",
          marginBottom: 6,
        }}
      >
        {qn}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--color-text)", lineHeight: 1.4, marginBottom: 6 }}>{q}</div>
      <div style={{ fontSize: 11.5, color: italic ? "var(--color-faint)" : "var(--color-dim)", lineHeight: 1.4, fontStyle: italic ? "italic" : "normal" }}>
        {a}
      </div>
    </div>
  );
}

function GhostZone({
  label,
  status,
  state,
  widths,
}: {
  label: string;
  status: string;
  state: "heated" | "heating" | "cold";
  widths: string[];
}) {
  const border =
    state === "heating" ? "var(--color-heat-line)" : state === "heated" ? "var(--color-heat-line)" : "var(--color-outline)";
  const bg =
    state === "heating" ? "var(--color-heat-wash)" : state === "heated" ? "var(--color-heat-tint)" : "transparent";
  const labColor =
    state === "heating" ? "var(--color-heat-hi)" : state === "heated" ? "var(--color-heat-line)" : "var(--color-faint)";
  const skelKind = state === "cold" ? "dim" : "amber";
  return (
    <div style={{ padding: "10px 12px", border: `1px solid ${border}`, borderRadius: "var(--radius-sm)", background: bg }}>
      <div
        className="df-mono"
        style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: labColor, marginBottom: 6, display: "flex", justifyContent: "space-between" }}
      >
        <span>{label}</span>
        <span>{status}</span>
      </div>
      {widths.map((w, i) => (
        <Skel key={i} width={w} kind={skelKind} />
      ))}
    </div>
  );
}

function AlignmentMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <SumCard name="› CONTEXT" pill="Approved" state="approved" widths={["92%", "78%", "68%"]} />
      <SumCard name="› PROPOSAL" pill="Approved" state="approved" widths={["88%", "74%"]} />
      <SumCard name="› IMPLEMENTATION" pill="Re-pouring" state="revising" widths={["80%", "60%"]} />
      <SumCard name="› RISKS" pill="Pending" state="pending" widths={["72%", "84%", "56%"]} />
    </div>
  );
}

function SumCard({
  name,
  pill,
  state,
  widths,
}: {
  name: string;
  pill: string;
  state: "approved" | "revising" | "pending";
  widths: string[];
}) {
  const border =
    state === "approved" ? "var(--color-steel-line)" : state === "revising" ? "var(--color-heat-line)" : "var(--color-outline)";
  const bg =
    state === "approved"
      ? "linear-gradient(180deg, var(--color-steel-tint), var(--color-sink))"
      : "var(--color-sink)";
  const pillTone = state === "approved" ? "steel" : state === "revising" ? "heat" : "ghost";
  const skelKind = state === "approved" ? "steel" : state === "revising" ? "amber" : "default";
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
        padding: 14,
        background: bg,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {state === "revising" && (
        <span
          aria-hidden
          className="animate-df-shimmer-card"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, transparent, var(--color-heat-tint), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-text)" }}>
          {name}
        </span>
        <Pill tone={pillTone} compact>{pill}</Pill>
      </div>
      {widths.map((w, i) => (
        <Skel key={i} width={w} kind={skelKind} />
      ))}
    </div>
  );
}

function GenerationMock() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <GenRow label="Context" clock="forged" state="complete" />
      <GenRow label="Proposal" clock="forged" state="complete" />
      <GenRow label="Implementation" clock="0:14 / ~0:30" state="live" width="62%" />
      <GenRow label="Risks" clock="queued" state="queued" />
    </div>
  );
}

function GenRow({
  label,
  clock,
  state,
  width,
}: {
  label: string;
  clock: string;
  state: "complete" | "live" | "queued";
  width?: string;
}) {
  const isComplete = state === "complete";
  const isLive = state === "live";
  const isQueued = state === "queued";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr 80px 160px",
        gap: 14,
        alignItems: "center",
        padding: "10px 0",
        borderTop: "1px solid var(--color-outline)",
      }}
    >
      <span
        className="df-mono"
        style={{ color: isComplete ? "var(--color-heat-line)" : isQueued ? "var(--color-mute)" : "var(--color-heat-hi)" }}
      >
        ›
      </span>
      <span style={{ fontSize: 12.5, color: isQueued ? "var(--color-faint)" : isComplete ? "var(--color-dim)" : "var(--color-text)" }}>
        {label}
      </span>
      <span
        className="df-mono"
        style={{
          fontSize: 10,
          color: isComplete ? "var(--color-heat-line)" : isQueued ? "var(--color-mute)" : "var(--color-heat-hi)",
          textAlign: "right",
          letterSpacing: "var(--tracking-data)",
        }}
      >
        {clock}
      </span>
      <div
        style={{
          height: 5,
          borderRadius: "var(--radius-pill)",
          background: "var(--color-hover)",
          border: "1px solid var(--color-outline)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!isQueued && (
          <div
            className={isLive ? "animate-df-pour-fill" : undefined}
            style={{
              height: "100%",
              borderRadius: "var(--radius-pill)",
              width: isComplete ? "100%" : width ?? "0%",
              background: isComplete
                ? "var(--color-heat-line)"
                : "linear-gradient(90deg, var(--color-heat-deep), var(--color-heat) 60%, var(--color-heat-hi))",
              position: "relative",
            }}
          >
            {isLive && (
              <span
                style={{
                  position: "absolute",
                  right: -2,
                  top: -2,
                  bottom: -2,
                  width: 14,
                  background: "linear-gradient(90deg, transparent, var(--color-spark))",
                  filter: "blur(3px)",
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RefinementMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, minHeight: 240 }}>
      <div
        style={{
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-sm)",
          padding: 12,
          background: "var(--color-sink)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <ChatMsg who="AI" tag="› ANALYSIS" tagColor="var(--color-steel-hi)">
          Drafted three implementation steps. Want me to expand the rollout, or tighten the rollback path first?
        </ChatMsg>
        <ChatMsg who="SC" user tag="› YOU">
          Tighten rollback. Add a fast revert flag.
        </ChatMsg>
        <ChatMsg who="AI" tag="› EDIT">
          Updated step 2 with a{" "}
          <code
            className="df-mono"
            style={{ fontSize: 10, color: "var(--color-heat-soft)", background: "var(--color-heat-wash)", padding: "1px 4px", borderRadius: "var(--radius-xs)" }}
          >
            revert_async_buffer
          </code>{" "}
          flag.
        </ChatMsg>
      </div>
      <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", padding: 16, background: "var(--color-sink)" }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Implementation</h4>
        <div
          className="df-mono"
          style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)", marginBottom: 14 }}
        >
          SECTION 03 · V3 OF 5 · LAST EDITED 32S AGO
        </div>
        <p style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.55, margin: "0 0 8px" }}>
          Roll the asynchronous confirmation buffer behind a feature flag (
          <Code>async_confirm_buffer</Code>) scoped to a single merchant cohort. Begin with shadow-write only.
        </p>
        <p style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.55, margin: 0 }}>
          A second flag (<Code>revert_async_buffer</Code>) returns the cohort to synchronous confirmation in under 30
          seconds, with the <Code>no-data-loss</Code> invariant asserted by the reconciliation job.
        </p>
      </div>
    </div>
  );
}

function ChatMsg({
  who,
  user,
  tag,
  tagColor,
  children,
}: {
  who: string;
  user?: boolean;
  tag: string;
  tagColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div
        className="df-mono"
        style={{
          width: 18,
          height: 18,
          borderRadius: "var(--radius-xs)",
          background: user ? "var(--color-hover)" : "var(--color-heat-wash)",
          color: user ? "var(--color-dim)" : "var(--color-heat-hi)",
          display: "grid",
          placeItems: "center",
          fontSize: 10,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {who}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--color-dim)",
          lineHeight: 1.4,
          border: "1px solid var(--color-outline)",
          padding: "7px 9px",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-sink)",
          flex: 1,
        }}
      >
        <div
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "var(--tracking-label)",
            color: tagColor ?? (user ? "var(--color-faint)" : "var(--color-heat-hi)"),
            marginBottom: 3,
          }}
        >
          {tag}
        </div>
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="df-mono"
      style={{
        fontSize: 10,
        color: "var(--color-heat-soft)",
        background: "var(--color-heat-wash)",
        padding: "1px 4px",
        borderRadius: "var(--radius-xs)",
      }}
    >
      {children}
    </code>
  );
}

function AuditMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <SevBox label="› Blocker" num="1" color="var(--color-error)" />
          <SevBox label="› Warn" num="2" color="var(--color-heat-hi)" />
          <SevBox label="› Nit" num="1" color="var(--color-steel-hi)" />
        </div>
        <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", background: "var(--color-sink)" }}>
          <Finding sev="blocker">
            Proposal references Aurora but Risks rules out Aurora as a future dependency.
          </Finding>
          <Finding sev="warn">
            Risks doesn't cover the <Code>revert_async_buffer</Code> failure mode.
          </Finding>
        </div>
      </div>
      <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 14, background: "var(--color-sink)" }}>
        <XraySec name="› CONTEXT" status="VERIFIED · 1 NIT" state="verified" widths={["88%", "70%"]} />
        <XraySec name="› PROPOSAL" status="1 BLOCKER · 1 WARN" state="problem" widths={["78%", "60%"]} />
        <XraySec name="› IMPLEMENTATION" status="SCANNING…" state="scanning" widths={["86%", "74%", "58%"]} />
        <XraySec name="› RISKS" status="QUEUED" state="queued" widths={["72%", "60%"]} />
      </div>
    </div>
  );
}

function SevBox({ label, num, color }: { label: string; num: string; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-outline)",
        borderLeft: `2px solid ${color}`,
        background: "var(--color-sink)",
      }}
    >
      <div className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color }}>
        {label}
      </div>
      <div className="df-mono" style={{ fontSize: 17, color: "var(--color-text)", marginTop: 2, letterSpacing: "-0.02em" }}>
        {num}
      </div>
    </div>
  );
}

function Finding({ sev, children }: { sev: "blocker" | "warn"; children: React.ReactNode }) {
  const color = sev === "blocker" ? "var(--color-error)" : "var(--color-heat-hi)";
  const border = sev === "blocker" ? "var(--color-error-line)" : "var(--color-heat-line)";
  const bg = sev === "blocker" ? "var(--color-error-wash)" : "var(--color-heat-tint)";
  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--color-outline)",
        display: "grid",
        gridTemplateColumns: "64px 1fr",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        className="df-mono"
        style={{
          fontSize: 10,
          padding: "2px 5px",
          borderRadius: "var(--radius-xs)",
          textAlign: "center",
          border: `1px solid ${border}`,
          background: bg,
          color,
          textTransform: "uppercase",
        }}
      >
        {sev}
      </span>
      <div style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

function XraySec({
  name,
  status,
  state,
  widths,
}: {
  name: string;
  status: string;
  state: "verified" | "scanning" | "problem" | "queued";
  widths: string[];
}) {
  const border =
    state === "verified"
      ? "var(--color-steel-line)"
      : state === "scanning"
      ? "var(--color-heat-line)"
      : state === "problem"
      ? "var(--color-error-line)"
      : "var(--color-outline)";
  const bg =
    state === "verified"
      ? "var(--color-steel-wash)"
      : state === "scanning"
      ? "var(--color-heat-wash)"
      : state === "problem"
      ? "var(--color-error-tint)"
      : "transparent";
  const labColor =
    state === "verified"
      ? "var(--color-steel-hi)"
      : state === "scanning"
      ? "var(--color-heat-hi)"
      : state === "problem"
      ? "var(--color-error)"
      : "var(--color-mute)";
  const skelKind = state === "verified" ? "steel" : state === "scanning" ? "amber" : state === "problem" ? "error" : "default";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${border}`,
        background: bg,
        marginBottom: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {state === "scanning" && (
        <span
          aria-hidden
          className="animate-df-scanline"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 10,
            background: "linear-gradient(180deg, transparent, var(--color-spark-soft), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        className="df-mono"
        style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", display: "flex", justifyContent: "space-between", marginBottom: 6, color: labColor }}
      >
        <span>{name}</span>
        <span>{status}</span>
      </div>
      {widths.map((w, i) => (
        <Skel key={i} width={w} kind={skelKind} />
      ))}
    </div>
  );
}

function CompletedMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 14, minHeight: 280 }}>
      <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", padding: 12, background: "var(--color-sink)" }}>
        <div className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)", marginBottom: 10 }}>
          › SECTIONS
        </div>
        {["01 · Context", "02 · Proposal", "03 · Implementation", "04 · Risks"].map((s, i) => {
          const active = i === 0;
          return (
            <div
              key={s}
              style={{
                display: "block",
                padding: active ? "5px 8px 5px 6px" : "5px 8px",
                borderRadius: "var(--radius-xs)",
                fontSize: 11.5,
                color: active ? "var(--color-heat-soft)" : "var(--color-dim)",
                marginBottom: 2,
                background: active ? "var(--color-heat-tint)" : "transparent",
                borderLeft: active ? "2px solid var(--color-heat)" : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", background: "var(--color-sink)", overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--color-outline)",
            background: "linear-gradient(90deg, var(--color-steel-wash), var(--color-steel-tint))",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            className="df-mono"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "1.5px solid var(--color-steel)",
              display: "grid",
              placeItems: "center",
              color: "var(--color-steel-hi)",
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            RFC
          </div>
          <div>
            <div
              className="df-mono"
              style={{ fontSize: 12.5, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-steel-hi)", fontWeight: 600 }}
            >
              FORGED · v1.0
            </div>
            <div
              className="df-mono"
              style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-data)", marginTop: 2 }}
            >
              AUDIT PASSED · MAY 21, 2026 · 14:22 UTC
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <h5 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Reducing payment-path latency</h5>
          <p style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.55, margin: "0 0 8px" }}>
            Payment confirmation latency spikes to 2–4 seconds during high-traffic windows because confirmations
            synchronously call the legacy ledger before responding to the merchant.
          </p>
          <p style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.55, margin: 0 }}>
            The on-call team filed three incidents last quarter; merchant retries amplify the load and have caused
            two cascading Sev3s.
          </p>
        </div>
      </div>
    </div>
  );
}
