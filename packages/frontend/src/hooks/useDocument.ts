import { useState, useEffect, useCallback, useRef } from "react";
import type { Document, Section, DiscoveryQuestion, AuditProblem } from "@/types";
import { API_BASE, mapDocument, mapSection, mapDiscoveryQuestion } from "@/utils/api";

interface DocumentState {
  document: Document | null;
  sections: Section[];
  discoveryQuestions: DiscoveryQuestion[];
  auditProblems: AuditProblem[];
  loading: boolean;
  error: string | null;
}

export function useDocument(documentId: string | null) {
  const [state, setState] = useState<DocumentState>({
    document: null,
    sections: [],
    discoveryQuestions: [],
    auditProblems: [],
    loading: false,
    error: null,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${documentId}`);
      if (!res.ok) throw new Error("Failed to fetch document");
      const data = await res.json();

      const docId = String(data.document.id);

      setState((prev) => ({
        ...prev,
        document: mapDocument(data.document),
        sections: data.sections
          ? (data.sections as Record<string, unknown>[]).map((s) =>
              mapSection(s, docId)
            )
          : prev.sections,
        discoveryQuestions: data.discovery_questions
          ? (data.discovery_questions as Record<string, unknown>[]).map((q) =>
              mapDiscoveryQuestion(q, docId)
            )
          : prev.discoveryQuestions,
        auditProblems: Array.isArray(data.audit_problems)
          ? (data.audit_problems as AuditProblem[])
          : [],
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [documentId]);

  // Start polling
  useEffect(() => {
    if (!documentId) return;

    setState((prev) => ({ ...prev, loading: true }));
    fetchDocument();

    intervalRef.current = setInterval(() => {
      // Stop polling when completed
      if (state.document?.currentPhase === "completed") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      fetchDocument();
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [documentId, fetchDocument]);

  const refreshNow = useCallback(() => {
    fetchDocument();
  }, [fetchDocument]);

  return { ...state, refreshNow };
}
