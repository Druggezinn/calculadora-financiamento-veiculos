import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinancialInstitution } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  listRates: vi.fn(),
  updateRate: vi.fn(),
  createAuditLog: vi.fn(),
  recordSyncRun: vi.fn(),
  fetchBcbRates: vi.fn(),
}));

vi.mock("./db", () => ({
  listActiveFinancialInstitutions: mocks.listRates,
  updateFinancialInstitutionRate: mocks.updateRate,
  createAdminAuditLog: mocks.createAuditLog,
  recordRateSyncRun: mocks.recordSyncRun,
}));

vi.mock("./rateSync", () => ({
  BCB_SOURCE_URL: "https://dados.bcb.gov.br/taxas",
  fetchBcbVehicleRates: mocks.fetchBcbRates,
}));

import { appRouter } from "./routers";

const matchedRate: FinancialInstitution = {
  id: 1,
  slug: "itau",
  displayName: "Itaú",
  legalName: "BANCO ITAÚ UNIBANCO S.A.",
  bcbCnpj8: "60872504",
  monthlyRate: 2.05,
  annualRate: 27.64,
  sourceUrl: null,
  sourceDescription: null,
  referenceStart: null,
  referenceEnd: null,
  sortOrder: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const unmatchedRate: FinancialInstitution = {
  ...matchedRate,
  id: 2,
  slug: "bv",
  displayName: "BV",
  bcbCnpj8: "12345678",
};

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "local:test-admin",
      name: "Administrador de teste",
      email: null,
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("finance.syncRates", () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.listRates.mockResolvedValue([matchedRate, unmatchedRate]);
    mocks.updateRate.mockResolvedValue(matchedRate);
    mocks.fetchBcbRates.mockResolvedValue([
      {
        institutionName: "BANCO ITAÚ UNIBANCO S.A.",
        cnpj8: "60872504",
        monthlyRate: 1.92,
        annualRate: 25.64,
        referenceStart: "2026-08-03",
        referenceEnd: "2026-08-07",
      },
    ]);
  });

  it("bloqueia sincronização para quem não é administrador", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.finance.syncRates()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.fetchBcbRates).not.toHaveBeenCalled();
  });

  it("sincroniza CNPJ correspondente e registra resultado parcial", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.finance.syncRates()).resolves.toEqual({
      status: "partial",
      recordsFound: 1,
      recordsUpdated: 1,
      details: ["BV: não localizado na fonte."],
    });
    expect(mocks.updateRate).toHaveBeenCalledWith(expect.objectContaining({ id: 1, monthlyRate: 1.92 }));
    expect(mocks.updateRate).not.toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
    expect(mocks.recordSyncRun).toHaveBeenCalledWith(expect.objectContaining({ status: "partial", recordsUpdated: 1 }));
  });

  it("registra falha de fonte e não expõe o detalhe técnico ao cliente", async () => {
    mocks.fetchBcbRates.mockRejectedValue(new Error("timeout da origem"));
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.finance.syncRates()).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "Não foi possível consultar a fonte oficial no momento.",
    });
    expect(mocks.recordSyncRun).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      details: "timeout da origem",
    }));
  });
});
