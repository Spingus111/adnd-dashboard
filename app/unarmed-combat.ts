import type { GrappleHold, SegmentedParticipant, UnarmedOverrides } from "./types.ts";
import { hitDiceValue } from "./osric-combat.ts";

export type UnarmedActionKind = "grapple" | "overbear";

export type UnarmedHitContext = {
  attacker: Pick<SegmentedParticipant, "armorMode" | "armorProfile" | "size" | "hitDice" | "unarmedOverrides">;
  defender: Pick<SegmentedParticipant, "armorMode" | "armorProfile" | "size" | "hitDice" | "unarmedOverrides">;
  attackerDexterity?: string | number | null;
  attackerMove: number;
  defenderMove: number;
  attackerWornAscendingAc?: number | null;
  defenderWornAscendingAc?: number | null;
  attackerMagicArmorBonus?: number;
  magicalArmorReduction?: boolean;
  conditionModifier?: number;
};

const sizeModifiers: Record<NonNullable<SegmentedParticipant["size"]>, number> = {
  tiny: -4,
  small: -2,
  medium: 0,
  large: 2,
  huge: 6,
  gargantuan: 10,
};

function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function unarmedMoveModifier(move: number) {
  const rate = Math.max(0, numeric(move));
  if (rate >= 150) return 10;
  if (rate >= 120) return 8;
  if (rate >= 90) return 6;
  if (rate >= 60) return 4;
  if (rate >= 30) return 2;
  return 0;
}

export function unarmedDexterityModifier(dexterity: string | number | null | undefined) {
  const score = numeric(String(dexterity ?? "").replace(/[^0-9.]/g, ""));
  return score >= 19 ? 2 : score >= 15 ? 1 : 0;
}

function wornArmorTarget(ascendingAc: number | null | undefined) {
  const ac = Math.max(10, Math.min(20, Math.floor(numeric(ascendingAc) || 10)));
  return ac <= 10 ? 2 : 2 + (ac - 10) * 2;
}

function wornDefenderModifier(ascendingAc: number | null | undefined) {
  const ac = Math.max(10, Math.min(20, Math.floor(numeric(ascendingAc) || 10)));
  if (ac >= 20) return 7;
  if (ac >= 17) return 5;
  if (ac >= 15) return 4;
  if (ac >= 12) return 2;
  return 0;
}

export function attackerArmorTarget(
  participant: Pick<SegmentedParticipant, "armorMode" | "armorProfile" | "unarmedOverrides">,
  wornAscendingAc?: number | null,
  magicArmorBonus = 0,
  magicalArmorReduction = false,
) {
  const override = participant.unarmedOverrides?.hitTargetNumber;
  if (override !== null && override !== undefined) return Math.max(2, Math.floor(override));
  let target = 2;
  if (participant.armorMode === "worn") target = wornArmorTarget(wornAscendingAc);
  else if (participant.armorProfile === "hide") target = 3;
  else if (participant.armorProfile === "scales") target = 4;
  else if (participant.armorProfile === "plates") target = 6;
  if (magicalArmorReduction) target -= Math.max(0, Math.floor(magicArmorBonus)) * 2;
  return Math.max(2, target);
}

export function defenderArmorModifier(
  participant: Pick<SegmentedParticipant, "armorMode" | "armorProfile">,
  wornAscendingAc?: number | null,
) {
  if (participant.armorMode === "worn") return wornDefenderModifier(wornAscendingAc);
  if (participant.armorProfile === "plates") return 1;
  return 0;
}

export function unarmedHitBreakdown(context: UnarmedHitContext) {
  const targetNumber = attackerArmorTarget(
    context.attacker,
    context.attackerWornAscendingAc,
    context.attackerMagicArmorBonus,
    context.magicalArmorReduction,
  );
  const dexterity = unarmedDexterityModifier(context.attackerDexterity);
  const attackerMove = unarmedMoveModifier(context.attackerMove);
  const defenderArmor = defenderArmorModifier(context.defender, context.defenderWornAscendingAc);
  const defenderMove = -unarmedMoveModifier(context.defenderMove);
  const attackerOverride = context.attacker.unarmedOverrides?.hitAttackModifier ?? 0;
  const defenderOverride = context.defender.unarmedOverrides?.hitDefenseModifier ?? 0;
  const conditions = context.conditionModifier ?? 0;
  const modifier = dexterity + attackerMove + defenderArmor + defenderMove + attackerOverride + defenderOverride + conditions;
  return { targetNumber, dexterity, attackerMove, defenderArmor, defenderMove, attackerOverride, defenderOverride, conditions, modifier };
}

