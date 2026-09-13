export const abilityNames = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

export type DerivedAbilityItem = {
  key: string;
  label: string;
  value: string;
  roll?: { dice: number; size: number; target: number; direction: "under" | "over"; label: string; extraordinaryTarget?: number };
};

function scoreOf(value: string | number) {
  return Math.max(3, Math.min(19, Math.floor(Number(value) || 10)));
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

type StrengthRow = { max: number; hit: number; damage: number; encumbranceLb: number; minor: number; major: number; extraordinaryMinor?: number };

const strengthRows: StrengthRow[] = [
  { max: 3, hit: -3, damage: -1, encumbranceLb: 10, minor: 1, major: 0 },
  { max: 5, hit: -2, damage: -1, encumbranceLb: 10, minor: 1, major: 0 },
  { max: 7, hit: -1, damage: 0, encumbranceLb: 20, minor: 1, major: 0 },
  { max: 9, hit: 0, damage: 0, encumbranceLb: 35, minor: 2, major: 1 },
  { max: 11, hit: 0, damage: 0, encumbranceLb: 35, minor: 2, major: 2 },
  { max: 13, hit: 0, damage: 0, encumbranceLb: 45, minor: 2, major: 4 },
  { max: 15, hit: 0, damage: 0, encumbranceLb: 55, minor: 2, major: 7 },
  { max: 16, hit: 0, damage: 1, encumbranceLb: 70, minor: 3, major: 10 },
  { max: 17, hit: 1, damage: 1, encumbranceLb: 85, minor: 3, major: 13 },
  { max: 18, hit: 1, damage: 2, encumbranceLb: 110, minor: 3, major: 16 },
  { max: 19, hit: 3, damage: 6, encumbranceLb: 300, minor: 5, major: 40, extraordinaryMinor: 2 },
];

const extraordinaryStrengthRows: Array<{ max: number; row: StrengthRow }> = [
  { max: 50, row: { max: 18, hit: 1, damage: 3, encumbranceLb: 135, minor: 3, major: 20 } },
  { max: 75, row: { max: 18, hit: 2, damage: 3, encumbranceLb: 160, minor: 4, major: 25 } },
  { max: 90, row: { max: 18, hit: 2, damage: 4, encumbranceLb: 185, minor: 4, major: 30 } },
  { max: 99, row: { max: 18, hit: 2, damage: 5, encumbranceLb: 235, minor: 4, major: 35, extraordinaryMinor: 1 } },
  { max: 100, row: strengthRows.at(-1)! },
];

export function normalizedExceptionalStrength(value: unknown) {
  const roll = Math.trunc(Number(value));
  return Number.isFinite(roll) && roll >= 1 && roll <= 100 ? roll : null;
}

export function effectiveStrengthScore(rawScore: string | number, exceptionalStrength?: number | null) {
  const score = scoreOf(rawScore);
  return score === 18 && normalizedExceptionalStrength(exceptionalStrength) === 100 ? 19 : score;
}

export function strengthScoreLabel(rawScore: string | number, exceptionalStrength?: number | null) {
  const score = scoreOf(rawScore);
  const roll = score === 18 ? normalizedExceptionalStrength(exceptionalStrength) : null;
  if (roll === 100) return "19";
  return roll ? `18.${String(roll).padStart(2, "0")}` : String(score);
}

function strengthRow(rawScore: string | number, exceptionalStrength?: number | null) {
  const score = scoreOf(rawScore);
  const roll = score === 18 ? normalizedExceptionalStrength(exceptionalStrength) : null;
  if (roll) return extraordinaryStrengthRows.find((entry) => roll <= entry.max)!.row;
  return strengthRows.find((entry) => score <= entry.max) ?? strengthRows.at(-1)!;
}

export function strengthEncumbranceLb(rawScore: string | number, exceptionalStrength?: number | null) {
  return strengthRow(rawScore, exceptionalStrength).encumbranceLb;
}

/** Campaign inventory capacity: OSRIC pounds, 10% player-favouring allowance, rounded up to a whole stone. */
export function strengthEncumbranceStone(rawScore: string | number, exceptionalStrength?: number | null) {
  return Math.ceil(strengthEncumbranceLb(rawScore, exceptionalStrength) * 1.1 / 14);
}

const dexterityRows = [
  { max: 3, surprise: -3, missile: -3, initiative: 3, ac: -4, agility: -4 },
  { max: 4, surprise: -2, missile: -2, initiative: 2, ac: -3, agility: -3 },
  { max: 5, surprise: -1, missile: -1, initiative: 1, ac: -2, agility: -2 },
  { max: 6, surprise: 0, missile: 0, initiative: 0, ac: -1, agility: -1 },
  { max: 14, surprise: 0, missile: 0, initiative: 0, ac: 0, agility: 0 },
  { max: 15, surprise: 0, missile: 0, initiative: 0, ac: 1, agility: 1 },
  { max: 16, surprise: 1, missile: 1, initiative: -1, ac: 2, agility: 2 },
  { max: 17, surprise: 2, missile: 2, initiative: -2, ac: 3, agility: 3 },
  { max: 19, surprise: 3, missile: 3, initiative: -3, ac: 4, agility: 4 },
];

export function dexterityArmorClassModifier(rawScore: string | number) {
  const score = scoreOf(rawScore);
  return (dexterityRows.find((entry) => score <= entry.max) ?? dexterityRows.at(-1)!).ac;
}

const constitutionRows = [
  { score: 3, hp: "−2", resurrection: 40, shock: 35 }, { score: 4, hp: "−1", resurrection: 45, shock: 40 },
  { score: 5, hp: "−1", resurrection: 50, shock: 45 }, { score: 6, hp: "−1", resurrection: 55, shock: 50 },
  { score: 7, hp: "0", resurrection: 60, shock: 55 }, { score: 8, hp: "0", resurrection: 65, shock: 60 },
  { score: 9, hp: "0", resurrection: 70, shock: 65 }, { score: 10, hp: "0", resurrection: 75, shock: 70 },
  { score: 11, hp: "0", resurrection: 80, shock: 75 }, { score: 12, hp: "0", resurrection: 85, shock: 80 },
  { score: 13, hp: "0", resurrection: 90, shock: 85 }, { score: 14, hp: "0", resurrection: 92, shock: 88 },
  { score: 15, hp: "+1", resurrection: 94, shock: 91 }, { score: 16, hp: "+2", resurrection: 96, shock: 95 },
  { score: 17, hp: "+2; fighter-types +3", resurrection: 98, shock: 97 },
  { score: 18, hp: "+2; fighter-types +4", resurrection: 100, shock: 99 },
  { score: 19, hp: "+2; fighter-types +5", resurrection: 100, shock: 99 },
];

function intelligenceLanguages(score: number) {
  if (score <= 7) return 0;
  return Math.min(8, Math.floor(score / 2) - 3);
}

function wisdomModifier(score: number) {
  if (score === 3) return -3;
  if (score === 4) return -2;
  if (score <= 7) return -1;
  if (score <= 14) return 0;
  return score - 14;
}

const charismaRows = [
  { max: 3, sidekicks: 1, loyalty: -30, reaction: -25 }, { max: 4, sidekicks: 1, loyalty: -25, reaction: -20 },
  { max: 5, sidekicks: 2, loyalty: -20, reaction: -15 }, { max: 6, sidekicks: 2, loyalty: -15, reaction: -10 },
  { max: 7, sidekicks: 3, loyalty: -10, reaction: -5 }, { max: 8, sidekicks: 3, loyalty: -5, reaction: 0 },
  { max: 11, sidekicks: 4, loyalty: 0, reaction: 0 }, { max: 12, sidekicks: 5, loyalty: 0, reaction: 0 },
  { max: 13, sidekicks: 5, loyalty: 0, reaction: 5 }, { max: 14, sidekicks: 6, loyalty: 5, reaction: 10 },
  { max: 15, sidekicks: 7, loyalty: 15, reaction: 15 }, { max: 16, sidekicks: 8, loyalty: 20, reaction: 25 },
  { max: 17, sidekicks: 10, loyalty: 30, reaction: 30 }, { max: 18, sidekicks: 15, loyalty: 40, reaction: 35 },
  { max: 19, sidekicks: 20, loyalty: 50, reaction: 40 },
];

export function derivedAbilityItems(statIndex: number, rawScore: string | number, exceptionalStrength?: number | null): DerivedAbilityItem[] {
  const score = scoreOf(rawScore);
  if (statIndex === 0) {
    const row = strengthRow(rawScore, exceptionalStrength);
    const minorDetail = row.extraordinaryMinor ? `; ${row.extraordinaryMinor} in 6 extraordinary` : "";
    return [
      { key: "melee-hit", label: "Melee/thrown hit", value: signed(row.hit) },
      { key: "damage", label: "Melee/thrown damage", value: signed(row.damage) },
      { key: "encumbrance", label: "Encumbrance", value: `${strengthEncumbranceStone(rawScore, exceptionalStrength)} st` },
      { key: "minor", label: "Minor strength", value: `1–${row.minor} on d6${minorDetail}`, roll: { dice: 1, size: 6, target: row.minor, direction: "under", label: "Minor strength", extraordinaryTarget: row.extraordinaryMinor } },
      { key: "major", label: "Major strength", value: `${row.major}%`, roll: { dice: 1, size: 100, target: row.major, direction: "under", label: "Major strength" } },
    ];
  }
  if (statIndex === 1) {
    const row = dexterityRows.find((entry) => score <= entry.max) ?? dexterityRows.at(-1)!;
    return [
      { key: "surprise", label: "Surprise", value: signed(row.surprise) },
      { key: "missile-hit", label: "Missile hit", value: signed(row.missile) },
      { key: "missile-init", label: "Missile initiative", value: row.initiative === 0 ? "0" : `${signed(row.initiative)} segment` },
      { key: "ac", label: "Ascending AC", value: signed(row.ac) },
      { key: "agility", label: "Agility save", value: signed(row.agility) },
    ];
  }
  if (statIndex === 2) {
    const row = constitutionRows.find((entry) => entry.score === score) ?? constitutionRows.at(-1)!;
    return [
      { key: "hp", label: "HP per die", value: row.hp },
      { key: "resurrection", label: "Resurrection", value: `${row.resurrection}%`, roll: { dice: 1, size: 100, target: row.resurrection, direction: "under", label: "Resurrection" } },
      { key: "system-shock", label: "System shock", value: `${row.shock}%`, roll: { dice: 1, size: 100, target: row.shock, direction: "under", label: "System shock" } },
    ];
  }
  if (statIndex === 3) return [{ key: "languages", label: "Additional languages", value: String(intelligenceLanguages(score)) }];
  if (statIndex === 4) return [{ key: "mental-save", label: "Mental save", value: signed(wisdomModifier(score)) }];
  const row = charismaRows.find((entry) => score <= entry.max) ?? charismaRows.at(-1)!;
  return [
    { key: "sidekicks", label: "Sidekick limit", value: String(row.sidekicks) },
    { key: "loyalty", label: "Loyalty", value: `${signed(row.loyalty)}%` },
    { key: "reaction", label: "Reaction", value: `${signed(row.reaction)}%` },
  ];
}

export function abilitySummary(statIndex: number, score: string | number, exceptionalStrength?: number | null) {
  return derivedAbilityItems(statIndex, score, exceptionalStrength).map((item) => `${item.label} ${item.value}`).join(" · ");
}
