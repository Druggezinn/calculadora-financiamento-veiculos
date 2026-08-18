import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  finance: router({
    listRates: publicProcedure.query(() => db.listActiveFinancialInstitutions()),
    updateRate: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          monthlyRate: z.number().min(0).max(100),
          annualRate: z.number().min(0).max(1_000).nullable().optional(),
          sourceUrl: z.string().url().nullable().optional(),
          sourceDescription: z.string().max(1_000).nullable().optional(),
          referenceStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          referenceEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        }),
      )
      .mutation(({ input }) => db.updateFinancialInstitutionRate(input)),
  }),
});

export type AppRouter = typeof appRouter;
