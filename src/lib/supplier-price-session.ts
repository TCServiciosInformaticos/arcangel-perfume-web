/** The browser tab keeps comparison data for the signed-in account only. */
export function comparisonSessionKey(userId: string): string {
  return `arcangel:comparison:v1:${userId}`;
}
export function readComparisonSession(
  storage: Storage,
  userId: string,
): Record<string, unknown> | null {
  const raw = storage.getItem(comparisonSessionKey(userId));
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Datos guardados inválidos");
  return parsed as Record<string, unknown>;
}
export function writeComparisonSession(storage: Storage, userId: string, snapshot: object): void {
  const key = comparisonSessionKey(userId);
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch (error) {
    // Do not restore an outdated set of prices as though it were current.
    try {
      storage.removeItem(key);
    } catch {
      /* Storage may be unavailable entirely. */
    }
    throw error;
  }
}
