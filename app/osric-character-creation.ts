import { secureRandomFloat } from "./random.ts";

export const OSRIC_ABILITIES = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

export type OsricAbility = (typeof OSRIC_ABILITIES)[number];
export type OsricStatline = [number, number, number, number, number, number];

export type OsricClassDefinition = {
  name: string;
  minimums: OsricStatline;
  primes: OsricAbility[];
  priorities: OsricAbility[];
  xpBonus: string | null;
  note?: string;
};

export type OsricAncestryDefinition = {
  name: string;
  minimums: OsricStatline;
  maximums: OsricStatline;
  adjustments: OsricStatline;
  combinations: string[];
};

export type StatPoolRoll = {
  dice: [number, number, number, number][];
  totals: number[];
};

export type ClassRecommendation = {
  combination: string;
  mode: "Single" | "Multi";
  raw: OsricStatline;
  final: OsricStatline;
  minimums: OsricStatline;
  xpBonusEligible: boolean;
};

export type HumanDualClassOption = {
  from: string;
  to: string;
  enterPrimes: OsricAbility[];
};

export type AncestryQualification = {
  name: string;
  qualified: boolean;
  final: OsricStatline;
  requirements: string[];
};

const S = (str: number, dex: number, con: number, int: number, wis: number, cha: number): OsricStatline => [str, dex, con, int, wis, cha];

export const OSRIC_CLASSES: OsricClassDefinition[] = [
  { name: "Assassin", minimums: S(12, 12, 6, 11, 6, 3), primes: ["DEX"], priorities: ["DEX", "STR", "INT", "CON"], xpBonus: null },
  { name: "Cleric", minimums: S(6, 3, 6, 6, 9, 6), primes: ["WIS"], priorities: ["WIS", "CON", "STR", "CHA"], xpBonus: "WIS 16+" },
  { name: "Druid", minimums: S(6, 3, 6, 6, 12, 15), primes: ["WIS", "CHA"], priorities: ["WIS", "CHA", "CON", "DEX"], xpBonus: "WIS and CHA 16+" },
  { name: "Fighter", minimums: S(9, 6, 7, 3, 6, 6), primes: ["STR"], priorities: ["STR", "CON", "DEX", "WIS"], xpBonus: "STR 16+" },
  { name: "Illusionist", minimums: S(6, 16, 3, 15, 6, 6), primes: ["INT"], priorities: ["INT", "DEX", "CON", "WIS"], xpBonus: null, note: "DEX 16 is a class minimum; INT is the prime requisite." },
  { name: "Magic-User", minimums: S(3, 6, 6, 9, 6, 6), primes: ["INT"], priorities: ["INT", "DEX", "CON", "WIS"], xpBonus: "INT 16+" },
  { name: "Monk", minimums: S(10, 15, 3, 3, 10, 3), primes: [], priorities: ["DEX", "WIS", "STR", "CON"], xpBonus: null, note: "OSRIC does not explicitly identify a monk prime requisite. STR 15+, WIS 15+, and CON 11+ avoid some ability reductions." },
  { name: "Paladin", minimums: S(12, 6, 9, 9, 13, 17), primes: ["STR", "WIS"], priorities: ["CHA", "WIS", "STR", "CON"], xpBonus: "STR and WIS 16+" },
  { name: "Ranger", minimums: S(13, 6, 14, 13, 14, 6), primes: ["STR", "INT", "WIS"], priorities: ["STR", "INT", "WIS", "CON", "DEX"], xpBonus: "STR, INT, and WIS 16+" },
  { name: "Thief", minimums: S(6, 9, 6, 6, 3, 6), primes: ["DEX"], priorities: ["DEX", "CON", "INT", "STR"], xpBonus: "DEX 16+" },
];