export function unarmedHitSucceeds(roll: number, targetNumber: number, modifier: number, pileOn = false) {
  if (roll === 1) return false;
  if (pileOn) return true;
  return roll + modifier >= targetNumber;
}

function strongCreatureModifier(participant: Pick<SegmentedParticipant, "hitDice">, strength?: string | number | null) {
  const hd = hitDiceValue(participant.hitDice) ?? 0;
  const source = String(strength ?? "").trim();
  const score = numeric(source.replace(/[^0-9.]/g, ""));
  const exceptional = /^18[/.]\d+/.test(source) || score > 18;
  if (exceptional || hd >= 9) return 2;
  if (score >= 16 || hd >= 4) return 1;
  return 0;
}

export function overbearResultModifier(options: {
  attacker: Pick<SegmentedParticipant, "size" | "hitDice" | "unarmedOverrides">;
  defender: Pick<SegmentedParticipant, "size" | "hitDice" | "unarmedOverrides">;
  attackerStrength?: string | number | null;
  defenderStrength?: string | number | null;
  attackerFourLegged?: boolean;
}) {
  const attacker = strongCreatureModifier(options.attacker, options.attackerStrength)
    + sizeModifiers[options.attacker.size ?? "medium"]
    + (options.attackerFourLegged ? 2 : 0)
    + (options.attacker.unarmedOverrides?.overbearAttackModifier ?? 0);
  const defender = -strongCreatureModifier(options.defender, options.defenderStrength)
    - sizeModifiers[options.defender.size ?? "medium"]
    + (options.defender.unarmedOverrides?.overbearDefenseModifier ?? 0);
  return { attacker, defender, total: attacker + defender };
}

export function grappleResultModifier(options: {
  attacker: Pick<SegmentedParticipant, "size" | "unarmedOverrides">;
  defender: Pick<SegmentedParticipant, "size" | "unarmedOverrides">;
  attackerAppendages?: number;
  defenderAppendages?: number;
}) {
  const appendage = (count: number) => count <= 1 ? -1 : count > 2 ? 1 : 0;
  const attacker = appendage(options.attackerAppendages ?? 2)
    + sizeModifiers[options.attacker.size ?? "medium"]
    + (options.attacker.unarmedOverrides?.grappleAttackModifier ?? 0);
  const defender = -appendage(options.defenderAppendages ?? 2)
    - sizeModifiers[options.defender.size ?? "medium"]
    + (options.defender.unarmedOverrides?.grappleDefenseModifier ?? 0);
  return { attacker, defender, total: attacker + defender };
}

export type UnarmedOutcome = {
  tier: string;
  label: string;
  realDamage: number;
  temporaryDamage: number;
  establishesHold: boolean;
  controllingLabel?: string;
  inferiorLabel?: string;
  followUp: boolean;
  followUpGrappleBonus: number;
  proneAttacker?: boolean;
  proneDefender?: boolean;
  staggeredDefender?: boolean;
  overborneDefender?: boolean;
  defenderLosesNextAction?: boolean;
  defenderMoveZero?: boolean;
  repeatsGrappleAtBonus?: number;
};

export function overbearOutcome(adjustedResult: number): UnarmedOutcome {
  if (adjustedResult <= 1) return { tier: "total-failure", label: "Total failure", realDamage: 0, temporaryDamage: 0, establishesHold: false, followUp: false, followUpGrappleBonus: 0, proneAttacker: true };
  if (adjustedResult === 2) return { tier: "partial-failure", label: "Foot grab", realDamage: 0, temporaryDamage: 0, establishesHold: true, controllingLabel: "Foot grab", followUp: false, followUpGrappleBonus: 0, proneAttacker: true };
  if (adjustedResult <= 4) return { tier: "partial-success", label: "Staggered · Overborne", realDamage: 0, temporaryDamage: Math.max(0, adjustedResult), establishesHold: false, followUp: true, followUpGrappleBonus: 0, staggeredDefender: true, overborneDefender: true };
  if (adjustedResult <= 6) return { tier: "success", label: "Prone · Overborne", realDamage: 1, temporaryDamage: Math.max(0, adjustedResult - 1), establishesHold: false, followUp: true, followUpGrappleBonus: 0, proneDefender: true, overborneDefender: true };
  return { tier: "total-success", label: "Total success", realDamage: 2, temporaryDamage: Math.max(0, adjustedResult - 2), establishesHold: false, followUp: true, followUpGrappleBonus: 2, proneDefender: true, overborneDefender: true, defenderLosesNextAction: true, defenderMoveZero: true };
}

