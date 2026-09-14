import type { PsionicAttackMode, PsionicDefenseMode, PsionicDiscipline, PsionicsSetup } from "./types.ts";

export const psionicAttackModes: PsionicAttackMode[] = [
  "Psionic Blast",
  "Mind Thrust",
  "Ego Whip",
  "Id Insinuation",
  "Psychic Crush",
];

export const psionicDefenseModes: PsionicDefenseMode[] = [
  "Mind Blank",
  "Thought Shield",
  "Mental Barrier",
  "Intellect Fortress",
  "Tower of Iron Will",
];

export const psionicAttackRules: Record<PsionicAttackMode, { cost: number; range: [number, number | null, number | null]; area: string; canTargetNonPsionic: boolean }> = {
  "Psionic Blast": { cost: 20, range: [2, 4, 6], area: "Cone", canTargetNonPsionic: true },
  "Mind Thrust": { cost: 4, range: [3, 6, 9], area: "One creature", canTargetNonPsionic: false },
  "Ego Whip": { cost: 7, range: [4, 8, 12], area: "One creature", canTargetNonPsionic: false },
  "Id Insinuation": { cost: 10, range: [6, 12, 18], area: "2 in. × 2 in.", canTargetNonPsionic: false },
  "Psychic Crush": { cost: 14, range: [5, null, null], area: "One creature", canTargetNonPsionic: false },
};

export const psionicDefenseRules: Record<PsionicDefenseMode, { cost: number; area: string }> = {
  "Mind Blank": { cost: 1, area: "Individual" }, "Thought Shield": { cost: 2, area: "Individual" }, "Mental Barrier": { cost: 3, area: "Individual" }, "Intellect Fortress": { cost: 8, area: "10-ft radius" }, "Tower of Iron Will": { cost: 10, area: "3-ft radius" },
};

export const minorDisciplineNames = ["Animal Telepathy", "Body Equilibrium", "Body Weaponry", "Cell Adjustment", "Clairaudience", "Clairvoyance", "Detection of Good or Evil", "Detection of Magic", "Domination", "Empathy", "ESP", "Expansion", "Hypnosis", "Invisibility", "Levitation", "Mind Over Body", "Molecular Agitation", "Object Reading", "Precognition", "Reduction", "Sensitivity to Psychic Impressions", "Suspend Animation"] as const;
export const majorDisciplineNames = ["Astral Projection", "Aura Alteration", "Body Control", "Dimension Door", "Dimension Walk", "Energy Control", "Etherealness", "Mass Domination", "Mind Bar", "Molecular Manipulation", "Molecular Rearrangement", "Probability Travel", "Telekinesis", "Telempathic Projection", "Telepathy", "Telepathic Projection", "Teleportation", "Shape Alteration"] as const;

