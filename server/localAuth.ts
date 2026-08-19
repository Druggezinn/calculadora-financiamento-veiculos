import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

export const LOCAL_SESSION_COOKIE = "autofin_local_session";
export const LOCAL_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const LOCAL_MAX_LOGIN_FAILURES = 5;
export const LOCAL_LOCK_DURATION_MS = 15 * 60 * 1000;

const passwordOptions = {
  iterations: 3,
  memorySize: 19_456,
  parallelism: 1,
  hashLength: 32,
  outputType: "encoded" as const,
};

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,63}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return usernamePattern.test(normalizeUsername(value));
}

export function isStrongPassword(value: string) {
  return value.length >= 12 && value.length <= 128;
}

export async function hashPassword(password: string) {
  return argon2id({
    password,
    salt: randomBytes(16),
    ...passwordOptions,
  });
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    return await argon2Verify({ password, hash: passwordHash });
  } catch {
    return false;
  }
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function safeSecretEquals(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function getLocalSessionCookieOptions(isSecure: boolean) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
  };
}
