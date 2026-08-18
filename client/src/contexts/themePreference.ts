export type Theme = "light" | "dark";
export type ThemeSource = "saved" | "system" | "fallback";

type ThemeResolution = {
  theme: Theme;
  source: ThemeSource;
};

type MatchMedia = (query: string) => Pick<MediaQueryList, "matches">;

const THEME_STORAGE_KEY = "theme";

function readStoredTheme(storage: Pick<Storage, "getItem"> | undefined): Theme | undefined {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readThemePreference(storage: Pick<Storage, "getItem"> | undefined, fallback: Theme): Theme {
  return readStoredTheme(storage) ?? fallback;
}

export function resolveInitialTheme(
  storage: Pick<Storage, "getItem"> | undefined,
  matchMedia: MatchMedia | undefined,
  fallback: Theme,
): ThemeResolution {
  const savedTheme = readStoredTheme(storage);
  if (savedTheme) {
    return { theme: savedTheme, source: "saved" };
  }

  try {
    if (matchMedia) {
      return {
        theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
        source: "system",
      };
    }
  } catch {
    // Mantém o tema de fallback quando o navegador bloqueia a consulta de preferência do sistema.
  }

  return { theme: fallback, source: "fallback" };
}

export function saveThemePreference(storage: Pick<Storage, "setItem"> | undefined, theme: Theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // O tema continua ativo nesta sessão mesmo quando o navegador bloqueia armazenamento local.
  }
}