export const OSRIC_ANCESTRIES: OsricAncestryDefinition[] = [
  { name: "Dwarf", minimums: S(8, 3, 12, 3, 3, 3), maximums: S(18, 17, 19, 18, 18, 16), adjustments: S(0, 0, 1, 0, 0, -1), combinations: ["Assassin", "Cleric", "Fighter", "Thief", "Fighter/Thief"] },
  { name: "Elf", minimums: S(3, 7, 6, 8, 3, 8), maximums: S(18, 19, 18, 18, 18, 18), adjustments: S(0, 1, -1, 0, 0, 0), combinations: ["Assassin", "Cleric", "Fighter", "Magic-User", "Thief", "Fighter/Magic-User", "Fighter/Thief", "Magic-User/Thief", "Fighter/Magic-User/Thief"] },
  { name: "Gnome", minimums: S(6, 3, 8, 7, 3, 3), maximums: S(18, 18, 18, 18, 18, 18), adjustments: S(0, 0, 0, 0, 0, 0), combinations: ["Assassin", "Cleric", "Fighter", "Illusionist", "Thief", "Fighter/Illusionist", "Fighter/Thief", "Illusionist/Thief"] },
  { name: "Half-Elf", minimums: S(3, 6, 6, 4, 3, 3), maximums: S(18, 18, 18, 18, 18, 18), adjustments: S(0, 0, 0, 0, 0, 0), combinations: ["Assassin", "Cleric", "Druid", "Fighter", "Magic-User", "Ranger", "Thief", "Cleric/Fighter", "Cleric/Ranger", "Cleric/Magic-User", "Fighter/Magic-User", "Fighter/Thief", "Cleric/Fighter/Magic-User", "Fighter/Magic-User/Thief"] },
  { name: "Halfling", minimums: S(6, 8, 10, 6, 3, 3), maximums: S(17, 18, 19, 18, 17, 18), adjustments: S(-1, 1, 0, 0, 0, 0), combinations: ["Fighter", "Druid", "Thief", "Fighter/Thief"] },
  { name: "Half-Orc", minimums: S(6, 3, 13, 3, 3, 3), maximums: S(18, 17, 19, 17, 14, 12), adjustments: S(1, 0, 1, 0, 0, -2), combinations: ["Assassin", "Cleric", "Fighter", "Thief", "Cleric/Fighter", "Cleric/Thief", "Cleric/Assassin", "Fighter/Thief", "Fighter/Assassin"] },
  { name: "Human", minimums: S(3, 3, 3, 3, 3, 3), maximums: S(18, 18, 18, 18, 18, 18), adjustments: S(0, 0, 0, 0, 0, 0), combinations: ["Assassin", "Cleric", "Druid", "Fighter", "Illusionist", "Magic-User", "Monk", "Paladin", "Ranger", "Thief"] },
];

const abilityIndex = (ability: OsricAbility) => OSRIC_ABILITIES.indexOf(ability);

export function ancestryDefinition(name: string) {
  return OSRIC_ANCESTRIES.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase()) ?? OSRIC_ANCESTRIES.at(-1)!;
}

export function classDefinition(name: string) {
  return OSRIC_CLASSES.find((entry) => entry.name.toLowerCase() === name.trim().toLowerCase());
}

export function rollStatPool(random: () => number = secureRandomFloat): StatPoolRoll {
  const dice = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => Math.floor(random() * 6) + 1) as [number, number, number, number]);
  return {
    dice,
    totals: dice.map((rolls) => [...rolls].sort((left, right) => left - right).slice(1).reduce((sum, roll) => sum + roll, 0)),
  };
}

export function finalStatsFromRaw(raw: OsricStatline, ancestryName: string): OsricStatline {
  const ancestry = ancestryDefinition(ancestryName);
  return raw.map((score, index) => score + ancestry.adjustments[index]) as OsricStatline;
}

export function ancestryQualifications(raw: OsricStatline): AncestryQualification[] {
  return OSRIC_ANCESTRIES.map((ancestry) => {
    const final = finalStatsFromRaw(raw, ancestry.name);
    const requirements = final.flatMap((score, index) => {
      if (score < ancestry.minimums[index]) return [`${OSRIC_ABILITIES[index]} ${ancestry.minimums[index]}+`];
      if (score > ancestry.maximums[index]) return [`${OSRIC_ABILITIES[index]} ${ancestry.maximums[index]} maximum`];
      return [];
    });
    return { name: ancestry.name, qualified: requirements.length === 0, final, requirements };
  });
}

