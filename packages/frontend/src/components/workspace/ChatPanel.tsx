import { useEffect, useRef, useState } from "react";
import { Icon, MarkdownRenderer } from "../shared";
import { useWorkspaceStore } from "@/store";
import type { SectionActionType } from "@/types";

import { useI18n } from "@/i18n";
// ─── Message cards ───────────────────────────────────────────

interface ChatMessageBubbleProps {
  role: "agent" | "user";
  content: string;
}

function ChatMessageBubble({ role, content }: ChatMessageBubbleProps) {
  const { t } = useI18n();
  if (role === "agent") {
    return (
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-outline)",
          borderLeft: "2px solid var(--color-steel)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
        }}
      >
        <div
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-steel-hi)",
            marginBottom: 8,
          }}
        >
          {t("g.ws.analysis")}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.6 }}>
          <MarkdownRenderer content={content} variant="chat" />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-surface-mid)",
        border: "1px solid var(--color-outline-md)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "var(--tracking-eyebrow)",
          textTransform: "uppercase",
          color: "var(--color-faint)",
          marginBottom: 8,
        }}
      >
        {t("g.ws.you")}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--color-text)", lineHeight: 1.6 }}>
        <MarkdownRenderer content={content} variant="chat" />
      </div>
    </div>
  );
}

function AgentProcessingBubble({ isSending }: { isSending: boolean }) {
  const { t } = useI18n();
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-outline)",
        borderLeft: "2px solid var(--color-heat)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "var(--tracking-eyebrow)",
          textTransform: "uppercase",
          color: "var(--color-heat-hi)",
          marginBottom: 8,
        }}
      >
        {isSending ? t("g.ws.sending") : t("g.ws.analysis")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon
          name={isSending ? "upload" : "autorenew"}
          className={`text-heat-hi scale-90 ${isSending ? "" : "animate-spin"}`}
        />
        <span style={{ fontSize: 12.5, color: "var(--color-faint)" }}>
          {isSending ? t("g.ws.sendingLong") : t("g.ws.drafting")}
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
                  background: "var(--color-heat-hi)",
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
  { icon: "help", label: "g.ws.ask", action: "ask_question" },
  { icon: "edit_note", label: "g.ws.requestEdit", action: "request_edit" },
];

// ─── Chat Panel ──────────────────────────────────────────────

export function ChatPanel() {
  const { t } = useI18n();
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
        borderRight: "1px solid var(--color-outline)",
        background: "var(--color-chrome)",
        backdropFilter: "blur(4px)",
        zIndex: "var(--z-raised)",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--color-outline)",
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-faint)",
          }}
        >
          › {t("g.ws.chat")}
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
                letterSpacing: "var(--tracking-label)",
                color: "var(--color-mute)",
                textAlign: "center",
                padding: "0 12px",
              }}
            >
              {viewMode === "locked"
                ? t("g.ws.finalizeFirst")
                : t("g.ws.history")}
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
            borderTop: "1px solid var(--color-outline)",
            background: "var(--color-chrome)",
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
              style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--color-mute)" }}
            >
              {t("g.ws.messages")}
            </span>
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color:
                  userMessageCount >= 10
                    ? "var(--color-error)"
                    : userMessageCount >= 8
                    ? "var(--color-heat-hi)"
                    : "var(--color-mute)",
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
                    borderRadius: "var(--radius-sm)",
                    fontSize: 11.5,
                    fontWeight: 500,
                    border: `1px solid ${isActive ? "var(--color-heat-line)" : "var(--color-outline)"}`,
                    color: isActive ? "var(--color-heat-soft)" : "var(--color-faint)",
                    background: isActive ? "var(--color-heat-wash)" : "transparent",
                    cursor: isProcessing || isAtLimit ? "not-allowed" : "pointer",
                    opacity: isProcessing || isAtLimit ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  <Icon name={qa.icon} className="!text-[13px]" />
                  {t(qa.label)}
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
                isAtLimit ? t("g.ws.limit") : isProcessing ? t("g.ws.forging") : t("g.ws.typeMessage")
              }
              disabled={isProcessing || isAtLimit}
              style={{
                width: "100%",
                background: "var(--color-surface)",
                border: "1px solid var(--color-outline-md)",
                color: "var(--color-text)",
                fontSize: 12.5,
                borderRadius: "var(--radius-md)",
                padding: "8px 36px 8px 12px",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-heat-line)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-outline-md)";
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
                color: "var(--color-faint)",
                cursor: isProcessing || isAtLimit ? "not-allowed" : "pointer",
                opacity: isProcessing || isAtLimit ? 0.4 : 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { if (!isProcessing && !isAtLimit) e.currentTarget.style.color = "var(--color-heat-hi)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-faint)"; }}
            >
              <Icon name="arrow_upward" className="!text-body" />
            </button>
          </div>
          {input.length > 700 && (
            <p
              className="df-mono"
              style={{
                fontSize: 10,
                marginTop: 4,
                textAlign: "right",
                color: input.length >= 1000 ? "var(--color-error)" : "var(--color-mute)",
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
