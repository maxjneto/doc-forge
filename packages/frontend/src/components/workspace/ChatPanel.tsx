import { useEffect, useRef, useState } from "react";
import { Icon, MarkdownRenderer } from "../shared";
import { useWorkspaceStore } from "@/store";
import type { SectionActionType } from "@/types";

interface ChatMessageBubbleProps {
  role: "agent" | "user";
  content: string;
}

function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  if (role === "agent") {
    return (
      <div className="flex items-start gap-3">
        <Icon name="robot_2" className="text-primary mt-1 scale-90" />
        <div className="text-sm text-on-surface-variant/80 bg-surface-container-high/50 p-3 rounded-xl rounded-tl-sm border border-outline-variant/10">
          <MarkdownRenderer content={content} variant="chat" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 flex-row-reverse">
      <div className="text-sm text-on-surface bg-neutral-800 p-3 rounded-xl rounded-tr-sm border border-outline-variant/10">
        <MarkdownRenderer content={content} variant="chat" />
      </div>
    </div>
  );
}

function AgentProcessingBubble({ isSending }: { isSending: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        name={isSending ? "upload" : "autorenew"}
        className={`text-primary mt-1 scale-90 ${isSending ? "" : "animate-spin"}`}
      />
      <div className="text-sm text-on-surface-variant/80 bg-surface-container-high/50 p-3 rounded-xl rounded-tl-sm border border-outline-variant/10">
        <div className="flex items-center gap-2">
          <span>{isSending ? "Sending message..." : "Agent is drafting a response..."}</span>
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:240ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

const quickActions: { icon: string; label: string; action: SectionActionType }[] = [
  { icon: "help", label: "Ask Question", action: "ask_question" },
  { icon: "edit_note", label: "Request Edits", action: "request_edit" },
  { icon: "analytics", label: "Manual Analysis", action: "analyze_user_edit" },
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [activeAction, setActiveAction] = useState<SectionActionType>("ask_question");
  const historyRef = useRef<HTMLDivElement>(null);
  const messages = useWorkspaceStore((s) => s.getActiveSectionMessages());
  const sendMessage = useWorkspaceStore((s) => s.sendMessage);
  const viewMode = useWorkspaceStore((s) => s.getActiveViewMode());
  const isSendingMessage = useWorkspaceStore((s) => s.getActiveSectionIsSendingMessage());
  const isAwaitingAgent = useWorkspaceStore((s) => s.getActiveSectionIsAwaitingAgent());

  const isInteractive = viewMode === "editing";
  const isProcessing = isSendingMessage || isAwaitingAgent;

  useEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, isProcessing]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    setInput("");

    try {
      await sendMessage(trimmed, activeAction);
    } catch {
      setInput(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <aside className="w-[20%] h-full flex flex-col border-r border-outline-variant/20 bg-surface/30 backdrop-blur-sm z-10">
      {/* Chat History */}
      <div ref={historyRef} className="flex-1 overflow-y-auto py-8 px-4 hide-scrollbar flex flex-col gap-4">
        {messages.length === 0 && !isInteractive && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-on-surface-variant/40 text-center px-4">
              {viewMode === "locked"
                ? "Finalize the current section to interact with this one."
                : "Edit history for this section."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}
        {isInteractive && isProcessing && (
          <AgentProcessingBubble isSending={isSendingMessage} />
        )}
      </div>

      {/* Chat Input */}
      {isInteractive && (
        <div className="p-4 border-t border-outline-variant/20 bg-surface/50">
          <div className="flex flex-wrap gap-2 mb-3">
            {quickActions.map((qa) => (
              <button
                key={qa.action}
                onClick={() => setActiveAction(qa.action)}
                disabled={isProcessing}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium border rounded transition-all ${
                  activeAction === qa.action
                    ? "text-primary bg-primary/10 border-primary/30"
                    : "text-on-surface-variant/70 hover:text-on-surface bg-surface-container-high/30 hover:bg-surface-container-high border-outline-variant/10"
                } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Icon name={qa.icon} className="!text-[14px]" />
                {qa.label}
              </button>
            ))}
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isProcessing ? "Processing your message..." : "Send a message..."}
              disabled={isProcessing}
              className="w-full bg-surface-container-high/50 border border-outline-variant/20 text-on-surface text-sm rounded-lg pl-4 pr-10 py-2.5 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-on-surface-variant/40"
            />
            <button
              onClick={() => { void handleSend(); }}
              disabled={isProcessing}
              className="absolute right-2 p-1.5 text-on-surface-variant/60 hover:text-primary transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="arrow_upward" className="!text-sm" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
