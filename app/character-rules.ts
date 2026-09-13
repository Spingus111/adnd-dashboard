import type { Character, SaveBlock } from "./types";
import { OSRIC_ANCESTRIES, type OsricStatline } from "./osric-character-creation.ts";
import { reconcileOsricAutomation } from "./osric-advancement.ts";
import { normalizedExceptionalStrength } from "./osric-stats.ts";
import { secureRandomFloat } from "./random.ts";

type SaveRow = { minimumLevel: number; maximumLevel: number; values: SaveBlock };
type ClassRule = {
  hitDie: number;
  xp: number[];
  saves: SaveRow[];
  attackBonus: (level: number) => number;
  hitDice: (level: number) => { dice: number; bonus: number };
  xpStepAfterTable?: number;
};

const saves = (wands: number, breath: number, death: number, polymorph: number, spells: number): SaveBlock => ({ wands, breath, death, polymorph, spells });
const row = (minimumLevel: number, maximumLevel: number, values: SaveBlock): SaveRow => ({ minimumLevel, maximumLevel, values });
const ordinaryDice = (maximumDice: number, fixedPerLevel: number) => (level: number) => ({
  dice: Math.min(Math.max(1, Math.trunc(level)), maximumDice),
  bonus: Math.max(0, Math.trunc(level) - maximumDice) * fixedPerLevel,
});
// Converted from the AD&D 1e descending-AC attack matrices to the dashboard's
// ascending-AC modifier: modifier = 10 - required roll against AC 10.
const fighterAttack = (level: number) => Math.min(16, Math.max(0, Math.trunc(level) - 1));
const clericAttack = (level: number) => {
  const current = Math.max(1, Math.trunc(level));
  return current >= 19 ? 11 : Math.floor((current - 1) / 3) * 2;
};
const arcaneAttack = (level: number) => level >= 21 ? 9 : level >= 16 ? 7 : level >= 11 ? 4 : level >= 6 ? 1 : -1;
const thiefAttack = (level: number) => level >= 21 ? 10 : level >= 17 ? 8 : level >= 13 ? 6 : level >= 9 ? 4 : level >= 5 ? 1 : -1;

const thiefSaves = [
  row(1, 4, saves(14, 16, 13, 12, 15)),
  row(5, 8, saves(12, 15, 12, 11, 13)),
  row(9, 12, saves(10, 14, 11, 10, 11)),
  row(13, 16, saves(8, 13, 10, 9, 9)),
  row(17, Number.POSITIVE_INFINITY, saves(6, 12, 9, 8, 7)),
];
const clericSaves = [
  row(1, 3, saves(14, 16, 10, 13, 15)),
  row(4, 6, saves(13, 15, 9, 12, 14)),
  row(7, 9, saves(11, 13, 7, 10, 12)),
  row(10, 12, saves(10, 12, 6, 9, 11)),
  row(13, 15, saves(9, 11, 5, 8, 10)),
  row(16, 18, saves(8, 10, 4, 7, 9)),
  row(19, Number.POSITIVE_INFINITY, saves(6, 8, 2, 5, 7)),
];
const fighterSaves = [
  row(1, 2, saves(16, 17, 14, 15, 17)),
  row(3, 4, saves(15, 16, 13, 14, 16)),
  row(5, 6, saves(13, 13, 11, 12, 14)),
  row(7, 8, saves(12, 12, 10, 11, 13)),
  row(9, 10, saves(10, 9, 8, 9, 11)),
  row(11, 12, saves(9, 8, 7, 8, 10)),
  row(13, 14, saves(7, 5, 5, 6, 8)),
  row(15, 16, saves(6, 4, 4, 5, 7)),
  row(17, 18, saves(5, 4, 3, 4, 6)),
  row(19, Number.POSITIVE_INFINITY, saves(4, 3, 2, 3, 5)),
];
const arcaneSaves = [
  row(1, 5, saves(11, 15, 14, 13, 12)),
  row(6, 10, saves(9, 13, 13, 11, 10)),
  row(11, 15, saves(7, 11, 11, 9, 8)),
  row(16, Number.POSITIVE_INFINITY, saves(5, 9, 10, 7, 6)),
];
const paladinSaves = [
  row(1, 2, saves(14, 15, 12, 13, 15)),
  row(3, 4, saves(13, 14, 11, 12, 14)),
  row(5, 6, saves(11, 11, 9, 10, 12)),
  row(7, 8, saves(10, 10, 8, 9, 11)),
  row(9, 10, saves(8, 7, 6, 7, 9)),
  row(11, 12, saves(7, 6, 5, 6, 8)),
  row(13, 14, saves(5, 3, 3, 4, 6)),
  row(15, 16, saves(4, 2, 2, 3, 5)),
  row(17, 18, saves(3, 2, 2, 2, 4)),
  row(19, Number.POSITIVE_INFINITY, saves(2, 2, 2, 2, 3)),
];

