import type { CampaignState, CharacterWeapon, MeleeEngagement, SegmentedAction, SegmentedParticipant } from "./types.ts";
import { ascendingAcToArmorCategory, weaponRulesById, weaponRulesForItem, type ArmorCategory, type WeaponRules } from "./weapon-rules.ts";
import { naturalArmorProfile, wornArmorProfile } from "./monster-armor.ts";

export const naturalSpeedFactors = { fast: 2, normal: 6, slow: 11 } as const;

const meleeActions = new Set<SegmentedAction>([
  "charge", "melee", "spec-melee", "heroic-assault", "melee-combination",
  "set-charge", "brawl", "grapple", "overbear", "improve-hold", "small-weapon", "natural-attack", "three-piece",
]);

export function isMeleeAction(action: SegmentedAction) {
  return meleeActions.has(action);
}

export function engagementKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join("::");
}

export function normalizeEngagements(engagements: MeleeEngagement[] | null | undefined) {
  const unique = new Map<string, MeleeEngagement>();
  for (const engagement of engagements ?? []) {
    if (!engagement?.attackerId || !engagement?.defenderId || engagement.attackerId === engagement.defenderId) continue;
    const [attackerId, defenderId] = [engagement.attackerId, engagement.defenderId].sort();
    const key = engagementKey(attackerId, defenderId);
    const createdRound = Math.max(1, Math.trunc(Number(engagement.createdRound) || 1));
    const prior = unique.get(key);
    if (!prior || createdRound < prior.createdRound) unique.set(key, { attackerId, defenderId, createdRound });
  }
  return Array.from(unique.values());
}

export function areEngaged(engagements: MeleeEngagement[], leftId: string, rightId: string) {
  const key = engagementKey(leftId, rightId);
  return engagements.some((entry) => engagementKey(entry.attackerId, entry.defenderId) === key);
}

export function wereEngagedAtStartOfRound(engagements: MeleeEngagement[], leftId: string, rightId: string, round: number) {
  const key = engagementKey(leftId, rightId);
  return engagements.some((entry) => engagementKey(entry.attackerId, entry.defenderId) === key && entry.createdRound < round);
}

export function establishEngagement(engagements: MeleeEngagement[], leftId: string, rightId: string, round: number) {
  if (!leftId || !rightId || leftId === rightId || areEngaged(engagements, leftId, rightId)) return normalizeEngagements(engagements);
  const [attackerId, defenderId] = [leftId, rightId].sort();
  return normalizeEngagements([...engagements, { attackerId, defenderId, createdRound: Math.max(1, round) }]);
}

export function removeEngagement(engagements: MeleeEngagement[], leftId: string, rightId?: string) {
  return engagements.filter((entry) => rightId
    ? engagementKey(entry.attackerId, entry.defenderId) !== engagementKey(leftId, rightId)
    : entry.attackerId !== leftId && entry.defenderId !== leftId);
}

export function engagedOpponentIds(engagements: MeleeEngagement[], participantId: string) {
  return engagements.flatMap((entry) => entry.attackerId === participantId ? [entry.defenderId] : entry.defenderId === participantId ? [entry.attackerId] : []);
}

/** Breadth-first traversal of the complete connected melee-engagement component. */
export function connectedEngagementClusterIds(engagements: MeleeEngagement[], participantId: string) {
  const visited = new Set<string>();
  const queue = [participantId];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const adjacent of engagedOpponentIds(engagements, current)) if (!visited.has(adjacent)) queue.push(adjacent);
  }
  return [...visited];
}

export function physicalArmorCategory(campaign: CampaignState, participant: SegmentedParticipant): ArmorCategory | null {
  if (participant.kind !== "character" || !participant.characterId) {
    if (participant.armorMode !== "worn") return naturalArmorProfile(participant.armorProfile).armorCategory;
    const profile = wornArmorProfile(participant.armorProfile);
    if (profile) return profile.armorCategory;
    if (participant.armorClass === null) return null;
    return ascendingAcToArmorCategory(participant.armorClass);
  }
  const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === participant.characterId);
  if (!owner) return 10;
  const worn = campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
  const ownedStacks = campaign.inventoryManagement.stacks.filter((stack) => {
    if (stack.containerId === worn?.id) return true;
    if (!stack.handSlot || !stack.containerId) return false;
    const container = campaign.inventoryManagement.containers.find((entry) => entry.id === stack.containerId);
    return container?.holderType === "owner" && container.holderId === owner.id;
  });
  const armorAscending = Math.max(10, ...ownedStacks.filter((stack) => stack.equipment?.kind === "armor").map((stack) => Number(stack.equipment?.ascendingAc) || 10));
  const shieldBonus = Math.max(0, ...ownedStacks.filter((stack) => stack.equipment?.kind === "shield").map((stack) => Number(stack.equipment?.shieldBonus) || 0));
  return ascendingAcToArmorCategory(armorAscending + shieldBonus);
}

export function getWeaponVsArmorModifier(rules: WeaponRules | null, target: SegmentedParticipant, campaign: CampaignState, ranged = false) {
  if (!rules) return 0;
  const category = physicalArmorCategory(campaign, target);
  if (category === null) return 0;
  return (ranged ? rules.missileArmorAdjustments : undefined)?.[category] ?? rules.armorAdjustments[category] ?? 0;
}

