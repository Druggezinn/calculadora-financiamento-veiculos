import { boolean, double, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Usuários locais da VPS, com senha somente em hash Argon2id. */
export const localUsers = mysqlTable("localUsers", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 512 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
  failedLoginCount: int("failedLoginCount").notNull().default(0),
  lockUntil: timestamp("lockUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalUser = typeof localUsers.$inferSelect;

/** Sessões de autenticação locais. O cookie carrega somente o token opaco; o banco guarda seu hash. */
export const localAuthSessions = mysqlTable(
  "localAuthSessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    sessionHash: varchar("sessionHash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("localAuthSessions_sessionHash_idx").on(table.sessionHash)],
);

export type LocalAuthSession = typeof localAuthSessions.$inferSelect;

/** Histórico compacto de login para bloqueio persistido e investigação administrativa. */
export const localLoginAttempts = mysqlTable(
  "localLoginAttempts",
  {
    id: int("id").autoincrement().primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    wasSuccessful: boolean("wasSuccessful").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("localLoginAttempts_username_idx").on(table.username)],
);

/**
 * Taxas de referência exibidas na calculadora. Cada linha é administrada pelo
 * proprietário e preserva sua proveniência e período de vigência.
 */
export const financialInstitutions = mysqlTable("financialInstitutions", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  legalName: varchar("legalName", { length: 200 }).notNull(),
  bcbCnpj8: varchar("bcbCnpj8", { length: 8 }),
  monthlyRate: double("monthlyRate").notNull(),
  annualRate: double("annualRate"),
  sourceUrl: text("sourceUrl"),
  sourceDescription: text("sourceDescription"),
  referenceStart: varchar("referenceStart", { length: 10 }),
  referenceEnd: varchar("referenceEnd", { length: 10 }),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialInstitution = typeof financialInstitutions.$inferSelect;
export type InsertFinancialInstitution = typeof financialInstitutions.$inferInsert;

/** Configuração única de apresentação, atualizada exclusivamente pelo administrador. */
export const appSettings = mysqlTable("appSettings", {
  id: int("id").primaryKey(),
  brandName: varchar("brandName", { length: 80 }).notNull().default("AutoFin"),
  logoUrl: text("logoUrl"),
  logoStorageKey: varchar("logoStorageKey", { length: 500 }),
  updatedByOpenId: varchar("updatedByOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;

/** Registro imutável das alterações administrativas para rastreabilidade operacional. */
export const adminAuditLogs = mysqlTable("adminAuditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetType: varchar("targetType", { length: 80 }).notNull(),
  targetId: varchar("targetId", { length: 128 }),
  previousValue: text("previousValue"),
  nextValue: text("nextValue"),
  sourceUrl: text("sourceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

/** Resultado de cada consulta manual à fonte pública de taxas. */
export const rateSyncRuns = mysqlTable("rateSyncRuns", {
  id: int("id").autoincrement().primaryKey(),
  actorOpenId: varchar("actorOpenId", { length: 64 }).notNull(),
  sourceUrl: text("sourceUrl").notNull(),
  status: mysqlEnum("status", ["success", "partial", "failed"]).notNull(),
  referenceStart: varchar("referenceStart", { length: 10 }),
  referenceEnd: varchar("referenceEnd", { length: 10 }),
  recordsFound: int("recordsFound").notNull().default(0),
  recordsUpdated: int("recordsUpdated").notNull().default(0),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RateSyncRun = typeof rateSyncRuns.$inferSelect;
