import postgres from "postgres";
import { requiredEnv } from "@/lib/env";

type DatabaseClient = ReturnType<typeof postgres>;

let client: DatabaseClient | undefined;

function database(): DatabaseClient {
  client ??= postgres(requiredEnv("DATABASE_URL"), {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 5,
  });
  return client;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly postgres.SerializableParameter[] = [],
): Promise<T[]> {
  const rows = await database().unsafe<T[]>(text, [...params]);
  return [...rows];
}

export function resetDatabaseClientForTests(): void {
  if (client) void client.end({ timeout: 0 });
  client = undefined;
}
