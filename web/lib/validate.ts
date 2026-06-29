/** Truncates a string to a max length. Returns null for empty/whitespace-only input. */
export function clampStr(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/** Picks only the allowed keys from a body, dropping everything else (defends against mass-assignment). */
export function pickFields<T extends Record<string, unknown>>(body: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {}
  for (const k of keys) {
    if (k in body) out[k] = body[k]
  }
  return out
}
