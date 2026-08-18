import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isStrongPassword,
  normalizeUsername,
  verifyPassword,
} from "./localAuth";

describe("autenticação local", () => {
  it("gera e verifica hash Argon2id sem expor a senha", async () => {
    const password = "Uma-senha-longa-para-teste";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toContain(password);
    expect(await verifyPassword(password, passwordHash)).toBe(true);
    expect(await verifyPassword("senha-incorreta", passwordHash)).toBe(false);
  });

  it("normaliza o identificador e exige senha com comprimento mínimo", () => {
    expect(normalizeUsername("  Administrador  ")).toBe("administrador");
    expect(isStrongPassword("curta")).toBe(false);
    expect(isStrongPassword("senha-com-12-ou-mais")).toBe(true);
  });

  it("mantém tokens opacos e armazena somente seu hash determinístico", () => {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    expect(token).not.toBe(tokenHash);
    expect(tokenHash).toHaveLength(64);
    expect(hashSessionToken(token)).toBe(tokenHash);
  });
});
