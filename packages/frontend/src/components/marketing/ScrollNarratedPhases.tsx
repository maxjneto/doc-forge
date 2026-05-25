import { useEffect, useRef, useState } from "react";

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
        Before forging, the entire document is scanned for{" "}
        <strong>cross-section contradictions, terminology drift, and scope creep</strong>. Findings come in three
        severities — BLOCKER, WARN, NIT — and clicking Fix opens the workspace with the issue pre-quoted into the
        right section's chat.
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
        Stamped, exportable, and version-locked. Export to <strong>Markdown, PDF, GitHub-flavored MD, Confluence, or
        copy as Linear comment</strong>. Make edits after forging? The stamp shows drift — re-run audit to seal the
        new version. Nothing ever ships invisibly broken.
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
        borderTop: "1px solid var(--df-outline)",
        padding: "80px 0 100px",
        position: "relative",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px 60px", textAlign: "center" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-amber-300)",
            fontWeight: 600,
          }}
        >
          Path A · The Forger
        </span>
        <h2 style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", margin: "14px 0 14px" }}>
          Six phases, <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>one coherent document</em>.
        </h2>
        <p style={{ fontSize: 15, color: "var(--df-dim)", lineHeight: 1.6, maxWidth: 600, margin: "0 auto" }}>
          Scroll through the pipeline. The timeline on the left lights up as each phase comes into view.
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
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--df-faint)",
              marginBottom: 20,
            }}
          >
            › The Forge Pipeline
          </div>
          <div
            style={{
              height: 5,
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--df-outline)",
              overflow: "hidden",
              marginBottom: 22,
              position: "relative",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, var(--df-amber-700), var(--df-amber-500) 60%, var(--df-amber-300))",
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
                  background: "linear-gradient(90deg, transparent, rgba(255,217,184,0.85))",
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
                background: "var(--df-outline)",
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
                      border: state === "future" ? "1px solid var(--df-mute)" : "none",
                      background:
                        state === "now"
                          ? "var(--df-amber-500)"
                          : state === "done"
                          ? "var(--df-amber-trail)"
                          : "#050608",
                      display: "grid",
                      placeItems: "center",
                      zIndex: 2,
                      fontSize: 9,
                      fontWeight: 600,
                      color: state === "future" ? "var(--df-mute)" : state === "done" ? "#050608" : "#fff",
                      boxShadow:
                        state === "now"
                          ? "0 0 0 4px rgba(255,77,0,0.15), 0 0 18px rgba(255,77,0,0.50)"
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
                        fontSize: 9.5,
                        letterSpacing: "0.16em",
                        color:
                          state === "now"
                            ? "var(--df-amber-500)"
                            : state === "done"
                            ? "var(--df-amber-trail)"
                            : "var(--df-mute)",
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
                            ? "#e3e2e2"
                            : state === "done"
                            ? "var(--df-on-soft, #c6c5c4)"
                            : "var(--df-mute)",
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
                    color: "var(--df-amber-trail)",
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
                      fontSize: 10.5,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: p.num === "06" ? "var(--df-steel-100)" : "var(--df-amber-300)",
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
              <p style={{ fontSize: 15, color: "var(--df-dim)", lineHeight: 1.65, maxWidth: 580, margin: "14px 0 26px" }}>
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
        border: "1px solid var(--df-outline)",
        borderRadius: 14,
        background: "rgba(14,16,17,0.55)",
        backdropFilter: "blur(6px)",
        padding: "24px 26px",
        overflow: "hidden",
        boxShadow: "0 24px 60px -16px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 14,
          marginBottom: 16,
          borderBottom: "1px solid var(--df-outline)",
        }}
      >
        <span
          className="df-mono"
          style={{ fontSize: 11, color: "var(--df-amber-300)", letterSpacing: "0.10em", textTransform: "uppercase" }}
        >
          {title}
        </span>
        <span className="df-pill df-pill-heat">{pill}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Per-phase mocks ─────────────────────────────────────── */

