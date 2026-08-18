import { describe, expect, it, vi } from "vitest";
import { readThemePreference, saveThemePreference } from "./themePreference";

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
});
