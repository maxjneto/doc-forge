import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

export type DocumentRole = "owner" | "editor" | "commenter" | "viewer";

export const canEditAs = (role: DocumentRole) => role === "owner" || role === "editor";
export const canCommentAs = (role: DocumentRole) => role !== "viewer";

/**
 * What every document says about itself the same way, next to its own state: the
 * viewer's role when it limits them, and that an agent works on it through MCP.
 */
export function ContextPills({ role, viaMcp }: { role: DocumentRole; viaMcp: boolean }) {
  const { t } = useI18n();
  return (
    <>
      {role === "viewer" && <Pill tone="ghost">{t("doc.role.viewer")}</Pill>}
      {role === "commenter" && <Pill tone="ghost">{t("doc.role.commenter")}</Pill>}
      {viaMcp && <Pill tone="steel">{t("editor.mcpManaged")}</Pill>}
    </>
  );
}
