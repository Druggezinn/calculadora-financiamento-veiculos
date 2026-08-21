import { homedir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";

if (!process.env.DATABASE_URL) {
  config({ path: process.env.AUTOFIN_ENV_FILE ?? join(homedir(), ".config", "autofin", "autofin.env") });
}

await import("./dist/index.js");