type DisciplineRule = { category: "minor" | "major"; cost: string; duration: string; restriction?: string; status: PsionicDiscipline["status"]; summary: string };
const disciplineExceptions: Record<string, Partial<DisciplineRule>> = {
  "Animal Telepathy": { cost: "1/round", duration: "Concentration", summary: "Communicate with increasingly alien life by mastery." },
  "Body Equilibrium": { cost: "1/round", duration: "Concentration", status: "reference", summary: "Cross unstable surfaces; falling is treated as feather fall." },
  "Body Weaponry": { cost: "1/round", duration: "Concentration", restriction: "Magic-users cannot possess", summary: "Body becomes armor and an unarmed weapon by mastery." },
  "Cell Adjustment": { cost: "Special", duration: "Permanent", summary: "Heal 1 HP per Strength Point; disease cost is GM adjudicated." },
  "Clairaudience": { cost: "5/round", duration: "Concentration" }, "Clairvoyance": { cost: "5/round", duration: "Concentration" },
  "Detection of Good or Evil": { cost: "2/round", duration: "Concentration" }, "Detection of Magic": { cost: "3/round", duration: "Concentration" },
  "Domination": { restriction: "Thieves cannot possess" }, "Empathy": { cost: "1/round", duration: "Concentration", restriction: "Fighters cannot possess" }, "ESP": { cost: "2/round", duration: "Concentration" },
  "Expansion": { cost: "6/round", duration: "Concentration", restriction: "Clerics cannot possess" }, "Invisibility": { cost: "3/round", duration: "Concentration" }, "Levitation": { cost: "1/round", duration: "Concentration" }, "Mind Over Body": { cost: "1/round", duration: "Concentration" },
  "Object Reading": { restriction: "Thieves cannot possess" }, "Reduction": { cost: "1/round", duration: "Concentration", restriction: "Clerics cannot possess" },
  "Mass Domination": { restriction: "Thieves cannot possess" }, "Telempathic Projection": { restriction: "Fighters cannot possess", cost: "Unspecified", duration: "Unspecified", status: "incomplete-source", summary: "The reconstruction does not supply a complete operational procedure; GM adjudication is required." },
};
Object.assign(disciplineExceptions, {
  "Animal Telepathy": { cost: "1/round", duration: "Concentration", summary: "Mastery governs range and creature type, from mammals at 1st to plants at 14th." },
  "Body Equilibrium": { cost: "1/round", duration: "Concentration", summary: "Walk on yielding surfaces; falls are treated as feather fall." },
  "Body Weaponry": { cost: "1/round", duration: "Concentration", restriction: "Magic-users cannot possess", summary: "Mastery supplies class-specific AC and weapon-equivalent attack; it does not stack with actual armor or weapons." },
  "Cell Adjustment": { cost: "1 per HP / special", duration: "Permanent", summary: "Heal 1 HP per point; disease curing is 20–70 points, with class maximum per mastery." },
  "Clairaudience": { cost: "5/round", duration: "Concentration", summary: "Clairaudience; may scan an unknown area within 30 feet." },
  "Clairvoyance": { cost: "5/round", duration: "Concentration", summary: "Clairvoyance; may scan an unknown area within 20 feet." },
  "Detection of Good or Evil": { cost: "2/round", duration: "Concentration", summary: "3-inch aura reading; mastery controls creature/aura/alignment identification chances." },
  "Detection of Magic": { cost: "3/round", duration: "Concentration", summary: "3-inch, half-inch path; identify type or school at 5% per mastery." },
  "Domination": { cost: "5 contact + target level/HD per round", duration: "Maintained", restriction: "Thieves cannot possess", summary: "Save vs. magic negates; contrary orders double and extreme orders triple maintenance." },
  "Empathy": { cost: "3/use", duration: "1 turn", restriction: "Fighters cannot possess", summary: "1 inch per mastery directional emotional reading of unshielded sentient minds." },
  "ESP": { cost: "2/round", duration: "Concentration", summary: "9-inch, half-inch path; language and intelligence limitations follow the spell." },
  "Expansion": { cost: "5/round", duration: "1 turn/mastery", restriction: "Clerics cannot possess", summary: "Up to 1 foot growth/mastery, +1 damage per foot; magical expanded items risk destruction." },
  "Hypnosis": { cost: "1 per level/HD", duration: "Special", summary: "INT 8–16 only; maximum total HD is mastery × (mastery + 1) / 2." },
  "Invisibility": { cost: "3/turn", duration: "1 turn/expenditure", summary: "Mental invisibility affects combined HD up to mastery × (mastery + 1) / 2; Mind Bar blocks it." },
  "Levitation": { cost: "3/turn", duration: "Up to 1 turn/mastery", summary: "Functions as levitate; duration may be divided." },
  "Mind Over Body": { cost: "5/day", duration: "Up to 2 days/mastery", summary: "Suppresses bodily needs; equal days of complete rest are required afterwards." },
  "Molecular Agitation": { cost: "1/round", duration: "Until stopped", summary: "Sight range; delay starts at 10 rounds and falls with mastery, then flesh damage rises cumulatively each round." },
  "Object Reading": { cost: "1/round", duration: "Concentration", restriction: "Thieves cannot possess", summary: "Touch an object to read impressions; usable information remains GM-adjudicated." },
  "Precognition": { cost: "1 per unknown", duration: "Immediate future", summary: "Base chance is INT+WIS by difficulty plus mastery, maximum 90%; GM sets unknown factors." },
  "Reduction": { cost: "2/turn", duration: "1 turn/mastery", restriction: "Clerics cannot possess", summary: "Shrink 1 foot/mastery to 5th; thereafter halve remaining height each mastery." },
  "Sensitivity to Psychic Impressions": { cost: "1/round", duration: "Concentration", summary: "2-inch sphere senses emotional/death residues; visions are GM-adjudicated." },
  "Suspend Animation": { cost: "6", duration: "mastery × (mastery + 1) / 2 weeks", summary: "Predetermined awakening; one active day is required for each suspended week." },
  "Astral Projection": { cost: "10", duration: "Special", summary: "As clerical astral spell, but transports only the psionic." },
  "Aura Alteration": { cost: "Special", duration: "6 turns for alignment", summary: "10 points per alignment factor; hostile aura recognition/removal costs use class level formulas." },
  "Body Control": { cost: "2/turn", duration: "1 turn/mastery", summary: "Survive hostile environments; withstand about 1 HD damage/mastery and breathe water at 1st." },
  "Dimension Door": { cost: "10", duration: "Instant", summary: "Functions as dimension door." },
  "Dimension Walk": { cost: "1/turn", duration: "Concentration", summary: "21 miles/turn; direction and arrival modifiers are determined by mastery tables." },
  "Energy Control": { cost: "1/spell level or damage die", duration: "Reactive", summary: "10-foot radius; channels comparable energy attacks harmlessly." },
  "Etherealness": { cost: "6/turn", duration: "Maintained", summary: "Become ethereal with 50 gp weight of touched/carried matter per mastery." },
  "Mass Domination": { cost: "10 contact + 1/target level/HD", duration: "5 turns/mastery", restriction: "Thieves cannot possess", summary: "Up to five targets save vs. magic at -4; mastery governs HD and mental scores shorten duration." },
  "Mind Bar": { cost: "5/day", duration: "1 day", summary: "10% protection/mastery against listed mental effects; source-identification is explicitly clarified for mastery 11+." },
  "Molecular Manipulation": { cost: "50", duration: "1 round activation", summary: "1-inch range; mastery table limits material weakened; magical objects save vs. magical fire." },
  "Molecular Rearrangement": { cost: "1 per gp weight", duration: "Once/month", summary: "Touch transmutation; 10 gp weight/mastery and metal limits use the mastery table." },
  "Probability Travel": { cost: "10 per plane/world", duration: "Instant", summary: "Additional travelers and arrival error improve at masteries 5 and 10." },
  "Telekinesis": { cost: "3/round", duration: "Maintained", summary: "Visible target; 3 inches + 1/mastery and maximum weight 30 gp × mastery × (mastery + 1) / 2." },
  "Telepathy": { cost: "1/round", duration: "Maintained", summary: "INT 5+ direct communication; known minds reach across a plane, subject to source limits." },
  "Telepathic Projection": { cost: "Special", duration: "Special", summary: "Save vs. magic negates; suggestion and possession each have explicit target-stat costs and mastery formulas." },
  "Teleportation": { cost: "20", duration: "Instant", summary: "Functions as teleport; extra points alter too-high/too-low arrival chance." },
  "Shape Alteration": { cost: "3 + material costs", duration: "Special", summary: "Polymorph-self-like form; body weight and material changes add the listed costs." },
});
export const psionicDisciplineRules: Record<string, DisciplineRule> = Object.fromEntries([
  ...minorDisciplineNames.map((name) => [name, { category: "minor", cost: "Special", duration: "See source", status: "gm-adjudicated", summary: "Reference discipline; apply its mastery procedure with GM adjudication.", ...disciplineExceptions[name] }]),
  ...majorDisciplineNames.map((name) => [name, { category: "major", cost: "Special", duration: "See source", status: "gm-adjudicated", summary: "Reference discipline; apply its mastery procedure with GM adjudication.", ...disciplineExceptions[name] }]),
]) as Record<string, DisciplineRule>;

