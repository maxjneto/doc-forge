import { useEffect, useRef } from "react";
import { ChatPanel } from "./ChatPanel";
import { EditorPanel } from "./EditorPanel";
import { TimelinePanel } from "./TimelinePanel";
import { useWorkspaceStore } from "@/store";
import type { Section } from "@/types";

interface WorkspaceLayoutProps {
  documentId: string;
  sections: Section[];
}

export function WorkspaceLayout({ documentId, sections }: WorkspaceLayoutProps) {
  const hydrate = useWorkspaceStore((s) => s.hydrate);
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const getActiveSection = useWorkspaceStore((s) => s.getActiveSection);
  const fetchVersions = useWorkspaceStore((s) => s.fetchVersions);
  const fetchMessages = useWorkspaceStore((s) => s.fetchMessages);

  // Hydrate store with polling data
  useEffect(() => {
    hydrate(documentId, sections);
  }, [documentId, sections, hydrate]);

  // Fetch versions and messages when active section changes
  const prevSectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const section = getActiveSection();
    if (!section || section.id === prevSectionIdRef.current) return;
    prevSectionIdRef.current = section.id;

    fetchVersions(section.id);
    fetchMessages(section.id);
  }, [activeSection, getActiveSection, fetchVersions, fetchMessages]);

  // Poll messages for the active section every 3 seconds
  useEffect(() => {
    const section = getActiveSection();
    if (!section) return;

    const interval = setInterval(() => {
      fetchMessages(section.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeSection, getActiveSection, fetchMessages]);

  return (
    <main className="h-screen w-full flex pt-[64px] linear-gradient-bg">
      <ChatPanel />
      <EditorPanel />
      <TimelinePanel />
    </main>
  );
}
