import type { SaveBlock } from "./types";
import { applyManualCombatModifier } from "./combat-manual-modifier.ts";
import { secureRandomFloat } from "./random.ts";

export const enemySaveLabels: Array<[keyof SaveBlock, string]> = [
  ["wands", "Aimed magic items"],
  ["breath", "Breath weapons"],
  ["death", "Death / paralysis / poison"],
  ["polymorph", "Petrifaction / polymorph"],
  ["spells", "Spells / unlisted"],
];

export type ParsedHitDice = {
  count: number;
  sides: number;
  modifier: number;
  fraction: number | null;
};

export function parseHitDice(value: string): ParsedHitDice | null {
  const source = value.trim().toLowerCase().replaceAll(" ", "");
  if (!source) return null;
  const fraction = source.match(/^(\d+)\/(\d+)([+-]\d+)?$/);
  if (fraction) return {
    count: 1,
    sides: Math.max(2, Number(fraction[2])),
    modifier: Number(fraction[3] ?? 0),
    fraction: Number(fraction[1]) / Math.max(1, Number(fraction[2])),
  };
  const explicit = source.match(/^(\d+)d(\d+)([+-]\d+)?(?:hp)?$/);
  if (explicit) return {
    count: Math.max(1, Number(explicit[1])),
    sides: Math.max(2, Number(explicit[2])),
    modifier: Number(explicit[3] ?? 0),
    fraction: null,
  };
  const standard = source.match(/^(\d+)([+-]\d+)?$/);
  if (!standard) return null;
  return {
    count: Math.max(1, Number(standard[1])),
    sides: 8,
    modifier: Number(standard[2] ?? 0),
    fraction: null,
  };
}

export function hitDiceValue(value: string) {
  const parsed = parseHitDice(value);
  if (!parsed) return null;
  return parsed.fraction ?? parsed.count;
}

export function rollMonsterHp(value: string, random: () => number = secureRandomFloat) {
  const parsed = parseHitDice(value);
  if (!parsed) return null;
  if (parsed.fraction !== null) return Math.max(1, Math.floor(random() * parsed.sides) + 1 + parsed.modifier);
  const rolled = Array.from({ length: parsed.count }, () => Math.floor(random() * parsed.sides) + 1)
    .reduce((sum, roll) => sum + roll, 0);
  return Math.max(1, rolled + parsed.modifier);
}

export function singleHitDieExpression(value: string) {
  const parsed = parseHitDice(value);
  return parsed ? `1d${parsed.sides}` : "1d6";
}

export function monsterRequiredRoll(hitDice: string, ascendingArmorClass: number) {
  const bonus = monsterAttackBonus(hitDice);
  return bonus === null ? null : Math.floor(ascendingArmorClass) - bonus;
}

export function monsterAttackBonus(hitDice: string) {
  const parsed = parseHitDice(hitDice);
  if (!parsed) return null;
  const base = parsed.fraction ?? parsed.count;
  if (base < 1 || (parsed.count === 1 && parsed.modifier < -1)) return -1;
  if (parsed.count === 1 && parsed.modifier === -1) return 0;
  if (parsed.count === 1 && parsed.modifier === 0) return 1;
  if (parsed.count === 1) return 2;
  if (parsed.count <= 3) return 4;
  if (parsed.count <= 5) return 5;
  if (parsed.count <= 7) return 7;
  if (parsed.count <= 9) return 8;
  if (parsed.count <= 11) return 10;
  if (parsed.count <= 13) return 11;
  if (parsed.count <= 15) return 12;
  return 13;
}

export function maximumHitPointsFromHitDice(value: string) {
  const parsed = parseHitDice(value);
  if (!parsed) return null;
  return Math.max(1, parsed.count * parsed.sides + parsed.modifier);
}

export function heroicAssaultEligible(value: string) {
  const maximum = maximumHitPointsFromHitDice(value);
  return maximum !== null && maximum < 8;
}

const normalMonsterSaveRows: SaveBlock[] = [
  { death:16,wands:18,polymorph:17,breath:20,spells:19 },
  { death:14,wands:16,polymorph:15,breath:17,spells:17 },
  { death:13,wands:15,polymorph:14,breath:16,spells:16 },
  { death:11,wands:13,polymorph:12,breath:13,spells:14 },
  { death:10,wands:12,polymorph:11,breath:12,spells:13 },
  { death:8,wands:10,polymorph:9,breath:9,spells:11 },
  { death:7,wands:9,polymorph:8,breath:8,spells:10 },
  { death:5,wands:7,polymorph:6,breath:5,spells:8 },
  { death:4,wands:6,polymorph:5,breath:4,spells:7 },
  { death:3,wands:5,polymorph:4,breath:4,spells:6 },
  { death:2,wands:4,polymorph:3,breath:3,spells:5 },
];

