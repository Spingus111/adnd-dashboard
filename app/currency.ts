export type CurrencyCode = "pp" | "gp" | "ep" | "sp" | "cp";

export type CurrencyDefinition = {
  code: CurrencyCode;
  name: string;
  label: string;
  tileEmoji: string;
  gpValue: number;
  copperValue: number;
  treasureOnly?: boolean;
};

/** AD&D 1e currency, ordered largest to smallest for making change. */
export const CURRENCY_DEFINITIONS: readonly CurrencyDefinition[] = [
  { code: "pp", name: "Platinum Coins", label: "Platinum Coins (pp)", tileEmoji: "💠", gpValue: 5, copperValue: 1000, treasureOnly: true },
  { code: "gp", name: "Gold Coins", label: "Gold Coins (gp)", tileEmoji: "🥇", gpValue: 1, copperValue: 200 },
  { code: "ep", name: "Electrum Coins", label: "Electrum Coins (ep)", tileEmoji: "🟡", gpValue: .5, copperValue: 100, treasureOnly: true },
  { code: "sp", name: "Silver Coins", label: "Silver Coins (sp)", tileEmoji: "🥈", gpValue: .05, copperValue: 10 },
  { code: "cp", name: "Copper Coins", label: "Copper Coins (cp)", tileEmoji: "🥉", gpValue: .005, copperValue: 1 },
] as const;

export const CURRENCY_BY_CODE = Object.fromEntries(CURRENCY_DEFINITIONS.map((definition) => [definition.code, definition])) as Record<CurrencyCode, CurrencyDefinition>;
/** Ordinary prices and shop change use only gold, silver, and copper. */
export const SHOP_CURRENCY_DEFINITIONS = CURRENCY_DEFINITIONS.filter((definition) => !definition.treasureOnly);

export function gpToCopperPieces(valueGp: number) {
  const safe = Number(valueGp);
  return Number.isFinite(safe) ? Math.max(0, Math.round(safe * 200)) : 0;
}

export function copperPiecesToGp(copperPieces: number) {
  const safe = Number(copperPieces);
  return Number.isFinite(safe) ? Math.max(0, Math.round(safe)) / 200 : 0;
}

export function currencyBreakdownFromGp(valueGp: number, denominations: readonly CurrencyDefinition[] = CURRENCY_DEFINITIONS) {
  let remainingCopper = gpToCopperPieces(valueGp);
  const breakdown = Object.fromEntries(CURRENCY_DEFINITIONS.map((definition) => [definition.code, 0])) as Record<CurrencyCode, number>;
  for (const definition of denominations) {
    breakdown[definition.code] = Math.floor(remainingCopper / definition.copperValue);
    remainingCopper %= definition.copperValue;
  }
  return breakdown;
}

export function formatGpAsCurrency(valueGp: number, zeroLabel = "0 gp") {
  const breakdown = currencyBreakdownFromGp(valueGp);
  const parts = CURRENCY_DEFINITIONS
    .map((definition) => breakdown[definition.code] ? `${breakdown[definition.code].toLocaleString()} ${definition.code}` : "")
    .filter(Boolean);
  return parts.length ? parts.join(" ") : zeroLabel;
}

/** Formats an ordinary price without converting it into treasure denominations. */
export function formatGpAsPrice(valueGp: number, zeroLabel = "0 gp") {
  const breakdown = currencyBreakdownFromGp(valueGp, SHOP_CURRENCY_DEFINITIONS);
  const parts = SHOP_CURRENCY_DEFINITIONS
    .map((definition) => breakdown[definition.code] ? `${breakdown[definition.code].toLocaleString()} ${definition.code}` : "")
    .filter(Boolean);
  return parts.length ? parts.join(" ") : zeroLabel;
}

export function currencyCodeFromName(value: string): CurrencyCode | null {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = normalized.match(/^(?:\d+\s*)?(cp|sp|ep|gp|pp|copper|silver|electrum|gold|platinum)(?:\s+(?:piece|pieces|coin|coins|coinage))?(?:\s+(?:cp|sp|ep|gp|pp))?$/);
  if (!match) return null;
  const token = match[1];
  if (token === "pp" || token === "platinum") return "pp";
  if (token === "gp" || token === "gold") return "gp";
  if (token === "ep" || token === "electrum") return "ep";
  if (token === "sp" || token === "silver") return "sp";
  return "cp";
}

export function currencyGpValueFromName(value: string) {
  const code = currencyCodeFromName(value);
  return code ? CURRENCY_BY_CODE[code].gpValue : null;
}

export const ADND_CURRENCY_RULE = "10 cp = 1 sp · 20 sp = 1 gp · EP and PP are treasure coinage";