const normalMatrix = [
  [[3,7,4,1,0],[12,4,0,0,1],[8,3,0,0,0],[1,6,8,1,1],[2,null,null,null,null]],
  [[6,9,6,2,0],[15,6,1,0,2],[12,4,0,0,0],[2,8,10,3,3],[5,2,1,null,null]],
  [[10,12,9,4,1],[18,9,2,2,3],[17,6,1,1,1],[4,11,13,7,6],[9,4,2,1,null]],
  [[15,16,13,7,2],[22,13,5,4,5],[23,9,3,2,3],[7,15,17,12,10],[14,7,5,3,2]],
  [[21,21,18,11,4],[26,18,9,7,8],[30,13,6,4,6],[11,20,22,18,15],[20,11,9,6,4]],
  [[28,27,24,16,7],[30,24,16,11,12],[38,18,10,7,10],[16,26,28,25,21],[27,16,14,10,7]],
] as const;
function strengthBand(value: number) { return value <= 25 ? 0 : value <= 50 ? 1 : value <= 75 ? 2 : value <= 100 ? 3 : value <= 125 ? 4 : 5; }
export function normalPsionicLoss(totalStrength: number, attack: PsionicAttackMode, defense: PsionicDefenseMode) {
  const value = normalMatrix[strengthBand(totalStrength)][psionicAttackModes.indexOf(attack)][psionicDefenseModes.indexOf(defense)];
  return attack === "Psychic Crush" ? { loss: null, instantDeathPercent: value ?? 0 } : { loss: value, instantDeathPercent: 0 };
}