export function combinationMinimums(ancestryName: string, combination: string): OsricStatline {
  const ancestry = ancestryDefinition(ancestryName);
  const definitions = combination.split("/").map((name) => classDefinition(name)).filter((entry): entry is OsricClassDefinition => Boolean(entry));
  return ancestry.minimums.map((minimum, index) => Math.max(minimum, ...definitions.map((entry) => entry.minimums[index]))) as OsricStatline;
}

export function qualifiesForCombination(ancestryName: string, combination: string, final: OsricStatline) {
  const ancestry = ancestryDefinition(ancestryName);
  if (!ancestry.combinations.includes(combination)) return false;
  const minimums = combinationMinimums(ancestryName, combination);
  return final.every((score, index) => score >= minimums[index] && score <= ancestry.maximums[index]);
}

function combinationDefinitions(combination: string) {
  return combination.split("/").map((name) => classDefinition(name)).filter((entry): entry is OsricClassDefinition => Boolean(entry));
}

function combinationPrimes(combination: string) {
  return Array.from(new Set(combinationDefinitions(combination).flatMap((entry) => entry.primes)));
}

function combinationPriorities(combination: string) {
  return Array.from(new Set(combinationDefinitions(combination).flatMap((entry) => entry.priorities)));
}

export function xpBonusEligible(combination: string, final: OsricStatline) {
  const definitions = combinationDefinitions(combination);
  return definitions.length > 0 && definitions.every((entry) => entry.xpBonus && entry.primes.every((prime) => final[abilityIndex(prime)] >= 16));
}

function uniquePermutations(values: number[]) {
  const sorted = [...values].sort((left, right) => right - left);
  const result: OsricStatline[] = [];
  const used = Array(sorted.length).fill(false);
  const current: number[] = [];
  const visit = () => {
    if (current.length === sorted.length) {
      result.push([...current] as OsricStatline);
      return;
    }
    for (let index = 0; index < sorted.length; index += 1) {
      if (used[index] || (index > 0 && sorted[index] === sorted[index - 1] && !used[index - 1])) continue;
      used[index] = true;
      current.push(sorted[index]);
      visit();
      current.pop();
      used[index] = false;
    }
  };
  visit();
  return result;
}

function recommendationKey(combination: string, final: OsricStatline) {
  const primes = combinationPrimes(combination);
  const priorities = combinationPriorities(combination);
  const primeScores = primes.map((prime) => final[abilityIndex(prime)]);
  const minimumPrime = primeScores.length ? Math.min(...primeScores) : 0;
  const sumPrime = primeScores.reduce((sum, score) => sum + score, 0);
  const priorityScore = priorities.reduce((sum, ability, index) => sum + final[abilityIndex(ability)] * Math.max(1, 8 - index), 0);
  const generalOrder: OsricAbility[] = ["CON", "DEX", "STR", "WIS", "INT", "CHA"];
  return [xpBonusEligible(combination, final) ? 1 : 0, minimumPrime, sumPrime, priorityScore, ...generalOrder.map((ability) => final[abilityIndex(ability)])];
}

function compareKeys(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) - (right[index] ?? 0);
  }
  return 0;
}

export function recommendedClassAssignments(ancestryName: string, pool: number[]): ClassRecommendation[] {
  if (pool.length !== 6 || pool.some((score) => !Number.isFinite(score))) return [];
  const ancestry = ancestryDefinition(ancestryName);
  const permutations = uniquePermutations(pool);
  return ancestry.combinations.flatMap((combination) => {
    let best: { raw: OsricStatline; final: OsricStatline; key: number[] } | null = null;
    for (const raw of permutations) {
      const final = finalStatsFromRaw(raw, ancestry.name);
      if (!qualifiesForCombination(ancestry.name, combination, final)) continue;
      const key = recommendationKey(combination, final);
      if (!best || compareKeys(key, best.key) > 0) best = { raw, final, key };
    }
    return best ? [{ combination, mode: combination.includes("/") ? "Multi" as const : "Single" as const, raw: best.raw, final: best.final, minimums: combinationMinimums(ancestry.name, combination), xpBonusEligible: xpBonusEligible(combination, best.final) }] : [];
  });
}