const CLASS_RULES: Record<string, ClassRule> = {
  Assassin: { hitDie: 6, xp: [0, 1500, 3000, 6000, 12000, 25000, 50000, 100000, 200000, 300000, 450000, 600000, 750000, 1000000, 1500000], saves: thiefSaves, attackBonus: thiefAttack, hitDice: ordinaryDice(15, 0) },
  Cleric: { hitDie: 8, xp: [0, 1500, 3000, 6000, 13000, 27000, 55000, 110000, 220000, 450000, 675000, 900000, 1125000, 1350000, 1575000, 1800000, 2050000, 2300000, 2550000, 2700000], saves: clericSaves, attackBonus: clericAttack, hitDice: ordinaryDice(9, 2), xpStepAfterTable: 250000 },
  Druid: { hitDie: 8, xp: [0, 2000, 4000, 8000, 12000, 20000, 35000, 60000, 90000, 125000, 200000, 300000, 750000, 1500000], saves: clericSaves, attackBonus: clericAttack, hitDice: ordinaryDice(14, 0) },
  Fighter: { hitDie: 10, xp: [0, 2000, 4000, 8000, 17000, 35000, 70000, 125000, 250000, 500000, 750000, 1000000, 1250000, 1500000, 1750000, 2000000, 2250000, 2500000, 2750000, 3000000], saves: fighterSaves, attackBonus: fighterAttack, hitDice: ordinaryDice(9, 3), xpStepAfterTable: 250000 },
  Illusionist: { hitDie: 4, xp: [0, 2500, 4750, 9000, 18000, 35000, 60000, 95000, 145000, 220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000, 2420000], saves: arcaneSaves, attackBonus: arcaneAttack, hitDice: ordinaryDice(10, 1), xpStepAfterTable: 220000 },
  "Magic-User": { hitDie: 4, xp: [0, 2400, 4800, 10250, 22000, 40000, 60000, 80000, 140000, 250000, 375000, 750000, 1125000, 1500000, 1875000, 2250000, 2625000, 3000000, 3375000, 3750000], saves: arcaneSaves, attackBonus: arcaneAttack, hitDice: ordinaryDice(11, 1), xpStepAfterTable: 375000 },
  Monk: { hitDie: 4, xp: [0, 2000, 5000, 10000, 21250, 45000, 100000, 200000, 350000, 500000, 700000, 950000, 1250000, 1750000, 2250000, 2750000, 3250000], saves: [row(1, 4, saves(14, 16, 13, 12, 15)), row(5, 8, saves(12, 15, 12, 11, 13)), row(9, 12, saves(10, 14, 11, 10, 11)), row(13, 16, saves(8, 13, 10, 9, 9)), row(17, Number.POSITIVE_INFINITY, saves(6, 12, 9, 8, 7))], attackBonus: clericAttack, hitDice: (level) => ({ dice: Math.min(18, Math.max(1, Math.trunc(level)) + 1), bonus: 0 }) },
  Paladin: { hitDie: 10, xp: [0, 2550, 5500, 12500, 25000, 45000, 95000, 175000, 325000, 600000, 1000000, 1350000, 1700000, 2050000, 2400000, 2750000, 3100000, 3450000, 3800000, 4150000], saves: paladinSaves, attackBonus: fighterAttack, hitDice: ordinaryDice(9, 3), xpStepAfterTable: 350000 },
  Ranger: { hitDie: 8, xp: [0, 2250, 4500, 9500, 20000, 40000, 90000, 150000, 225000, 325000, 650000, 975000, 1300000, 1625000, 1950000, 2275000, 2600000, 2925000, 3250000, 3575000], saves: fighterSaves, attackBonus: fighterAttack, hitDice: (level) => { const current = Math.max(1, Math.trunc(level)); return current <= 10 ? { dice: current + 1, bonus: 0 } : { dice: 11, bonus: (current - 10) * 2 }; }, xpStepAfterTable: 325000 },
  Thief: { hitDie: 6, xp: [0, 1250, 2500, 5000, 10000, 20000, 40000, 70000, 110000, 160000, 220000, 440000, 660000, 880000, 1100000, 1320000, 1540000, 1760000, 1980000, 2200000], saves: thiefSaves, attackBonus: thiefAttack, hitDice: ordinaryDice(10, 2), xpStepAfterTable: 220000 },
};

