import { useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/shared";
import { Button, Card, Eyebrow, IconButton, Input, Page, PageHeader, Pill } from "@/components/ui";
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
import { useI18n } from "@/i18n";

const PHASES = ["discovery", "alignment", "generation", "refinement", "audit", "coherence"];

type CustomizeTab = "pipelines" | "documentTypes";
type GetToken = () => Promise<string | null>;

export function CustomizePage() {
  const { getToken } = useAuth();
  const { t } = useI18n();
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
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <TopBar dashboardNav />

      <Page>
        <PageHeader title={t("cz.title")} lead={t("cz.lead")} />

        {locked ? (
          <UpgradeNotice />
        ) : (
          <>
            <div role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--color-outline)", marginBottom: 28 }}>
              <TabButton label={t("cz.tabPipelines")} active={tab === "pipelines"} onClick={() => setTab("pipelines")} />
              <TabButton label={t("cz.tabTypes")} active={tab === "documentTypes"} onClick={() => setTab("documentTypes")} />
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
      </Page>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: "transparent",
        border: "none",
        boxShadow: active ? "inset 0 -2px 0 var(--color-heat)" : "none",
        color: active ? "var(--color-text)" : "var(--color-faint)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "color var(--duration-fast) var(--ease-forge)",
      }}
    >
      {label}
    </button>
  );
}

function UpgradeNotice() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <Card style={{ padding: "28px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 28, color: "var(--color-faint)", marginBottom: 6 }}>lock</span>
      <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{t("cz.lockedTitle")}</p>
      <p style={{ fontSize: 13, color: "var(--color-dim)", margin: "0 0 12px", maxWidth: 520 }}>{t("cz.lockedBody")}</p>
      <Button variant="primary" icon="arrow_forward" onClick={() => navigate("/billing")}>{t("cz.viewPlans")}</Button>
    </Card>
  );
}

// ─── Pipelines ────────────────────────────────────────────────

function PipelinesSection({ getToken }: { getToken: GetToken }) {
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("cz.errClone"));
    } finally {
      setCloning(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDeletePipelineDefinition(id, getToken);
      await refresh();
    } catch {
      setError(t("cz.errDelete"));
    }
  }

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-outline)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="df-input"
              value={cloneSlug}
              onChange={(e) => setCloneSlug(e.target.value)}
              aria-label={t("cz.baseType")}
              style={{ width: "auto" }}
            >
              {docTypes.map((dt) => (
                <option key={dt.slug} value={dt.slug}>{dt.name}</option>
              ))}
            </select>
            <Input
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={t("cz.pipelineName")}
              aria-label={t("cz.pipelineName")}
              style={{ flex: 1, minWidth: 160, width: "auto" }}
            />
            <Button variant="primary" icon="fork_right" iconPosition="start" onClick={handleClone} disabled={cloning}>
              {cloning ? t("cz.cloning") : t("cz.clone")}
            </Button>
          </div>
          {error && <p style={{ fontSize: 12.5, color: "var(--color-error)", margin: "8px 0 0" }}>{error}</p>}
        </div>

        <div>
          {definitions === null && <EmptyRow>{t("common.loading")}</EmptyRow>}
          {definitions && definitions.length === 0 && <EmptyRow>{t("cz.noPipelines")}</EmptyRow>}
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
  getToken: GetToken;
  docTypes: DocumentType[];
}

const PIPELINE_GROUPS = ["discovery", "alignment", "generation", "audit"];

/** Structured editor over `definition.steps` — grouped by phase in the order
 * they already appear in the array (discovery → alignment → generation →
 * audit, per clone_baseline_definition). Only `prompt` is ever rewritten by
 * the user; `phase`/`section_key`/`checkpoint` are always copied straight
 * from the original step object, so there's no client-side JSON to validate. */
