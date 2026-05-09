import { Icon } from "../shared";
import { useWorkspaceStore, SECTION_LABELS } from "@/store";
import type { SectionType, SectionVersion } from "@/types";

// ─── Version Node ────────────────────────────────────────────

interface VersionNodeProps {
  version: SectionVersion;
  onRestore: (versionId: string) => void;
}

function VersionNode({ version, onRestore }: VersionNodeProps) {
  if (version.isActive) {
    return (
      <div className="relative pl-6">
        <div className="absolute left-0 top-[-12px] w-4 h-[22px] border-l border-b border-neutral-800 rounded-bl-lg" />
        <div
          className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-2 py-1.5 cursor-pointer"
          onClick={() => onRestore(version.id)}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="font-mono text-[11px] text-primary font-medium">
              {version.versionName}
            </span>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-tighter font-bold">
            Active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative pl-6 group opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
      onClick={() => onRestore(version.id)}
    >
      <div className="absolute left-0 top-[-12px] w-4 h-[22px] border-l border-b border-neutral-800 rounded-bl-lg" />
      <div className="flex items-center gap-2 hover:bg-neutral-800/30 p-1 rounded transition-colors">
        <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
        <span className="font-mono text-[11px] text-on-surface-variant/80 group-hover:text-on-surface">
          {version.versionName}
        </span>
      </div>
    </div>
  );
}

// ─── Section Node ────────────────────────────────────────────

interface SectionNodeProps {
  sectionType: SectionType;
  status: "pending" | "drafting" | "refining" | "finalized";
  isActive: boolean;
  onClick: () => void;
}

function SectionNode({ sectionType, status, isActive, onClick }: SectionNodeProps) {
  const label = SECTION_LABELS[sectionType];

  if (status === "finalized") {
    return (
      <div className="relative pl-8 group cursor-pointer" onClick={onClick}>
        <div className="absolute left-0 top-0.5 w-4 h-4 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center z-10">
          <Icon name="check" className="!text-[10px] text-green-500 font-bold" />
        </div>
        <span
          className={`text-sm font-medium transition-colors ${
            isActive ? "text-on-surface" : "text-on-surface-variant/80 group-hover:text-on-surface"
          }`}
        >
          {label}
        </span>
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="relative pl-8 cursor-pointer" onClick={onClick}>
        <div className="absolute left-0 top-0.5 w-4 h-4 rounded-full bg-background border-2 border-primary active-glow-primary z-10" />
        <span className="text-sm font-medium text-primary">{label}</span>
      </div>
    );
  }

  return (
    <div className="relative pl-8 group cursor-pointer" onClick={onClick}>
      <div className="absolute left-0 top-0.5 w-4 h-4 rounded-full bg-neutral-900 border border-neutral-800 z-10" />
      <span className="text-sm font-medium text-on-surface-variant/40 group-hover:text-on-surface-variant/60 transition-colors">
        {label}
      </span>
    </div>
  );
}

// ─── Timeline Panel ──────────────────────────────────────────

export function TimelinePanel() {
  const sections = useWorkspaceStore((s) => s.sections);
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSection);
  const versions = useWorkspaceStore((s) => s.getActiveSectionVersions());
  const restoreVersion = useWorkspaceStore((s) => s.restoreVersion);
  const finalizeSection = useWorkspaceStore((s) => s.finalizeSection);
  const createVersionSnapshot = useWorkspaceStore((s) => s.createVersionSnapshot);
  const getActiveSection = useWorkspaceStore((s) => s.getActiveSection);
  const viewMode = useWorkspaceStore((s) => s.getActiveViewMode());

  const isAwaitingAgent = useWorkspaceStore((s) => s.getActiveSectionIsAwaitingAgent());
  const isSendingMessage = useWorkspaceStore((s) => s.getActiveSectionIsSendingMessage());
  const isAIPending = isAwaitingAgent || isSendingMessage;

  const currentSection = getActiveSection();

  const handleRestore = (versionId: string) => {
    if (!currentSection || viewMode !== "editing") return;
    restoreVersion(currentSection.id, versionId);
  };

  const handleFinalize = () => {
    if (!currentSection) return;
    finalizeSection(currentSection.id);
  };

  const handleNewVersion = () => {
    if (!currentSection || viewMode !== "editing" || isAIPending) return;
    void createVersionSnapshot(currentSection.id);
  };

  return (
    <aside className="w-[20%] h-full flex flex-col border-l border-outline-variant/20 bg-surface/30 backdrop-blur-sm p-6 overflow-y-auto hide-scrollbar z-10">
      <h3 className="text-[11px] font-semibold text-on-surface-variant/40 mb-6 tracking-widest uppercase px-1">
        Version Graph
      </h3>

      <div className="relative flex-1">
        {/* Vertical Trunk Line */}
        <div className="absolute left-[7px] top-2 bottom-4 w-[1px] bg-neutral-800" />

        <div className="space-y-6 relative">
          {sections.map((section) => {
            const isActive = section.sectionType === activeSection;
            return (
              <div key={section.id}>
                <SectionNode
                  sectionType={section.sectionType}
                  status={section.status}
                  isActive={isActive}
                  onClick={() => setActiveSection(section.sectionType)}
                />
                {/* Show versions only for active section */}
                {isActive && versions.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 ml-8">
                    {versions.map((v) => (
                      <VersionNode
                        key={v.id}
                        version={v}
                        onRestore={handleRestore}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Version + Finish Section buttons */}
      {currentSection && viewMode === "editing" && currentSection.status !== "finalized" && (
        <div className="mt-6 pt-4 border-t border-outline-variant/10 flex flex-col gap-2">
          <button
            onClick={handleNewVersion}
            disabled={isAIPending}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface bg-surface-container-high/40 hover:bg-surface-container-high/70 border border-outline-variant/20 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-container-high/40 disabled:hover:text-on-surface-variant/70"
          >
            <Icon
              name={isAIPending ? "autorenew" : "fork_right"}
              className={`!text-[16px] ${isAIPending ? "animate-spin" : ""}`}
            />
            New Version
          </button>
          <button
            onClick={handleFinalize}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-lg transition-all"
          >
            <Icon name="task_alt" className="!text-[16px]" />
            Finish Section
          </button>
        </div>
      )}

      {/* Meta info */}
      <div className="mt-auto pt-6 border-t border-outline-variant/20">
        <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant/40 tracking-wider uppercase">
          <span>Demo</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.3)]" />
            Live
          </span>
        </div>
      </div>
    </aside>
  );
}
