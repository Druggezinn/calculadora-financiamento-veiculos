import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinancialInstitution } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listRates: vi.fn(),
  updateRate: vi.fn(),
}));

vi.mock("./db", () => ({
  listActiveFinancialInstitutions: mocks.listRates,
  updateFinancialInstitutionRate: mocks.updateRate,
}));

import { appRouter } from "./routers";

const sampleRate: FinancialInstitution = {
  id: 1,
  slug: "itau",
  displayName: "Itaú",
  legalName: "ITAÚ UNIBANCO HOLDING S.A.",
  monthlyRate: 2.05,
  annualRate: 27.64,
  sourceUrl: null,
  sourceDescription: null,
  referenceStart: "2026-07-28",
  referenceEnd: "2026-08-03",
  sortOrder: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createContext(role: "admin" | "user" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          openId: "test-user",
          name: "Test user",
          email: "test@example.com",
          loginMethod: "test",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("finance routes", () => {
  beforeEach(() => {
    mocks.listRates.mockReset();
    mocks.updateRate.mockReset();
    mocks.listRates.mockResolvedValue([sampleRate]);
    mocks.updateRate.mockResolvedValue(sampleRate);
  });

  it("expõe as taxas ativas sem exigir autenticação", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.finance.listRates()).resolves.toEqual([sampleRate]);
  });

  it("permite que o administrador atualize uma taxa", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await caller.finance.updateRate({ id: 1, monthlyRate: 1.95 });
    expect(mocks.updateRate).toHaveBeenCalledWith({ id: 1, monthlyRate: 1.95 });
  });

  it("bloqueia edição de taxa para usuário não administrativo", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.finance.updateRate({ id: 1, monthlyRate: 1.95 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