export function rulesForCharacterWeapon(weapon: CharacterWeapon | null | undefined) {
  return weaponRulesForItem({ name: weapon?.name, weaponRulesId: weapon?.weaponRulesId });
}

export function participantAttackRules(participant: SegmentedParticipant, characterWeapon?: CharacterWeapon | null) {
  if (participant.kind === "character") return rulesForCharacterWeapon(characterWeapon);
  if (participant.attackMode === "weapon") return weaponRulesById(participant.weaponRulesId);
  return null;
}

export function attackInstrumentLabel(participant: SegmentedParticipant, characterWeapon?: CharacterWeapon | null) {
  if (participant.kind !== "character" && participant.attackMode !== "weapon") return "a natural attack";
  const rulesName = participantAttackRules(participant, characterWeapon)?.name.trim();
  const itemName = characterWeapon?.name.trim();
  const name = rulesName || itemName;
  if (!name || /^(?:unarmed|fist|open hand|fist or open hand)$/i.test(name)) return "an unarmed strike";
  return name;
}

export function getAttackSpeedFactor(participant: SegmentedParticipant, characterWeapon?: CharacterWeapon | null) {
  if (participant.action === "grapple" || participant.action === "overbear" || participant.action === "improve-hold") return 2;
  if (participant.kind === "character") return participantAttackRules(participant, characterWeapon)?.speedFactor ?? null;
  if (participant.attackMode === "weapon") return participantAttackRules(participant)?.speedFactor ?? null;
  return naturalSpeedFactors[participant.naturalSpeed ?? "normal"];
}

export function getDefendingSpeedFactor(participant: SegmentedParticipant, characterWeapon?: CharacterWeapon | null) {
  return getAttackSpeedFactor(participant, characterWeapon);
}

export function getSpeedFactorAttackCount({
  melee,
  engagedAtRoundStart,
  finalMeleeAttack,
  attackerSpeedFactor,
  targetSpeedFactor,
}: {
  melee: boolean;
  engagedAtRoundStart: boolean;
  finalMeleeAttack: boolean;
  attackerSpeedFactor: number | null;
  targetSpeedFactor: number | null;
}): 1 | 2 | 3 {
  if (!melee || !engagedAtRoundStart || !finalMeleeAttack || attackerSpeedFactor === null || targetSpeedFactor === null || attackerSpeedFactor >= targetSpeedFactor) return 1;
  const difference = targetSpeedFactor - attackerSpeedFactor;
  if (difference >= 10) return 3;
  if (difference >= 5 || difference >= attackerSpeedFactor * 2) return 2;
  return 1;
}

export function compareEstablishedMeleeSpeed({
  sameSegment,
  mutualTargets,
  engagedAtRoundStart,
  leftSpeedFactor,
  rightSpeedFactor,
}: {
  sameSegment: boolean;
  mutualTargets: boolean;
  engagedAtRoundStart: boolean;
  leftSpeedFactor: number | null;
  rightSpeedFactor: number | null;
}) {
  if (!sameSegment || !mutualTargets || !engagedAtRoundStart || leftSpeedFactor === null || rightSpeedFactor === null) return 0;
  return leftSpeedFactor - rightSpeedFactor;
}

export function compareInitialChargeReach({
  mutualTargets,
  engagedAtRoundStart,
  leftAction,
  rightAction,
  leftReach,
  rightReach,
}: {
  mutualTargets: boolean;
  engagedAtRoundStart: boolean;
  leftAction: SegmentedAction;
  rightAction: SegmentedAction;
  leftReach: number | null;
  rightReach: number | null;
}) {
  const bothCharging = leftAction === "charge" && rightAction === "charge";
  const chargeMeetsSetWeapon = (leftAction === "charge" && rightAction === "set-charge")
    || (leftAction === "set-charge" && rightAction === "charge");
  if (!mutualTargets || engagedAtRoundStart || (!bothCharging && !chargeMeetsSetWeapon)) return 0;
  return (rightReach ?? 0) - (leftReach ?? 0);
}

export function getWeaponDamageForTarget(rules: WeaponRules | null, target: SegmentedParticipant, fallback: string) {
  if (!rules) return fallback;
  const largeTarget = target.size ? ["large", "huge", "gargantuan"].includes(target.size) : Boolean(target.large);
  return largeTarget ? rules.damageL : rules.damageSM;
}

export function weaponReachFeet(rules: WeaponRules | null) {
  if (!rules) return null;
  const values = rules.length.match(/\d+(?:½)?/g);
  if (!values?.length) return null;
  const reach = Math.max(...values.map((value) => Number(value.replace("½", ".5")) || 0));
  // PHB weapon lengths are usually written in feet, but dagger-length
  // weapons are recorded in inches (for example, "c. 15 in"). Keep one
  // canonical reach value so grapple/short-weapon checks do not mistake
  // fifteen inches for fifteen feet.
  return /\bin\b/i.test(rules.length) ? reach / 12 : reach;
}

/** House-rule threshold for weapons that can be used inside a grapple. */
export function isDaggerLengthWeapon(rules: WeaponRules | null) {
  return Boolean(rules && rules.weaponType === "melee" && (weaponReachFeet(rules) ?? 99) <= 2);
}
