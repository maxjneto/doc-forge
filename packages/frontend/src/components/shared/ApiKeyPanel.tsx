import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiCreateApiKey, apiListApiKeys, apiRevokeApiKey } from "@/utils/api";
import type { ApiKey } from "@/types";

interface ApiKeyPanelProps {
  onClose: () => void;
}

export function ApiKeyPanel({ onClose }: ApiKeyPanelProps) {
  const { getToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<{ id: string; key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiListApiKeys(getToken)
      .then(setKeys)
      .catch(() => setError("Failed to load API keys"))
      .finally(() => setLoading(false));
  }, [getToken]);

  async function handleCreate() {
    const name = newKeyName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await apiCreateApiKey(name, getToken);
      setRevealedKey({ id: result.id, key: result.key, name: result.name });
      setNewKeyName("");
      const updated = await apiListApiKeys(getToken);
      setKeys(updated);
    } catch {
      setError("Failed to create API key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setError(null);
    try {
      await apiRevokeApiKey(keyId, getToken);
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k));
    } catch {
      setError("Failed to revoke API key.");
    }
  }

  function handleCopy() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: "var(--z-toast)",
        background: "var(--color-scrim)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-outline)",
          borderRadius: "0.5rem",
          padding: "32px",
          width: "min(640px, 100%)",
          boxShadow: "var(--shadow-modal)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text)" }}>
              API Keys
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--color-dim)" }}>
              Each key is an agent identity. Use one key per tool or environment.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-faint)", padding: "4px", lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Revealed key (one-time display) */}
        {revealedKey && (
          <div style={{
            background: "var(--color-surface-mid)",
            border: "1px solid var(--color-heat-line)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--color-heat)", marginBottom: "8px" }}>
              Copy your key — it won't be shown again
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{
                flex: 1, fontSize: 12.5, color: "var(--color-text)",
                background: "var(--color-hover)", borderRadius: "var(--radius-xs)",
                padding: "8px 10px", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {revealedKey.key}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600,
                  border: "1px solid var(--color-heat-line)",
                  background: copied ? "var(--color-heat-strong)" : "var(--color-heat-wash)",
                  color: "var(--color-heat)", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setRevealedKey(null)}
                style={{
                  padding: "8px 14px", borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600,
                  border: "1px solid var(--color-outline-md)",
                  background: "transparent", color: "var(--color-dim)", cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Create new key */}
        <div>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--color-dim)", marginBottom: "8px" }}>
            New API Key
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="e.g. Claude Code — work laptop"
              maxLength={100}
              style={{
                flex: 1,
                background: "var(--color-hover)",
                border: "1px solid var(--color-outline-md)",
                borderRadius: "var(--radius-sm)",
                padding: "9px 12px",
                fontSize: 13,
                color: "var(--color-text)",
                fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-heat-line)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-press)"; }}
            />
            <button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || creating}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "9px 18px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--color-heat-line)",
                background: (!newKeyName.trim() || creating) ? "var(--color-heat-tint)" : "var(--color-heat-wash)",
                color: (!newKeyName.trim() || creating) ? "var(--color-heat-line)" : "var(--color-heat)",
                cursor: (!newKeyName.trim() || creating) ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {creating ? "Creating…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ fontSize: 12.5, color: "var(--color-error)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>
            {error}
          </div>
        )}

        {/* Keys list */}
        <div>
          <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--color-dim)", marginBottom: "10px" }}>
            Active Keys
          </label>
          {loading ? (
            <div style={{ fontSize: 13, color: "var(--color-faint)", padding: "16px 0" }}>Loading…</div>
          ) : keys.filter((k) => !k.revokedAt).length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-faint)", padding: "16px 0" }}>No active keys. Generate one above.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {keys.filter((k) => !k.revokedAt).map((key) => (
                <div key={key.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "var(--color-hover)",
                  border: "1px solid var(--color-outline)",
                  borderRadius: "var(--radius-md)",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{key.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--color-faint)" }}>
                      Created {formatDate(key.createdAt)}
                      {key.lastUsedAt ? ` · Last used ${formatDate(key.lastUsedAt)}` : " · Never used"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    style={{
                      padding: "5px 12px", borderRadius: "var(--radius-sm)", fontSize: 12.5,
                      border: "1px solid var(--color-error-strong)",
                      background: "var(--color-error-tint)",
                      color: "var(--color-error)",
                      cursor: "pointer",
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
