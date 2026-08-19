import * as db from "../db";
import {
  generateSessionToken,
  getLocalSessionCookieOptions,
  hashPassword,
  hashSessionToken,
  isStrongPassword,
  isValidUsername,
  LOCAL_LOCK_DURATION_MS,
  LOCAL_MAX_LOGIN_FAILURES,
  LOCAL_SESSION_COOKIE,
  LOCAL_SESSION_TTL_MS,
  normalizeUsername,
  safeSecretEquals,
  verifyPassword,
} from "../localAuth";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(64).refine(isValidUsername, {
    message: "Use letras minúsculas, números, ponto, hífen ou sublinhado no usuário.",
  }),
  password: z.string().min(12).max(128),
}).strict();

function isSecureRequest(protocol: string | undefined) {
  return protocol === "https" || process.env.NODE_ENV === "production";
}

export const localAuthRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  status: publicProcedure.query(async () => ({ hasAdmin: await db.hasLocalAdmin() })),
  login: publicProcedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    const username = normalizeUsername(input.username);
    const recentFailures = await db.countRecentFailedLoginAttempts(
      username,
      new Date(Date.now() - LOCAL_LOCK_DURATION_MS),
    );
    if (recentFailures >= LOCAL_MAX_LOGIN_FAILURES) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Aguarde alguns minutos antes de tentar novamente." });
    }

    const user = await db.getLocalUserByUsername(username);
    const isLocked = Boolean(user?.lockUntil && user.lockUntil > new Date());
    const passwordMatches = user && !isLocked ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !passwordMatches) {
      await db.recordLocalLoginAttempt(username, false);
      if (user && !isLocked) await db.registerLocalLoginFailure(user);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
    }

    await db.recordLocalLoginAttempt(username, true);
    await db.registerSuccessfulLocalLogin(user.id);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + LOCAL_SESSION_TTL_MS);
    await db.createLocalAuthSession({ userId: user.id, sessionHash: hashSessionToken(token), expiresAt });
    ctx.res.cookie(LOCAL_SESSION_COOKIE, token, {
      ...getLocalSessionCookieOptions(isSecureRequest(ctx.req.protocol)),
      maxAge: LOCAL_SESSION_TTL_MS,
    });
    return { id: user.id, username: user.username, role: user.role };
  }),
  bootstrapAdmin: publicProcedure
    .input(credentialsSchema.extend({ setupToken: z.string().min(24).max(256) }))
    .mutation(async ({ input }) => {
      const expectedToken = process.env.LOCAL_ADMIN_SETUP_TOKEN;
      if (!expectedToken || !safeSecretEquals(input.setupToken, expectedToken) || await db.hasLocalAdmin()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Não foi possível concluir o provisionamento." });
      }
      const username = normalizeUsername(input.username);
      if (!isStrongPassword(input.password) || await db.getLocalUserByUsername(username)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível concluir o provisionamento." });
      }
      const user = await db.createLocalUser({ username, passwordHash: await hashPassword(input.password), role: "admin" });
      return { id: user?.id, username: user?.username, role: user?.role };
    }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.req.headers.cookie
      ?.split(";")
      .map(item => item.trim())
      .find(item => item.startsWith(`${LOCAL_SESSION_COOKIE}=`))
      ?.slice(LOCAL_SESSION_COOKIE.length + 1);
    if (token) await db.revokeLocalSession(hashSessionToken(token));
    ctx.res.clearCookie(LOCAL_SESSION_COOKIE, {
      ...getLocalSessionCookieOptions(isSecureRequest(ctx.req.protocol)),
      maxAge: -1,
    });
    return { success: true } as const;
  }),
});