const defenselessMatrix = [
  [["D", "C", "C", 15, 10, 5, 5], ["W", "W", 40, 35, 30, 25, 20], [30, 25, 20, 15, 10, 5, 5], [40, 35, 30, 25, 20, 15, 10], [72, 60, 50, 40, 30, 20, 10]],
  [["S", "D", "C", "C", 15, 10, 5], ["W", "W", "W", 40, 35, 30, 25], [35, 30, 25, 20, 15, 10, 5], ["R", 40, 35, 30, 25, 20, 15], [75, 62, 52, 42, 32, 22, 12]],
  [["W", "S", "D", "C", "C", 15, 10], ["P", "W", "W", "W", 40, 35, 30], [40, 35, 30, 25, 20, 15, 10], ["R", "R", 40, 35, 30, 25, 20], [79, 65, 55, 45, 35, 25, 15]],
  [["P", "W", "S", "D", "C", "C", 15], ["P", "P", "W", "W", "W", 40, 35], ["P", 40, 35, 30, 25, 20, 15], ["R", "R", "R", 40, 35, 30, 25], [84, 69, 59, 49, 39, 29, 19]],
  [["K", "P", "W", "S", "D", "C", "C"], ["P", "P", "P", "W", "W", "W", 40], ["I", "P", 40, 35, 30, 25, 20], ["R", "R", "R", "R", 40, 35, 30], [90, 74, 64, 54, 44, 34, 24]],
  [["K", "K", "P", "W", "S", "D", "C"], ["P", "P", "P", "P", "W", "W", "W"], ["I", "I", "P", 40, 35, 30, 25], ["R", "R", "R", "R", "R", 40, 35], [97, 80, 70, 60, 50, 40, 30]],
] as const;
function defenselessStrengthBand(value: number) { return value <= 59 ? 0 : value <= 109 ? 1 : value <= 159 ? 2 : value <= 209 ? 3 : value <= 259 ? 4 : value <= 309 ? 5 : 6; }
export function defenselessPsionicResult(attackerAttackPoints: number, defenderOriginalAbility: number, attack: PsionicAttackMode) {
  const row = strengthBand(attackerAttackPoints);
  const attackRow = psionicAttackModes.indexOf(attack);
  return defenselessMatrix[row][attackRow][defenselessStrengthBand(defenderOriginalAbility)];
}

export function psionicAttackCost(attack: PsionicAttackMode, range: "short" | "medium" | "long") {
  const multiplier = range === "long" && attack !== "Psionic Blast" && attack !== "Psychic Crush" ? 1 : 1;
  return psionicAttackRules[attack].cost * multiplier;
}

export function psionicRangeAdjustedLoss(value: number, range: "short" | "medium" | "long", attackerTotal: number) {
  if (range === "short") return value;
  if (range === "long" && attackerTotal <= 25) return Math.floor(value * .5);
  return Math.floor(value * .8);
}

export function bestPsionicDefense(psionics: PsionicsSetup, attackerTotal: number, attack: PsionicAttackMode) {
  const available = psionics.defenseModes.filter((mode) => psionics.currentDefensePoints >= psionicDefenseRules[mode].cost);
  const candidates = available.length ? available : ["Mind Blank" as PsionicDefenseMode];
  return candidates.reduce((best, mode) => {
    const contender = normalPsionicLoss(attackerTotal, attack, mode).loss ?? 999;
    const existing = normalPsionicLoss(attackerTotal, attack, best).loss ?? 999;
    return contender < existing ? mode : best;
  }, candidates[0]);
}

