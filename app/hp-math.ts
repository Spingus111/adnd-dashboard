export function evaluateHpEntry(entry: string, startingValue: number) {
  const trimmed = entry.trim();
  if (!trimmed) return 0;
  if (/^[+-]\d+(?:\.\d+)?$/.test(trimmed)) return startingValue + Number(trimmed);
  const direct = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed;
  const parsed = Number(direct);
  return Number.isFinite(parsed) ? parsed : startingValue;
}
