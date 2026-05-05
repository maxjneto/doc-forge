import { useState } from "react";

interface InitialInputProps {
  onSubmit: (context: string, preferences: string) => void;
}

export function InitialInput({ onSubmit }: InitialInputProps) {
  const [context, setContext] = useState("");
  const [preferences, setPreferences] = useState("");

  const canSubmit = context.trim().length > 10;

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold text-on-surface mb-2">
          Describe your RFC
        </h2>
        <p className="text-sm text-on-surface-variant/60">
          Provide the problem context and your preferences for the document.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Context Card */}
        <div className="panel-depth rounded-xl p-6 bg-surface-container-low">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60">description</span>
            <h3 className="text-sm font-semibold text-on-surface">Context</h3>
          </div>
          <p className="text-xs text-on-surface-variant/60 mb-3">
            Describe the problem your RFC solves. The more details, the better.
          </p>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="E.g.: Our payment system is suffering from latency above 500ms during peak hours. PostgreSQL 14 is not scaling adequately..."
            className="w-full h-40 bg-surface-container rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 resize-none border border-outline-variant/30 focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Preferences Card */}
        <div className="panel-depth rounded-xl p-6 bg-surface-container-low">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60">tune</span>
            <h3 className="text-sm font-semibold text-on-surface">Preferences</h3>
          </div>
          <p className="text-xs text-on-surface-variant/60 mb-3">
            Tone, format, target audience, and any specific instructions.
          </p>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            placeholder="E.g.: Technical tone, target audience is senior engineers. Include Mermaid diagrams. Focus on trade-offs..."
            className="w-full h-40 bg-surface-container rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 resize-none border border-outline-variant/30 focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="text-center mt-8">
        <button
          onClick={() => onSubmit(context, preferences)}
          disabled={!canSubmit}
          className="px-6 py-3 bg-primary-container text-on-primary-container rounded-lg font-medium text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Submit for analysis →
        </button>
      </div>
    </div>
  );
}
