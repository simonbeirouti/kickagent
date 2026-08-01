import { optionalEnv } from "@/lib/env";

/**
 * Who may connect a Kick account is controlled by the KICK_ALLOWED_USER_ID env
 * var (see .env.example):
 *
 * - unset, empty, or "*"  → any Kick account may connect (hackathon default)
 * - "4083762"             → only that numeric Kick user id
 * - "4083762,123456"      → comma-separated allowlist of ids
 *
 * "4083762" (bsimon) is the historical single hardcoded owner, kept in the
 * docs and tests as the example id.
 */
export function allowedKickUserIds(): readonly string[] | "any" {
  const raw = optionalEnv("KICK_ALLOWED_USER_ID");
  if (!raw) return "any";
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0 || entries.includes("*")) return "any";
  return entries;
}

export function isKickAccountAllowed(userId: string): boolean {
  const allowed = allowedKickUserIds();
  return allowed === "any" || allowed.includes(userId);
}
