import type { AuditProblem } from "@/types";

interface AuditProblemsProps {
  problems: AuditProblem[];
  onFix: (section: string) => void;
}

export function AuditProblems({ problems, onFix }: AuditProblemsProps) {
  return (
    <div className="h-full pt-[64px] flex flex-col items-center px-6 overflow-y-auto">
      <div className="max-w-3xl w-full py-12">
        {/* Error banner */}
        <div className="rounded-xl p-4 bg-error-container/30 border border-error/30 mb-8">
          <p className="text-sm text-error font-medium text-center">
            ✗ Inconsistencies found
          </p>
        </div>

        {/* Problems list */}
        <div className="space-y-4">
          {problems.map((problem, idx) => (
            <div
              key={idx}
              className="panel-depth rounded-xl p-5 bg-surface-container-low border border-error/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="text-xs text-error/80 font-medium uppercase tracking-wider">
                    {problem.section}
                  </span>
                  <p className="text-sm text-on-surface/80 mt-1">
                    {problem.issue}
                  </p>
                  {problem.severity && (
                    <span className="text-xs text-on-surface-variant/50 mt-1 inline-block">
                      Severity: {problem.severity}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onFix(problem.section)}
                  className="px-4 py-2 bg-error-container text-on-error-container rounded-lg text-xs font-medium hover:brightness-110 transition-all shrink-0"
                >
                  Fix
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