const mindlessMonsterSaveRows: SaveBlock[] = [
  { death:16,wands:18,polymorph:17,breath:20,spells:19 },
  { death:14,wands:16,polymorph:15,breath:17,spells:17 },
  { death:13,wands:16,polymorph:15,breath:17,spells:17 },
  { death:11,wands:15,polymorph:14,breath:16,spells:16 },
  { death:10,wands:15,polymorph:14,breath:16,spells:16 },
  { death:8,wands:13,polymorph:12,breath:13,spells:14 },
  { death:7,wands:13,polymorph:12,breath:13,spells:14 },
  { death:5,wands:12,polymorph:11,breath:12,spells:13 },
  { death:4,wands:12,polymorph:11,breath:12,spells:13 },
  { death:3,wands:10,polymorph:9,breath:9,spells:11 },
  { death:2,wands:10,polymorph:9,breath:9,spells:11 },
];

function monsterSaveRow(hitDice: string) {
  const value = hitDiceValue(hitDice);
  if (value === null || value < 1) return 0;
  return Math.min(10, Math.floor((Math.ceil(value) - 1) / 2) + 1);
}

export function monsterSaves(hitDice: string, nonIntelligent = false) {
  return (nonIntelligent ? mindlessMonsterSaveRows : normalMonsterSaveRows)[monsterSaveRow(hitDice)];
}

export function canChooseNonIntelligentSaveTable(
  currentRound: number,
  joinedRound: number,
  phase: "declaration" | "active" | "round-complete",
) {
  return phase === "declaration" && currentRound === joinedRound;
}

export function attackRequiresDeclaredTarget(action: string) {
  return !["missile", "spec-ranged", "close-hurl"].includes(action);
}

export function canCheckUnhelmedHeadshot(options: { targetIsEnemy: boolean; armoredHead: boolean; ascendingArmorClass: number; attackRoll: number; attackTotal: number; ordinaryHit: boolean; automaticHit: boolean }) {
  return !options.automaticHit
    && options.targetIsEnemy
    && !options.armoredHead
    && options.attackTotal >= 10
    && options.attackRoll !== 1;
}

export function resolvedAttackD20(roll: number) {
  return roll === 20 ? 25 : roll;
}

export function attackHitsAscendingArmor(options: { roll: number; attackModifier: number; armorClass: number; automaticHit?: boolean }) {
  if (options.automaticHit) return true;
  if (options.roll === 1) return false;
  return resolvedAttackD20(options.roll) + options.attackModifier >= options.armorClass;
}

/** Uses the resolver's own natural-roll and manual-modifier rules to find the first successful d20 face. */
export function requiredAttackD20(options: { armorClass: number; baseModifier: number; manualModifier?: string | null; automaticHit?: boolean }) {
  if (options.automaticHit) return 2;
  for (let roll = 2; roll <= 20; roll += 1) {
    const resolved = resolvedAttackD20(roll);
    const total = applyManualCombatModifier(resolved + options.baseModifier, options.manualModifier);
    if (attackHitsAscendingArmor({ roll, attackModifier: total - resolved, armorClass: options.armorClass })) return roll;
  }
  return 20;
}

export function monsterOnslaughtSegment(
  timing: "segment-1" | "rolled" | "segment-10",
  rolledSegment: number | null,
) {
  if (timing === "segment-1") return 1;
  if (timing === "segment-10") return 10;
  return Math.max(1, Math.min(10, Math.floor(rolledSegment ?? 1)));
}

export function surpriseSegmentsForRoll(roll: number, surprisedOn = 2) {
  const result = Math.max(1, Math.min(6, Math.floor(roll)));
  const threshold = Math.max(0, Math.min(6, Math.floor(surprisedOn)));
  return result <= threshold ? result : 0;
}

export function adjustedSurpriseSegments(baseSegments: number, dexterityAdjustment: number) {
  const base = Math.max(0, Math.min(10, Math.floor(baseSegments)));
  if (base === 0) return 0;
  return Math.max(0, Math.min(10, base - Math.trunc(dexterityAdjustment)));
}

