import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { DiscoveryQuestion } from "@/types";
import { apiAnswerQuestion } from "@/utils/api";

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
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              borderLeft: "2px solid var(--df-amber-trail, rgba(255,77,0,0.42))",
              borderRadius: 10,
              padding: "16px 18px",
              background: "rgba(255,77,0,0.04)",
              animation: "df-answer-enter 0.28s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--df-faint, rgba(227,226,226,0.38))" }}
              >
                <b style={{ color: "var(--df-amber-300, #ff8d4a)" }}>
                  {String(idx + 1).padStart(2, "0")}
                </b>{" "}
                · Forged
              </span>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#e3e2e2", marginBottom: 10 }}>
              {q.question}
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--df-dim, rgba(227,226,226,0.62))",
                lineHeight: 1.5,
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.20)",
                border: "1px dashed var(--df-outline, rgba(255,255,255,0.06))",
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
            border: "1px solid rgba(255,77,0,0.35)",
            borderRadius: 10,
            padding: "16px 18px",
            background: "rgba(255,77,0,0.06)",
            boxShadow: "0 0 0 4px rgba(255,77,0,0.05)",
            position: "relative",
            animation: exitingId === questions[currentQuestionIndex]?.id
              ? "df-answer-exit 0.19s ease-in forwards"
              : "df-answer-enter 0.25s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span
              className="df-mono"
              style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--df-faint, rgba(227,226,226,0.38))" }}
            >
              <b style={{ color: "var(--df-amber-300, #ff8d4a)" }}>
                {String(currentQuestionIndex + 1).padStart(2, "0")}
              </b>{" "}
              · Heating
            </span>
            <span
              className="df-ember animate-df-pulse"
            />
          </div>

          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "#e3e2e2", marginBottom: 10 }}>
            {questions[currentQuestionIndex].question}
          </div>

          <textarea
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Type or paste context. We'll smelt it down to a draft."
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              fontSize: 13,
              color: "#e3e2e2",
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
                letterSpacing: "0.10em",
                color: "var(--df-faint, rgba(227,226,226,0.38))",
                background: "transparent",
                border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                padding: "5px 10px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Skip
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
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--df-amber-500, #ff4d00)",
                  background: "var(--df-amber-500, #ff4d00)",
                  color: "#fff",
                  cursor: !currentInput.trim() ? "not-allowed" : "pointer",
                  opacity: !currentInput.trim() ? 0.4 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  arrow_forward
                </span>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {allAnswered && (
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 10,
            border: "1px solid var(--df-steel-border, rgba(138,160,184,0.35))",
            background: "var(--df-steel-bg, rgba(138,160,184,0.10))",
            textAlign: "center",
            animation: "df-answer-enter 0.35s ease-out, df-section-forged-pulse 3s ease-in-out 0.5s infinite",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(90deg, transparent 0%, rgba(138,160,184,0.09) 40%, transparent 100%)",
            animation: "df-shimmer-loop 4s ease-in-out 0.6s infinite",
          }} />
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--df-steel-100, #b9c6d4)", display: "block", marginBottom: 6 }}>
            check_circle
          </span>
          <span
            className="df-mono"
            style={{ fontSize: 11, color: "var(--df-steel-100, #b9c6d4)", letterSpacing: "0.10em" }}
          >
            All questions answered - forging context…
          </span>
        </div>
      )}
    </div>
  );
}