const LEGAL_HIT_DICE = [4, 6, 8, 10, 12];
const abilityZeroes = (): OsricStatline => [0, 0, 0, 0, 0, 0];

type RaceRule = {
  movementRate: number;
  heightBaseInches: number;
  heightDice: [number, number];
  weightBasePounds: number;
  weightDice: [number, number];
  ageStages: [number, OsricStatline][];
  startingAges: Record<string, [number, number, number]>;
};

const commonAgeStages = (adult: number, grizzled: number, elder: number, ancient: number): [number, OsricStatline][] => [
  [0, [0, 0, 1, 0, -1, 0]],
  [adult, [1, 0, 0, 0, 1, 0]],
  [grizzled, [-1, 0, -1, 1, 1, 0]],
  [elder, [-2, -2, -1, 0, 1, 0]],
  [ancient, [-1, -1, -1, 1, 1, 0]],
];

const RACE_RULES: Record<string, RaceRule> = {
  Dwarf: { movementRate: 90, heightBaseInches: 48, heightDice: [3, 4], weightBasePounds: 150, weightDice: [5, 10], ageStages: commonAgeStages(51, 150, 250, 350), startingAges: { Cleric: [250, 2, 20], Fighter: [40, 5, 4], Thief: [75, 3, 6], Assassin: [75, 3, 6] } },
  Elf: { movementRate: 120, heightBaseInches: 54, heightDice: [3, 4], weightBasePounds: 70, weightDice: [5, 10], ageStages: commonAgeStages(175, 550, 875, 1200), startingAges: { Cleric: [500, 10, 10], Fighter: [130, 5, 6], "Magic-User": [150, 5, 6], Thief: [100, 5, 6], Assassin: [100, 5, 6] } },
  Gnome: { movementRate: 90, heightBaseInches: 34, heightDice: [3, 4], weightBasePounds: 45, weightDice: [4, 10], ageStages: commonAgeStages(90, 300, 450, 600), startingAges: { Cleric: [300, 3, 12], Fighter: [60, 5, 4], Illusionist: [100, 2, 12], Thief: [80, 5, 4], Assassin: [80, 5, 4] } },
  "Half-Elf": { movementRate: 120, heightBaseInches: 60, heightDice: [4, 4], weightBasePounds: 90, weightDice: [5, 10], ageStages: commonAgeStages(40, 100, 175, 250), startingAges: { Cleric: [40, 2, 4], Druid: [40, 2, 4], Fighter: [22, 3, 4], Ranger: [22, 3, 4], "Magic-User": [30, 2, 8], Thief: [22, 3, 8], Assassin: [22, 3, 8] } },
  Halfling: { movementRate: 90, heightBaseInches: 34, heightDice: [3, 4], weightBasePounds: 45, weightDice: [4, 10], ageStages: commonAgeStages(33, 68, 101, 144), startingAges: { Fighter: [20, 3, 4], Druid: [40, 3, 4], Thief: [40, 2, 4] } },
  "Half-Orc": { movementRate: 120, heightBaseInches: 66, heightDice: [3, 4], weightBasePounds: 150, weightDice: [5, 10], ageStages: commonAgeStages(16, 30, 45, 60), startingAges: { Cleric: [20, 1, 4], Fighter: [13, 1, 4], Thief: [20, 2, 4], Assassin: [20, 2, 4] } },
  Human: { movementRate: 120, heightBaseInches: 64, heightDice: [3, 4], weightBasePounds: 140, weightDice: [6, 10], ageStages: commonAgeStages(20, 40, 60, 90), startingAges: { Cleric: [20, 1, 4], Druid: [20, 1, 4], Monk: [20, 1, 4], Fighter: [15, 1, 4], Paladin: [15, 1, 4], Ranger: [15, 1, 4], "Magic-User": [24, 2, 8], Illusionist: [24, 2, 8], Thief: [20, 1, 4], Assassin: [20, 1, 4] } },
};

