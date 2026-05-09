import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { DiscoveryQuestion } from "@/types";
import { apiCreateDocument } from "@/utils/api";
import { InitialInput } from "./InitialInput";
import { ProcessingState } from "./ProcessingState";
import { FollowUpQuestions } from "./FollowUpQuestions";

type DiscoverySubState = "input" | "processing" | "questions";

interface DiscoveryLayoutProps {
  documentId: string | null;
  questions: DiscoveryQuestion[];
  onDocumentCreated?: (docId: string) => void;
  documentTypeSlug?: string;
}

export function DiscoveryLayout({
  documentId,
  questions,
  onDocumentCreated,
  documentTypeSlug = "rfc",
}: DiscoveryLayoutProps) {
  const { getToken } = useAuth();
  const getInitialSubState = (): DiscoverySubState => {
    if (!documentId) return "input";
    if (questions.length > 0) return "questions";
    return "processing";
  };

  const [subState, setSubState] = useState<DiscoverySubState>(getInitialSubState);

  // React to questions arriving from polling
  useEffect(() => {
    if (documentId && questions.length > 0) {
      setSubState("questions");
    }
  }, [documentId, questions.length]);

  const handleSubmitInput = async (context: string, preferences: string) => {
    setSubState("processing");

    const doc = await apiCreateDocument("New RFC", context, getToken, preferences, documentTypeSlug);
    onDocumentCreated?.(doc.id);
    // Polling will now start in DocumentPage and feed questions back via props
  };

  const handleQuestionsComplete = () => {
    // All current questions answered — show processing while backend re-evaluates
    // Polling will either bring more questions (triggering "questions" subState)
    // or transition to alignment (handled by DocumentPage)
    setSubState("processing");
  };

  return (
    <div style={{ height: '100%', paddingTop: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }} className="px-6">
      {subState === "input" && (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '56rem' }}>
          <InitialInput onSubmit={handleSubmitInput} />
        </div>
      )}
      {subState === "processing" && (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '28rem', textAlign: 'center' }}>
          <ProcessingState />
        </div>
      )}
      {subState === "questions" && documentId && (
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: '36rem' }}>
          <FollowUpQuestions
            documentId={documentId}
            questions={questions}
            onComplete={handleQuestionsComplete}
          />
        </div>
      )}
    </div>
  );
}
