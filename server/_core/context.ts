import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse } from "cookie";
import * as db from "../db";
import { hashSessionToken, LOCAL_SESSION_COOKIE } from "../localAuth";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type AuthenticatedUser = Pick<User, "id" | "role"> & {
  openId: string;
  name: string | null;
  email: string | null;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;

  const localToken = parse(opts.req.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (localToken) {
    const localUser = await db.getLocalUserBySessionHash(hashSessionToken(localToken));
    if (localUser) {
      user = {
        id: localUser.id,
        role: localUser.role,
        openId: `local:${localUser.username}`,
        name: localUser.username,
        email: null,
      };
    }
  }

  if (!user && process.env.NODE_ENV !== "production") {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
