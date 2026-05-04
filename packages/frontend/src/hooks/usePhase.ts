import type { Phase } from "@/types";

interface PhaseConfig {
  phase: Phase;
  label: string;
  description: string;
}

export const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  discovery: {
    phase: "discovery",
    label: "Discovery",
    description: "Gathering problem context",
  },
  alignment: {
    phase: "alignment",
    label: "Alignment",
    description: "Validating document direction",
  },
  generation: {
    phase: "generation",
    label: "Generation",
    description: "Forging your RFC",
  },
  refinement: {
    phase: "refinement",
    label: "Refinement",
    description: "Editing and refining sections",
  },
  audit: {
    phase: "audit",
    label: "Audit",
    description: "Checking consistency",
  },
  completed: {
    phase: "completed",
    label: "Completed",
    description: "Manual full-document editing",
  },
};

export function usePhase(currentPhase: Phase | null) {
  const config = currentPhase ? PHASE_CONFIG[currentPhase] : null;

  return {
    phase: currentPhase,
    config,
    isDiscovery: currentPhase === "discovery",
    isAlignment: currentPhase === "alignment",
    isGeneration: currentPhase === "generation",
    isRefinement: currentPhase === "refinement",
    isAudit: currentPhase === "audit",
    isCompleted: currentPhase === "completed",
  };
}
