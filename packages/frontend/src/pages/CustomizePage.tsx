import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { TopBar } from "@/components/shared";
import {
  apiFetchMe,
  apiListDocumentTypes,
  apiCreateDocumentType,
  apiUpsertPrompt,
  apiGenerateSectionSummary,
  apiListPipelineDefinitions,
  apiClonePipelineDefinition,
  apiUpdatePipelineDefinition,
  apiDeletePipelineDefinition,
} from "@/utils/api";
import type { DocumentType, PipelineDefinition, PipelineStep } from "@/types";

const PHASES = ["discovery", "alignment", "generation", "refinement", "audit", "coherence"];

type CustomizeTab = "pipelines" | "documentTypes";

export function CustomizePage() {
  const { getToken } = useAuth();
  const [plan, setPlan] = useState<string | null>(null);
  const [tab, setTab] = useState<CustomizeTab>("pipelines");

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
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--df-outline)", marginBottom: 28 }}>
              <TabButton label="Pipelines" active={tab === "pipelines"} onClick={() => setTab("pipelines")} />
              <TabButton label="Document types" active={tab === "documentTypes"} onClick={() => setTab("documentTypes")} />
            </div>
            {/* Both sections stay mounted; switching tabs only toggles display,
                so neither refetches on every tab switch. */}
            <div style={{ display: tab === "pipelines" ? "block" : "none" }}>
              <PipelinesSection getToken={getToken} />
            </div>
            <div style={{ display: tab === "documentTypes" ? "block" : "none" }}>
              <DocumentTypesSection getToken={getToken} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--df-amber-500)" : "transparent"}`,
        color: active ? "#e3e2e2" : "var(--df-faint)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
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
    apiListDocumentTypes(getToken).then(setDocTypes).catch(() => {});
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
              docTypes={docTypes}
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
  docTypes: DocumentType[];
}

const PIPELINE_GROUPS: { phase: string; label: string }[] = [
  { phase: "discovery", label: "Discovery" },
  { phase: "alignment", label: "Alignment" },
  { phase: "generation", label: "Generation" },
  { phase: "audit", label: "Audit" },
];

/** Structured editor over `definition.steps` — grouped by phase in the order
 * they already appear in the array (discovery → alignment → generation →
 * audit, per clone_baseline_definition). Only `prompt` is ever rewritten by
 * the user; `phase`/`section_key`/`checkpoint` are always copied straight
 * from the original step object, so there's no client-side JSON to validate. */
