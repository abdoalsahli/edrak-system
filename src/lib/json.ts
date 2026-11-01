/**
 * JSON kept in text columns — SQL Server has no JSON type in Prisma. Lists
 * (a plan's focus areas, a report's changes and obstacles) and audit snapshots
 * are written with toJson and read back with fromJson.
 */

export function toJson(value: unknown): string;
export function toJson(value: unknown | null): string | null;
export function toJson(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

/** Parse a stored JSON text; anything missing or unreadable gives `fallback`. */
export function fromJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A stored string list (focus areas, changes, obstacles). */
export const fromJsonList = (text: string | null | undefined): string[] => {
  const v = fromJson<unknown>(text, []);
  return Array.isArray(v) ? v.map(String) : [];
};
