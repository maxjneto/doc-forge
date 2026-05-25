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
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#121414",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "0.5rem",
          padding: "32px",
          width: "min(640px, 100%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.03em", color: "#e3e2e2" }}>
              API Keys
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(200,198,197,0.5)" }}>
              Each key is an agent identity. Use one key per tool or environment.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,198,197,0.4)", padding: "4px", lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Revealed key (one-time display) */}
        {revealedKey && (
          <div style={{
            background: "rgba(26,27,27,0.8)",
            border: "1px solid rgba(255,77,0,0.3)",
            borderRadius: "8px",
            padding: "16px",
          }}>
            <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "#FF4D00", marginBottom: "8px" }}>
              Copy your key — it won't be shown again
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{
                flex: 1, fontSize: "12px", color: "#e3e2e2",
                background: "rgba(255,255,255,0.04)", borderRadius: "4px",
                padding: "8px 10px", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {revealedKey.key}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                  border: "1px solid rgba(255,77,0,0.4)",
                  background: copied ? "rgba(255,77,0,0.15)" : "rgba(255,77,0,0.08)",
                  color: "#FF4D00", cursor: "pointer", whiteSpace: "nowrap",
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
                  padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent", color: "rgba(200,198,197,0.5)", cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Create new key */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(200,198,197,0.45)", marginBottom: "8px" }}>
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
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "6px",
                padding: "9px 12px",
                fontSize: "13px",
                color: "#e3e2e2",
                fontFamily: "inherit",
                outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,77,0,0.45)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
            <button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || creating}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "9px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                border: "1px solid rgba(255,77,0,0.5)",
                background: (!newKeyName.trim() || creating) ? "rgba(255,77,0,0.06)" : "rgba(255,77,0,0.10)",
                color: (!newKeyName.trim() || creating) ? "rgba(255,77,0,0.5)" : "#FF4D00",
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
          <div style={{ fontSize: "12px", color: "#e86464", display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>
            {error}
          </div>
        )}

        {/* Keys list */}
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(200,198,197,0.45)", marginBottom: "10px" }}>
            Active Keys
          </label>
          {loading ? (
            <div style={{ fontSize: "13px", color: "rgba(200,198,197,0.4)", padding: "16px 0" }}>Loading…</div>
          ) : keys.filter((k) => !k.revokedAt).length === 0 ? (
            <div style={{ fontSize: "13px", color: "rgba(200,198,197,0.35)", padding: "16px 0" }}>No active keys. Generate one above.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {keys.filter((k) => !k.revokedAt).map((key) => (
                <div key={key.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#e3e2e2" }}>{key.name}</span>
                    <span style={{ fontSize: "11px", color: "rgba(200,198,197,0.4)" }}>
                      Created {formatDate(key.createdAt)}
                      {key.lastUsedAt ? ` · Last used ${formatDate(key.lastUsedAt)}` : " · Never used"}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    style={{
                      padding: "5px 12px", borderRadius: "5px", fontSize: "12px",
                      border: "1px solid rgba(232,100,100,0.25)",
                      background: "rgba(232,100,100,0.05)",
                      color: "rgba(232,100,100,0.7)",
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
