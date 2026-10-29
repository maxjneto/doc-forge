import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiUpdateSectionContent } from "@/utils/api";
import type { SaveState } from "@/components/editor/EditorStatusBar";

const DEBOUNCE_MS = 1200;

interface UseAutosaveOptions {
  sectionId: string | undefined;
  content: string;
  /**
   * Content as last known to the server. Edits are only persisted once the
   * local text diverges from this, so opening a document does not rewrite it.
   */
  baseline: string;
  onSaved?: (content: string) => void;
}

/**
 * Debounced autosave for the editor body.
 *
 * Before this, the only way to persist typing was a "Save changes" button
 * living inside the Versions tab — invisible from the Gate and Review tabs,
 * which meant work could be lost simply by having the wrong tab open.
 */
export function useAutosave({ sectionId, content, baseline, onSaved }: UseAutosaveOptions) {
  const { getToken } = useAuth();
  const [state, setState] = useState<SaveState>({ status: "idle", savedAt: null });

  const timer = useRef<number | null>(null);
  const inFlight = useRef(false);
  const lastSaved = useRef(baseline);
  const pending = useRef<string | null>(null);

  // A version switch or an SSE push replaces the text under us; that new text
  // is now the server's truth, not an unsaved edit.
  useEffect(() => {
    lastSaved.current = baseline;
  }, [baseline]);

  const flush = useCallback(
    async (value: string) => {
      if (!sectionId) return;
      if (inFlight.current) {
        pending.current = value;
        return;
      }
      inFlight.current = true;
      setState({ status: "saving" });
      try {
        await apiUpdateSectionContent(sectionId, value, getToken);
        lastSaved.current = value;
        setState({ status: "idle", savedAt: Date.now() });
        onSaved?.(value);
      } catch (e) {
        setState({ status: "error", message: e instanceof Error ? e.message : "erro" });
      } finally {
        inFlight.current = false;
        const queued = pending.current;
        pending.current = null;
        if (queued !== null && queued !== lastSaved.current) void flush(queued);
      }
    },
    [sectionId, getToken, onSaved],
  );

  useEffect(() => {
    if (!sectionId || content === lastSaved.current) return;

    setState((s) => (s.status === "saving" ? s : { status: "dirty" }));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(content), DEBOUNCE_MS);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [content, sectionId, flush]);

  // Last-chance save when the tab goes away mid-edit.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden" && content !== lastSaved.current) {
        void flush(content);
      }
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [content, flush]);

  const saveNow = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (content !== lastSaved.current) void flush(content);
  }, [content, flush]);

  return { state, saveNow, isDirty: content !== lastSaved.current };
}
