export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

export function readThemePreference(storage: Pick<Storage, "getItem"> | undefined, fallback: Theme): Theme {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : fallback;
  } catch {
    return fallback;
  }
}

export function saveThemePreference(storage: Pick<Storage, "setItem"> | undefined, theme: Theme) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // O tema continua ativo nesta sessão mesmo quando o navegador bloqueia armazenamento local.
  }
}
