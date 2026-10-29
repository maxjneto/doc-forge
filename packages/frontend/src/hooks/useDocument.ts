import { useState, useEffect, useCallback, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { Document, Section } from "@/types";
import { API_BASE, mapDocument, mapSection } from "@/utils/api";

type GetToken = () => Promise<string | null>;

interface DocumentState {
  document: Document | null;
  sections: Section[];
  loading: boolean;
  error: string | null;
  /** Moves on every change to the document (content, review, comments…). */
  sseTick: number;
  /** Moves when someone opens or closes the document. */
  presenceTick: number;
}

const MAX_RETRY_DELAY = 30000;

function eventType(data: string): string | null {
  try {
    return (JSON.parse(data) as { type?: string }).type ?? null;
  } catch {
    return null;
  }
}

export function useDocument(documentId: string | null, getToken?: GetToken) {
  const [state, setState] = useState<DocumentState>({
    document: null,
    sections: [],
    loading: false,
    error: null,
    sseTick: 0,
    presenceTick: 0,
  });

  const fetchDocument = useCallback(async () => {
    if (!documentId) return;

    try {
      const token = getToken ? await getToken() : null;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/documents/${documentId}`, { headers });
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
  }, [documentId, getToken]);

  // Refs so the SSE effect closure always calls the latest versions
  // without needing them in the dependency array (which would restart
  // the SSE connection on every re-render where getToken changes reference).
  const fetchDocumentRef = useRef(fetchDocument);
  fetchDocumentRef.current = fetchDocument;

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    if (!documentId) return;

    setState((prev) => ({ ...prev, loading: true }));
    fetchDocumentRef.current();

    if (!getTokenRef.current) return;

    const ctrl = new AbortController();
    let retryDelay = 1000;

    const connect = async () => {
      if (ctrl.signal.aborted) return;
      const token = getTokenRef.current ? await getTokenRef.current() : null;
      if (!token || ctrl.signal.aborted) return;

      try {
        await fetchEventSource(`${API_BASE}/documents/${documentId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
          onopen: async (res) => {
            if (res.ok) {
              retryDelay = 1000;
              // Re-sync state in case events were missed during reconnect
              fetchDocumentRef.current();
              return;
            }
            // Fatal errors — stop reconnecting
            if (res.status === 401 || res.status === 404) {
              throw new Error(`SSE fatal: ${res.status}`);
            }
          },
          onmessage: (ev) => {
            if (!ev.data || ev.event === "ping") return;
            // Someone arriving or leaving changes nothing in the document: refresh
            // who is here and leave the editors alone.
            if (eventType(ev.data) === "presence_changed") {
              setState((prev) => ({ ...prev, presenceTick: prev.presenceTick + 1 }));
              return;
            }
            fetchDocumentRef.current();
            setState((prev) => ({ ...prev, sseTick: prev.sseTick + 1 }));
          },
          onerror: () => {
            // Throw to stop fetchEventSource's own retry — we handle backoff ourselves
            throw new Error("SSE connection error");
          },
        });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        const delay = retryDelay;
        retryDelay = Math.min(delay * 2, MAX_RETRY_DELAY);
        setTimeout(() => connect(), delay);
      }
    };

    connect();

    return () => ctrl.abort();
  }, [documentId]); // Only restart SSE when the document changes, not on re-renders

  const refreshNow = useCallback(() => {
    fetchDocument();
  }, [fetchDocument]);

  return { ...state, refreshNow };
}
