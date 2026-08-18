import { and, asc, count, eq, gte, gt, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  financialInstitutions,
  InsertUser,
  adminAuditLogs,
  appSettings,
  localAuthSessions,
  localLoginAttempts,
  localUsers,
  rateSyncRuns,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listActiveFinancialInstitutions() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(financialInstitutions)
    .where(eq(financialInstitutions.isActive, true))
    .orderBy(asc(financialInstitutions.sortOrder));
}

export async function updateFinancialInstitutionRate(input: {
  id: number;
  monthlyRate: number;
  annualRate?: number | null;
  sourceUrl?: string | null;
  sourceDescription?: string | null;
  referenceStart?: string | null;
  referenceEnd?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const updateValues = {
    monthlyRate: input.monthlyRate,
    ...("annualRate" in input ? { annualRate: input.annualRate ?? null } : {}),
    ...("sourceUrl" in input ? { sourceUrl: input.sourceUrl ?? null } : {}),
    ...("sourceDescription" in input
      ? { sourceDescription: input.sourceDescription ?? null }
      : {}),
    ...("referenceStart" in input
      ? { referenceStart: input.referenceStart ?? null }
      : {}),
    ...("referenceEnd" in input
      ? { referenceEnd: input.referenceEnd ?? null }
      : {}),
  };

  await db
    .update(financialInstitutions)
    .set(updateValues)
    .where(eq(financialInstitutions.id, input.id));

  const result = await db
    .select()
    .from(financialInstitutions)
    .where(eq(financialInstitutions.id, input.id))
    .limit(1);

  return result[0];
}

export async function getLocalUserByUsername(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.username, username))
    .limit(1);
  return result[0];
}

export async function hasLocalAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db
    .select({ id: localUsers.id })
    .from(localUsers)
    .where(eq(localUsers.role, "admin"))
    .limit(1);
  return Boolean(result[0]);
}

export async function createLocalUser(input: {
  username: string;
  passwordHash: string;
  role: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  await db.insert(localUsers).values(input);
  return getLocalUserByUsername(input.username);
}

export async function countRecentFailedLoginAttempts(username: string, since: Date) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const result = await db
    .select({ total: count() })
    .from(localLoginAttempts)
    .where(
      and(
        eq(localLoginAttempts.username, username),
        eq(localLoginAttempts.wasSuccessful, false),
        gte(localLoginAttempts.createdAt, since),
      ),
    );
  return Number(result[0]?.total ?? 0);
}

export async function recordLocalLoginAttempt(username: string, wasSuccessful: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(localLoginAttempts).values({ username, wasSuccessful });
}

export async function registerLocalLoginFailure(user: typeof localUsers.$inferSelect) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  const nextCount = user.failedLoginCount + 1;
  const lockUntil =
    nextCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : user.lockUntil;
  await db
    .update(localUsers)
    .set({ failedLoginCount: nextCount, lockUntil })
    .where(eq(localUsers.id, user.id));
}

export async function registerSuccessfulLocalLogin(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db
    .update(localUsers)
    .set({ failedLoginCount: 0, lockUntil: null, lastLoginAt: new Date() })
    .where(eq(localUsers.id, userId));
}

export async function createLocalAuthSession(input: {
  userId: number;
  sessionHash: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(localAuthSessions).values(input);
}

export async function getLocalUserBySessionHash(sessionHash: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: localUsers.id,
      username: localUsers.username,
      role: localUsers.role,
      lastLoginAt: localUsers.lastLoginAt,
    })
    .from(localAuthSessions)
    .innerJoin(localUsers, eq(localAuthSessions.userId, localUsers.id))
    .where(
      and(
        eq(localAuthSessions.sessionHash, sessionHash),
        isNull(localAuthSessions.revokedAt),
        gt(localAuthSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return result[0];
}

export async function revokeLocalSession(sessionHash: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(localAuthSessions)
    .set({ revokedAt: new Date() })
    .where(eq(localAuthSessions.sessionHash, sessionHash));
}

export async function getAppSettings() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1);
  if (result[0]) return result[0];
  await db.insert(appSettings).values({ id: 1, brandName: "AutoFin" });
  return (await db.select().from(appSettings).where(eq(appSettings.id, 1)).limit(1))[0]!;
}

export async function updateAppSettings(input: {
  brandName: string;
  logoUrl?: string | null;
  logoStorageKey?: string | null;
  updatedByOpenId: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await getAppSettings();
  await db
    .update(appSettings)
    .set({
      brandName: input.brandName,
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.logoStorageKey !== undefined ? { logoStorageKey: input.logoStorageKey } : {}),
      updatedByOpenId: input.updatedByOpenId,
    })
    .where(eq(appSettings.id, 1));
  return getAppSettings();
}

export async function createAdminAuditLog(input: {
  actorOpenId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  previousValue?: string | null;
  nextValue?: string | null;
  sourceUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(adminAuditLogs).values(input);
}

export async function recordRateSyncRun(input: {
  actorOpenId: string;
  sourceUrl: string;
  status: "success" | "partial" | "failed";
  referenceStart?: string | null;
  referenceEnd?: string | null;
  recordsFound: number;
  recordsUpdated: number;
  details?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(rateSyncRuns).values(input);
}
