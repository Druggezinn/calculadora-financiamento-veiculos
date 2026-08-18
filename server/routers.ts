import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { financeRouter } from "./routers/finance";
import { localAuthRouter } from "./routers/localAuth";
import { settingsRouter } from "./routers/settings";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: localAuthRouter,
  finance: financeRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