export function grappleOutcome(adjustedResult: number): UnarmedOutcome {
  if (adjustedResult <= 1) return { tier: "scuffling", label: "Awkward scuffling", realDamage: 0, temporaryDamage: 1, establishesHold: false, followUp: false, followUpGrappleBonus: 0 };
  if (adjustedResult <= 4) return { tier: "arm-grab", label: "Arm grab / Elbow bash", realDamage: 1, temporaryDamage: Math.max(0, adjustedResult - 1), establishesHold: true, controllingLabel: "Arm grab", inferiorLabel: "Elbow bash", followUp: false, followUpGrappleBonus: 0 };
  if (adjustedResult === 5) return { tier: "waist-lock", label: "Waist lock / Leg hold", realDamage: 1, temporaryDamage: 4, establishesHold: true, controllingLabel: "Waist lock", inferiorLabel: "Leg hold", followUp: false, followUpGrappleBonus: 0 };
  if (adjustedResult === 6) return { tier: "rear-choke", label: "Rear choke / Head butt", realDamage: 2, temporaryDamage: 4, establishesHold: true, controllingLabel: "Rear choke", inferiorLabel: "Head butt", followUp: false, followUpGrappleBonus: 0 };
  if (adjustedResult === 7) return { tier: "arm-lock", label: "Arm lock / Wicked elbow bash", realDamage: 2, temporaryDamage: 5, establishesHold: true, controllingLabel: "Arm lock", inferiorLabel: "Wicked elbow bash", followUp: false, followUpGrappleBonus: 0 };
  if (adjustedResult === 8) return { tier: "head-lock", label: "Head lock / Gouge", realDamage: 2, temporaryDamage: 6, establishesHold: true, controllingLabel: "Head lock", inferiorLabel: "Gouge", followUp: false, followUpGrappleBonus: 0 };
  return { tier: "decisive-throw", label: "Decisive throw", realDamage: 3, temporaryDamage: 6, establishesHold: false, followUp: false, followUpGrappleBonus: 0, defenderLosesNextAction: true, repeatsGrappleAtBonus: 2 };
}

export function controllingHoldId(holds: GrappleHold[], leftId: string, rightId: string) {
  return holds
    .filter((hold) => (hold.attackerId === leftId && hold.defenderId === rightId) || (hold.attackerId === rightId && hold.defenderId === leftId))
    .sort((left, right) => right.result - left.result || left.establishedOrder - right.establishedOrder)[0]?.id ?? null;
}

export function participantIsGrappling(holds: GrappleHold[], participantId: string) {
  return holds.some((hold) => hold.result > 1 && (hold.attackerId === participantId || (!hold.footGrab && hold.defenderId === participantId)));
}

export function pileOnApplies(holds: GrappleHold[], attackerId: string, defenderId: string) {
  return holds.some((hold) => {
    const defenderIsGrappling = hold.result > 1
      && (hold.attackerId === defenderId || (!hold.footGrab && hold.defenderId === defenderId));
    const attackerIsAlreadyInThisGrapple = hold.attackerId === attackerId || hold.defenderId === attackerId;
    return defenderIsGrappling && !attackerIsAlreadyInThisGrapple;
  });
}

export function holdsForParticipant(holds: GrappleHold[], participantId: string) {
  return holds.filter((hold) => hold.attackerId === participantId || hold.defenderId === participantId);
}

export function normalizeUnarmedOverrides(value: UnarmedOverrides | null | undefined): UnarmedOverrides {
  return {
    hitTargetNumber: value?.hitTargetNumber ?? null,
    hitAttackModifier: value?.hitAttackModifier ?? null,
    hitDefenseModifier: value?.hitDefenseModifier ?? null,
    overbearAttackModifier: value?.overbearAttackModifier ?? null,
    overbearDefenseModifier: value?.overbearDefenseModifier ?? null,
    grappleAttackModifier: value?.grappleAttackModifier ?? null,
    grappleDefenseModifier: value?.grappleDefenseModifier ?? null,
    magicArmorBonus: value?.magicArmorBonus ?? null,
    cannotGrapple: Boolean(value?.cannotGrapple),
    cannotBeGrappled: Boolean(value?.cannotBeGrappled),
    cannotOverbear: Boolean(value?.cannotOverbear),
    cannotBeOverborne: Boolean(value?.cannotBeOverborne),
    immuneTemporaryDamage: Boolean(value?.immuneTemporaryDamage),
    fourLegged: Boolean(value?.fourLegged),
    appendages: Math.max(1, Math.floor(value?.appendages ?? 2)),
  };
}
