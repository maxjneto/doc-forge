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
  const [answers, setAnswers] = useState<Record<string, { answer: string | null; answered: boolean }>>({});
  const [currentInput, setCurrentInput] = useState("");

  // A question is "done" if answered locally OR already answered/skipped from DB
  const isQuestionDone = (q: DiscoveryQuestion) =>
    answers[q.id]?.answered || q.answer !== null || q.skipped;

  const currentQuestionIndex = questions.findIndex((q) => !isQuestionDone(q));
  const allAnswered = currentQuestionIndex === -1;

  const handleAnswer = async (questionId: string, answer: string | null) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: { answer, answered: true },
    }));
    setCurrentInput("");

    await apiAnswerQuestion(documentId, question.question, answer, getToken);

    // If this was the last question, complete
    const remaining = questions.filter(
      (q) => q.id !== questionId && !isQuestionDone(q)
    );
    if (remaining.length === 0) {
      setTimeout(onComplete, 500);
    }
  };

  return (
    <div className="flex flex-col gap-4" style={{ width: '100%' }}>
      <p className="text-sm text-on-surface-variant/70 text-center mb-2">
        A few questions to enrich the context:
      </p>

      {/* Answered questions (collapsed) */}
      {questions.map((q) => {
        const a = answers[q.id];
        const doneLocally = a?.answered;
        const doneFromDb = q.answer !== null || q.skipped;
        if (!doneLocally && !doneFromDb) return null;

        const displayAnswer = a?.answer ?? q.answer ?? (q.skipped ? "Skipped" : "Skipped");

        return (
          <div
            key={q.id}
            className="panel-depth rounded-lg p-4 bg-surface-container-low/50 opacity-60"
          >
            <div className="flex items-start gap-2">
              <span className="text-primary text-xs mt-0.5">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant/70 truncate">
                  {q.question}
                </p>
                <p className="text-xs text-on-surface/60 mt-1 truncate">
                  {displayAnswer}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Current question */}
      {!allAnswered && (
        <div className="panel-depth rounded-xl p-6 bg-surface-container-low animate-slide-up">
          <p className="text-sm text-on-surface mb-4">
            {questions[currentQuestionIndex].question}
          </p>
          <textarea
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            placeholder="Your answer..."
            className="w-full h-24 bg-surface-container rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 resize-none border border-outline-variant/30 focus:border-primary/50 focus:outline-none transition-colors mb-4"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                handleAnswer(
                  questions[currentQuestionIndex].id,
                  currentInput.trim() || null
                )
              }
              disabled={!currentInput.trim()}
              className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-xs font-medium hover:brightness-110 transition-all disabled:opacity-30"
            >
              Answer
            </button>
            <button
              onClick={() =>
                handleAnswer(questions[currentQuestionIndex].id, null)
              }
              className="px-4 py-2 text-on-surface-variant/60 text-xs font-medium hover:text-on-surface transition-colors"
            >
              Not relevant ⏭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