function rollDice(count: number, sides: number, random: () => number) {
  let total = 0;
  for (let index = 0; index < count; index += 1) total += Math.floor(random() * sides) + 1;
  return total;
}

export function classNamesFromLine(className: string) {
  const activeLine = className.includes("→") ? className.split("→").at(-1) ?? className : className;
  return activeLine.split("/").map((entry) => entry.trim()).filter((entry) => Boolean(CLASS_RULES[entry]));
}

export function constitutionHitPointBonusPerDie(constitution: string | number, className: string) {
  const score = Math.max(3, Math.min(19, Math.trunc(Number(constitution) || 10)));
  if (score <= 3) return -2;
  if (score <= 6) return -1;
  if (score <= 14) return 0;
  if (score === 15) return 1;
  if (score === 16) return 2;
  const fighterType = classNamesFromLine(className).some((name) => ["Fighter", "Paladin", "Ranger"].includes(name));
  if (!fighterType) return 2;
  return score === 17 ? 3 : score === 18 ? 4 : 5;
}

export function rollCharacterHitPoints(hitDice: string, constitution: string | number, className: string, random: () => number = secureRandomFloat) {
  const parsed = hitDice.trim().toLowerCase().replaceAll(" ", "").match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!parsed) return null;
  const count = Math.max(1, Number(parsed[1]));
  const sides = Math.max(2, Number(parsed[2]));
  const fixedBonus = Number(parsed[3] ?? 0);
  const constitutionBonus = constitutionHitPointBonusPerDie(constitution, className);
  const rolls = Array.from({ length: count }, () => Math.floor(Math.max(0, Math.min(.999999999, random())) * sides) + 1);
  const adjustedRolls = rolls.map((roll) => Math.max(1, roll + constitutionBonus));
  return {
    total: Math.max(1, adjustedRolls.reduce((sum, roll) => sum + roll, 0) + fixedBonus),
    rolls,
    adjustedRolls,
    sides,
    fixedBonus,
    constitutionBonus,
  };
}

export function qualifiesForExtraordinaryStrength(className: string, strength: string | number) {
  const names = className.replaceAll("→", "/").split("/").map((name) => name.trim());
  return Number(strength) === 18 && names.some((name) => ["Fighter", "Paladin", "Ranger"].includes(name));
}

function extraordinaryStrengthFor(character: Character, strength: string | number, random: () => number) {
  if (!qualifiesForExtraordinaryStrength(character.className, strength)) return null;
  const stored = normalizedExceptionalStrength(character.exceptionalStrength);
  if (stored) return stored;
  return Math.min(100, Math.max(1, Math.floor(Math.max(0, Math.min(.999999999, random())) * 100) + 1));
}

