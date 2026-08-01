export function boundedInteger(
  value: unknown,
  { defaultValue, min, max }: { defaultValue?: number; min: number; max: number },
): number | null {
  const candidate = value === undefined ? defaultValue : value
  if (candidate === undefined || candidate === null || candidate === '') return null
  const parsed = typeof candidate === 'number' ? candidate : Number(candidate)
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