function PipelineRow({ definition, isFirst, expanded, onToggle, onDelete, onSaved, getToken, docTypes }: PipelineRowProps) {
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("cz.errSave"));
    } finally {
      setSaving(false);
    }
  }

  const count = definition.steps.length;

  return (
    <div style={{ borderTop: isFirst ? "none" : "1px solid var(--color-outline)" }}>
      <div className="df-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
        <IconButton
          icon={expanded ? "expand_less" : "expand_more"}
          label={expanded ? t("folder.collapse") : t("folder.expand")}
          onClick={onToggle}
          aria-expanded={expanded}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{definition.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--color-faint)", marginTop: 2 }}>
            {count === 1 ? t("cz.step") : t("cz.steps", { count })}
            {baseDocType ? ` · ${baseDocType.name}` : ""}
          </div>
        </div>
        <Button variant="ghost" icon="delete" iconPosition="start" onClick={onDelete}>{t("common.delete")}</Button>
      </div>

      {expanded && (
        <div style={{ padding: "4px 20px 18px 54px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} aria-label={t("versions.name")} />

          {PIPELINE_GROUPS.map((phase) => {
            const groupSteps = steps
              .map((step, index) => ({ step, index }))
              .filter(({ step }) => step.phase === phase);
            if (groupSteps.length === 0) return null;
            return (
              <div key={phase}>
                <Eyebrow style={{ marginBottom: 8 }}>{t(`phase.${phase}`)}</Eyebrow>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {groupSteps.map(({ step, index }) => (
                    <div key={index} style={subCardStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>
                          {step.section_key ? sectionLabel(step.section_key) : t(`phase.${phase}`)}
                        </span>
                        {step.checkpoint === "human" && <Pill tone="warn" compact>{t("cz.humanApproval")}</Pill>}
                      </div>
                      <textarea
                        className="df-input"
                        value={step.prompt ?? ""}
                        onChange={(e) => updatePrompt(index, e.target.value)}
                        rows={4}
                        style={{ lineHeight: 1.55, resize: "vertical" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {error && <p style={{ fontSize: 12.5, color: "var(--color-error)", margin: 0 }}>{error}</p>}
          <div>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? t("versions.saving") : t("versions.saveChanges")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Document types + prompts ─────────────────────────────────

function DocumentTypesSection({ getToken }: { getToken: GetToken }) {
  const { t } = useI18n();
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

  const customTypes = (types ?? []).filter((dt) => dt.isCustom);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{t("cz.customTypes")}</h2>
        <Button icon={showCreate ? "close" : "add"} iconPosition="start" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? t("common.cancel") : t("cz.newType")}
        </Button>
      </div>

      {showCreate && (
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <CreateTypeForm getToken={getToken} onCreated={() => { setShowCreate(false); refresh(); }} />
        </div>
      )}

      <div style={cardStyle}>
        {types === null && <EmptyRow>{t("common.loading")}</EmptyRow>}
        {types && customTypes.length === 0 && <EmptyRow>{t("cz.noTypes")}</EmptyRow>}
        {types && customTypes.map((dt, i) => (
          <DocumentTypeRow key={dt.id} docType={dt} isFirst={i === 0} getToken={getToken} />
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

function CreateTypeForm({ getToken, onCreated }: { getToken: GetToken; onCreated: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([{ display_name: "", role_description: "" }]);
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
      setError(e instanceof Error ? e.message : t("cz.errCreate"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("cz.namePh")} aria-label={t("cz.namePh")} />
      <textarea
        className="df-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("cz.descPh")}
        aria-label={t("cz.descPh")}
        rows={2}
      />

      <Eyebrow style={{ marginTop: 8 }}>{t("cz.sections")}</Eyebrow>
      {sections.map((s, i) => (
        <div key={i} style={{ ...subCardStyle, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <IconButton icon="keyboard_arrow_up" label={t("cz.moveUp")} onClick={() => moveSection(i, -1)} disabled={i === 0} style={{ width: 22, height: 18 }} />
              <IconButton icon="keyboard_arrow_down" label={t("cz.moveDown")} onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} style={{ width: 22, height: 18 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input
                value={s.display_name}
                onChange={(e) => updateSection(i, { display_name: e.target.value })}
                placeholder={t("cz.sectionNamePh")}
                aria-label={t("cz.sectionNamePh")}
              />
              <div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", marginTop: 4, letterSpacing: "var(--tracking-data)" }}>
                {t("cz.key", { key: sectionKeys[i] })}
              </div>
            </div>
            <IconButton icon="close" label={t("cz.removeSection")} onClick={() => removeSection(i)} />
          </div>
          <textarea
            className="df-input"
            value={s.role_description}
            onChange={(e) => updateSection(i, { role_description: e.target.value })}
            placeholder={t("cz.rolePh")}
            aria-label={t("cz.rolePh")}
            rows={2}
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
        <Button icon="add" iconPosition="start" onClick={addSection}>{t("cz.addSection")}</Button>
      </div>

      {error && <p style={{ fontSize: 12.5, color: "var(--color-error)", margin: 0 }}>{error}</p>}
      <div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving || !name}>
          {saving ? t("common.creating") : t("cz.createType")}
        </Button>
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
  getToken: GetToken;
  onGenerated: (text: string) => void;
}) {
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("cz.errGen"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Button
        variant="ghost"
        icon="auto_awesome"
        iconPosition="start"
        onClick={handleClick}
        disabled={disabled || loading}
        title={disabled ? t("cz.genHint") : undefined}
      >
        {loading ? t("cz.generating") : t("cz.genAi")}
      </Button>
      {error && <span style={{ fontSize: 11.5, color: "var(--color-error)" }}>{error}</span>}
    </div>
  );
}

function DocumentTypeRow({ docType, isFirst, getToken }: { docType: DocumentType; isFirst: boolean; getToken: GetToken }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const count = docType.sections.length;

  return (
    <div style={{ borderTop: isFirst ? "none" : "1px solid var(--color-outline)" }}>
      <div className="df-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
        <IconButton
          icon={expanded ? "expand_less" : "expand_more"}
          label={expanded ? t("folder.collapse") : t("folder.expand")}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{docType.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--color-faint)", marginTop: 2 }}>
            <span className="df-mono" style={{ letterSpacing: "var(--tracking-data)" }}>{docType.slug}</span>
            {" · "}
            {count === 1 ? t("cz.sectionCount") : t("cz.sectionsCount", { count })}
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 16px 54px" }}>
          <p style={{ fontSize: 12.5, color: "var(--color-dim)", margin: "0 0 14px" }}>{docType.description}</p>
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
  docType: DocumentType; sectionKey: string; sectionLabel: string; getToken: GetToken;
}) {
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("cz.errPrompt"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ ...subCardStyle, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{sectionLabel}</span>
        <select
          className="df-input"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          aria-label={t("cz.phase")}
          style={{ width: "auto", padding: "4px 8px" }}
        >
          {PHASES.map((p) => <option key={p} value={p}>{t(`phase.${p}`)}</option>)}
        </select>
      </div>
      <textarea
        className="df-input"
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        placeholder={t("cz.promptPh", { section: sectionLabel, phase: t(`phase.${phase}`) })}
        aria-label={t("cz.promptPh", { section: sectionLabel, phase: t(`phase.${phase}`) })}
        rows={3}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Button onClick={handleSave} disabled={saving || !promptText.trim()}>
          {saving ? t("versions.saving") : t("cz.savePrompt")}
        </Button>
        {saved && <span role="status" style={{ fontSize: 11.5, color: "var(--color-ok)" }}>{t("cz.saved")}</span>}
        {error && <span style={{ fontSize: 11.5, color: "var(--color-error)" }}>{error}</span>}
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--color-faint)", lineHeight: 1.5 }}>{children}</div>;
}

const cardStyle: CSSProperties = {
  border: "1px solid var(--color-outline)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  overflow: "hidden",
};

/** A step or section inside a card — recessed one surface level. */
const subCardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-surface-mid)",
  border: "1px solid var(--color-outline)",
};