function nextLevelXp(rule: ClassRule, level: number) {
  const index = Math.max(1, Math.trunc(level));
  if (index < rule.xp.length) return rule.xp[index];
  if (!rule.xpStepAfterTable) return 0;
  return rule.xp.at(-1)! + (index - rule.xp.length + 1) * rule.xpStepAfterTable;
}

function classSave(rule: ClassRule, level: number) {
  const current = Math.max(1, Math.trunc(level));
  return rule.saves.find((entry) => current >= entry.minimumLevel && current <= entry.maximumLevel)?.values ?? rule.saves.at(-1)!.values;
}

function ancestrySaveBonus(race: string, constitution: number) {
  if (!["dwarf", "gnome", "halfling"].includes(race.trim().toLowerCase())) return 0;
  if (constitution >= 18) return 5;
  if (constitution >= 14) return 4;
  if (constitution >= 11) return 3;
  if (constitution >= 7) return 2;
  return constitution >= 4 ? 1 : 0;
}

export function deriveClassProgression(className: string, level: number, race = "Human", constitution = 10) {
  const names = classNamesFromLine(className);
  const rules = names.map((name) => CLASS_RULES[name]).filter(Boolean);
  if (!rules.length) return { toHit: 0, hitDice: "1d8", totalXp: 0, saves: saves(20, 20, 20, 20, 20) };

  const bestSaves = rules.map((rule) => classSave(rule, level)).reduce((best, current) => ({
    wands: Math.min(best.wands, current.wands),
    breath: Math.min(best.breath, current.breath),
    death: Math.min(best.death, current.death),
    polymorph: Math.min(best.polymorph, current.polymorph),
    spells: Math.min(best.spells, current.spells),
  }));
  const racialBonus = ancestrySaveBonus(race, constitution);
  const adjustedSaves = racialBonus ? {
    ...bestSaves,
    wands: Math.max(2, bestSaves.wands - racialBonus),
    death: Math.max(2, bestSaves.death - racialBonus),
    spells: Math.max(2, bestSaves.spells - racialBonus),
  } : bestSaves;
  const profiles = rules.map((rule) => ({ ...rule.hitDice(level), sides: rule.hitDie }));
  const averageSides = profiles.reduce((sum, profile) => sum + profile.sides, 0) / profiles.length;
  const die = LEGAL_HIT_DICE.filter((sides) => sides <= averageSides).at(-1) ?? 4;
  const dice = Math.max(1, Math.floor(profiles.reduce((sum, profile) => sum + profile.dice, 0) / profiles.length));
  const bonus = Math.floor(profiles.reduce((sum, profile) => sum + profile.bonus, 0) / profiles.length);

  return {
    toHit: Math.max(...rules.map((rule) => rule.attackBonus(level))),
    hitDice: `${dice}d${die}${bonus ? `+${bonus}` : ""}`,
    totalXp: rules.reduce((sum, rule) => sum + nextLevelXp(rule, level), 0),
    saves: adjustedSaves,
  };
}

export function ageAdjustmentsFor(race: string, age: number): OsricStatline {
  const rule = RACE_RULES[race] ?? RACE_RULES.Human;
  return rule.ageStages.reduce((total, [minimumAge, adjustments]) => {
    if (age < minimumAge) return total;
    return total.map((value, index) => value + adjustments[index]) as OsricStatline;
  }, abilityZeroes());
}

/** Apply only ancestry adjustments to the immutable base scores. */
export function applyAncestry(rawStats: Character["stats"], race: string): Character["stats"] {
  const ancestry = OSRIC_ANCESTRIES.find((entry) => entry.name.toLowerCase() === race.toLowerCase()) ?? OSRIC_ANCESTRIES.find((entry) => entry.name === "Human")!;
  return rawStats.map((score, index) => {
    const raw = Number(score) || 10;
    return String(Math.max(ancestry.minimums[index], Math.min(ancestry.maximums[index], raw + ancestry.adjustments[index])));
  }) as Character["stats"];
}