export function missileInitiativeAdjustment(dexterity: string | number) {
  const score = Math.max(3, Math.min(19, Math.floor(Number(dexterity) || 10)));
  if (score <= 3) return 3;
  if (score === 4) return 2;
  if (score === 5) return 1;
  if (score <= 15) return 0;
  if (score === 16) return -1;
  if (score === 17) return -2;
  return -3;
}

export function missileInitiativeSegment(roll: number, dexterity: string | number) {
  return Math.max(1, Math.min(10, Math.floor(roll) + missileInitiativeAdjustment(dexterity)));
}

type XpBracket = { base: number; special: number; exceptional: number; perHp: number };
const monsterXpRows: XpBracket[] = [
  {base:5,special:3,exceptional:25,perHp:1},{base:10,special:5,exceptional:35,perHp:1},
  {base:30,special:10,exceptional:50,perHp:1},{base:50,special:15,exceptional:60,perHp:2},
  {base:75,special:30,exceptional:70,perHp:3},{base:110,special:45,exceptional:80,perHp:4},
  {base:160,special:70,exceptional:120,perHp:6},{base:225,special:120,exceptional:200,perHp:8},
  {base:350,special:200,exceptional:300,perHp:10},{base:600,special:300,exceptional:400,perHp:12},
  {base:700,special:400,exceptional:500,perHp:13},{base:900,special:500,exceptional:600,perHp:14},
  {base:1200,special:700,exceptional:850,perHp:16},{base:1500,special:800,exceptional:1000,perHp:17},
  {base:1800,special:950,exceptional:1200,perHp:18},{base:2100,special:1100,exceptional:1400,perHp:19},
  {base:2400,special:1250,exceptional:1600,perHp:20},{base:2700,special:1400,exceptional:1800,perHp:23},
  {base:3000,special:1550,exceptional:2000,perHp:25},{base:3500,special:1800,exceptional:2250,perHp:28},
  {base:4000,special:2100,exceptional:2500,perHp:30},{base:4500,special:2350,exceptional:2750,perHp:33},
  {base:5000,special:2600,exceptional:3000,perHp:35},
];

function monsterXpRow(hitDice: string) {
  const parsed = parseHitDice(hitDice);
  if (!parsed) return 1;
  const value = parsed.fraction ?? parsed.count;
  if (value < 1) return 0;
  if (value <= 1 && parsed.modifier <= 0) return 1;
  return Math.min(22, Math.max(2, Math.floor(value) + (parsed.modifier > 0 ? 1 : 0)));
}

export function monsterXpBreakdown(hitDice: string, hitPoints: number, specialAbilities = 0, exceptionalAbilities = 0) {
  const row = monsterXpRows[monsterXpRow(hitDice)];
  const base = row.base;
  const hp = Math.max(0, hitPoints) * row.perHp;
  const special = Math.max(0, Math.floor(specialAbilities)) * row.special;
  const exceptional = Math.max(0, Math.floor(exceptionalAbilities)) * row.exceptional;
  return { base, hp, special, exceptional, total: base + hp + special + exceptional, row };
}

export function fighterLevelFromHitDice(value: string) {
  const base = hitDiceValue(value);
  if (base === null) return null;
  const parsed = parseHitDice(value);
  const bonusLevels = parsed && parsed.modifier > 0 ? Math.ceil(parsed.modifier / 4) : 0;
  return Math.max(0, Math.ceil(base) + bonusLevels);
}

export function fighterBaseToHit(level: number) {
  return Math.max(-1, Math.floor(level) - 1);
}

export function fighterSaves(level: number): SaveBlock {
  return normalMonsterSaveRows[Math.min(10, Math.max(0, Math.floor((Math.max(0, level) - 1) / 2) + (level > 0 ? 1 : 0)))];
}

export function specializedMeleeRate(level: number): "3/2" | "2/1" | "5/2" {
  if (level >= 13) return "5/2";
  if (level >= 7) return "2/1";
  return "3/2";
}

export function specializedMeleeSegments(level: number, round: number, rolledSegment: number) {
  const rate = specializedMeleeRate(level);
  if (rate === "2/1") return [1, 10];
  if (rate === "5/2") return round % 2 === 1 ? [1, 5, 10] : [1, 10];
  return round % 2 === 1 ? [1, 10] : [rolledSegment];
}
