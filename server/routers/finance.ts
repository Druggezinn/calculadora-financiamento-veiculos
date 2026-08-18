import * as db from "../db";
import { BCB_SOURCE_URL, fetchBcbVehicleRates } from "../rateSync";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const rateInput = z.object({
  id: z.number().int().positive(),
  monthlyRate: z.number().min(0).max(100),
  annualRate: z.number().min(0).max(1_000).nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  sourceDescription: z.string().max(1_000).nullable().optional(),
  referenceStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  referenceEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const financeRouter = router({
  listRates: publicProcedure.query(() => db.listActiveFinancialInstitutions()),
  updateRate: adminProcedure.input(rateInput).mutation(async ({ ctx, input }) => {
    const rates = await db.listActiveFinancialInstitutions();
    const previous = rates.find(rate => rate.id === input.id);
    if (!previous) throw new TRPCError({ code: "NOT_FOUND", message: "Financeira não encontrada." });
    const updated = await db.updateFinancialInstitutionRate(input);
    await db.createAdminAuditLog({
      actorOpenId: ctx.user.openId,
      action: "rate.updated",
      targetType: "financialInstitution",
      targetId: String(input.id),
      previousValue: JSON.stringify({ monthlyRate: previous.monthlyRate, annualRate: previous.annualRate }),
      nextValue: JSON.stringify({ monthlyRate: updated?.monthlyRate, annualRate: updated?.annualRate }),
      sourceUrl: updated?.sourceUrl,
    });
    return updated;
  }),
  syncRates: adminProcedure.mutation(async ({ ctx }) => {
    const configuredRates = await db.listActiveFinancialInstitutions();
    try {
      const sourceRates = await fetchBcbVehicleRates();
      const byCnpj = new Map(sourceRates.map(rate => [rate.cnpj8, rate]));
      const changes: string[] = [];
      let updatedCount = 0;
      let referenceStart: string | null = null;
      let referenceEnd: string | null = null;

      for (const configuredRate of configuredRates) {
        const sourceRate = configuredRate.bcbCnpj8 ? byCnpj.get(configuredRate.bcbCnpj8) : undefined;
        if (!sourceRate) {
          changes.push(`${configuredRate.displayName}: não localizado na fonte.`);
          continue;
        }
        await db.updateFinancialInstitutionRate({
          id: configuredRate.id,
          monthlyRate: sourceRate.monthlyRate,
          annualRate: sourceRate.annualRate,
          sourceUrl: BCB_SOURCE_URL,
          sourceDescription: `Média de referência do Banco Central — ${sourceRate.institutionName}.`,
          referenceStart: sourceRate.referenceStart,
          referenceEnd: sourceRate.referenceEnd,
        });
        await db.createAdminAuditLog({
          actorOpenId: ctx.user.openId,
          action: "rate.synced",
          targetType: "financialInstitution",
          targetId: String(configuredRate.id),
          previousValue: JSON.stringify({ monthlyRate: configuredRate.monthlyRate, annualRate: configuredRate.annualRate }),
          nextValue: JSON.stringify({ monthlyRate: sourceRate.monthlyRate, annualRate: sourceRate.annualRate }),
          sourceUrl: BCB_SOURCE_URL,
        });
        updatedCount += 1;
        referenceStart = sourceRate.referenceStart ?? referenceStart;
        referenceEnd = sourceRate.referenceEnd ?? referenceEnd;
      }

      const status = updatedCount === configuredRates.length ? "success" : "partial";
      await db.recordRateSyncRun({
        actorOpenId: ctx.user.openId,
        sourceUrl: BCB_SOURCE_URL,
        status,
        referenceStart,
        referenceEnd,
        recordsFound: sourceRates.length,
        recordsUpdated: updatedCount,
        details: changes.join(" ") || null,
      });
      return { status, recordsFound: sourceRates.length, recordsUpdated: updatedCount, details: changes };
    } catch (error) {
      const details = error instanceof Error ? error.message : "Falha desconhecida na fonte oficial.";
      await db.recordRateSyncRun({
        actorOpenId: ctx.user.openId,
        sourceUrl: BCB_SOURCE_URL,
        status: "failed",
        recordsFound: 0,
        recordsUpdated: 0,
        details,
      });
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível consultar a fonte oficial no momento." });
    }
  }),
});