function Skel({ width, kind = "default" }: { width: string; kind?: "default" | "amber" | "steel" | "dim" | "error" }) {
  const bg = {
    default: "rgba(255,255,255,0.05)",
    amber: "rgba(255,77,0,0.25)",
    steel: "rgba(138,160,184,0.25)",
    dim: "rgba(255,255,255,0.03)",
    error: "rgba(232,100,100,0.20)",
  }[kind];
  return (
    <span style={{ display: "block", height: 6, borderRadius: 2, background: bg, marginBottom: 6, width }} />
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
        border: `1px solid ${active ? "rgba(255,77,0,0.35)" : "var(--df-outline)"}`,
        borderRadius: 8,
        padding: "12px 14px",
        background: active ? "rgba(255,77,0,0.05)" : "rgba(0,0,0,0.20)",
        marginBottom: 8,
        opacity: dim ? 0.6 : 1,
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 9.5,
          color: active ? "var(--df-amber-300)" : "var(--df-faint)",
          letterSpacing: "0.10em",
          marginBottom: 6,
        }}
      >
        {qn}
      </div>
      <div style={{ fontSize: 11.5, color: "#e3e2e2", lineHeight: 1.4, marginBottom: 6 }}>{q}</div>
      <div style={{ fontSize: 10.5, color: italic ? "var(--df-faint)" : "var(--df-dim)", lineHeight: 1.4, fontStyle: italic ? "italic" : "normal" }}>
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
    state === "heating" ? "rgba(255,77,0,0.45)" : state === "heated" ? "rgba(255,77,0,0.30)" : "var(--df-outline)";
  const bg =
    state === "heating" ? "rgba(255,77,0,0.08)" : state === "heated" ? "rgba(255,77,0,0.05)" : "transparent";
  const labColor =
    state === "heating" ? "var(--df-amber-300)" : state === "heated" ? "var(--df-amber-trail)" : "var(--df-faint)";
  const skelKind = state === "cold" ? "dim" : "amber";
  return (
    <div style={{ padding: "10px 12px", border: `1px solid ${border}`, borderRadius: 6, background: bg }}>
      <div
        className="df-mono"
        style={{ fontSize: 9, letterSpacing: "0.14em", color: labColor, marginBottom: 6, display: "flex", justifyContent: "space-between" }}
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
    state === "approved" ? "var(--df-steel-border)" : state === "revising" ? "rgba(255,77,0,0.30)" : "var(--df-outline)";
  const bg =
    state === "approved"
      ? "linear-gradient(180deg, rgba(138,160,184,0.05), rgba(0,0,0,0.20))"
      : "rgba(0,0,0,0.20)";
  const pillClass =
    state === "approved" ? "df-pill df-pill-steel" : state === "revising" ? "df-pill df-pill-heat" : "df-pill df-pill-ghost";
  const skelKind = state === "approved" ? "steel" : state === "revising" ? "amber" : "default";
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 8,
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
            background: "linear-gradient(120deg, transparent, rgba(255,77,0,0.07), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="df-mono" style={{ fontSize: 10, letterSpacing: "0.10em", color: "#e3e2e2" }}>
          {name}
        </span>
        <span className={pillClass} style={{ padding: "2px 6px" }}>{pill}</span>
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
        borderTop: "1px solid var(--df-outline)",
      }}
    >
      <span
        className="df-mono"
        style={{ color: isComplete ? "var(--df-amber-trail)" : isQueued ? "var(--df-mute)" : "var(--df-amber-300)" }}
      >
        ›
      </span>
      <span style={{ fontSize: 12, color: isQueued ? "var(--df-faint)" : isComplete ? "var(--df-on-soft, #c6c5c4)" : "#e3e2e2" }}>
        {label}
      </span>
      <span
        className="df-mono"
        style={{
          fontSize: 10,
          color: isComplete ? "var(--df-amber-trail)" : isQueued ? "var(--df-mute)" : "var(--df-amber-300)",
          textAlign: "right",
          letterSpacing: "0.04em",
        }}
      >
        {clock}
      </span>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--df-outline)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!isQueued && (
          <div
            className={isLive ? "animate-df-pour-fill" : undefined}
            style={{
              height: "100%",
              borderRadius: 999,
              width: isComplete ? "100%" : width ?? "0%",
              background: isComplete
                ? "var(--df-amber-trail)"
                : "linear-gradient(90deg, var(--df-amber-700), var(--df-amber-500) 60%, var(--df-amber-300))",
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
                  background: "linear-gradient(90deg, transparent, rgba(255,217,184,0.85))",
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
          border: "1px solid var(--df-outline)",
          borderRadius: 6,
          padding: 12,
          background: "rgba(0,0,0,0.20)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <ChatMsg who="AI" tag="› ANALYSIS" tagColor="var(--df-steel-100)">
          Drafted three implementation steps. Want me to expand the rollout, or tighten the rollback path first?
        </ChatMsg>
        <ChatMsg who="SC" user tag="› YOU">
          Tighten rollback. Add a fast revert flag.
        </ChatMsg>
        <ChatMsg who="AI" tag="› EDIT">
          Updated step 2 with a{" "}
          <code
            className="df-mono"
            style={{ fontSize: 9, color: "var(--df-amber-200)", background: "rgba(255,77,0,0.08)", padding: "1px 4px", borderRadius: 3 }}
          >
            revert_async_buffer
          </code>{" "}
          flag.
        </ChatMsg>
      </div>
      <div style={{ border: "1px solid var(--df-outline)", borderRadius: 6, padding: 16, background: "rgba(0,0,0,0.30)" }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Implementation</h4>
        <div
          className="df-mono"
          style={{ fontSize: 9.5, color: "var(--df-faint)", letterSpacing: "0.10em", marginBottom: 14 }}
        >
          SECTION 03 · V3 OF 5 · LAST EDITED 32S AGO
        </div>
        <p style={{ fontSize: 11.5, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.55, margin: "0 0 8px" }}>
          Roll the asynchronous confirmation buffer behind a feature flag (
          <Code>async_confirm_buffer</Code>) scoped to a single merchant cohort. Begin with shadow-write only.
        </p>
        <p style={{ fontSize: 11.5, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.55, margin: 0 }}>
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
          borderRadius: 3,
          background: user ? "rgba(255,255,255,0.05)" : "rgba(255,77,0,0.12)",
          color: user ? "var(--df-on-soft, #c6c5c4)" : "var(--df-amber-300)",
          display: "grid",
          placeItems: "center",
          fontSize: 8,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {who}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--df-on-soft, #c6c5c4)",
          lineHeight: 1.4,
          border: "1px solid var(--df-outline)",
          padding: "7px 9px",
          borderRadius: 5,
          background: "rgba(0,0,0,0.15)",
          flex: 1,
        }}
      >
        <div
          className="df-mono"
          style={{
            fontSize: 8,
            letterSpacing: "0.10em",
            color: tagColor ?? (user ? "var(--df-faint)" : "var(--df-amber-300)"),
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
        color: "var(--df-amber-200)",
        background: "rgba(255,77,0,0.08)",
        padding: "1px 4px",
        borderRadius: 3,
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
          <SevBox label="› Blocker" num="1" color="var(--df-error)" />
          <SevBox label="› Warn" num="2" color="var(--df-amber-300)" />
          <SevBox label="› Nit" num="1" color="var(--df-steel-100)" />
        </div>
        <div style={{ border: "1px solid var(--df-outline)", borderRadius: 8, background: "rgba(0,0,0,0.20)" }}>
          <Finding sev="blocker">
            Proposal references Aurora but Risks rules out Aurora as a future dependency.
          </Finding>
          <Finding sev="warn">
            Risks doesn't cover the <Code>revert_async_buffer</Code> failure mode.
          </Finding>
        </div>
      </div>
      <div style={{ border: "1px solid var(--df-outline)", borderRadius: 8, padding: 14, background: "rgba(0,0,0,0.20)" }}>
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
        borderRadius: 6,
        border: "1px solid var(--df-outline)",
        borderLeft: `2px solid ${color}`,
        background: "rgba(0,0,0,0.15)",
      }}
    >
      <div className="df-mono" style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
        {label}
      </div>
      <div className="df-mono" style={{ fontSize: 18, color: "#e3e2e2", marginTop: 2, letterSpacing: "-0.02em" }}>
        {num}
      </div>
    </div>
  );
}

