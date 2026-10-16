/**
 * Where agents connect. Baked at build time (VITE_MCP_URL) so a deploy on another
 * domain — or a local stack — shows the right address in every setup snippet.
 */
export const MCP_URL: string = (import.meta.env.VITE_MCP_URL as string | undefined) || "https://mcp.docforge.dev/mcp";