export function applyAncestryAndAge(rawStats: Character["stats"], race: string, age: number): Character["stats"] {
  const ancestry = OSRIC_ANCESTRIES.find((entry) => entry.name.toLowerCase() === race.toLowerCase()) ?? OSRIC_ANCESTRIES.find((entry) => entry.name === "Human")!;
  const ancestryStats = applyAncestry(rawStats, ancestry.name);
  const ageChanges = ageAdjustmentsFor(ancestry.name, age);
  return ancestryStats.map((score, index) => {
    const afterAncestry = Number(score) || 10;
    const afterAge = afterAncestry + ageChanges[index];
    return String(afterAge < ancestry.minimums[index] || afterAge > ancestry.maximums[index] ? afterAncestry : afterAge);
  }) as Character["stats"];
}

function ageFormulaFor(race: string, className: string) {
  const rule = RACE_RULES[race] ?? RACE_RULES.Human;
  const formulas = classNamesFromLine(className).map((name) => rule.startingAges[name]).filter(Boolean);
  if (!formulas.length) return rule.startingAges.Fighter ?? Object.values(rule.startingAges)[0] ?? [15, 1, 4];
  return formulas.sort((a, b) => (b[0] + b[1] * (b[2] + 1) / 2) - (a[0] + a[1] * (a[2] + 1) / 2))[0];
}

export function generateStartingAge(race: string, className: string, random: () => number = secureRandomFloat) {
  const [ageBase, ageDice, ageSides] = ageFormulaFor(race, className);
  return String(ageBase + rollDice(ageDice, ageSides, random));
}

export function generatePhysicalRecord(race: string, className: string, random: () => number = secureRandomFloat) {
  const rule = RACE_RULES[race] ?? RACE_RULES.Human;
  let height = rule.heightBaseInches + rollDice(...rule.heightDice, random);
  let weight = rule.weightBasePounds + rollDice(...rule.weightDice, random);
  const variation = Math.floor(random() * 6) + 1;
  if (variation === 1) { height -= rollDice(1, 4, random); weight -= rollDice(1, 20, random); }
  if (variation === 6) { height += rollDice(1, 4, random); weight += rollDice(1, 20, random); }
  return {
    age: generateStartingAge(race, className, random),
    height: `${Math.floor(height / 12)}′ ${height % 12}″`,
    weight: `${Math.max(1, weight)} lb`,
  };
}

export function deriveCharacterRecord(character: Character, options: { regeneratePhysical?: boolean; regenerateAge?: boolean; random?: () => number } = {}): Character {
  const random = options.random ?? secureRandomFloat;
  const raceRule = RACE_RULES[character.race] ?? RACE_RULES.Human;
  const physical = options.regeneratePhysical
    ? generatePhysicalRecord(character.race, character.className, random)
    : {
        age: options.regenerateAge ? generateStartingAge(character.race, character.className, random) : character.age,
        height: character.height,
        weight: character.weight,
      };
  const age = Math.max(0, Math.trunc(Number.parseFloat(physical.age) || 0));
  const ancestryStats = character.rawStats ? applyAncestry(character.rawStats, character.race) : character.stats;
  const stats = character.rawStats && age > 0 && character.statAssignmentComplete !== false
    ? applyAncestryAndAge(character.rawStats, character.race, age)
    : ancestryStats;
  const progression = deriveClassProgression(character.className, character.level, character.race, Number(stats[2]) || 10);
  const exceptionalStrength = extraordinaryStrengthFor(character, stats[0], random);
  return reconcileOsricAutomation({ ...character, ...physical, ...progression, movementRate: options.regeneratePhysical ? raceRule.movementRate : character.movementRate, stats, exceptionalStrength });
}
