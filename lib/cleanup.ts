import { query } from "@/lib/db";

export async function cleanupExpiredData(connectionId?: string): Promise<void> {
  const connectionClause = connectionId ? "AND connection_id = $1" : "";
  const parameters = connectionId ? [connectionId] : [];

  await Promise.all([
    query(
      `DELETE FROM chat_messages
       WHERE created_at < now() - interval '24 hours' ${connectionClause}`,
      parameters,
    ),
    query(
      `DELETE FROM analysis_windows
       WHERE window_start < now() - interval '7 days' ${connectionClause}`,
      parameters,
    ),
    query("DELETE FROM app_sessions WHERE expires_at < now()"),
    query("DELETE FROM kick_webhook_events WHERE received_at < now() - interval '24 hours'"),
  ]);
}
