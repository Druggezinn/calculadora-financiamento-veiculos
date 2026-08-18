import React, { createContext, useContext, useEffect, useState } from "react";
import { resolveInitialTheme, saveThemePreference, type Theme } from "./themePreference";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [themeState, setThemeState] = useState(() => {
    if (!switchable || typeof window === "undefined") {
      return { theme: defaultTheme, source: "fallback" as const };
    }

    return resolveInitialTheme(
      window.localStorage,
      typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : undefined,
      defaultTheme,
    );
  });
  const theme = themeState.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.style.colorScheme = theme;

    if (switchable && themeState.source === "saved") {
      saveThemePreference(window.localStorage, theme);
    }
  }, [theme, switchable, themeState.source]);

  useEffect(() => {
    if (
      !switchable ||
      themeState.source === "saved" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateThemeFromSystem = (event: MediaQueryListEvent) => {
      setThemeState(current => current.source === "saved"
        ? current
        : { theme: event.matches ? "dark" : "light", source: "system" });
    };

    mediaQuery.addEventListener("change", updateThemeFromSystem);
    return () => mediaQuery.removeEventListener("change", updateThemeFromSystem);
  }, [switchable, themeState.source]);

  const toggleTheme = switchable
    ? () => {
        setThemeState(current => ({
          theme: current.theme === "light" ? "dark" : "light",
          source: "saved",
        }));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
