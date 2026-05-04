import { useState, useEffect } from "react";
import { AuditSuccess } from "./AuditSuccess";
import { AuditProblems } from "./AuditProblems";
import type { Phase, AuditProblem, Section } from "@/types";

const AUDIT_STEPS = [
  "Checking cross-section references...",
  "Verifying technical consistency...",
  "Comparing proposal against implementation...",
  "Validating risk coverage...",
];

interface AuditLayoutProps {
  documentId: string;
  currentPhase: Phase;
  sections: Section[];
  auditProblems?: AuditProblem[];
}

export function AuditLayout({ documentId, currentPhase, sections, auditProblems = [] }: AuditLayoutProps) {
  const [auditStep, setAuditStep] = useState(0);

  useEffect(() => {
    if (currentPhase !== "audit" || auditProblems.length > 0) return;
    const interval = setInterval(() => {
      setAuditStep((i) => (i + 1) % AUDIT_STEPS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [currentPhase, auditProblems.length]);

  // Phase transitions are handled by DocumentPage polling:
  // - "audit" → show loading or problems (backend is running audit)
  // - "completed" → show success
  // - "refinement" → DocumentPage will render WorkspaceLayout instead

  if (currentPhase === "completed") {
    return <AuditSuccess documentId={documentId} sections={sections} />;
  }

  // If audit found problems, show them before transitioning to refinement
  if (auditProblems.length > 0) {
    return (
      <AuditProblems
        problems={auditProblems}
        onFix={() => {
          // The backend already transitions to refinement phase;
          // polling will pick it up and render WorkspaceLayout.
        }}
      />
    );
  }

  // Still in "audit" phase — backend is processing
  return (
    <div className="h-full pt-[64px] flex flex-col items-center justify-center px-6 w-full">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Scanning animation */}
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-3 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">verified</span>
          </div>
        </div>

        {/* Rotating status messages */}
        <div className="text-center min-h-[3rem]">
          <p className="text-sm text-on-surface font-medium mb-1">
            Running audit
          </p>
          <p
            key={auditStep}
            className="text-xs text-on-surface-variant/60 animate-fade-in"
          >
            {AUDIT_STEPS[auditStep]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-60 h-1 bg-surface-container-high rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-progress-pulse" />
        </div>

        {/* Section checklist */}
        <div className="flex gap-3 mt-2">
          {["Context", "Proposal", "Implementation", "Risks"].map((name, i) => (
            <div
              key={name}
              className={`text-xs px-2 py-1 rounded-md transition-all duration-500 ${
                i <= auditStep
                  ? "bg-primary/20 text-primary"
                  : "bg-surface-container-high text-on-surface-variant/40"
              }`}
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
