import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { requiredEnv } from "@/lib/env";

let client: NeonQueryFunction<false, false> | undefined;

function database(): NeonQueryFunction<false, false> {
  client ??= neon(requiredEnv("DATABASE_URL"));
  return client;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  return (await database().query(text, [...params])) as T[];
}

export function resetDatabaseClientForTests(): void {
  client = undefined;
}
