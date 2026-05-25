import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { apiListApiKeys } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { ApiKey } from "@/types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatCreated(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConnectedAgentsCard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiListApiKeys(getToken)
      .then((data) => {
        if (!cancelled) setKeys(data.filter((k) => !k.revokedAt));
      })
      .catch(() => {
        if (!cancelled) setKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <>
      <section style={cardStyle}>
        <header style={headStyle}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Connected agents</span>
        </header>
        <div style={{ padding: "14px 18px" }}>
          {keys === null && <Empty>Loading…</Empty>}
          {keys && keys.length === 0 && (
            <Empty>
              No agents connected yet. Generate an API key to hook up Claude Code, Cursor, or any MCP-capable client.
            </Empty>
          )}
          {keys && keys.map((k, i) => (
            <div
              key={k.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--df-outline)",
              }}
            >
              <span
                className="df-mono"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  background: "var(--df-steel-bg)",
                  border: "1px solid var(--df-steel-border)",
                  color: "var(--df-steel-100)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {k.harness && isHarness(k.harness)
                  ? <img src={HARNESS_META[k.harness].logo} width={14} height={14} alt={HARNESS_META[k.harness].label} />
                  : initials(k.name)}
              </span>
              <span style={{ fontSize: 12.5, color: k.harness && isHarness(k.harness) ? HARNESS_META[k.harness].fg : "#e3e2e2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {k.name}
              </span>
              <span
                className="df-mono"
                style={{
                  marginLeft: "auto",
                  fontSize: 9.5,
                  letterSpacing: "0.10em",
                  color: "var(--df-faint)",
                  textTransform: "uppercase",
                }}
              >
                Added {formatCreated(k.createdAt)}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            margin: "0 18px 18px",
            padding: 14,
            border: "1px dashed var(--df-outline-md)",
            borderRadius: 8,
            textAlign: "center",
          }}
        >
          <button
            onClick={() => navigate("/mcp")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--df-steel-100)",
              padding: "7px 12px",
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              border: "1px solid var(--df-steel-border)",
              background: "var(--df-steel-bg)",
              cursor: "pointer",
              width: "100%",
              justifyContent: "center",
              fontFamily: "inherit",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            Connect another agent
          </button>
        </div>
      </section>
    </>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--df-outline)",
  borderRadius: 12,
  background: "rgba(18,20,20,0.5)",
  overflow: "hidden",
};

const headStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--df-outline)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};


function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: "var(--df-faint)", lineHeight: 1.5, padding: "4px 0" }}>{children}</div>
  );
}