function PipelineRow({ definition, isFirst, expanded, onToggle, onDelete, onSaved, getToken, docTypes }: PipelineRowProps) {
  const baseDocType = docTypes.find((dt) => dt.id === definition.baseDocumentTypeId) ?? null;
  const [nameDraft, setNameDraft] = useState(definition.name);
  const [steps, setSteps] = useState<PipelineStep[]>(() => definition.steps.map((s) => ({ ...s })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function sectionLabel(key: string | null | undefined): string {
    if (!key) return "";
    return baseDocType?.sections.find((s) => s.sectionKey === key)?.displayName ?? key;
  }

  function updatePrompt(index: number, prompt: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, prompt } : s)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await apiUpdatePipelineDefinition(definition.id, { name: nameDraft, steps }, getToken);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pipeline");
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
        <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            style={inputStyle}
          />

          {PIPELINE_GROUPS.map((group) => {
            const groupSteps = steps
              .map((step, index) => ({ step, index }))
              .filter(({ step }) => step.phase === group.phase);
            if (groupSteps.length === 0) return null;
            return (
              <div key={group.phase}>
                <div className="df-mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--df-faint)", marginBottom: 8 }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupSteps.map(({ step, index }) => (
                    <div
                      key={index}
                      style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--df-outline)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>
                          {step.section_key ? sectionLabel(step.section_key) : group.label}
                        </span>
                        {step.checkpoint === "human" && (
                          <span
                            className="df-mono"
                            style={{ fontSize: 9.5, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: "rgba(255,196,0,0.12)", color: "#ffd25e" }}
                          >
                            requires human approval
                          </span>
                        )}
                      </div>
                      <textarea
                        value={step.prompt ?? ""}
                        onChange={(e) => updatePrompt(index, e.target.value)}
                        rows={4}
                        style={{ ...inputStyle, fontSize: 12, lineHeight: 1.5, resize: "vertical" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

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
      setTypes(await apiListDocumentTypes(getToken));
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
  display_name: string;
  role_description: string;
}

function slugifySectionKey(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug || "section";
}

/** Derive unique section_keys for the whole draft list in one pass —
 * duplicates (e.g. two sections both named "Notes") get -2, -3, ... suffixes,
 * since the backend requires section_key to be unique per request. */
function computeSectionKeys(sections: SectionDraft[]): string[] {
  const counts: Record<string, number> = {};
  return sections.map((s) => {
    const base = slugifySectionKey(s.display_name);
    const count = (counts[base] ?? 0) + 1;
    counts[base] = count;
    return count === 1 ? base : `${base}-${count}`;
  });
}

function CreateTypeForm({ getToken, onCreated }: { getToken: () => Promise<string | null>; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([
    { display_name: "", role_description: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionKeys = computeSectionKeys(sections);

  function updateSection(i: number, patch: Partial<SectionDraft>) {
    setSections((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { display_name: "", role_description: "" }]);
  }

  function removeSection(i: number) {
    setSections((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveSection(i: number, dir: -1 | 1) {
    setSections((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      await apiCreateDocumentType({
        name,
        description,
        sections: sections.map((s, i) => ({
          section_key: sectionKeys[i],
          display_name: s.display_name,
          order: i + 1,
          role_description: s.role_description,
        })),
      }, getToken);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create document type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. ADR)" style={inputStyle} />
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
        <div
          key={i}
          style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--df-outline)", display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button onClick={() => moveSection(i, -1)} disabled={i === 0} style={reorderBtnStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_up</span>
              </button>
              <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} style={reorderBtnStyle}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_down</span>
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={s.display_name}
                onChange={(e) => updateSection(i, { display_name: e.target.value })}
                placeholder="Display name (e.g. Context)"
                style={inputStyle}
              />
              <div className="df-mono" style={{ fontSize: 10, color: "var(--df-faint)", marginTop: 4 }}>
                key: {sectionKeys[i]}
              </div>
            </div>
            <button onClick={() => removeSection(i)} style={{ ...ghostBtnStyle, border: "none" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
          <textarea
            value={s.role_description}
            onChange={(e) => updateSection(i, { role_description: e.target.value })}
            placeholder="What this section should contain"
            rows={2}
            style={inputStyle}
          />
          <SectionRoleGenButton
            documentTypeName={name}
            documentTypeDescription={description}
            sectionDisplayName={s.display_name}
            getToken={getToken}
            onGenerated={(text) => updateSection(i, { role_description: text })}
          />
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
        <button onClick={handleSubmit} disabled={saving || !name} style={primaryBtnStyle}>
          {saving ? "Creating…" : "Create document type"}
        </button>
      </div>
    </div>
  );
}

function SectionRoleGenButton({
  documentTypeName, documentTypeDescription, sectionDisplayName, getToken, onGenerated,
}: {
  documentTypeName: string;
  documentTypeDescription: string;
  sectionDisplayName: string;
  getToken: () => Promise<string | null>;
  onGenerated: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !documentTypeName.trim() || !documentTypeDescription.trim() || !sectionDisplayName.trim();

  async function handleClick() {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const text = await apiGenerateSectionSummary({
        document_type_name: documentTypeName,
        document_type_description: documentTypeDescription,
        section_display_name: sectionDisplayName,
      }, getToken);
      onGenerated(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        title={disabled ? "Fill in the type's name, description, and this section's display name first" : undefined}
        style={{ ...ghostBtnStyle, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
        {loading ? "Generating…" : "Generate with AI"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--df-error, #f55)" }}>{error}</span>}
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

const reorderBtnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 20,
  height: 16,
  padding: 0,
  background: "transparent",
  border: "1px solid var(--df-outline-md, rgba(255,255,255,0.09))",
  borderRadius: 4,
  color: "var(--df-dim)",
  cursor: "pointer",
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
