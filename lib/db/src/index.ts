import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { IS_FALLBACK } from "../../runtime-mode/src/index.ts";
import * as schema from "./schema/index.ts";

const { Pool } = pg;

function getPoolConfig(connectionString: string) {
  const config: ConstructorParameters<typeof Pool>[0] = {
    connectionString,
  };

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");

    if (sslMode === "require") {
      url.searchParams.delete("sslmode");
      config.connectionString = url.toString();
      config.ssl = {
        rejectUnauthorized: false,
      };
    }
  } catch {
    return config;
  }

  return config;
}

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
  : new Pool(getPoolConfig(databaseUrl));

export const db = shouldUseFallbackStub
  ? createFallbackDbStub()
  : drizzle(pool, { schema });

export async function pingDatabase(): Promise<void> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const probePool = new Pool({
    max: 1,
    ...getPoolConfig(databaseUrl),
  });

  try {
    await probePool.query("select 1 as ok");
  } finally {
    await probePool.end();
  }
}

export * from "./schema/index.ts";
