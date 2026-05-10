import { useEffect, useRef, useState } from "react";
import { Icon, MarkdownRenderer } from "../shared";
import { useWorkspaceStore } from "@/store";
import type { SectionActionType } from "@/types";

// ─── Message cards ───────────────────────────────────────────

interface ChatMessageBubbleProps {
  role: "agent" | "user";
  content: string;
}

function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  if (role === "agent") {
    return (
      <div
        style={{
          background: "rgba(18,20,20,0.9)",
          border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          borderLeft: "2px solid var(--df-amber-500, #ff4d00)",
          borderRadius: 8,
          padding: "12px 14px",
        }}
      >
        <div
          className="df-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--df-amber-300, #ff8d4a)",
            marginBottom: 8,
          }}
        >
          Analysis
        </div>
        <div style={{ fontSize: 12.5, color: "var(--df-dim, rgba(227,226,226,0.62))", lineHeight: 1.6 }}>
          <MarkdownRenderer content={content} variant="chat" />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgba(38,40,41,0.5)",
        border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--df-steel-200, #8aa0b8)",
          marginBottom: 8,
        }}
      >
        You
      </div>
      <div style={{ fontSize: 12.5, color: "var(--df-on-surface, #e3e2e2)", lineHeight: 1.6 }}>
        <MarkdownRenderer content={content} variant="chat" />
      </div>
    </div>
  );
}

function AgentProcessingBubble({ isSending }: { isSending: boolean }) {
  return (
    <div
      style={{
        background: "rgba(18,20,20,0.9)",
        border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        borderLeft: "2px solid var(--df-amber-500, #ff4d00)",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--df-amber-300, #ff8d4a)",
          marginBottom: 8,
        }}
      >
        {isSending ? "Sending" : "Analysis"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon
          name={isSending ? "upload" : "autorenew"}
          className={`text-primary scale-90 ${isSending ? "" : "animate-spin"}`}
        />
        <span style={{ fontSize: 12, color: "var(--df-faint, rgba(227,226,226,0.38))" }}>
          {isSending ? "Sending to forge…" : "Drafting response…"}
        </span>
        {!isSending && (
          <span style={{ display: "inline-flex", gap: 3 }}>
            {[0, 120, 240].map((delay) => (
              <span
                key={delay}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--df-amber-400, #ff6a14)",
                  opacity: 0.7,
                  animation: `df-pulse 1.6s ease-in-out ${delay}ms infinite`,
                }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Quick action chips ──────────────────────────────────────

const quickActions: { icon: string; label: string; action: SectionActionType }[] = [
  { icon: "help", label: "Ask Question", action: "ask_question" },
  { icon: "edit_note", label: "Request Edit", action: "request_edit" },
];

// ─── Chat Panel ──────────────────────────────────────────────

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
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isAtLimit = userMessageCount >= 10;

  useEffect(() => {
    const node = historyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, isProcessing]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing || isAtLimit) return;
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
    <aside
      style={{
        width: "20%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(10,11,12,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 10,
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-faint, rgba(227,226,226,0.38))",
          }}
        >
          › Chat
        </span>
      </div>

      {/* Chat history */}
      <div
        ref={historyRef}
        className="hide-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {messages.length === 0 && !isInteractive && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.08em",
                color: "var(--df-mute, rgba(227,226,226,0.18))",
                textAlign: "center",
                padding: "0 12px",
              }}
            >
              {viewMode === "locked"
                ? "Finalize the current section to interact."
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

      {/* Chat input */}
      {isInteractive && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            background: "rgba(13,14,15,0.6)",
            flexShrink: 0,
          }}
        >
          {/* Message counter */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              className="df-mono"
              style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--df-mute, rgba(227,226,226,0.18))" }}
            >
              Messages
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color:
                  userMessageCount >= 10
                    ? "var(--df-error, #e86464)"
                    : userMessageCount >= 8
                    ? "var(--df-amber-300, #ff8d4a)"
                    : "var(--df-mute, rgba(227,226,226,0.18))",
              }}
            >
              {userMessageCount}/10
            </span>
          </div>

          {/* Quick action chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {quickActions.map((qa) => {
              const isActive = activeAction === qa.action;
              return (
                <button
                  key={qa.action}
                  onClick={() => setActiveAction(qa.action)}
                  disabled={isProcessing || isAtLimit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 9px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 500,
                    border: `1px solid ${isActive ? "rgba(255,77,0,0.45)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
                    color: isActive ? "var(--df-amber-200, #ffb59e)" : "var(--df-faint, rgba(227,226,226,0.38))",
                    background: isActive ? "rgba(255,77,0,0.08)" : "transparent",
                    cursor: isProcessing || isAtLimit ? "not-allowed" : "pointer",
                    opacity: isProcessing || isAtLimit ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon name={qa.icon} className="!text-[13px]" />
                  {qa.label}
                </button>
              );
            })}
          </div>

          {/* Text input */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={1000}
              placeholder={
                isAtLimit ? "Message limit reached." : isProcessing ? "Forging…" : "Type a message…"
              }
              disabled={isProcessing || isAtLimit}
              style={{
                width: "100%",
                background: "rgba(18,20,20,0.8)",
                border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
                color: "var(--df-on-surface, #e3e2e2)",
                fontSize: 12.5,
                borderRadius: 8,
                padding: "8px 36px 8px 12px",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,77,0,0.40)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--df-outline-md, rgba(255,255,255,0.10))";
              }}
            />
            <button
              onClick={() => { void handleSend(); }}
              disabled={isProcessing || isAtLimit}
              style={{
                position: "absolute",
                right: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                background: "transparent",
                border: "none",
                color: "var(--df-faint, rgba(227,226,226,0.38))",
                cursor: isProcessing || isAtLimit ? "not-allowed" : "pointer",
                opacity: isProcessing || isAtLimit ? 0.4 : 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { if (!isProcessing && !isAtLimit) e.currentTarget.style.color = "var(--df-amber-300, #ff8d4a)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--df-faint, rgba(227,226,226,0.38))"; }}
            >
              <Icon name="arrow_upward" className="!text-sm" />
            </button>
          </div>
          {input.length > 700 && (
            <p
              className="df-mono"
              style={{
                fontSize: 9,
                marginTop: 4,
                textAlign: "right",
                color: input.length >= 1000 ? "var(--df-error, #e86464)" : "var(--df-mute, rgba(227,226,226,0.18))",
              }}
            >
              {input.length}/1000
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
