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
        <div className="rounded-md p-4 bg-error-wash border border-error-line mb-8">
          <p className="text-body text-error font-medium text-center">
            ✗ Inconsistencies found
          </p>
        </div>

        {/* Problems list */}
        <div className="space-y-4">
          {problems.map((problem, idx) => (
            <div
              key={idx}
              className="panel-depth rounded-md p-5 bg-surface border border-error-line"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="text-body-sm text-error font-medium uppercase tracking-wider">
                    {problem.section}
                  </span>
                  <p data-ph-mask className="text-body text-text mt-1">
                    {problem.issue}
                  </p>
                  {problem.severity && (
                    <span className="text-body-sm text-faint mt-1 inline-block">
                      Severity: {problem.severity}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onFix(problem.section)}
                  className="px-4 py-2 bg-error-wash text-error border border-error-line rounded-md text-body-sm font-medium hover:brightness-110 transition-all shrink-0"
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
