import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { IS_FALLBACK } from "../../runtime-mode/src/index.ts";
import * as schema from "./schema";

const { Pool } = pg;

function createFallbackDbStub() {
  return new Proxy(
    {},
    {
      get(_target, property) {
        throw new Error(
          `Database access is unavailable in fallback mode (attempted to read "${String(property)}").`,
        );
      },
    },
  ) as ReturnType<typeof drizzle>;
}

const databaseUrl = process.env.DATABASE_URL;
const shouldUseFallbackStub = IS_FALLBACK || !databaseUrl;

export const pool = shouldUseFallbackStub
  ? null
  : new Pool({ connectionString: databaseUrl });

export const db = shouldUseFallbackStub
  ? createFallbackDbStub()
  : drizzle(pool, { schema });

export * from "./schema";