const blastSaveTargets = [[5, 20, 19, 18], [9, 18, 17, 16], [13, 16, 15, 14], [17, 14, 13, 12], [21, 12, 11, 10], [25, 10, 9, 8], [29, 8, 7, 6], [33, 6, 5, 4], [35, 4, 3, 2], [37, 2, 1, 0], [Infinity, 0, -1, -2]] as const;
export function psionicBlastSaveTarget(intelligencePlusWisdom: number, range: "short" | "medium" | "long") {
  const row = blastSaveTargets.find((entry) => intelligencePlusWisdom <= entry[0]) ?? blastSaveTargets[blastSaveTargets.length - 1];
  return row[range === "short" ? 1 : range === "medium" ? 2 : 3];
}
const blastEffects = [
  [5, ["Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Death", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Coma", "Sleep"]],
] as const;

/** Maps a failed blast d100 to an explicit condition. The compact ranges stay
 * data-driven so the UI never needs to guess at the table. */
export function psionicBlastEffect(intelligencePlusWisdom: number, roll: number) {
  const band = intelligencePlusWisdom <= 5 ? 0 : intelligencePlusWisdom <= 9 ? 1 : intelligencePlusWisdom <= 13 ? 2 : intelligencePlusWisdom <= 17 ? 3 : intelligencePlusWisdom <= 21 ? 4 : intelligencePlusWisdom <= 25 ? 5 : intelligencePlusWisdom <= 29 ? 6 : intelligencePlusWisdom <= 33 ? 7 : intelligencePlusWisdom <= 35 ? 8 : intelligencePlusWisdom <= 37 ? 9 : 10;
  const tables = [
    [[85, "Death"], [99, "Coma"], [100, "Sleep"]], [[10, "Death"], [90, "Coma"], [99, "Sleep"], [100, "Stun"]], [[1, "Death"], [15, "Coma"], [90, "Sleep"], [99, "Stun"], [100, "Confused"]], [[1, "Coma"], [10, "Sleep"], [90, "Stun"], [99, "Confused"], [100, "Enraged"]], [[1, "Sleep"], [15, "Stun"], [90, "Confused"], [99, "Enraged"], [100, "Panicked"]], [[1, "Stun"], [15, "Confused"], [90, "Enraged"], [99, "Panicked"], [100, "Feebleminded"]], [[1, "Confused"], [15, "Enraged"], [90, "Panicked"], [99, "Feebleminded"], [100, "Permanent insanity"]], [[1, "Enraged"], [15, "Panicked"], [90, "Feebleminded"], [99, "Permanent insanity"], [100, "Temporary insanity"]], [[1, "Panicked"], [20, "Feebleminded"], [85, "Permanent insanity"], [99, "Temporary insanity"], [100, "Mild insanity"]], [[1, "Feebleminded"], [15, "Permanent insanity"], [90, "Temporary insanity"], [100, "Mild insanity"]], [[1, "Permanent insanity"], [15, "Temporary insanity"], [100, "Mild insanity"]],
  ] as const;
  return tables[band].find(([upper]) => roll <= upper)?.[1] ?? "Mild insanity";
}
export function psionicPotentialModifier(intelligence: number, wisdom: number, charisma: number) { return Math.floor(Math.max(0, intelligence - 16) * 2.5 + Math.max(0, wisdom - 16) * 1.5 + Math.max(0, charisma - 16) * .5); }
export function psionicsEligible(intelligence: number, wisdom: number, charisma: number) { return Math.max(intelligence, wisdom, charisma) >= 16; }
export function psionicStrengthBonus(intelligence: number, wisdom: number, charisma: number) { const base = [intelligence, wisdom, charisma].reduce((sum, score) => sum + Math.max(0, score - 12), 0); const exceptional = [intelligence, wisdom, charisma].filter((score) => score > 16).length; return base * (exceptional === 3 ? 4 : exceptional >= 2 ? 2 : 1); }
export function attackModesKnown(roll: number) { return roll <= 25 ? 1 : roll <= 50 ? 2 : roll <= 75 ? 3 : roll <= 95 ? 4 : 5; }
export function defenseModesKnown(roll: number) { return roll <= 25 ? 2 : roll <= 75 ? 3 : roll <= 90 ? 4 : 5; }
export function disciplineCounts(roll: number) { if (roll <= 10) return { minor: 1, major: 0 }; if (roll <= 25) return { minor: 2, major: 0 }; if (roll <= 40) return { minor: 3, major: 0 }; if (roll <= 55) return { minor: 2, major: 1 }; if (roll <= 70) return { minor: 3, major: 1 }; if (roll <= 80) return { minor: 4, major: 1 }; if (roll <= 90) return { minor: 3, major: 2 }; if (roll <= 95) return { minor: 5, major: 1 }; return { minor: 4, major: 2 }; }
export function psionicRecovery(activity: "hard" | "walking" | "sitting" | "resting" | "sleeping") { return ({ hard: 0, walking: 3, sitting: 6, resting: 12, sleeping: 24 })[activity]; }

function pointValue(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function selectedModes<T extends string>(value: unknown, allowed: readonly T[]) {
  const selected = Array.isArray(value) ? value.filter((entry): entry is T => typeof entry === "string" && allowed.includes(entry as T)) : [];
  return allowed.filter((mode) => selected.includes(mode));
}

/**
 * Psionic combat uses separate attack and defense point pools. Mind Blank is
 * the automatic base defense for every psionic combatant, so persisted data
 * never represents an enabled psionic creature without it.
 */
export function normalizePsionics(value: PsionicsSetup | null | undefined): PsionicsSetup {
  const enabled = Boolean(value?.enabled);
  const maxAttackPoints = pointValue(value?.maxAttackPoints);
  const maxDefensePoints = pointValue(value?.maxDefensePoints);
  const attackModes = selectedModes(value?.attackModes, psionicAttackModes);
  const selectedDefenses = selectedModes(value?.defenseModes, psionicDefenseModes);
  const defenseModes = enabled && !selectedDefenses.includes("Mind Blank")
    ? ["Mind Blank", ...selectedDefenses] as PsionicDefenseMode[]
    : selectedDefenses;
  return {
    enabled,
    determination: value?.determination ?? "unresolved",
    potentialRoll: value?.potentialRoll ?? null,
    potentialModifier: pointValue(value?.potentialModifier),
    psionicStrengthRoll: value?.psionicStrengthRoll ?? null,
    psionicStrength: pointValue(value?.psionicStrength),
    originalPsionicAbility: pointValue(value?.originalPsionicAbility ?? maxAttackPoints + maxDefensePoints),
    maxAttackPoints,
    currentAttackPoints: Math.min(maxAttackPoints, pointValue(value?.currentAttackPoints)),
    maxDefensePoints,
    currentDefensePoints: Math.min(maxDefensePoints, pointValue(value?.currentDefensePoints)),
    attackModes,
    defenseModes,
    attackModeRoll: value?.attackModeRoll ?? null,
    defenseModeRoll: value?.defenseModeRoll ?? null,
    disciplineRoll: value?.disciplineRoll ?? null,
    disciplines: Array.isArray(value?.disciplines) ? value.disciplines.filter((entry): entry is PsionicDiscipline => Boolean(entry && psionicDisciplineRules[entry.name])).map((entry) => ({ ...entry, masteryLevel: Math.max(1, pointValue(entry.masteryLevel)), acquiredLevel: Math.max(1, pointValue(entry.acquiredLevel)), status: psionicDisciplineRules[entry.name].status })) : [],
    forced: Boolean(value?.forced),
  };
}

export function restorePsionicPoints(psionics: PsionicsSetup, strengthPoints: number) {
  let remaining = Math.max(0, Math.floor(strengthPoints)) * 2;
  const attack = Math.min(remaining, psionics.maxAttackPoints - psionics.currentAttackPoints); remaining -= attack;
  const defense = Math.min(remaining, psionics.maxDefensePoints - psionics.currentDefensePoints);
  return normalizePsionics({ ...psionics, currentAttackPoints: psionics.currentAttackPoints + attack, currentDefensePoints: psionics.currentDefensePoints + defense });
}
