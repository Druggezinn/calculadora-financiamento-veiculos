import { describe, expect, it, vi } from "vitest";
import { readThemePreference, resolveInitialTheme, saveThemePreference } from "./themePreference";

describe("preferência de tema", () => {
  it("lê apenas valores de tema suportados e usa o padrão para dados inválidos", () => {
    expect(readThemePreference({ getItem: () => "dark" }, "light")).toBe("dark");
    expect(readThemePreference({ getItem: () => "system" }, "light")).toBe("light");
  });

  it("persiste o tema quando o armazenamento está disponível e tolera falhas", () => {
    const setItem = vi.fn();
    saveThemePreference({ setItem }, "dark");
    expect(setItem).toHaveBeenCalledWith("theme", "dark");
    expect(() => saveThemePreference({ setItem: () => { throw new Error("bloqueado"); } }, "light")).not.toThrow();
  });

  it("usa o tema do sistema somente quando não há uma escolha manual persistida", () => {
    const prefersDark = () => ({ matches: true });

    expect(resolveInitialTheme({ getItem: () => null }, prefersDark, "light")).toEqual({
      theme: "dark",
      source: "system",
    });
    expect(resolveInitialTheme({ getItem: () => "light" }, prefersDark, "dark")).toEqual({
      theme: "light",
      source: "saved",
    });
  });

  it("mantém o fallback quando a consulta ao sistema não está disponível", () => {
    expect(resolveInitialTheme({ getItem: () => null }, undefined, "light")).toEqual({
      theme: "light",
      source: "fallback",
    });
    expect(resolveInitialTheme({ getItem: () => null }, () => { throw new Error("bloqueado"); }, "dark")).toEqual({
      theme: "dark",
      source: "fallback",
    });
  });
});