function Finding({ sev, children }: { sev: "blocker" | "warn"; children: React.ReactNode }) {
  const color = sev === "blocker" ? "var(--df-error)" : "var(--df-amber-300)";
  const border = sev === "blocker" ? "rgba(232,100,100,0.40)" : "rgba(255,77,0,0.30)";
  const bg = sev === "blocker" ? "rgba(232,100,100,0.08)" : "rgba(255,77,0,0.06)";
  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--df-outline)",
        display: "grid",
        gridTemplateColumns: "64px 1fr",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        className="df-mono"
        style={{
          fontSize: 8.5,
          padding: "2px 5px",
          borderRadius: 3,
          textAlign: "center",
          border: `1px solid ${border}`,
          background: bg,
          color,
          textTransform: "uppercase",
        }}
      >
        {sev}
      </span>
      <div style={{ fontSize: 11, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.45 }}>{children}</div>
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
      ? "var(--df-steel-border)"
      : state === "scanning"
      ? "rgba(255,77,0,0.45)"
      : state === "problem"
      ? "rgba(232,100,100,0.40)"
      : "var(--df-outline)";
  const bg =
    state === "verified"
      ? "var(--df-steel-bg)"
      : state === "scanning"
      ? "rgba(255,77,0,0.08)"
      : state === "problem"
      ? "rgba(232,100,100,0.05)"
      : "transparent";
  const labColor =
    state === "verified"
      ? "var(--df-steel-100)"
      : state === "scanning"
      ? "var(--df-amber-300)"
      : state === "problem"
      ? "var(--df-error)"
      : "var(--df-mute)";
  const skelKind = state === "verified" ? "steel" : state === "scanning" ? "amber" : state === "problem" ? "error" : "default";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 6,
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
            background: "linear-gradient(180deg, transparent, rgba(255,217,184,0.50), transparent)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        className="df-mono"
        style={{ fontSize: 9, letterSpacing: "0.14em", display: "flex", justifyContent: "space-between", marginBottom: 6, color: labColor }}
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
      <div style={{ border: "1px solid var(--df-outline)", borderRadius: 6, padding: 12, background: "rgba(0,0,0,0.20)" }}>
        <div className="df-mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--df-faint)", marginBottom: 10 }}>
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
                borderRadius: 4,
                fontSize: 11.5,
                color: active ? "var(--df-amber-200)" : "var(--df-dim)",
                marginBottom: 2,
                background: active ? "rgba(255,77,0,0.05)" : "transparent",
                borderLeft: active ? "2px solid var(--df-amber-500)" : "none",
              }}
            >
              {s}
            </div>
          );
        })}
      </div>
      <div style={{ border: "1px solid var(--df-outline)", borderRadius: 6, background: "rgba(0,0,0,0.20)", overflow: "hidden" }}>
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--df-outline)",
            background: "linear-gradient(90deg, rgba(138,160,184,0.10), rgba(138,160,184,0.04))",
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
              border: "1.5px solid var(--df-steel-200)",
              display: "grid",
              placeItems: "center",
              color: "var(--df-steel-100)",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            RFC
          </div>
          <div>
            <div
              className="df-mono"
              style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--df-steel-100)", fontWeight: 600 }}
            >
              FORGED · v1.0
            </div>
            <div
              className="df-mono"
              style={{ fontSize: 9, color: "var(--df-faint)", letterSpacing: "0.06em", marginTop: 2 }}
            >
              AUDIT PASSED · MAY 21, 2026 · 14:22 UTC
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 18px" }}>
          <h5 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>Reducing payment-path latency</h5>
          <p style={{ fontSize: 11.5, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.55, margin: "0 0 8px" }}>
            Payment confirmation latency spikes to 2–4 seconds during high-traffic windows because confirmations
            synchronously call the legacy ledger before responding to the merchant.
          </p>
          <p style={{ fontSize: 11.5, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.55, margin: 0 }}>
            The on-call team filed three incidents last quarter; merchant retries amplify the load and have caused
            two cascading Sev3s.
          </p>
        </div>
      </div>
    </div>
  );
}
