import { useCallback, useEffect, useState } from "react";
import type { TokenOverrides } from "@docforge-lib/layout";
import { apiCreateLayoutTheme, apiDeleteLayoutTheme, apiListLayoutThemes, apiUpdateLayoutTheme, type LayoutTheme } from "@/utils/api";

type GetToken = () => Promise<string | null>;

export interface ThemeLibrary {
  themes: LayoutTheme[];
  /** Families a theme may use (the ones the layout engine measures). */
  fonts: string[];
  loading: boolean;
  error: boolean;
  save: (name: string, tokens: TokenOverrides) => Promise<LayoutTheme>;
  update: (id: string, patch: { name?: string; tokens?: TokenOverrides }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** The person's themes (built-in ones first), shared by the Design panel and the theme picker. */
export function useThemes(getToken: GetToken): ThemeLibrary {
  const [themes, setThemes] = useState<LayoutTheme[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiListLayoutThemes(getToken)
      .then((data) => {
        if (cancelled) return;
        setThemes(data.themes);
        setFonts(data.fonts);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const save = useCallback(
    async (name: string, tokens: TokenOverrides) => {
      const theme = await apiCreateLayoutTheme(name, tokens as LayoutTheme["tokens"], getToken);
      setThemes((list) => [...list, theme]);
      return theme;
    },
    [getToken],
  );
  const update = useCallback(
    async (id: string, patch: { name?: string; tokens?: TokenOverrides }) => {
      const theme = await apiUpdateLayoutTheme(id, patch as { name?: string; tokens?: LayoutTheme["tokens"] }, getToken);
      setThemes((list) => list.map((t) => (t.id === id ? theme : t)));
    },
    [getToken],
  );
  const remove = useCallback(
    async (id: string) => {
      await apiDeleteLayoutTheme(id, getToken);
      setThemes((list) => list.filter((t) => t.id !== id));
    },
    [getToken],
  );
  return { themes, fonts, loading, error, save, update, remove };
}
