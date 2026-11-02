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
  storage.setItem(comparisonSessionKey(userId), JSON.stringify(snapshot));
}
