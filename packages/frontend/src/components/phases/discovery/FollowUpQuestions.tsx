import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { DiscoveryQuestion } from "@/types";
import { apiAnswerQuestion } from "@/utils/api";

import { useI18n } from "@/i18n";
interface FollowUpQuestionsProps {
  documentId: string;
  questions: DiscoveryQuestion[];
  onComplete: () => void;
}

export function FollowUpQuestions({
  documentId,
  questions,
  onComplete,
}: FollowUpQuestionsProps) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const [answers, setAnswers] = useState<
    Record<string, { answer: string | null; answered: boolean }>
  >({});
  const [currentInput, setCurrentInput] = useState("");
  const [exitingId, setExitingId] = useState<string | null>(null);

  const isQuestionDone = (q: DiscoveryQuestion) =>
    answers[q.id]?.answered || q.answer !== null || q.skipped;

  const currentQuestionIndex = questions.findIndex((q) => !isQuestionDone(q));
  const allAnswered = currentQuestionIndex === -1;

  const handleAnswer = async (questionId: string, answer: string | null) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || exitingId) return;

    if (answer === null) {
      posthog.capture("discovery_question_skipped", { document_id: documentId, section_key: question.sectionKey });
    } else {
      posthog.capture("discovery_question_answered", { document_id: documentId, section_key: question.sectionKey, answer_length: answer.length });
    }

    setExitingId(questionId);
    const apiPromise = apiAnswerQuestion(documentId, question.question, answer, getToken);

    await new Promise((r) => setTimeout(r, 190));
    setExitingId(null);
    setCurrentInput("");
    setAnswers((prev) => ({ ...prev, [questionId]: { answer, answered: true } }));

    await apiPromise;

    const remaining = questions.filter(
      (q) => q.id !== questionId && !isQuestionDone(q)
    );
    if (remaining.length === 0) {
      setTimeout(onComplete, 500);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        overflowY: "auto",
      }}
      className="hide-scrollbar"
    >
      {/* Answered questions */}
      {questions.map((q, idx) => {
        const a = answers[q.id];
        const doneLocally = a?.answered;
        const doneFromDb = q.answer !== null || q.skipped;
        if (!doneLocally && !doneFromDb) return null;

        const displayAnswer =
          a?.answer ?? q.answer ?? (q.skipped ? "Skipped" : "Skipped");

        return (
          <div
            key={q.id}
            style={{
              border: "1px solid var(--color-outline)",
              borderLeft: "2px solid var(--color-heat-line)",
              borderRadius: "var(--radius-md)",
              padding: "16px 18px",
              background: "var(--color-heat-tint)",
              animation: "df-answer-enter 0.28s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-faint)" }}
              >
                <b style={{ color: "var(--color-heat-hi)" }}>
                  {String(idx + 1).padStart(2, "0")}
                </b>{" "}
                · {t("g.state.forged")}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text)", marginBottom: 10 }}>
              {q.question}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--color-dim)",
                lineHeight: 1.5,
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-sink)",
                border: "1px dashed var(--color-outline)",
              }}
            >
              {displayAnswer}
            </div>
          </div>
        );
      })}

      {/* Current active question */}
      {!allAnswered && (
        <div
          key={questions[currentQuestionIndex]?.id}
          style={{
            border: "1px solid var(--color-heat-line)",
            borderRadius: "var(--radius-md)",
            padding: "16px 18px",
            background: "var(--color-heat-tint)",
            boxShadow: "0 0 0 4px var(--color-heat-tint)",
            position: "relative",
            animation: exitingId === questions[currentQuestionIndex]?.id
              ? "df-answer-exit 0.19s ease-in forwards"
              : "df-answer-enter 0.25s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              className="df-mono"
              style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-faint)" }}
            >
              <b style={{ color: "var(--color-heat-hi)" }}>
                {String(currentQuestionIndex + 1).padStart(2, "0")}
              </b>{" "}
              · {t("g.state.heating")}
            </span>
            <span
              className="df-ember animate-df-pulse"
            />
          </div>

          <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text)", marginBottom: 10 }}>
            {questions[currentQuestionIndex].question}
          </div>

          <textarea
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder={t("g.fu.ph")}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              fontSize: 13,
              color: "var(--color-text)",
              fontFamily: "inherit",
              lineHeight: 1.5,
              resize: "none",
              height: 72,
              outline: "none",
              padding: 0,
            }}
          />

          <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
            <button
              onClick={() =>
                handleAnswer(questions[currentQuestionIndex].id, null)
              }
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "var(--tracking-label)",
                color: "var(--color-faint)",
                background: "transparent",
                border: "1px solid var(--color-outline)",
                padding: "5px 10px",
                borderRadius: "var(--radius-xs)",
                cursor: "pointer",
              }}
            >
              {t("g.fu.skip")}
            </button>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() =>
                  handleAnswer(
                    questions[currentQuestionIndex].id,
                    currentInput.trim() || null
                  )
                }
                disabled={!currentInput.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "1px solid var(--color-heat)",
                  background: "var(--color-heat)",
                  color: "var(--color-on-heat)",
                  cursor: !currentInput.trim() ? "not-allowed" : "pointer",
                  opacity: !currentInput.trim() ? 0.4 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  arrow_forward
                </span>
                {t("g.fu.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {allAnswered && (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-steel-line)",
            background: "var(--color-steel-wash)",
            textAlign: "center",
            animation: "df-answer-enter 0.35s ease-out, df-section-forged-pulse 3s ease-in-out 0.5s infinite",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent 0%, var(--color-steel-wash) 40%, transparent 100%)",
            animation: "df-shimmer-loop 4s ease-in-out 0.6s infinite",
          }} />
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-steel-hi)", display: "block", marginBottom: 6 }}>
            check_circle
          </span>
          <span
            className="df-mono"
            style={{ fontSize: 11.5, color: "var(--color-steel-hi)", letterSpacing: "var(--tracking-label)" }}
          >
            {t("g.fu.done")}
          </span>
        </div>
      )}
    </div>
  );
}
