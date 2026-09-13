import type { CampaignState, Character } from "./types.ts";

const armorMovementCaps: Array<[RegExp, number]> = [
  [/\belfin\b/i, 120],
  [/\b(?:banded|chain|padded|gambeson|ring|splint|studded)\b/i, 90],
  [/\b(?:plate|scale|lamellar)\b/i, 60],
  [/\bleather\b/i, 120],
];

export function armorMovementCapForName(name: string | null | undefined) {
  return armorMovementCaps.find(([pattern]) => pattern.test(String(name ?? "")))?.[1] ?? null;
}

export function effectiveArmorMovementRate(campaign: Pick<CampaignState, "inventoryManagement">, character: Pick<Character, "id" | "movementRate">) {
  const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
  const worn = owner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
  const caps = worn ? campaign.inventoryManagement.stacks
    .filter((entry) => entry.containerId === worn.id && entry.equipment?.kind === "armor")
    .flatMap((entry) => {
      const cap = armorMovementCapForName(entry.name);
      return cap === null ? [] : [cap];
    }) : [];
  return Math.min(Math.max(0, Number(character.movementRate) || 0), ...(caps.length ? caps : [Number.POSITIVE_INFINITY]));
}

/** Daily overland distance in 6-mile hexes at the cautious/combat pace. */
export function dailyHexes(movementRate: number) {
  // Rate × 0.2 gives daily miles; each map hex is six miles.
  return Math.max(0, Math.round((Number.isFinite(movementRate) ? movementRate : 0) * 0.2 / 6));
}

export function movementSummary(movementRate: number) {
  const rate = Math.max(0, Math.round(Number.isFinite(movementRate) ? movementRate : 0));
  return { rate, hexes: dailyHexes(rate) };
}

export type EncumbranceBand = "unencumbered" | "three-quarter" | "half" | "quarter" | "immobile";

/** The heaviest load that still permits quarter-speed movement. */
export function maximumMovableLoadUnits(capacityUnits: number) {
  return Math.max(0, Math.round(Number(capacityUnits) || 0)) + 3600;
}

/** A character load bar runs from empty hands to the last movable load. */
export function encumbranceLoadPercent(carriedUnits: number, capacityUnits: number) {
  const maximum = maximumMovableLoadUnits(capacityUnits);
  if (maximum <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(Math.max(0, Number(carriedUnits) || 0) / maximum * 100)));
}

export function encumbranceSummary(maxRate: number, carriedUnits: number, capacityUnits: number, lightArmor = true) {
  const maximum = Math.max(0, Math.round(Number(maxRate) || 0));
  const carried = Math.max(0, Math.round(Number(carriedUnits) || 0));
  const capacity = Math.max(0, Math.round(Number(capacityUnits) || 0));
  const over = Math.max(0, carried - capacity);
  // 1 stone is 14 lb. Each 40-lb band rounds up to 3 stone in the party's favour.
  const band: EncumbranceBand = over === 0 ? "unencumbered" : over <= 1200 ? "three-quarter" : over <= 2400 ? "half" : over <= 3600 ? "quarter" : "immobile";
  const multiplier = band === "unencumbered" ? 1 : band === "three-quarter" ? .75 : band === "half" ? .5 : band === "quarter" ? .25 : 0;
  // Movement on the sheet and dashboard stays in clean ten-foot increments.
  const rate = Math.max(0, Math.round(maximum * multiplier / 10) * 10);
  const surpriseModifier = band === "unencumbered" ? (lightArmor ? 1 : 0) : band === "quarter" ? -1 : band === "immobile" ? -2 : 0;
  return { band, rate, maxRate: maximum, carried, capacity, over, surpriseModifier, hexes: dailyHexes(rate) };
}

export function partyEncumbranceSurpriseModifier(entries: Array<{ band: EncumbranceBand; surpriseModifier: number }>) {
  if (!entries.length) return 0;
  const counts = new Map<string, number>();
  entries.forEach((entry) => {
    const key = `${entry.band}:${entry.surpriseModifier}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const majority = [...counts.entries()].find(([, count]) => count > entries.length / 2)?.[0];
  return majority ? Number(majority.split(":")[1]) || 0 : 0;
}
