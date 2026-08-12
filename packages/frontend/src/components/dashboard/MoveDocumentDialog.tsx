import { useEffect, useMemo, useState } from "react";
import type { Folder } from "@/types";
import { Button, Card } from "@/components/ui";
import { useI18n } from "@/i18n";

interface MoveDocumentDialogProps {
  documentTitle: string;
  currentFolderId: string | null;
  folders: Folder[];
  onMove: (folderId: string | null) => Promise<void>;
  onClose: () => void;
}

export function MoveDocumentDialog({
  documentTitle,
  currentFolderId,
  folders,
  onMove,
  onClose,
}: MoveDocumentDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(currentFolderId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const childrenByParent = useMemo(() => {
    const grouped = new Map<string | null, Folder[]>();
    for (const folder of folders) {
      const siblings = grouped.get(folder.parentId) ?? [];
      siblings.push(folder);
      grouped.set(folder.parentId, siblings);
    }
    for (const siblings of grouped.values()) {
      siblings.sort((a, b) => a.name.localeCompare(b.name));
    }
    return grouped;
  }, [folders]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  async function move() {
    if (selected === currentFolderId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onMove(selected);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("folder.moveErrorDocument"));
    } finally {
      setBusy(false);
    }
  }

  function folderRows(parentId: string | null, depth: number): React.ReactNode {
    return (childrenByParent.get(parentId) ?? []).map((folder) => (
      <div key={folder.id}>
        <button
          onClick={() => setSelected(folder.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            minHeight: 34,
            padding: "6px 9px",
            paddingLeft: 10 + depth * 18,
            border: 0,
            borderRadius: 5,
            background: selected === folder.id ? "var(--color-white-04)" : "transparent",
            boxShadow: selected === folder.id ? "inset 3px 0 0 var(--df-steel-200)" : "none",
            color: selected === folder.id ? "var(--df-on-surface)" : "var(--df-dim)",
            font: "inherit",
            fontSize: 12.5,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--df-amber-300)", fontVariationSettings: "'FILL' 1" }}>
            folder
          </span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
          {currentFolderId === folder.id && <span className="df-mono" style={{ fontSize: 8.5, color: "var(--df-faint)" }}>{t("common.current").toUpperCase()}</span>}
        </button>
        {folderRows(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-scrim)" }}>
      <Card padded={false} style={{ width: 440, maxWidth: "92vw", padding: 22 }}>
        <div onClick={(event) => event.stopPropagation()}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{t("folder.moveDocument", { name: documentTitle })}</h2>
          <p style={{ margin: "5px 0 17px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: "var(--df-faint)" }}>
            {documentTitle}
          </p>

          <div style={{ maxHeight: 340, overflowY: "auto", padding: 5, border: "1px solid var(--df-outline)", borderRadius: 8, background: "var(--df-bg)" }}>
            <button
              onClick={() => setSelected(null)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 36, padding: "6px 9px", border: 0, borderRadius: 5, background: selected === null ? "var(--color-white-04)" : "transparent", boxShadow: selected === null ? "inset 3px 0 0 var(--df-steel-200)" : "none", color: selected === null ? "var(--df-on-surface)" : "var(--df-dim)", font: "inherit", fontSize: 12.5, textAlign: "left", cursor: "pointer" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--df-faint)" }}>home</span>
              <span style={{ flex: 1 }}>{t("dashboard.libraryShort")}</span>
              {currentFolderId === null && <span className="df-mono" style={{ fontSize: 8.5, color: "var(--df-faint)" }}>{t("common.current").toUpperCase()}</span>}
            </button>
            {folderRows(null, 0)}
          </div>

          {error && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--df-error)" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <Button onClick={onClose}>{t("common.cancel")}</Button>
            <Button variant="primary" disabled={selected === currentFolderId || busy} onClick={() => void move()}>
              {busy ? t("folder.moving") : t("folder.moveHere")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
