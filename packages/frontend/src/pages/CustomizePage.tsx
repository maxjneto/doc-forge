import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/shared";
import {
  apiFetchMe,
  apiListDocumentTypes,
  apiCreateDocumentType,
  apiUpsertPrompt,
  apiListPipelineDefinitions,
  apiClonePipelineDefinition,
  apiUpdatePipelineDefinition,
  apiDeletePipelineDefinition,
} from "@/utils/api";
import type { DocumentType, PipelineDefinition, PipelineStep } from "@/types";

const PHASES = ["discovery", "alignment", "generation", "refinement", "audit", "coherence"];

export function CustomizePage() {
  const { getToken } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetchMe(getToken).then((me) => { if (!cancelled) setPlan(me.plan); }).catch(() => {});
    return () => { cancelled = true; };
  }, [getToken]);

  const locked = plan !== null && plan === "free";

  return (
    <div style={{ minHeight: "100vh", background: "var(--df-bg, #0a0b0c)", color: "#e3e2e2", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
      <TopBar dashboardNav />

      <main style={{ flex: 1, paddingTop: 56 + 36, paddingBottom: 80, paddingLeft: 56, paddingRight: 56, maxWidth: 960, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>Customize</h1>
          <p style={{ fontSize: 13, color: "var(--df-dim)", margin: 0 }}>
            Clone the BYOA pipeline, define your own document types, and edit the prompts your agent reads at each step.
          </p>
        </div>

        {locked ? (
          <UpgradeNotice />
        ) : (
          <>
            <PipelinesSection getToken={getToken} />
            <DocumentTypesSection getToken={getToken} />
          </>
        )}
      </main>
    </div>
  );
}

function UpgradeNotice() {
  return (
    <div style={{ ...cardStyle, padding: "24px 20px", textAlign: "center" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--df-amber-300)", marginBottom: 10, display: "block" }}>
        lock
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>Custom pipelines, document types, and prompts are a Pro feature.</p>
      <p style={{ fontSize: 13, color: "var(--df-dim)", margin: "0 0 16px" }}>
        Upgrade to clone the baseline pipeline, edit its prompts, and define your own document types.
      </p>
      <Link
        to="/billing"
        className="forge-btn"
        style={{ display: "inline-flex", padding: "8px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
      >
        View plans
      </Link>
    </div>
  );
}

// ─── Pipelines ────────────────────────────────────────────────

function PipelinesSection({ getToken }: { getToken: () => Promise<string | null> }) {
  const [definitions, setDefinitions] = useState<PipelineDefinition[] | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [cloneSlug, setCloneSlug] = useState("rfc");
  const [cloneName, setCloneName] = useState("");
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setDefinitions(await apiListPipelineDefinitions(getToken));
    } catch {
      setDefinitions([]);
    }
  }

  useEffect(() => {
    refresh();
    apiListDocumentTypes().then(setDocTypes).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClone() {
    setCloning(true);
    setError(null);
    try {
      await apiClonePipelineDefinition(cloneSlug, cloneName.trim() || null, getToken);
      setCloneName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clone pipeline");
    } finally {
      setCloning(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDeletePipelineDefinition(id, getToken);
      await refresh();
    } catch {
      setError("Failed to delete pipeline");
    }
  }

  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 14px" }}>Pipelines</h2>
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--df-outline)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={cloneSlug}
              onChange={(e) => setCloneSlug(e.target.value)}
              style={selectStyle}
            >
              {docTypes.map((dt) => (
                <option key={dt.slug} value={dt.slug}>{dt.name}</option>
              ))}
            </select>
            <input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="Pipeline name (optional)"
              style={{ ...inputStyle, flex: 1, minWidth: 160 }}
            />
            <button onClick={handleClone} disabled={cloning} style={primaryBtnStyle}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fork_right</span>
              {cloning ? "Cloning…" : "Clone baseline"}
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: "var(--df-error, #f55)", margin: "8px 0 0" }}>{error}</p>}
        </div>

        <div>
          {definitions === null && <EmptyRow>Loading…</EmptyRow>}
          {definitions && definitions.length === 0 && (
            <EmptyRow>No custom pipelines yet. Clone a baseline above to start editing steps.</EmptyRow>
          )}
          {definitions && definitions.map((d, i) => (
            <PipelineRow
              key={d.id}
              definition={d}
              isFirst={i === 0}
              expanded={editingId === d.id}
              onToggle={() => setEditingId(editingId === d.id ? null : d.id)}
              onDelete={() => handleDelete(d.id)}
              onSaved={refresh}
              getToken={getToken}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface PipelineRowProps {
  definition: PipelineDefinition;
  isFirst: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSaved: () => void;
  getToken: () => Promise<string | null>;
}

function PipelineRow({ definition, isFirst, expanded, onToggle, onDelete, onSaved, getToken }: PipelineRowProps) {
  const [stepsJson, setStepsJson] = useState(() => JSON.stringify(definition.steps, null, 2));
  const [nameDraft, setNameDraft] = useState(definition.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const steps = JSON.parse(stepsJson) as PipelineStep[];
      await apiUpdatePipelineDefinition(definition.id, { name: nameDraft, steps }, getToken);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid steps JSON");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ borderTop: isFirst ? "none" : "1px solid var(--df-outline)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px" }}>
        <button onClick={onToggle} style={{ ...ghostBtnStyle, border: "none", padding: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>{definition.name}</div>
          <div className="df-mono" style={{ fontSize: 10, color: "var(--df-faint)", marginTop: 2 }}>
            {definition.steps.length} steps
          </div>
        </div>
        <button onClick={onDelete} style={{ ...ghostBtnStyle, color: "var(--df-faint)" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
          Delete
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            style={inputStyle}
          />
          <textarea
            value={stepsJson}
            onChange={(e) => setStepsJson(e.target.value)}
            rows={12}
            className="df-mono"
            style={{ ...inputStyle, fontSize: 11.5, lineHeight: 1.5, resize: "vertical" }}
          />
          <p style={{ fontSize: 11, color: "var(--df-faint)", margin: 0 }}>
            Each step: <code className="df-mono">{"{ phase, section_key?, prompt?, checkpoint? }"}</code>. Set <code className="df-mono">prompt</code> to override the default instructions for that step.
          </p>
          {error && <p style={{ fontSize: 12, color: "var(--df-error, #f55)", margin: 0 }}>{error}</p>}
          <div>
            <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document types + prompts ─────────────────────────────────

function DocumentTypesSection({ getToken }: { getToken: () => Promise<string | null> }) {
  const [types, setTypes] = useState<DocumentType[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function refresh() {
    try {
      setTypes(await apiListDocumentTypes());
    } catch {
      setTypes([]);
    }
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const customTypes = (types ?? []).filter((t) => t.isCustom);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: 0 }}>Custom document types</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={ghostBtnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showCreate ? "close" : "add"}</span>
          {showCreate ? "Cancel" : "New type"}
        </button>
      </div>

      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <CreateTypeForm
            getToken={getToken}
            onCreated={() => { setShowCreate(false); refresh(); }}
          />
        </div>
      )}

      <div style={cardStyle}>
        {types === null && <EmptyRow>Loading…</EmptyRow>}
        {types && customTypes.length === 0 && (
          <EmptyRow>No custom document types yet. Create one to expose it to the pipeline and MCP.</EmptyRow>
        )}
        {types && customTypes.map((t, i) => (
          <DocumentTypeRow key={t.id} docType={t} isFirst={i === 0} getToken={getToken} />
        ))}
      </div>
    </section>
  );
}

interface SectionDraft {
  section_key: string;
  display_name: string;
  order: number;
  role_description: string;
}

function CreateTypeForm({ getToken, onCreated }: { getToken: () => Promise<string | null>; onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([
    { section_key: "", display_name: "", order: 1, role_description: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSection(i: number, patch: Partial<SectionDraft>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { section_key: "", display_name: "", order: prev.length + 1, role_description: "" }]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await apiCreateDocumentType({ slug, name, description, sections }, getToken);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create document type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (e.g. adr)" style={{ ...inputStyle, flex: 1 }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. ADR)" style={{ ...inputStyle, flex: 1 }} />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        style={inputStyle}
      />

      <div className="df-mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--df-faint)", textTransform: "uppercase", marginTop: 6 }}>
        Sections
      </div>
      {sections.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            value={s.section_key}
            onChange={(e) => updateSection(i, { section_key: e.target.value })}
            placeholder="section_key"
            style={{ ...inputStyle, width: 110 }}
          />
          <input
            value={s.display_name}
            onChange={(e) => updateSection(i, { display_name: e.target.value })}
            placeholder="Display name"
            style={{ ...inputStyle, width: 140 }}
          />
          <input
            type="number"
            value={s.order}
            onChange={(e) => updateSection(i, { order: Number(e.target.value) })}
            style={{ ...inputStyle, width: 60 }}
          />
          <input
            value={s.role_description}
            onChange={(e) => updateSection(i, { role_description: e.target.value })}
            placeholder="What this section should contain"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => removeSection(i)} style={{ ...ghostBtnStyle, border: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      ))}
      <div>
        <button onClick={addSection} style={ghostBtnStyle}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          Add section
        </button>
      </div>

      {error && <p style={{ fontSize: 12, color: "var(--df-error, #f55)", margin: 0 }}>{error}</p>}
      <div>
        <button onClick={handleSubmit} disabled={saving || !slug || !name} style={primaryBtnStyle}>
          {saving ? "Creating…" : "Create document type"}
        </button>
      </div>
    </div>
  );
}

function DocumentTypeRow({ docType, isFirst, getToken }: { docType: DocumentType; isFirst: boolean; getToken: () => Promise<string | null> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ borderTop: isFirst ? "none" : "1px solid var(--df-outline)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px" }}>
        <button onClick={() => setExpanded(!expanded)} style={{ ...ghostBtnStyle, border: "none", padding: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13 }}>{docType.name}</div>
          <div className="df-mono" style={{ fontSize: 10, color: "var(--df-faint)", marginTop: 2 }}>
            {docType.slug} · {docType.sections.length} section{docType.sections.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 16px" }}>
          <p style={{ fontSize: 12.5, color: "var(--df-dim)", margin: "0 0 14px" }}>{docType.description}</p>
          {docType.sections.map((s) => (
            <PromptEditor key={s.sectionKey} docType={docType} sectionKey={s.sectionKey} sectionLabel={s.displayName} getToken={getToken} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptEditor({
  docType, sectionKey, sectionLabel, getToken,
}: {
  docType: DocumentType; sectionKey: string; sectionLabel: string; getToken: () => Promise<string | null>;
}) {
  const [phase, setPhase] = useState("generation");
  const [promptText, setPromptText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!promptText.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiUpsertPrompt(docType.slug, { phase, section_key: sectionKey, prompt_text: promptText }, getToken);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save prompt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--df-outline)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{sectionLabel}</span>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ ...selectStyle, padding: "4px 8px", fontSize: 11 }}>
          {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <textarea
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        placeholder={`Prompt override for ${sectionLabel} / ${phase}…`}
        rows={3}
        style={{ ...inputStyle, fontSize: 12 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <button onClick={handleSave} disabled={saving || !promptText.trim()} style={{ ...primaryBtnStyle, padding: "5px 12px", fontSize: 11 }}>
          {saving ? "Saving…" : "Save prompt"}
        </button>
        {saved && <span style={{ fontSize: 11, color: "#50c878" }}>Saved</span>}
        {error && <span style={{ fontSize: 11, color: "var(--df-error, #f55)" }}>{error}</span>}
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 20px", fontSize: 12, color: "var(--df-faint)", lineHeight: 1.5 }}>{children}</div>;
}

const cardStyle: CSSProperties = {
  border: "1px solid var(--df-outline)",
  borderRadius: 12,
  background: "rgba(18,20,20,0.5)",
  overflow: "hidden",
};

const ghostBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  background: "transparent",
  border: "1px solid var(--df-outline-md, rgba(255,255,255,0.09))",
  borderRadius: 6,
  color: "var(--df-dim)",
  cursor: "pointer",
  fontSize: 11.5,
  fontFamily: "inherit",
};

const primaryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  background: "var(--df-amber-500)",
  color: "#fff",
  border: "1px solid var(--df-amber-500)",
  cursor: "pointer",
  fontFamily: "inherit",
};

const inputStyle: CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--df-outline)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "#e3e2e2",
  fontSize: 12.5,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  width: "100%",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  width: "auto",
};
