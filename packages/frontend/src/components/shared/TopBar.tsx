import { useState, useRef, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useKilnAudio } from "@/hooks/useKilnAudio";
import { ApiKeyPanel } from "@/components/shared/ApiKeyPanel";
import type { Phase } from "@/types";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

const PHASE_STEPS: { id: Phase; labelKey: string; num: string }[] = [
  { id: "discovery",   labelKey: "phase.discovery",   num: "01" },
  { id: "alignment",   labelKey: "phase.alignment",   num: "02" },
  { id: "generation",  labelKey: "phase.generation",  num: "03" },
  { id: "refinement",  labelKey: "phase.refinement",  num: "04" },
  { id: "audit",       labelKey: "phase.audit",       num: "05" },
  { id: "completed",   labelKey: "phase.completed",   num: "06" },
];

const PHASE_ORDER = PHASE_STEPS.map((p) => p.id);

function getStepState(
  stepId: Phase,
  current: Phase
): "done" | "now" | "future" {
  const stepIdx = PHASE_ORDER.indexOf(stepId);
  const currIdx = PHASE_ORDER.indexOf(current);
  if (stepIdx < currIdx) return "done";
  if (stepIdx === currIdx) return "now";
  return "future";
}

// ─── Kiln audio toggle ───────────────────────────────────────

function KilnToggle() {
  const [active, setActive] = useState(false);
  const { start, stop } = useKilnAudio();
  const { t } = useI18n();

  const toggle = () => {
    if (active) {
      stop();
      setActive(false);
    } else {
      start();
      setActive(true);
    }
  };

  return (
    <button
      onClick={toggle}
      title={active ? t("kiln.mute") : t("kiln.play")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${active ? "var(--color-heat-border)" : "var(--df-outline)"}`,
        background: active ? "var(--color-heat-08)" : "transparent",
        color: active ? "var(--df-amber-300)" : "var(--df-faint)",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14 }}
      >
        {active ? "volume_up" : "volume_off"}
      </span>
      <span
        className="df-mono"
        style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        Kiln
      </span>
      {active && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--df-amber-500)",
            boxShadow: "0 0 6px var(--df-amber-500)",
            animation: "df-pulse 1.6s ease-in-out infinite",
          }}
        />
      )}
    </button>
  );
}

// ─── TopBar ──────────────────────────────────────────────────

interface TopBarProps {
  phase?: Phase;
  phaseLabel?: string;
  credits?: number;
  docTitle?: string;
  onRenameTitle?: (title: string) => Promise<void>;
  /** Show the dashboard-style nav row when no phase is active. */
  dashboardNav?: boolean;
}

export function TopBar({ phase, credits, docTitle, onRenameTitle, dashboardNav }: TopBarProps) {
  const { t } = useI18n();
  const isCompleted = phase === "completed";
  const isRefinement = phase === "refinement";
  const isEditing = phase === "editing";
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showApiKeys, setShowApiKeys] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) {
      setTitleDraft(docTitle ?? "");
      setTimeout(() => titleInputRef.current?.select(), 0);
    }
  }, [editingTitle, docTitle]);

  const commitTitle = async () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === docTitle) return;
    await onRenameTitle?.(trimmed);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitTitle();
    if (e.key === "Escape") setEditingTitle(false);
  };

  return (
    <>
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "rgba(13,14,15,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--df-outline)",
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 18,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        to="/home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <img
          src="/assets/docforge-logo.png"
          alt="DocForge"
          style={{ height: 28, width: "auto" }}
        />
        <span
          className="df-mono"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--df-on-surface)",
          }}
        >
          DOCFORGE
        </span>
      </Link>

      {/* Dashboard nav row */}
      {dashboardNav && !phase && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { to: "/home", label: t("nav.dashboard") },
            { to: "/how-it-works", label: t("nav.howItWorks") },
            { to: "/mcp", label: "DocForge MCP" },
            { to: "/customize", label: t("nav.customize") },
            { to: "/billing", label: t("nav.billing") },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              style={({ isActive }) => ({
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12.5,
                color: isActive ? "var(--df-on-surface)" : "var(--df-dim)",
                background: isActive ? "var(--color-white-04)" : "transparent",
                textDecoration: "none",
                letterSpacing: "0.02em",
                transition: "color 0.15s, background 0.15s",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      {/* Phase stepper */}
      {phase && !isEditing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginLeft: 28,
          }}
        >
          {PHASE_STEPS.map((step, i) => {
            const state =
              isCompleted && step.id === "completed"
                ? "now-steel"
                : getStepState(step.id, phase);
            const isDone = state === "done";
            const isNow = state === "now";
            const isNowSteel = state === "now-steel";

            const color = isDone
              ? "var(--df-amber-trail)"
              : isNow
              ? "var(--df-amber-500)"
              : isNowSteel
              ? "var(--df-steel-100)"
              : "var(--df-mute)";

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && (
                  <div
                    style={{
                      width: 18,
                      height: 1,
                      background: isDone || isNowSteel
                        ? "var(--df-amber-trail)"
                        : "var(--df-mute)",
                    }}
                  />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    className={isNow ? "animate-df-pulse" : ""}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: color,
                      opacity: isDone || isNow || isNowSteel ? 1 : 0.55,
                      boxShadow: isNow
                        ? "0 0 0 3px rgba(255,77,0,0.18), 0 0 12px rgba(255,77,0,0.6)"
                        : isNowSteel
                        ? "0 0 0 3px var(--df-steel-bg-strong)"
                        : "none",
                    }}
                  />
                  <span
                    className="df-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color,
                    }}
                  >
                    {step.num} {t(step.labelKey)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Kiln audio toggle (refinement only) */}
        {isRefinement && <KilnToggle />}

        {/* API Keys */}
        <button
          onClick={() => setShowApiKeys(true)}
          title={t("nav.manageApiKeys")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 6,
            border: "1px solid var(--df-outline)",
            background: "transparent",
            color: "var(--df-faint)",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-dim)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint)"; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>key</span>
          <span className="df-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("nav.apiKeys")}</span>
        </button>

        <LanguageSwitcher compact />

        {/* Doc title / credits */}
        {docTitle && phase ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              border: "1px solid var(--df-outline)",
              borderRadius: 4,
              padding: "2px 4px 2px 10px",
              maxWidth: 260,
            }}
          >
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
                maxLength={200}
                className="df-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--df-dim)",
                  width: 180,
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <span
                className="df-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--df-dim)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 200,
                }}
              >
                {docTitle.length > 28 ? docTitle.slice(0, 28) + "…" : docTitle}
              </span>
            )}
            {onRenameTitle && (
              <button
                onClick={() => setEditingTitle((v) => !v)}
                title={t("common.rename")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "3px 5px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--df-mute)",
                  borderRadius: 3,
                  transition: "color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-mute)"; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
              </button>
            )}
          </div>
        ) : credits !== undefined ? (
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--df-dim)",
              border: "1px solid var(--df-outline)",
              borderRadius: 4,
              padding: "4px 10px",
            }}
          >
            CREATIONS ·{" "}
            <b style={{ color: "var(--df-amber-300)" }}>{credits}</b>
          </span>
        ) : null}

        <UserButton />
      </div>
    </header>
    {showApiKeys && <ApiKeyPanel onClose={() => setShowApiKeys(false)} />}
    </>
  );
}
