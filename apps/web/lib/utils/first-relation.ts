export function firstRelation<T>(value: T[] | null | undefined): T | null {
  return value?.[0] ?? null;
}