export function qualifyingCombinations(ancestryName: string, final: OsricStatline) {
  const ancestry = ancestryDefinition(ancestryName);
  return ancestry.combinations.filter((combination) => qualifiesForCombination(ancestry.name, combination, final));
}

export function closestClassMisses(ancestryName: string, final: OsricStatline, limit = 3) {
  const ancestry = ancestryDefinition(ancestryName);
  return ancestry.combinations
    .filter((combination) => !qualifiesForCombination(ancestry.name, combination, final))
    .map((combination) => {
      const minimums = combinationMinimums(ancestry.name, combination);
      const deficits = minimums.map((minimum, index) => Math.max(0, minimum - final[index])) as OsricStatline;
      return { combination, minimums, deficits, totalDeficit: deficits.reduce((sum, deficit) => sum + deficit, 0) };
    })
    .sort((left, right) => left.totalDeficit - right.totalDeficit || left.combination.localeCompare(right.combination))
    .slice(0, limit);
}

export function humanDualClassOptions(currentClassName: string, final: OsricStatline): HumanDualClassOption[] {
  const current = classDefinition(currentClassName);
  if (!current || current.primes.length === 0 || !current.primes.every((prime) => final[abilityIndex(prime)] >= 15)) return [];
  return OSRIC_CLASSES.filter((candidate) => candidate.name !== current.name && candidate.primes.length > 0)
    .filter((candidate) => qualifiesForCombination("Human", candidate.name, final))
    .filter((candidate) => candidate.primes.every((prime) => final[abilityIndex(prime)] >= 17))
    .map((candidate) => ({ from: current.name, to: candidate.name, enterPrimes: candidate.primes }));
}

export function statlineFromStrings(values: readonly string[]): OsricStatline {
  return values.map((value) => Math.max(3, Math.min(19, Math.trunc(Number(value) || 10)))) as OsricStatline;
}

export function formatStatline(values: OsricStatline) {
  return values.map((value, index) => `${OSRIC_ABILITIES[index]} ${value}`).join(" · ");
}

export function formatAdjustments(ancestryName: string) {
  const ancestry = ancestryDefinition(ancestryName);
  const parts = ancestry.adjustments.flatMap((value, index) => value ? [`${OSRIC_ABILITIES[index]} ${value > 0 ? "+" : ""}${value}`] : []);
  return parts.length ? parts.join(" · ") : "No ancestry adjustments";
}

export type StartingMoneyFormula = { className: string; dice: number; sides: number; multiplier: number; maximumGp: number };

const STARTING_MONEY: Record<string, Omit<StartingMoneyFormula, "className" | "maximumGp">> = {
  Assassin: { dice: 2, sides: 6, multiplier: 10 },
  Cleric: { dice: 3, sides: 6, multiplier: 10 },
  Druid: { dice: 3, sides: 6, multiplier: 10 },
  Fighter: { dice: 5, sides: 4, multiplier: 10 },
  Illusionist: { dice: 2, sides: 4, multiplier: 10 },
  "Magic-User": { dice: 2, sides: 4, multiplier: 10 },
  Monk: { dice: 5, sides: 4, multiplier: 1 },
  Paladin: { dice: 5, sides: 4, multiplier: 10 },
  Ranger: { dice: 5, sides: 4, multiplier: 10 },
  Thief: { dice: 2, sides: 6, multiplier: 10 },
};

/** Multiclass money is exactly one roll: the applicable formula with the highest possible GP result. */
export function startingMoneyFormula(className: string): StartingMoneyFormula | null {
  return className.split("/").map((entry) => entry.trim()).flatMap((entry) => {
    const formula = STARTING_MONEY[entry];
    return formula ? [{ className: entry, ...formula, maximumGp: formula.dice * formula.sides * formula.multiplier }] : [];
  }).sort((left, right) => right.maximumGp - left.maximumGp)[0] ?? null;
}

export function rollStartingMoneyGp(className: string, random: () => number = secureRandomFloat) {
  const formula = startingMoneyFormula(className);
  if (!formula) return 0;
  const rolled = Array.from({ length: formula.dice }, () => Math.floor(random() * formula.sides) + 1).reduce((sum, value) => sum + value, 0);
  return rolled * formula.multiplier;
}
