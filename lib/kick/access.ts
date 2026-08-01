export const KICK_OWNER_USER_ID = "4083762";

export function isKickAccountAllowed(userId: string): boolean {
  return userId === KICK_OWNER_USER_ID;
}
