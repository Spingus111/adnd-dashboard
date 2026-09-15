"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { emptyCampaign, type
  CampaignState,
  CombatEffect,
  CombatEventResolution,
  InventoryStack,
  PsionicDefenseMode,
  SaveBlock,
  SegmentedAction,
  SegmentedInitiativeState,
  SegmentedParticipant,
} from "./types";
import { sendChatAction } from "./chat-events";
import { abilityNames, derivedAbilityItems, strengthScoreLabel } from "./osric-stats";
import { adjustedSurpriseSegments, attackHitsAscendingArmor, attackRequiresDeclaredTarget, canCheckUnhelmedHeadshot, canChooseNonIntelligentSaveTable, enemySaveLabels, fighterLevelFromHitDice, heroicAssaultEligible, maximumHitPointsFromHitDice, missileInitiativeAdjustment, missileInitiativeSegment, monsterAttackBonus, monsterOnslaughtSegment, monsterSaves, requiredAttackD20, resolvedAttackD20, rollMonsterHp, singleHitDieExpression, specializedMeleeRate, specializedMeleeSegments, surpriseSegmentsForRoll } from "./osric-combat";
import { characterFillStyle, characterTileStyle } from "./tile-color";
import { evaluateDiceExpression, looksLikeDice } from "./dice-expression";
import HpBar, { MonsterHpBar } from "./hp-bar";
import HpMathInput from "./hp-math-input";
import { availableCharacterWeapons, characterWeapon, weaponDamageBonus, weaponEquipmentBonus } from "./character-weapons";
import { visibleMarchCapacity } from "./marching-order";
import { saveIcons } from "./save-icons";
import CharacterNameLink from "./character-navigation";
import { combatConditionRule, conditionSummary } from "./combat-conditions";
import { handStateForWeapon, handStateHasShield, usesUnarmedDamage } from "./hand-states";
import { effectiveArmorMovementRate, encumbranceSummary, partyEncumbranceSurpriseModifier } from "./movement";
import { ammoShotsForCharacter, consumeAmmoShotForCharacter, getContainerCapacityUnits, getContainerUsedUnits, getOwnerCapacityUnits, getOwnerUsedUnits, handLoadoutIssue, moveStack, moveStackToHand, stackRequiresBothHands, syncPhysicalEquipment, throwOneStackToGround } from "./inventory-management";
import { preparedSpells } from "./spellcasting";
import { PARTY_CHAT_PREFERENCES_KEY, combatDeclarationIsHidden, partyChatRoleFromPreferences, partyChatRoleHasGmPermissions, type PartyChatRole } from "./party-chat-role";
import { announceCombatMutation, canControlCombatant, canControlCombatProgression, type CombatIdentity } from "./combat-permissions";
import { attackInstrumentLabel, compareEstablishedMeleeSpeed, compareInitialChargeReach, connectedEngagementClusterIds, engagedOpponentIds, establishEngagement, getAttackSpeedFactor, getDefendingSpeedFactor, getSpeedFactorAttackCount, getWeaponDamageForTarget, getWeaponVsArmorModifier, isDaggerLengthWeapon, isMeleeAction, participantAttackRules, removeEngagement, weaponReachFeet, wereEngagedAtStartOfRound } from "./weapon-combat-rules";
import { phbWeaponRules, weaponCanMakeMissileAttack, weaponIsThrown, weaponRulesById, weaponRulesForItem } from "./weapon-rules";
import { NaturalSpeedInfoButton, WeaponRulesTooltip } from "./weapon-rules-tooltip";
import { announceCampaignOperations } from "./campaign-operation-events";
import type { CampaignOperation } from "./campaign-operations";
import { sharedId } from "./shared-id";
import { defaultMonsterArmorProfile, monsterArmorProfileLabel, naturalArmorProfiles, wornArmorProfile, wornArmorProfiles, type MonsterArmorProfile } from "./monster-armor";
import { stableNpcToParticipant } from "./npc-stable";
import { applyManualCombatModifier, parseManualCombatModifier } from "./combat-manual-modifier";
import { participantIsConscious, pruneInvalidCombatTargets } from "./combat-targeting";
import { attackerArmorTarget, controllingHoldId, defenderArmorModifier, grappleOutcome, grappleResultModifier, holdsForParticipant, normalizeUnarmedOverrides, overbearOutcome, overbearResultModifier, participantIsGrappling, pileOnApplies, unarmedHitBreakdown, unarmedHitSucceeds } from "./unarmed-combat";
import { bestPsionicDefense, defenselessPsionicResult, normalizePsionics, normalPsionicLoss, psionicAttackCost, psionicAttackModes, psionicAttackRules, psionicBlastEffect, psionicBlastSaveTarget, psionicDefenseModes, psionicDefenseRules, psionicRangeAdjustedLoss } from "./psionics";
import { getNonProficiencyPenalty, getSpellcastingTracks, getWeaponTrainingState, specialistClassLevel, specializedMissileRate } from "./osric-advancement";
import { publishAttackControls, subscribeAttackRequests } from "./combat-attack-control";
import { rollSecureDie, secureRandomFloat, secureRandomIndex } from "./random";

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
};

type SegmentEvent = {
  key: string;
  participantId: string;
  round: number;
  segment: number;
  label: string;
  emoji: string;
  targetId?: string;
  damageExpression?: string;
  freeAttackBonus?: number;
  attackCount?: number;
  weaponId?: string;
  twoWeaponPenalty?: -2 | -4;
};

const actionEmojis: Record<SegmentedAction, string> = {
  "": "◆",
  move: "🚶",
  charge: "🐎",
  close: "➡️",
  "close-hurl": "🪓",
  flee: "🏃",
  melee: "⚔️",
  "hand-2-melee": "🗡️",
  "two-weapon-melee": "⚔️",
  "spec-melee": "🗡️",
  "heroic-assault": "💥",
  "melee-combination": "⚔️",
  missile: "🏹",
  "spec-ranged": "🎯",
  negotiate: "🗣️",
  parry: "🛡️",
  "parry-disengage": "🏃",
  "set-charge": "🔱",
  spell: "✨",
  "spell-like-effect": "🌀",
  "use-magic": "⚡",
  "switch-weapon": "🔄",
  "three-piece": "☠️",
  brawl: "🥊",
  grapple: "🤼",
  overbear: "🐂",
  "maintain-hold": "🔒",
  "improve-hold": "⬆️",
  "release-hold": "🔓",
  "small-weapon": "🗡️",
  "natural-attack": "🐾",
  "psionic-combat": "🧠",
  "stand-up": "⬆️",
  unconscious: "💤",
  die: "🩸",
  hold: "⏸️",
  skip: "⏭️",
  inventory: "🎒",
  other: "❓",
};

const actionLabels: Record<SegmentedAction, string> = {
  "": "Select declared action",
  move: "Move",
  charge: "Charge into combat",
  close: "Close into combat",
  "close-hurl": "Close into combat, hurl weapon",
  flee: "Flee from combat",
  melee: "Melee attack",
  "hand-2-melee": "Hand 2 melee",
  "two-weapon-melee": "Two-weapon fighting melee",
  "spec-melee": "Specialized melee",
  "heroic-assault": "Heroic Assault",
  "melee-combination": "Melee attack combination",
  missile: "Missile attack",
  "spec-ranged": "Specialized ranged",
  negotiate: "Negotiation / diplomacy",
  parry: "Parry",
  "parry-disengage": "Parry & disengage",
  "set-charge": "Set weapon against charge",
  spell: "Cast spell",
  "spell-like-effect": "Spell-like effect",
  "use-magic": "Use magical device",
  "switch-weapon": "Move items between hands and Quick Access",
  "three-piece": "Monster Onslaught",
  brawl: "Brawl",
  grapple: "Grapple",
  overbear: "Overbear",
  "maintain-hold": "Maintain hold",
  "improve-hold": "Improve hold",
  "release-hold": "Release hold",
  "small-weapon": "Short weapon attack",
  "natural-attack": "Natural attack",
  "psionic-combat": "Psionic combat",
  "stand-up": "Stand up",
  unconscious: "Be unconscious",
  die: "Die (-1 HP)",
  hold: "Hold until a chosen segment",
  skip: "Skip / no action",
  inventory: "Inventory management",
  other: "Other",
};

const actionHelp: Record<Exclude<SegmentedAction, "">, string> = {
  move: "Begin ordinary movement in segment 1; movement continues through later segments as needed.",
  charge: "Begin moving in segment 1, then Engage and make one melee attack in the rolled segment at +2 to hit. Charging does not trigger a full specialized routine.",
  close: "Enter melee without attacking in the rolled segment. Use Engage when contact occurs; if necessary, the tracker readies the first listed melee weapon.",
  "close-hurl": "Begin moving in segment 1, then Engage and throw the equipped weapon in the DEX-adjusted rolled segment. This does not trigger a full missile routine.",
  flee: "Attempt to withdraw or escape. The GM determines pursuit, free attacks, and movement limits.",
  melee: "Make one melee attack in the rolled initiative segment using STR, class to-hit, and the equipped weapon.",
  "hand-2-melee": "Make one melee attack with the readied Hand 2 dagger or hand axe. This does not use specialization.",
  "two-weapon-melee": "Make a primary-hand attack at −2 and a Hand 2 dagger/hand axe attack at −4. Apply the DEX missile adjustment to each penalty, never beyond 0. This does not use specialization.",
  "spec-melee": "Uses fighter level and round parity: 3/2, 2/1, or 5/2 melee timing is generated automatically. Weapon specialization adds +1 to hit and +2 damage.",
  "heroic-assault": "A level 2+ fighter acts in segment 1 and may attack one different enemy per fighter level, but only if that enemy's HD could not possibly roll 8 hp. For example, 1d6+1 qualifies; 1d8 and 2d4 do not. This replaces all regular and combination attacks for the round.",
  "melee-combination": "For eligible fighters: one attack in segment 1 and another in segment 10.",
  missile: "Make a ranged attack in the rolled segment after applying the character's DEX initiative adjustment. A target may be left open for random fire into melee.",
  "spec-ranged": "All selected missiles are discharged in the same DEX-adjusted initiative segment. Weapon specialization adds +1 to hit and +2 damage.",
  negotiate: "Speak, bargain, threaten, or attempt diplomacy instead of making a combat attack.",
  parry: "Give up the attack and improve ascending AC with positive STR melee and equipped-weapon attack bonuses.",
  "parry-disengage": "Parry while withdrawing from the selected enemy. That enemy receives one free melee attack at +4; your usual parry AC bonus applies against it.",
  "set-charge": "Set a suitable weapon before an incoming charge; resolve the prepared attack when the charger reaches the defender.",
  spell: "Begin casting in the rolled initiative segment. The spell takes effect after its listed casting time; naming the spell and choosing a target are optional.",
  "spell-like-effect": "Monster-only magical effect. Choose every affected target, then roll separate damage and the selected saving throw for each.",
  "use-magic": "Activate a wand, staff, rod, scroll, potion, or similar device. The short description is optional unless the GM needs it.",
  "switch-weapon": "Use the rolled segment to rearrange any Quick Access items between Hand 1, Hand 2, and Quick Access.",
  "three-piece": "Enemy-only routine with fixed attacks in segments 1 and 10 plus up to eight additional attacks, each receiving its own d6 segment. Set every attack's damage separately.",
  brawl: "Make a normal proficient melee attack for 1d2 ordinary damage.",
  grapple: "Fend, then make the special OSRIC Unarmed Hit roll and a d8 Grapple Result. Both hands must be free, or hold only one dagger-length weapon.",
  overbear: "Fend, then make the special OSRIC Unarmed Hit roll and a d6 Overbear Result. Hands may remain occupied.",
  "maintain-hold": "Automatically repeat the selected established hold's damage and effect.",
  "improve-hold": "Make another Unarmed Hit from inside the grapple, with no Fending, then roll a new Grapple Result.",
  "release-hold": "Release the selected hold. The relationship ends if no other hold keeps it active.",
  "small-weapon": "Attack within a grapple using a dagger-length-or-smaller normal weapon in hand or Quick Access.",
  "natural-attack": "Use a natural claw, bite, or similar attack normally while Grappling.",
  "psionic-combat": "Choose a psionic attack and target. The tracker creates one exchange per occupied segment, automatically maintains a legal defense, and records the matrix result.",
  "stand-up": "Use this action to remove Prone. Overborne prevents standing until that restriction ends.",
  unconscious: "No voluntary action. This is assigned automatically at 0 HP.",
  die: "Lose 1 HP automatically in the rolled segment. This is assigned at -1 through -9 HP.",
  hold: "Ignore the rolled segment and act in the segment you choose.",
  skip: "Appear in the initiative order but take no declared action.",
  inventory: "Manage equipment and inventory; this reserves no combat action and functions as Skip.",
  other: "Describe an action not covered by the standard list.",
};

const actionGroups: Array<{ label: string; actions: Array<Exclude<SegmentedAction, "">> }> = [
  { label: "Common actions", actions: ["charge", "melee", "hand-2-melee", "two-weapon-melee", "missile", "close", "move", "parry-disengage", "spell"] },
  { label: "Unarmed", actions: ["brawl", "grapple", "overbear"] },
  { label: "Psionics", actions: ["psionic-combat"] },
  { label: "Prone", actions: ["stand-up"] },
  { label: "Tactical & equipment", actions: ["close-hurl", "parry", "set-charge", "switch-weapon", "use-magic", "flee", "hold"] },
  { label: "Current grapple", actions: ["maintain-hold", "improve-hold", "release-hold", "small-weapon", "natural-attack"] },
  { label: "Special attacks", actions: ["heroic-assault", "melee-combination", "three-piece", "spell-like-effect"] },
  { label: "Non-combat / no action", actions: ["negotiate", "inventory", "other", "skip"] },
];

const actionPages: Partial<Record<Exclude<SegmentedAction, "">, string>> = {
  move: "OSRIC Player Guide p.95",
  charge: "p.93",
  close: "p.93",
  "close-hurl": "pp.93-94",
  flee: "p.94",
  hold: "p.94",
  melee: "p.94",
  "spec-melee": "p.57",
  "heroic-assault": "p.57",
  "melee-combination": "p.57",
  missile: "p.94",
  "spec-ranged": "pp.57, 94",
  negotiate: "p.95",
  parry: "p.95",
  "set-charge": "p.95",
  spell: "p.96",
  grapple: "p.102",
  "psionic-combat": "Psionics Appendix pp.8–15",
  brawl: "p.102",
  overbear: "p.102",
  "maintain-hold": "p.102",
  "improve-hold": "p.102",
  "release-hold": "p.102",
  "stand-up": "p.95",
  "use-magic": "p.91",
  "switch-weapon": "p.91",
  other: "p.91",
  skip: "p.91",
};

const compactSaveLabels: Record<keyof SaveBlock, string> = {
  death: "Death",
  wands: "Wands",
  polymorph: "Poly",
  breath: "Breath",
  spells: "Spell",
};

const attackActions = new Set<SegmentedAction>([
  "charge", "close-hurl", "melee", "hand-2-melee", "two-weapon-melee", "spec-melee", "heroic-assault", "melee-combination",
  "missile", "spec-ranged", "set-charge", "brawl", "grapple", "overbear", "improve-hold", "small-weapon", "natural-attack", "three-piece",
]);

const meleeActions = new Set<SegmentedAction>([
  "charge", "melee", "hand-2-melee", "two-weapon-melee", "spec-melee", "heroic-assault", "melee-combination", "set-charge", "brawl", "grapple", "overbear", "improve-hold", "small-weapon", "natural-attack", "three-piece",
]);

const rangedActions = new Set<SegmentedAction>(["missile", "spec-ranged", "close-hurl"]);

const proneAllowedActions = new Set<SegmentedAction>([
  "brawl", "grapple", "overbear", "maintain-hold", "improve-hold", "release-hold", "natural-attack", "stand-up",
]);

const attackEventKeys = new Set([
  "charge-attack", "close-hurl-attack", "combination-1", "combination-10", "spec-ranged",
  "spec-melee-1", "spec-melee-2", "spec-melee-3", "hand-2-melee", "two-weapon-main", "two-weapon-offhand", "action",
]);

function isAttackEvent(event: SegmentEvent, participant: SegmentedParticipant) {
  return Boolean(event.freeAttackBonus) || (attackActions.has(participant.action) && (attackEventKeys.has(event.key) || event.key.startsWith("heroic-") || event.key.startsWith("spec-ranged-shot-") || event.key.startsWith("monster-onslaught-")));
}

function resolutionKey(event: SegmentEvent) {
  return `${event.round}:${event.key}`;
}

const conditionPresets = [
  { name: "Bless", rounds: 6, description: "+1 to attack rolls and morale." },
  { name: "Curse", rounds: 6, description: "−1 to attack rolls and morale." },
  { name: "Haste", rounds: 3, description: "Doubles movement and attack rate; apply the spell's aging consequence." },
  { name: "Slow", rounds: 3, description: "Halves movement and attack rate; apply the spell's combat penalties." },
  { name: "Prayer", rounds: 1, description: "+1 to attacks, damage, and saves for this affected ally." },
  { name: "Protection from Evil", rounds: 2, description: "Protected against attacks and contact from affected evil creatures." },
  { name: "Fear", rounds: 3, description: "Flees or recoils as adjudicated by the GM." },
  { name: "Blinded", rounds: 1, description: "−4 THB, −4 saves, and −4 ascending AC." },
  { name: "Confused", rounds: 1, description: "Acts randomly according to the source effect or the confusion table." },
  { name: "Dead", rounds: 1, description: "Cannot act; revival requires an appropriate spell or effect." },
  { name: "Deafened", rounds: 1, description: "Cannot hear; no standard surprise, initiative, attack, or spell penalty." },
  { name: "Engaged in Melee", rounds: 1, description: "Within 10 ft of an enemy; leaving may permit an attack and missile fire into melee can strike allies." },
  { name: "Ethereal", rounds: 1, description: "Cannot affect or be affected by the material plane without a specific exception." },
  { name: "Grappling", rounds: 1, description: "Cannot cast or fend off; only dagger-length, smaller, or natural weapons can attack." },
  { name: "Invisible", rounds: 1, description: "+4 effective AC and +4 saves; attackers need the general location." },
  { name: "Overborne", rounds: 1, description: "Cannot recover from prone or staggered until the overbearing restriction ends." },
  { name: "Held / Paralyzed", rounds: 4, description: "Cannot act; qualifying attacks hit automatically and may inflict maximum damage." },
  { name: "Prone", rounds: 1, description: "Only unarmed combat actions; attacks against the target gain +4. Stand Up removes Prone unless Overborne." },
  { name: "Magical Sleep", rounds: 1, description: "Cannot act; qualifying attacks hit automatically and may inflict maximum damage." },
  { name: "Normal Sleep", rounds: 1, description: "Cannot act; loses shield and DEX benefits and suffers −4 effective AC." },
  { name: "Staggered", rounds: 1, description: "Melee and missile attacks gain +2, represented as −2 effective AC." },
  { name: "Stunned", rounds: 1, description: "Cannot act; loses shield and DEX benefits and suffers −4 effective AC." },
  { name: "Unconscious", rounds: 1, description: "Cannot act; qualifying attacks hit automatically and may inflict maximum damage." },
  { name: "Custom", rounds: 1, description: "Custom timed effect." },
] as const;

type ConditionDraft = {
  preset: string;
  customName: string;
  rounds: number;
};

function id() {
  return sharedId();
}

function alphabeticMarker(index: number) {
  let value = Math.max(0, index) + 1;
  let marker = "";
  while (value > 0) {
    value -= 1;
    marker = String.fromCharCode(65 + (value % 26)) + marker;
    value = Math.floor(value / 26);
  }
  return marker;
}

function alphabeticMarkerIndex(marker: string) {
  return marker.toUpperCase().split("").reduce((index, character) => {
    const letter = character.charCodeAt(0) - 64;
    return index * 26 + letter;
  }, 0) - 1;
}

function rollD6() {
  return rollSecureDie(6);
}

function rollD20() {
  return rollSecureDie(20);
}

function defaultOnslaughtAttacks(damageExpression = "1d8") {
  return [
    { id: id(), timing: "segment-1" as const, damageExpression, rolledSegment: null },
    { id: id(), timing: "rolled" as const, damageExpression, rolledSegment: null },
    { id: id(), timing: "segment-10" as const, damageExpression, rolledSegment: null },
  ];
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function markedNaturalRoll(roll: number) {
  return roll === 20 ? "[[max:20]]" : roll === 1 ? "[[min:1]]" : String(roll);
}

function numericModifier(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "0").replaceAll("−", "-").replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampSegment(value: number) {
  return Math.max(1, Math.min(10, value));
}

function safeEmoji(value: string | undefined, fallback = "◆") {
  return value?.trim() || fallback;
}

function combatAbilityIndex(action: SegmentedAction): 0 | 1 | null {
  if (action === "missile" || action === "spec-ranged") return 1;
  if (["melee", "hand-2-melee", "two-weapon-melee", "spec-melee", "charge", "heroic-assault", "melee-combination", "brawl", "small-weapon", "natural-attack", "set-charge"].includes(action)) return 0;
  if (action === "close-hurl") return 0;
  return null;
}

function combatAbilityItems(statIndex: 0 | 1, score: string, exceptionalStrength?: number | null) {
  const relevantKeys = statIndex === 0 ? new Set(["melee-hit", "damage"]) : new Set(["missile-hit", "missile-init"]);
  return derivedAbilityItems(statIndex, score, statIndex === 0 ? exceptionalStrength : null).filter((item) => relevantKeys.has(item.key));
}

function initiativeReferenceLabel(key: string, fallback: string) {
  if (key === "melee-hit") return "STR melee hit";
  if (key === "damage") return "STR damage";
  if (key === "missile-hit") return "DEX missile hit";
  if (key === "missile-init") return "DEX initiative";
  return fallback;
}

function blankParticipant(kind: "enemy" | "npc", markerNumber = 1, joinedRound = 1): SegmentedParticipant {
  return {
    id: id(),
    kind,
    markerNumber,
    name: `${kind === "enemy" ? "Enemy" : "NPC"} ${markerNumber}`,
    hitDice: "",
    attackBonus: null,
    armorClass: null,
    currentHp: 1,
    maxHp: 1,
    temporaryDamage: 0,
    nonIntelligent: false,
    armoredHead: true,
    joinedRound,
    side: kind === "enemy" ? "opposition" : "party",
    action: "",
    actionDetail: "",
    castingTime: 1,
    holdSegment: 6,
    specializedRof: 2,
    segmentModifier: 0,
    initiativeRoll: null,
    subInitiativeRoll: null,
    scheduledSegment: null,
    declarationRound: null,
    completedEvents: [],
    statusNote: "",
    ready: false,
    targetId: null,
    targetIds: [],
    areaOfEffect: false,
    preparedSpellSlotId: null,
    damageExpression: "1d8",
    onslaughtAttacks: defaultOnslaughtAttacks(),
    equippedWeaponId: null,
    pendingWeaponId: null,
    resolutions: {},
    armorMode: "natural",
    armorProfile: "flesh",
    attackMode: "natural",
    naturalSpeed: "normal",
    weaponRulesId: null,
    weaponRulesIds: [],
    manualHitModifier: "+0",
    manualDamageModifier: "+0",
    movementRate: 120,
    size: "medium",
    large: false,
    unarmedOverrides: normalizeUnarmedOverrides(null),
    psionics: normalizePsionics(null),
  };
}

function participantEvents(participant: SegmentedParticipant, fighterLevel = 1, automaticSpecialization: { melee: boolean; missileShots: number; missileSpecialized: boolean } = { melee: false, missileShots: 1, missileSpecialized: false }): SegmentEvent[] {
  if (
    participant.declarationRound === null
    || participant.scheduledSegment === null
    || !participant.action
    || participant.completedEvents.includes("spell-complete")
  ) return [];
  if (participant.action === "skip" || participant.action === "inventory") return [];

  const common = { participantId: participant.id };
  if (participant.action === "psionic-combat") {
    const exchanges = Math.max(1, Math.min(10, participant.psionicCombat?.exchanges ?? 1, 11 - participant.scheduledSegment));
    return Array.from({ length: exchanges }, (_, index) => ({
      ...common,
      key: `psionic-exchange-${index + 1}`,
      round: participant.declarationRound as number,
      segment: participant.scheduledSegment! + index,
      targetId: participant.psionicCombat?.targetIds[0] ?? participant.targetId ?? undefined,
      label: `Psionic exchange ${index + 1} of ${exchanges}`,
      emoji: "🧠",
    }));
  }
  if (participant.action === "charge") {
    return [
      { ...common, key: "charge-move", round: participant.declarationRound, segment: 1, label: "Charge movement", emoji: "🐎" },
      { ...common, key: "charge-attack", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Charge melee attack · +2 to hit", emoji: "⚔️" },
    ];
  }
  if (participant.action === "close-hurl") {
    return [
      { ...common, key: "close-hurl-move", round: participant.declarationRound, segment: 1, label: "Begin closing movement", emoji: "➡️" },
      { ...common, key: "close-hurl-attack", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Hurl weapon · DEX-adjusted missile attack", emoji: "🪓" },
    ];
  }
  if (participant.action === "heroic-assault") {
    return participant.targetIds.slice(0, Math.max(1, fighterLevel)).map((targetId, index) => ({
      ...common,
      key: `heroic-${index + 1}-${targetId}`,
      round: participant.declarationRound as number,
      segment: 1,
      targetId,
      label: `Heroic Assault · attack ${index + 1} of ${Math.min(participant.targetIds.length, Math.max(1, fighterLevel))}`,
      emoji: "💥",
    }));
  }
  if (participant.action === "melee-combination") {
    return [
      { ...common, key: "combination-1", round: participant.declarationRound, segment: 1, label: "First melee attack", emoji: "⚔️" },
      { ...common, key: "combination-10", round: participant.declarationRound, segment: 10, label: "Second melee attack", emoji: "⚔️" },
    ];
  }
  if (participant.action === "hand-2-melee") {
    return [{ ...common, key: "hand-2-melee", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Hand 2 melee attack", emoji: "🗡️" }];
  }
  if (participant.action === "two-weapon-melee") {
    return [
      { ...common, key: "two-weapon-main", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Two-weapon fighting · Hand 1 (−2, DEX-adjusted)", emoji: "⚔️", twoWeaponPenalty: -2 },
      { ...common, key: "two-weapon-offhand", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Two-weapon fighting · Hand 2 (−4, DEX-adjusted)", emoji: "🗡️", twoWeaponPenalty: -4 },
    ];
  }
  if (participant.action === "melee" && automaticSpecialization.melee) {
    const rate = specializedMeleeRate(fighterLevel);
    const fixedSegments = specializedMeleeSegments(fighterLevel, participant.declarationRound, participant.scheduledSegment);
    return fixedSegments.map((segment, index) => ({
      ...common,
      key: `spec-melee-${index + 1}`,
      round: participant.declarationRound as number,
      segment,
      label: `Specialized melee ${rate} · attack ${index + 1} of ${fixedSegments.length} · +1 hit / +2 damage`,
      emoji: "🗡️",
    }));
  }
  if (participant.action === "missile" && automaticSpecialization.missileShots < 1) {
    return [{ ...common, key: "missile-reload", round: participant.declarationRound, segment: participant.scheduledSegment, label: "Heavy crossbow reload · no shot this round", emoji: "🏹" }];
  }
  if (participant.action === "missile" && automaticSpecialization.missileShots > 1) {
    return [{
      ...common,
      key: "spec-ranged",
      round: participant.declarationRound,
      segment: participant.scheduledSegment,
      attackCount: automaticSpecialization.missileShots,
      label: `${automaticSpecialization.missileSpecialized ? "Specialized ranged" : "Missile rate of fire"} · ${automaticSpecialization.missileShots} attack rolls${automaticSpecialization.missileSpecialized ? " · +1 hit / +2 damage" : ""}`,
      emoji: "🎯",
    }];
  }
  if (participant.action === "spec-melee") {
    const rate = specializedMeleeRate(fighterLevel);
    const fixedSegments = specializedMeleeSegments(fighterLevel, participant.declarationRound, participant.scheduledSegment);
    return fixedSegments.map((segment, index) => ({
      ...common,
      key: `spec-melee-${index + 1}`,
      round: participant.declarationRound as number,
      segment,
      label: `Specialized melee ${rate} · attack ${index + 1} of ${fixedSegments.length} · +1 hit / +2 damage`,
      emoji: "🗡️",
    }));
  }
  if (participant.action === "spec-ranged") {
    const shots = Math.max(2, Math.floor(participant.specializedRof || 2));
    return [{
      ...common,
      key: "spec-ranged",
      round: participant.declarationRound,
      segment: participant.scheduledSegment,
      attackCount: shots,
      label: `Specialized ranged · ${shots} attack rolls · +1 hit / +2 damage`,
      emoji: "🎯",
    }];
  }
  if (participant.action === "three-piece") {
    return participant.onslaughtAttacks.slice(0, 10).map((attack, index) => ({
      ...common,
      key: `monster-onslaught-${attack.id}`,
      round: participant.declarationRound as number,
      segment: monsterOnslaughtSegment(attack.timing, attack.rolledSegment),
      damageExpression: attack.damageExpression,
      label: `Monster Onslaught · attack ${index + 1} of ${participant.onslaughtAttacks.length} · ${attack.damageExpression || "damage unset"}`,
      emoji: "☠️",
    }));
  }
  if (participant.action === "spell") {
    if (participant.castingTime === 0) {
      return [{ ...common, key: "spell-complete", round: participant.declarationRound, segment: participant.scheduledSegment, label: `${participant.actionDetail || "Spell"} takes effect · instant`, emoji: "✨" }];
    }
    const startAbsolute = (participant.declarationRound - 1) * 10 + participant.scheduledSegment;
    const completionAbsolute = startAbsolute + Math.max(1, participant.castingTime) - 1;
    return [
      { ...common, key: "spell-start", round: participant.declarationRound, segment: participant.scheduledSegment, label: `Begin ${participant.actionDetail || "spell"}`, emoji: "✨" },
      { ...common, key: "spell-complete", round: Math.floor((completionAbsolute - 1) / 10) + 1, segment: ((completionAbsolute - 1) % 10) + 1, label: `${participant.actionDetail || "Spell"} takes effect`, emoji: "✨" },
    ];
  }
  if (participant.action === "spell-like-effect") {
    return [{ ...common, key: "spell-like-effect", round: participant.declarationRound, segment: participant.scheduledSegment, label: `${participant.actionDetail || "Spell-like effect"} takes effect`, emoji: "🌀" }];
  }
  return [{
    ...common,
    key: "action",
    round: participant.declarationRound,
    segment: participant.scheduledSegment,
    emoji: actionEmojis[participant.action],
    label: participant.action === "other"
      ? participant.actionDetail || "Other action"
      : participant.action === "hold"
        ? `Held action in segment ${participant.holdSegment}`
        : actionLabels[participant.action],
  }];
}

export default function SegmentedInitiativePanel({ campaign, setCampaign }: Props) {
  const storedTracker = campaign.segmentedInitiative ?? emptyCampaign.segmentedInitiative;
  const tracker: SegmentedInitiativeState = {
    ...emptyCampaign.segmentedInitiative,
    ...storedTracker,
    participants: Array.isArray(storedTracker.participants) ? storedTracker.participants.map((participant) => ({
      ...participant,
      weaponRulesIds: Array.isArray(participant.weaponRulesIds) ? participant.weaponRulesIds : participant.weaponRulesId ? [participant.weaponRulesId] : [],
      manualHitModifier: participant.manualHitModifier ?? "+0",
      manualDamageModifier: participant.manualDamageModifier ?? "+0",
      temporaryDamage: Math.max(0, Number(participant.temporaryDamage) || 0),
      movementRate: Math.max(0, Number(participant.movementRate) || 0),
      size: participant.size ?? (participant.large ? "large" : "medium"),
      unarmedOverrides: normalizeUnarmedOverrides(participant.unarmedOverrides),
    })) : [],
    effects: Array.isArray(storedTracker.effects) ? storedTracker.effects : [],
    engagements: Array.isArray(storedTracker.engagements) ? storedTracker.engagements : [],
    grappleHolds: Array.isArray(storedTracker.grappleHolds) ? storedTracker.grappleHolds : [],
    pendingUnarmed: storedTracker.pendingUnarmed ?? null,
    combatTallies: storedTracker.combatTallies && typeof storedTracker.combatTallies === "object" ? storedTracker.combatTallies : {},
    lastCheers: Array.isArray(storedTracker.lastCheers) ? storedTracker.lastCheers : [],
  };
  const [clockNow, setClockNow] = useState(0);
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, ConditionDraft>>({});
  const [blockedParticipantId, setBlockedParticipantId] = useState<string | null>(null);
  const [bulkEnemyAction, setBulkEnemyAction] = useState<SegmentedAction>("skip");
  const [bulkEnemyIds, setBulkEnemyIds] = useState<string[]>([]);
  const [bulkEnemyRandomTarget, setBulkEnemyRandomTarget] = useState(false);
  const [showIncapacitatedCombatants, setShowIncapacitatedCombatants] = useState(false);
  const [expandedCombatantIds, setExpandedCombatantIds] = useState<string[]>([]);
  const [viewerRole, setViewerRole] = useState<PartyChatRole | null>(null);
  const [viewerDockedCharacterIds, setViewerDockedCharacterIds] = useState<string[]>([]);
  const [viewerClientId, setViewerClientId] = useState<string | null>(null);
  const [controlHeld, setControlHeld] = useState(false);
  const [moraleReminder, setMoraleReminder] = useState("");
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const collapseIdentityKeyRef = useRef("");
  const seenCombatantIdsRef = useRef<Set<string>>(new Set());
  const viewerHasGmPermissions = partyChatRoleHasGmPermissions(viewerRole);
  const combatIdentity: CombatIdentity = { role: viewerRole, dockedCharacterIds: viewerDockedCharacterIds, clientId: viewerClientId };
  const hasProgressionAuthority = canControlCombatProgression(combatIdentity);

  useEffect(() => {
    if (tracker.phase !== "active" || tracker.currentSegment < 1) return;
    const scroller = timelineScrollRef.current;
    const current = scroller?.querySelector<HTMLElement>(`[data-combat-segment="${tracker.currentSegment}"]`);
    if (!scroller || !current) return;
    const left = current.offsetLeft - Math.max(0, (scroller.clientWidth - current.offsetWidth) / 2);
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [tracker.currentSegment, tracker.phase]);

  useEffect(() => {
    setCampaign((current) => {
      const deadIds = new Set(current.segmentedInitiative.effects.filter((effect) => effect.remainingRounds > 0 && effect.name === "Dead" && effect.participantId).map((effect) => effect.participantId as string));
      const linkedParticipants = current.segmentedInitiative.participants.map((participant) => {
        const character = participant.characterId ? current.characters.find((entry) => entry.id === participant.characterId) : undefined;
        const npc = participant.stableNpcId ? current.stableNpcs.find((entry) => entry.id === participant.stableNpcId) : undefined;
        const currentHp = character?.currentHp ?? npc?.currentHp ?? participant.currentHp;
        const maxHp = character?.maxHp ?? npc?.maxHp ?? participant.maxHp;
        return currentHp === participant.currentHp && maxHp === participant.maxHp ? participant : { ...participant, currentHp, maxHp };
      });
      const participants = pruneInvalidCombatTargets(linkedParticipants).map((participant) => {
        const targetId = participant.targetId && !deadIds.has(participant.targetId) ? participant.targetId : null;
        const targetIds = participant.targetIds.filter((id) => !deadIds.has(id));
        return targetId === participant.targetId && targetIds.length === participant.targetIds.length ? participant : { ...participant, targetId, targetIds };
      });
      const consciousIds = new Set(participants.filter((participant) => participantIsConscious(participant) && !deadIds.has(participant.id)).map((participant) => participant.id));
      const engagements = current.segmentedInitiative.engagements.filter((entry) => consciousIds.has(entry.attackerId) && consciousIds.has(entry.defenderId));
      const grappleHolds = (current.segmentedInitiative.grappleHolds ?? []).filter((hold) => consciousIds.has(hold.attackerId) && consciousIds.has(hold.defenderId));
      const footGrabbedIds = new Set(grappleHolds.filter((hold) => hold.footGrab).map((hold) => hold.defenderId));
      const effects = current.segmentedInitiative.effects.filter((effect) => effect.name !== "Feet clutched" || Boolean(effect.participantId && footGrabbedIds.has(effect.participantId)));
      const changedParticipants = participants.some((participant, index) => participant !== current.segmentedInitiative.participants[index]);
      if (!changedParticipants && engagements.length === current.segmentedInitiative.engagements.length && grappleHolds.length === (current.segmentedInitiative.grappleHolds ?? []).length && effects.length === current.segmentedInitiative.effects.length) return current;
      return { ...current, segmentedInitiative: { ...current.segmentedInitiative, participants, engagements, grappleHolds, effects } };
    });
  }, [campaign.characters, campaign.stableNpcs, campaign.segmentedInitiative.participants, campaign.segmentedInitiative.engagements, campaign.segmentedInitiative.effects, setCampaign]);

  useEffect(() => {
    setCampaign((current) => {
      let changed = false;
      const participants = current.segmentedInitiative.participants.map((participant) => {
        if (!participant.stableNpcId) return participant;
        const npc = current.stableNpcs.find((entry) => entry.id === participant.stableNpcId);
        if (!npc) return participant;
        const rules = weaponRulesById(npc.activeWeaponRulesId);
        const patch = {
          name: npc.name,
          hitDice: npc.hitDice,
          attackBonus: npc.attackBonus,
          armorClass: npc.armorClass,
          currentHp: npc.currentHp,
          maxHp: npc.maxHp,
          damageExpression: rules?.damageSM ?? npc.damageExpression,
          armorMode: npc.armorMode,
          armorProfile: npc.armorProfile,
          attackMode: npc.attackMode,
          naturalSpeed: npc.naturalSpeed,
          weaponRulesId: npc.activeWeaponRulesId,
          weaponRulesIds: npc.weaponRulesIds,
          movementRate: npc.movementRate,
          unarmedOverrides: normalizeUnarmedOverrides(npc.unarmedOverrides),
          psionics: normalizePsionics(npc.psionics),
          size: npc.size,
          large: npc.size === "large",
        };
        if (Object.entries(patch).every(([key, value]) => participant[key as keyof SegmentedParticipant] === value)) return participant;
        changed = true;
        return { ...participant, ...patch };
      });
      return changed ? { ...current, segmentedInitiative: { ...current.segmentedInitiative, participants } } : current;
    });
  }, [campaign.stableNpcs, setCampaign]);
  const missionCharacters = campaign.characters.filter((character) =>
    campaign.missionCharacterIds.includes(character.id),
  );
  const trackedCharacterIds = new Set(
    tracker.participants.flatMap((participant) => participant.characterId ? [participant.characterId] : []),
  );
  const availableCharacters = missionCharacters.filter((character) => !trackedCharacterIds.has(character.id));
  const trackedStableNpcIds = new Set(tracker.participants.flatMap((participant) => participant.stableNpcId ? [participant.stableNpcId] : []));
  const availableExpeditionNpcs = campaign.stableNpcs.filter((npc) => npc.campaignId === campaign.activeCharacterCampaignId && campaign.expeditionNpcIds.includes(npc.id) && !trackedStableNpcIds.has(npc.id));
  const enemyNumbers = new Map(
    tracker.participants
      .filter((participant) => participant.kind === "enemy")
      .map((participant, index) => [participant.id, participant.markerNumber ?? index + 1]),
  );
  const npcNumbers = new Map(
    tracker.participants
      .filter((participant) => participant.kind === "npc")
      .map((participant, index) => [participant.id, participant.markerNumber ?? index + 1]),
  );
  const belongsInIncapacitatedGroup = (participant: SegmentedParticipant) => participantHp(participant).current <= 0
    || participant.action === "unconscious"
    || conditionsForParticipant(participant).some((effect) => effect.remainingRounds > 0 && effect.name === "Unconscious");
  const playerParticipants = tracker.participants.filter((participant) => participant.kind === "character" && !belongsInIncapacitatedGroup(participant));
  function characterEncumbrance(character: CampaignState["characters"][number]) {
    const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const movementRate = effectiveArmorMovementRate(campaign, character);
    if (!owner) return encumbranceSummary(movementRate, 0, Number.MAX_SAFE_INTEGER);
    const worn = campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
    const bestArmor = worn ? Math.max(10, ...campaign.inventoryManagement.stacks.filter((entry) => entry.containerId === worn.id && entry.equipment?.kind === "armor").map((entry) => Number(entry.equipment?.ascendingAc) || 10)) : 10;
    return encumbranceSummary(movementRate, getOwnerUsedUnits(campaign.inventoryManagement, owner.id), getOwnerCapacityUnits(owner, campaign.characters), bestArmor < 15);
  }
  const partyEncumbranceModifier = partyEncumbranceSurpriseModifier(playerParticipants.flatMap((participant) => {
    const character = participant.characterId ? campaign.characters.find((entry) => entry.id === participant.characterId) : undefined;
    return character ? [characterEncumbrance(character)] : [];
  }));
  const effectivePartySurpriseThreshold = Math.max(1, Math.min(6, tracker.partySurpriseThreshold - partyEncumbranceModifier));
  const readyPlayers = playerParticipants.filter((participant) => participant.ready).length;
  const enemyParticipants = tracker.participants.filter((participant) => participant.side === "opposition" && !belongsInIncapacitatedGroup(participant));
  const declaringEnemies = tracker.participants.filter((participant) => participant.kind === "enemy" && !belongsInIncapacitatedGroup(participant));
  const readyEnemies = enemyParticipants.filter((participant) => participant.ready).length;
  const combatMarchCapacity = visibleMarchCapacity(campaign.dashboard);
  const combatMarchSlots = campaign.dashboard.marchColumns === 1
    ? campaign.dashboard.marchingOrderIds
    : campaign.dashboard.marchingOrderSlots.slice(0, combatMarchCapacity);
  const combatScout = campaign.dashboard.scoutingCharacterId
    ? campaign.characters.find((character) => character.id === campaign.dashboard.scoutingCharacterId)
    : undefined;
  const rearToFrontCharacterIds = [...combatMarchSlots]
    .reverse()
    .filter((characterId): characterId is string => Boolean(characterId));
  const formationRanks = new Map(rearToFrontCharacterIds.map((characterId, index) => [characterId, index]));
  const displayedParticipants = [...tracker.participants].sort((a, b) => {
    const group = (participant: SegmentedParticipant) => {
      if (belongsInIncapacitatedGroup(participant)) return 4;
      if (participant.kind === "character") return 0;
      if (participant.kind === "npc" && participant.side === "party") return 1;
      return 2;
    };
    const groupDifference = group(a) - group(b);
    if (groupDifference) return groupDifference;
    if (a.kind === "character" && b.kind === "character") {
      const formationDifference = (formationRanks.get(a.characterId ?? "") ?? Number.MAX_SAFE_INTEGER)
        - (formationRanks.get(b.characterId ?? "") ?? Number.MAX_SAFE_INTEGER);
      if (formationDifference) return formationDifference;
    }
    return tracker.participants.indexOf(a) - tracker.participants.indexOf(b);
  });
  const incapacitatedCombatants = displayedParticipants.filter(belongsInIncapacitatedGroup);
  const firstOppositionIndex = displayedParticipants.findIndex((participant) => participant.side === "opposition" && !belongsInIncapacitatedGroup(participant));
  const firstIncapacitatedIndex = displayedParticipants.findIndex(belongsInIncapacitatedGroup);
  const declarationElapsedSeconds = tracker.phase === "declaration" && tracker.declarationStartedAt
    ? Math.max(0, Math.floor((clockNow - tracker.declarationStartedAt) / 1000))
    : 0;
  const declarationClock = `${Math.floor(declarationElapsedSeconds / 60).toString().padStart(2, "0")}:${(declarationElapsedSeconds % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (tracker.phase !== "declaration") return;
    if (!tracker.declarationStartedAt && hasProgressionAuthority) {
      announceCombatMutation({ ...combatIdentity, sourceParticipantId: null, override: false });
      setCampaign((current) => ({
        ...current,
        segmentedInitiative: { ...current.segmentedInitiative, declarationStartedAt: Date.now() },
      }));
    }
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasProgressionAuthority, setCampaign, tracker.declarationStartedAt, tracker.phase]);

  useEffect(() => {
    const roleTimer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY) || "{}") as { role?: PartyChatRole; gmRole?: boolean; dockedIds?: string[]; clientId?: string };
        setViewerRole(partyChatRoleFromPreferences(stored));
        setViewerDockedCharacterIds(Array.isArray(stored.dockedIds) ? stored.dockedIds.filter((entry): entry is string => typeof entry === "string") : []);
        setViewerClientId(typeof stored.clientId === "string" ? stored.clientId : null);
      } catch {}
    }, 0);
    const roleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ role?: PartyChatRole; gmRole?: boolean; dockedIds?: string[]; clientId?: string }>).detail;
      setViewerRole(partyChatRoleFromPreferences(detail));
      setViewerDockedCharacterIds(Array.isArray(detail?.dockedIds) ? detail.dockedIds.filter((entry): entry is string => typeof entry === "string") : []);
      setViewerClientId(typeof detail?.clientId === "string" ? detail.clientId : null);
    };
    window.addEventListener("adnd-role-change", roleChange);
    return () => { window.clearTimeout(roleTimer); window.removeEventListener("adnd-role-change", roleChange); };
  }, []);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(true); };
    const keyUp = (event: KeyboardEvent) => { if (event.key === "Control") setControlHeld(false); };
    const clear = () => setControlHeld(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", keyDown); window.removeEventListener("keyup", keyUp); window.removeEventListener("blur", clear); };
  }, []);

  useEffect(() => {
    if (!viewerRole) return;
    const identityKey = `${viewerRole}:${[...viewerDockedCharacterIds].sort().join(",")}`;
    const selectedIds = tracker.participants
      .filter((participant) => participant.kind === "character" && Boolean(participant.characterId && viewerDockedCharacterIds.includes(participant.characterId)))
      .map((participant) => participant.id);
    if (collapseIdentityKeyRef.current !== identityKey) {
      collapseIdentityKeyRef.current = identityKey;
      seenCombatantIdsRef.current = new Set(tracker.participants.map((participant) => participant.id));
      setExpandedCombatantIds(selectedIds);
      return;
    }
    const newSelectedIds = selectedIds.filter((participantId) => !seenCombatantIdsRef.current.has(participantId));
    tracker.participants.forEach((participant) => seenCombatantIdsRef.current.add(participant.id));
    if (newSelectedIds.length) setExpandedCombatantIds((current) => Array.from(new Set([...current, ...newSelectedIds])));
  }, [tracker.participants, viewerDockedCharacterIds, viewerRole]);

  useEffect(() => {
    if (!hasProgressionAuthority || tracker.phase !== "active" || tracker.currentSegment < 1) return;
    announceCombatMutation({ ...combatIdentity, sourceParticipantId: null, override: false });
    const automaticKey = `dying-hp-loss:${tracker.round}`;
    setCampaign((current) => {
      const changedCharacterHp = new Map<string, number>();
      let changed = false;
      const participants = current.segmentedInitiative.participants.map((participant) => {
        if (participant.action !== "die"
          || participant.declarationRound !== current.segmentedInitiative.round
          || participant.scheduledSegment !== current.segmentedInitiative.currentSegment
          || participant.completedEvents.includes(automaticKey)) return participant;
        const character = participant.characterId ? current.characters.find((entry) => entry.id === participant.characterId) : undefined;
        const currentHp = character?.currentHp ?? participant.currentHp;
        if (currentHp >= 0 || currentHp <= -10) return participant;
        const nextHp = Math.max(-10, currentHp - 1);
        if (character) changedCharacterHp.set(character.id, nextHp);
        changed = true;
        return {
          ...participant,
          currentHp: nextHp,
          action: nextHp <= -10 ? "skip" as SegmentedAction : participant.action,
          statusNote: nextHp <= -10 ? "EXSANGUINATED" : `Dying · lost 1 HP (${nextHp})`,
          completedEvents: [...participant.completedEvents, automaticKey],
        };
      });
      if (!changed) return current;
      return {
        ...current,
        characters: current.characters.map((character) => changedCharacterHp.has(character.id) ? { ...character, currentHp: changedCharacterHp.get(character.id) as number } : character),
        segmentedInitiative: { ...current.segmentedInitiative, participants },
      };
    });
  }, [hasProgressionAuthority, setCampaign, tracker.currentSegment, tracker.phase, tracker.round]);

  function authorizeProgression(override = controlHeld) {
    if (!canControlCombatProgression(combatIdentity, override)) return false;
    announceCombatMutation({ ...combatIdentity, sourceParticipantId: null, override });
    return true;
  }

  function authorizeCombatant(participantId: string, override = controlHeld) {
    const participant = tracker.participants.find((entry) => entry.id === participantId);
    if (!participant || !canControlCombatant(combatIdentity, participant, override)) return false;
    announceCombatMutation({ ...combatIdentity, sourceParticipantId: participantId, override });
    return true;
  }

  function updateTracker(patch: Partial<SegmentedInitiativeState>, authorityRequired = false) {
    if (authorityRequired && !authorizeProgression()) return;
    setCampaign((current) => ({
      ...current,
      segmentedInitiative: { ...current.segmentedInitiative, ...patch },
    }));
  }

  function setAllCombatantsExpanded(expanded: boolean) {
    setExpandedCombatantIds(expanded ? tracker.participants.map((participant) => participant.id) : []);
  }

  function toggleCombatantExpanded(participantId: string) {
    setExpandedCombatantIds((current) => current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId]);
  }

  function recordCombatTally(participantId: string, patch: Partial<SegmentedInitiativeState["combatTallies"][string]>) {
    const additiveKeys = ["damageDealt", "damageReceived", "attacks", "attacksMissedAgainst", "savesSucceeded", "savesFailed", "moves"] as const;
    const operations = additiveKeys.flatMap((key): CampaignOperation[] => patch[key]
      ? [{ type: "increment", path: ["segmentedInitiative", "combatTallies", participantId, key], amount: patch[key] as number }]
      : []);
    if (patch.currentHitStreak !== undefined) operations.push({ type: "set", path: ["segmentedInitiative", "combatTallies", participantId, "currentHitStreak"], value: patch.currentHitStreak });
    if (patch.longestHitStreak !== undefined) operations.push({ type: "set", path: ["segmentedInitiative", "combatTallies", participantId, "longestHitStreak"], value: patch.longestHitStreak });
    announceCampaignOperations(operations);
    setCampaign((current) => {
      const prior = current.segmentedInitiative.combatTallies[participantId] ?? { damageDealt: 0, damageReceived: 0, attacks: 0, attacksMissedAgainst: 0, savesSucceeded: 0, savesFailed: 0, moves: 0, currentHitStreak: 0, longestHitStreak: 0 };
      const next = {
        damageDealt: prior.damageDealt + (patch.damageDealt ?? 0),
        damageReceived: prior.damageReceived + (patch.damageReceived ?? 0),
        attacks: prior.attacks + (patch.attacks ?? 0),
        attacksMissedAgainst: prior.attacksMissedAgainst + (patch.attacksMissedAgainst ?? 0),
        savesSucceeded: prior.savesSucceeded + (patch.savesSucceeded ?? 0),
        savesFailed: prior.savesFailed + (patch.savesFailed ?? 0),
        moves: prior.moves + (patch.moves ?? 0),
        currentHitStreak: patch.currentHitStreak ?? prior.currentHitStreak,
        longestHitStreak: patch.longestHitStreak ?? prior.longestHitStreak,
      };
      return { ...current, segmentedInitiative: { ...current.segmentedInitiative, combatTallies: { ...current.segmentedInitiative.combatTallies, [participantId]: next } } };
    });
  }

  function setSurpriseChecked(side: "party" | "opposition", checked: boolean) {
    if (!authorizeProgression()) return;
    const roll = side === "party" ? tracker.partySurpriseRoll : tracker.oppositionSurpriseRoll;
    const segments = checked ? Math.max(1, roll ?? 1) : 0;
    updateTracker(side === "party"
      ? { partySurprised: checked, partySurpriseSegments: segments }
      : { oppositionSurprised: checked, oppositionSurpriseSegments: segments });
  }

  function rollSurprise(side: "party" | "opposition") {
    if (!authorizeProgression()) return;
    const roll = rollD6();
    const threshold = side === "party" ? effectivePartySurpriseThreshold : tracker.oppositionSurpriseThreshold;
    const segments = surpriseSegmentsForRoll(roll, threshold);
    updateTracker(side === "party"
      ? { partySurpriseRoll: roll, partySurprised: segments > 0, partySurpriseSegments: segments }
      : { oppositionSurpriseRoll: roll, oppositionSurprised: segments > 0, oppositionSurpriseSegments: segments });
  }

  function setSurpriseThreshold(side: "party" | "opposition", requested: number) {
    if (!authorizeProgression()) return;
    const threshold = Math.max(1, Math.min(6, Math.floor(requested)));
    const roll = side === "party" ? tracker.partySurpriseRoll : tracker.oppositionSurpriseRoll;
    if (roll === null) {
      updateTracker(side === "party" ? { partySurpriseThreshold: threshold } : { oppositionSurpriseThreshold: threshold });
      return;
    }
    const effectiveThreshold = side === "party" ? Math.max(1, Math.min(6, threshold - partyEncumbranceModifier)) : threshold;
    const segments = surpriseSegmentsForRoll(roll, effectiveThreshold);
    updateTracker(side === "party"
      ? { partySurpriseThreshold: threshold, partySurprised: segments > 0, partySurpriseSegments: segments }
      : { oppositionSurpriseThreshold: threshold, oppositionSurprised: segments > 0, oppositionSurpriseSegments: segments });
  }

  function updateParticipant(participantId: string, patch: Partial<SegmentedParticipant>, skipPermissionCheck = false) {
    if (!skipPermissionCheck && !authorizeCombatant(participantId)) return;
    setCampaign((current) => {
      const participant = current.segmentedInitiative.participants.find((entry) => entry.id === participantId);
      const stableNpcPatch = participant?.stableNpcId ? {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.hitDice !== undefined ? { hitDice: patch.hitDice } : {}),
        ...(patch.attackBonus !== undefined && patch.attackBonus !== null ? { attackBonus: patch.attackBonus } : {}),
        ...(patch.armorClass !== undefined && patch.armorClass !== null ? { armorClass: patch.armorClass } : {}),
        ...(patch.currentHp !== undefined ? { currentHp: patch.currentHp } : {}),
        ...(patch.maxHp !== undefined ? { maxHp: patch.maxHp } : {}),
        ...(patch.damageExpression !== undefined ? { damageExpression: patch.damageExpression } : {}),
        ...(patch.armorMode !== undefined ? { armorMode: patch.armorMode } : {}),
        ...(patch.armorProfile !== undefined ? { armorProfile: patch.armorProfile } : {}),
        ...(patch.attackMode !== undefined ? { attackMode: patch.attackMode } : {}),
        ...(patch.naturalSpeed !== undefined ? { naturalSpeed: patch.naturalSpeed } : {}),
        ...(patch.weaponRulesId !== undefined ? { activeWeaponRulesId: patch.weaponRulesId } : {}),
        ...(patch.weaponRulesIds !== undefined ? { weaponRulesIds: patch.weaponRulesIds } : {}),
        ...(patch.movementRate !== undefined ? { movementRate: patch.movementRate } : {}),
        ...(patch.unarmedOverrides !== undefined ? { unarmedOverrides: patch.unarmedOverrides } : {}),
        ...(patch.psionics !== undefined ? { psionics: patch.psionics } : {}),
        ...(patch.size !== undefined ? { size: patch.size === "tiny" || patch.size === "small" ? "small" as const : patch.size === "large" || patch.size === "huge" || patch.size === "gargantuan" ? "large" as const : "medium" as const } : {}),
        ...(patch.large !== undefined ? { size: patch.large ? "large" as const : "medium" as const } : {}),
      } : null;
      return {
        ...current,
        characters: participant?.characterId && patch.psionics !== undefined
          ? current.characters.map((character) => character.id === participant.characterId ? { ...character, psionics: normalizePsionics(patch.psionics) } : character)
          : current.characters,
        stableNpcs: participant?.stableNpcId && stableNpcPatch ? current.stableNpcs.map((npc) => npc.id === participant.stableNpcId ? { ...npc, ...stableNpcPatch } : npc) : current.stableNpcs,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participantId ? { ...entry, ...patch } : entry),
        },
      };
    });
  }

  function updateUnarmedOverride<K extends keyof NonNullable<SegmentedParticipant["unarmedOverrides"]>>(participant: SegmentedParticipant, key: K, value: NonNullable<SegmentedParticipant["unarmedOverrides"]>[K]) {
    updateParticipant(participant.id, { unarmedOverrides: { ...normalizeUnarmedOverrides(participant.unarmedOverrides), [key]: value } });
  }

  function updatePsionics(participant: SegmentedParticipant, patch: Partial<NonNullable<SegmentedParticipant["psionics"]>>) {
    updateParticipant(participant.id, { psionics: normalizePsionics({ ...normalizePsionics(participant.psionics), ...patch }) });
  }

  function updateOnslaughtAttack(participant: SegmentedParticipant, attackId: string, damageExpression: string) {
    updateParticipant(participant.id, {
      onslaughtAttacks: participant.onslaughtAttacks.map((attack) => attack.id === attackId ? { ...attack, damageExpression } : attack),
      ready: true,
    });
  }

  function addOnslaughtAttack(participant: SegmentedParticipant) {
    if (participant.onslaughtAttacks.length >= 10) return;
    const attacks = [...participant.onslaughtAttacks];
    attacks.splice(Math.max(1, attacks.length - 1), 0, { id: id(), timing: "rolled", damageExpression: participant.damageExpression || "1d8", rolledSegment: null });
    updateParticipant(participant.id, { onslaughtAttacks: attacks, ready: true });
  }

  function removeOnslaughtAttack(participant: SegmentedParticipant, attackId: string) {
    if (participant.onslaughtAttacks.length <= 2) return;
    updateParticipant(participant.id, { onslaughtAttacks: participant.onslaughtAttacks.filter((attack) => attack.id !== attackId), ready: true });
  }

  function addMissionCharacter(characterId: string) {
    if (!authorizeProgression()) return;
    const character = campaign.characters.find((entry) => entry.id === characterId);
    if (!character || trackedCharacterIds.has(characterId)) return;
    updateTracker({
      participants: [...tracker.participants, {
        ...blankParticipant("npc", 1, tracker.round),
        id: id(),
        kind: "character",
        characterId: character.id,
        markerNumber: null,
        name: character.name,
        side: "party",
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        armorClass: character.armorClass,
        equippedWeaponId: character.equippedWeaponId,
        psionics: normalizePsionics(character.psionics),
      }],
    });
  }

  function addAllMissionCharacters() {
    if (!authorizeProgression()) return;
    const additions = availableCharacters.map((character) => ({
      ...blankParticipant("npc", 1, tracker.round),
      id: id(),
      kind: "character" as const,
      characterId: character.id,
      markerNumber: null,
      name: character.name,
      side: "party" as const,
      currentHp: character.currentHp,
      maxHp: character.maxHp,
      armorClass: character.armorClass,
      equippedWeaponId: character.equippedWeaponId,
      psionics: normalizePsionics(character.psionics),
    }));
    updateTracker({ participants: [...tracker.participants, ...additions] });
  }

  function addExpeditionNpc(npcId: string) {
    if (!authorizeProgression()) return;
    const npc = campaign.stableNpcs.find((entry) => entry.id === npcId && campaign.expeditionNpcIds.includes(entry.id));
    if (!npc || trackedStableNpcIds.has(npc.id)) return;
    updateTracker({ participants: [...tracker.participants, stableNpcToParticipant(npc, tracker.round)] });
  }

  function addAllExpeditionNpcs() {
    if (!authorizeProgression()) return;
    updateTracker({ participants: [...tracker.participants, ...availableExpeditionNpcs.map((npc) => stableNpcToParticipant(npc, tracker.round))] });
  }

  function addNonPlayer(kind: "enemy" | "npc") {
    if (!authorizeProgression()) return;
    const nextNumber = Math.max(0, ...tracker.participants
      .filter((participant) => participant.kind === kind)
      .map((participant) => participant.markerNumber ?? 0)) + 1;
    updateTracker({ participants: [...tracker.participants, blankParticipant(kind, nextNumber, tracker.round)], lastCheers: kind === "enemy" ? [] : tracker.lastCheers });
  }

  function copyMonster(monster: SegmentedParticipant) {
    if (!authorizeProgression()) return;
    const nextNumber = Math.max(0, ...tracker.participants
      .filter((participant) => participant.kind === "enemy")
      .map((participant) => participant.markerNumber ?? 0)) + 1;
    const genericEnemy = /^enemy(?:\s+\d+)?$/i.test(monster.name.trim());
    const letteredName = monster.name.trim().match(/^(.*?)\s+([A-Z]+)$/i);
    const baseName = (letteredName ? letteredName[1] : monster.name.trim().replace(/\s+\d+$/, "")) || "Enemy";
    const matchingCopyNumbers = tracker.participants
      .filter((participant) => participant.kind === "enemy")
      .flatMap((participant) => {
        const match = participant.name.trim().match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`, "i"));
        return match ? [Number(match[1])] : [];
      });
    const matchingLetterIndexes = letteredName
      ? tracker.participants
        .filter((participant) => participant.kind === "enemy")
        .flatMap((participant) => {
          const match = participant.name.trim().match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([A-Z]+)$`, "i"));
          return match ? [alphabeticMarkerIndex(match[1])] : [];
        })
      : [];
    const copiedHp = rollMonsterHp(monster.hitDice) ?? monster.maxHp;
    const copied = {
      ...monster,
      id: id(),
      markerNumber: nextNumber,
      name: genericEnemy
        ? `Enemy ${nextNumber}`
        : letteredName
          ? `${baseName} ${alphabeticMarker(Math.max(-1, ...matchingLetterIndexes) + 1)}`
          : `${baseName} ${Math.max(1, ...matchingCopyNumbers) + 1}`,
      currentHp: copiedHp,
      maxHp: copiedHp,
      joinedRound: tracker.round,
      action: "" as SegmentedAction,
      actionDetail: "",
      initiativeRoll: null,
      subInitiativeRoll: null,
      scheduledSegment: null,
      declarationRound: null,
      completedEvents: [],
      statusNote: "",
      ready: false,
      targetId: null,
      targetIds: [],
      areaOfEffect: false,
      preparedSpellSlotId: null,
      onslaughtAttacks: monster.onslaughtAttacks.map((attack) => ({ ...attack, id: id(), rolledSegment: null })),
      resolutions: {},
    };
    updateTracker({ participants: [...tracker.participants, copied] });
  }

  function removeParticipant(participantId: string) {
    if (!authorizeProgression()) return;
    updateTracker({
      participants: tracker.participants.filter((participant) => participant.id !== participantId).map((participant) => ({
        ...participant,
        targetId: participant.targetId === participantId ? null : participant.targetId,
        targetIds: participant.targetIds.filter((targetId) => targetId !== participantId),
      })),
      effects: tracker.effects.filter((effect) => effect.participantId !== participantId),
      engagements: removeEngagement(tracker.engagements, participantId),
      grappleHolds: tracker.grappleHolds.filter((hold) => hold.attackerId !== participantId && hold.defenderId !== participantId),
      pendingUnarmed: tracker.pendingUnarmed && (tracker.pendingUnarmed.attackerId === participantId || tracker.pendingUnarmed.defenderId === participantId) ? null : tracker.pendingUnarmed,
    });
  }

  function isOngoingSpell(participant: SegmentedParticipant) {
    return participant.action === "spell"
      && participant.declarationRound !== null
      && participant.declarationRound < tracker.round
      && !participant.completedEvents.includes("spell-complete");
  }

  function equippedWeaponFor(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (!character) return undefined;
    if (participant.action === "brawl") return characterWeapon(character, "unarmed");
    const weapon = characterWeapon(character, participant.equippedWeaponId ?? character.equippedWeaponId);
    return usesUnarmedDamage(character, weapon?.id) ? characterWeapon(character, "unarmed") : weapon;
  }

  function activeWeaponRules(participant: SegmentedParticipant) {
    return participantAttackRules(participant, equippedWeaponFor(participant));
  }

  function activeSpeedFactor(participant: SegmentedParticipant) {
    return getAttackSpeedFactor(participant, equippedWeaponFor(participant));
  }

  function activeSpeedLabel(participant: SegmentedParticipant, compact = false) {
    if (participant.kind !== "character" && participant.attackMode !== "weapon") {
      const speed = participant.naturalSpeed ?? "normal";
      return compact ? speed[0].toUpperCase() : speed.toUpperCase();
    }
    const speed = activeSpeedFactor(participant);
    return speed === null ? "—" : compact ? String(speed) : `SF ${speed}`;
  }

  function quickAccessStacks(character: CampaignState["characters"][number], inventory = campaign.inventoryManagement) {
    const owner = inventory.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const quick = owner && inventory.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
    return quick ? inventory.stacks.filter((entry) => entry.containerId === quick.id) : [];
  }

  function heldHandStacks(character: CampaignState["characters"][number], inventory = campaign.inventoryManagement) {
    return quickAccessStacks(character, inventory).filter((entry) => entry.handSlot);
  }

  function isDaggerLengthWeaponStack(stack: InventoryStack, character?: CampaignState["characters"][number]) {
    if (stack.equipment?.kind !== "weapon") return false;
    return !stackRequiresBothHands(stack, character)
      && isDaggerLengthWeapon(weaponRulesForItem({ name: stack.name, weaponRulesId: stack.equipment.weaponRulesId }));
  }

  function canGrapple(character: CampaignState["characters"][number]) {
    const held = heldHandStacks(character);
    // The house rule permits an unarmed grapple or a grapple while holding
    // exactly one dagger-length weapon and nothing else.
    if (!held.length) return character.handState === "unarmed";
    return held.length === 1 && isDaggerLengthWeaponStack(held[0], character);
  }

  function hasDaggerLengthWeaponInHandOrQuick(character: CampaignState["characters"][number]) {
    return quickAccessStacks(character).some((stack) => isDaggerLengthWeaponStack(stack, character));
  }

  function prepareShortWeaponHands(
    inventory: CampaignState["inventoryManagement"],
    characters: CampaignState["characters"],
    characterId: string,
    preferredWeaponId?: string | null,
  ) {
    const character = characters.find((entry) => entry.id === characterId);
    const owner = inventory.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
    const quick = owner && inventory.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
    if (!character || !owner || !quick) return { state: inventory, selectedWeaponStackId: null as string | null };
    const quickStacks = inventory.stacks.filter((entry) => entry.containerId === quick.id);
    const shortWeapons = quickStacks.filter((stack) => isDaggerLengthWeaponStack(stack, character));
    if (!shortWeapons.length) return { state: inventory, selectedWeaponStackId: null as string | null };
    const preferredId = preferredWeaponId?.startsWith("inventory:") ? preferredWeaponId.slice("inventory:".length) : null;
    const selected = shortWeapons.find((entry) => entry.id === preferredId)
      ?? shortWeapons.find((entry) => Boolean(entry.handSlot))
      ?? shortWeapons[0];
    const releasedIds = quickStacks.filter((entry) => entry.handSlot && entry.id !== selected.id).map((entry) => entry.id);
    let next = {
      ...inventory,
      stacks: inventory.stacks.map((entry) => entry.containerId === quick.id ? { ...entry, handSlot: null } : entry),
    };
    const moved = moveStackToHand(next, selected.id, owner.id, "main", characters);
    if (!moved.moved) return { state: inventory, selectedWeaponStackId: null as string | null };
    next = moved.state;

    // Released hand contents normally remain in Quick Access. If that
    // container is already full, preserve the swap by falling back to the
    // character backpack for those released items.
    const backpack = next.containers.find((entry) => entry.containerType === "character-backpack" && entry.holderType === "owner" && entry.holderId === owner.id);
    for (const releasedId of releasedIds) {
      if (!backpack || getContainerUsedUnits(next, quick.id) <= getContainerCapacityUnits(quick, characters)) break;
      const fallback = moveStack(next, releasedId, { type: "container", id: backpack.id }, characters, undefined, true);
      if (fallback.moved) next = fallback.state;
    }
    const heldSelected = next.stacks.find((entry) => entry.containerId === quick.id && entry.handSlot === "main" && isDaggerLengthWeaponStack(entry, character));
    return { state: next, selectedWeaponStackId: heldSelected?.id ?? null };
  }

  function hasFreeHand(character: CampaignState["characters"][number]) {
    const held = heldHandStacks(character);
    if (!held.length) return !character.handState.startsWith("two-hand-");
    return held.length < 2 && !held.some((entry) => stackRequiresBothHands(entry, character));
  }

  function participantMoveRate(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    const base = character ? characterEncumbrance(character).rate : Math.max(0, participant.movementRate ?? 0);
    const names = new Set(conditionsForParticipant(participant).filter((effect) => effect.remainingRounds > 0).map((effect) => effect.name));
    if (names.has("Overbear pin")) return 0;
    return Math.max(0, base - (names.has("Feet clutched") ? 30 : 0));
  }

  function participantAbility(participant: SegmentedParticipant, index: 0 | 1) {
    const character = participantCharacter(participant);
    if (!character) return null;
    return index === 0 ? strengthScoreLabel(character.stats[0], character.exceptionalStrength) : character.stats[1];
  }

  function participantWornArmorAscendingAc(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (!character) return participant.armorMode === "worn" ? wornArmorProfile(participant.armorProfile)?.ascendingAc ?? participant.armorClass ?? 10 : null;
    const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const worn = owner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
    const armor = worn && campaign.inventoryManagement.stacks.filter((entry) => entry.containerId === worn.id && entry.equipment?.kind === "armor");
    return armor?.length ? Math.max(10, ...armor.map((entry) => Number(entry.equipment?.ascendingAc) || 10)) : null;
  }

  function participantUnarmedArmor(participant: SegmentedParticipant) {
    const wornAc = participantWornArmorAscendingAc(participant);
    return participant.kind === "character"
      ? { ...participant, armorMode: wornAc === null ? "natural" as const : "worn" as const, armorProfile: wornAc === null ? "flesh" as const : participant.armorProfile }
      : participant;
  }

  function unarmedMagicArmorBonus(participant: SegmentedParticipant) {
    if (participant.unarmedOverrides?.magicArmorBonus !== null && participant.unarmedOverrides?.magicArmorBonus !== undefined) return Math.max(0, participant.unarmedOverrides.magicArmorBonus);
    const character = participantCharacter(participant);
    if (!character) return 0;
    const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const worn = owner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
    const bonuses = campaign.inventoryManagement.stacks.filter((entry) => entry.containerId === worn?.id && entry.equipment?.kind === "armor").map((entry) => Number(entry.name.match(/\+(\d+)/)?.[1]) || 0);
    return Math.max(0, ...bonuses);
  }

  function activeHolds(participantId: string) {
    return holdsForParticipant(tracker.grappleHolds, participantId);
  }

  function selectedHoldFor(participant: SegmentedParticipant) {
    const own = tracker.grappleHolds.filter((hold) => hold.attackerId === participant.id);
    return own.find((hold) => hold.id === participant.actionDetail) ?? own[0] ?? activeHolds(participant.id)[0];
  }

  function heldWeaponForCategory(character: CampaignState["characters"][number], category: "melee" | "ranged") {
    return heldWeapons(character).find((weapon) => category === "ranged" ? weaponCanMakeMissileAttack(weapon) : weapon.category === "melee");
  }

  function participantIsEngaged(participant: SegmentedParticipant) {
    if (!participantIsConscious({ ...participant, currentHp: participantHp(participant).effective })) return false;
    return engagedOpponentIds(tracker.engagements, participant.id).some((opponentId) => {
      const opponent = tracker.participants.find((entry) => entry.id === opponentId);
      return Boolean(opponent && participantIsConscious({ ...opponent, currentHp: participantHp(opponent).effective }));
    });
  }

  function missileDeclarationBlocked(participant: SegmentedParticipant, action = participant.action) {
    return rangedActions.has(action) && participantIsEngaged(participant);
  }

  function missileResolutionBlocked(participant: SegmentedParticipant) {
    // Close-and-hurl is declared before contact; its movement creates the
    // engagement, but the already-committed hurl still resolves afterward.
    if ((participant.action === "missile" || participant.action === "spec-ranged") && participantIsEngaged(participant)) return true;
    const character = participantCharacter(participant);
    return Boolean(character && activeWeaponRules(participant)?.missileMode === "projectile" && ammoShotsForCharacter(campaign.inventoryManagement, character.id) <= 0);
  }

  function heldWeapons(character: CampaignState["characters"][number]) {
    const hands = heldHandStacks(character);
    if (handLoadoutIssue(hands.find((entry) => entry.handSlot === "main"), hands.find((entry) => entry.handSlot === "offhand"), character)) return [];
    const heldIds = new Set(hands
      .filter((entry) => entry.equipment?.kind === "weapon")
      .map((entry) => `inventory:${entry.id}`));
    const physicalWeapons = character.weapons.filter((weapon) => heldIds.has(weapon.id));
    if (physicalWeapons.length) return physicalWeapons;
    const current = characterWeapon(character, character.equippedWeaponId);
    return current ? [current] : [];
  }

  function weaponInHand(character: CampaignState["characters"][number], hand: "main" | "offhand") {
    const stack = heldHandStacks(character).find((entry) => entry.handSlot === hand && entry.equipment?.kind === "weapon");
    return stack ? characterWeapon(character, `inventory:${stack.id}`) : undefined;
  }

  function twoWeaponLoadout(character: CampaignState["characters"][number]) {
    const main = weaponInHand(character, "main");
    const offhand = weaponInHand(character, "offhand");
    const offhandRules = weaponRulesForItem(offhand);
    return {
      main,
      offhand,
      eligible: Boolean(main?.category === "melee" && main.id !== "unarmed" && offhand?.category === "melee" && ["dagger", "hand-axe"].includes(offhandRules?.id ?? "")),
    };
  }

  function eventActor(participant: SegmentedParticipant, event?: SegmentEvent) {
    const character = participantCharacter(participant);
    if (!character) return participant;
    const loadout = twoWeaponLoadout(character);
    const weaponId = event?.weaponId
      ?? (participant.action === "hand-2-melee" || event?.key === "two-weapon-offhand" ? loadout.offhand?.id : event?.key === "two-weapon-main" ? loadout.main?.id : null);
    return weaponId ? { ...participant, equippedWeaponId: weaponId } : participant;
  }

  function spellNeedsFreeHand(character: CampaignState["characters"][number], preparedSpellSlotId: string | null) {
    if (!preparedSpellSlotId) return true;
    const slot = character.spellSlots.find((entry) => entry.id === preparedSpellSlotId);
    const track = slot && getSpellcastingTracks(character).find((entry) => entry.id === slot.trackId);
    return track?.tradition !== "divine";
  }

  function combatHandContents(character: CampaignState["characters"][number]) {
    const held = heldHandStacks(character);
    if (held.length) {
      const handOne = held.find((entry) => entry.handSlot === "main");
      const handTwo = held.find((entry) => entry.handSlot === "offhand");
      const twoHanded = held.find((entry) => stackRequiresBothHands(entry, character));
      return {
        handOne: handOne?.name ?? (twoHanded ? `${twoHanded.name} · two-handed` : "Empty"),
        handTwo: handTwo?.name ?? (twoHanded ? `${twoHanded.name} · two-handed` : "Empty"),
        handOneRulesId: handOne?.equipment?.weaponRulesId ?? twoHanded?.equipment?.weaponRulesId ?? null,
        handTwoRulesId: handTwo?.equipment?.weaponRulesId ?? twoHanded?.equipment?.weaponRulesId ?? null,
      };
    }
    const readiedWeapon = characterWeapon(character, character.equippedWeaponId);
    const weapon = readiedWeapon?.name ?? "Unarmed";
    const weaponRulesId = readiedWeapon?.weaponRulesId ?? null;
    if (character.handState === "unarmed") return { handOne: "Empty", handTwo: "Empty", handOneRulesId: null, handTwoRulesId: null };
    if (character.handState.startsWith("two-hand-")) return { handOne: `${weapon} · two-handed`, handTwo: `${weapon} · two-handed`, handOneRulesId: weaponRulesId, handTwoRulesId: weaponRulesId };
    const handTwo = character.handState === "one-hand-shield" ? "Shield"
      : character.handState === "one-hand-light" ? "Torch / lantern"
      : character.handState === "one-hand-missile" ? "Javelin / sling"
      : character.handState === "one-hand-offhand" ? "Dagger / handaxe"
      : "Empty";
    return { handOne: weapon, handTwo, handOneRulesId: weaponRulesId, handTwoRulesId: null };
  }

  function weaponMismatch(participant: SegmentedParticipant) {
    if (["brawl", "grapple", "overbear", "improve-hold", "maintain-hold", "release-hold", "natural-attack"].includes(participant.action)) return "";
    const weapon = equippedWeaponFor(participant);
    if (!weapon || weapon.category === "other") return "";
    const character = participantCharacter(participant);
    if (rangedActions.has(participant.action) && (!character || !heldWeaponForCategory(character, "ranged"))) return `Ready a ranged weapon before declaring this missile attack.`;
    if (meleeActions.has(participant.action) && participant.action !== "three-piece" && (!character || !heldWeaponForCategory(character, "melee"))) return `Ready a melee weapon before declaring this melee attack.`;
    return "";
  }

  function suggestedWeaponSwitch(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (!character) return undefined;
    const requiredCategory = rangedActions.has(participant.action)
      ? "ranged"
      : meleeActions.has(participant.action) && participant.action !== "three-piece"
        ? "melee"
        : null;
    if (!requiredCategory) return undefined;
    const preferredWeapons = [...character.weapons.filter((weapon) => weapon.name.trim()), ...availableCharacterWeapons(character).filter((weapon) => weapon.id === "unarmed")];
    return preferredWeapons.find((weapon) => (requiredCategory === "ranged" ? weaponCanMakeMissileAttack(weapon) : weapon.category === "melee")
      && weapon.id !== (participant.equippedWeaponId ?? character.equippedWeaponId));
  }

  function targetsForAction(participant: SegmentedParticipant, action: SegmentedAction) {
    return tracker.participants.filter((entry) => {
      if (entry.id === participant.id || (action !== "spell" && action !== "spell-like-effect" && action !== "use-magic" && entry.side === participant.side)) return false;
      if (conditionsForParticipant(entry).some((effect) => effect.remainingRounds > 0 && effect.name === "Dead")) return false;
      if (!participantIsConscious({ ...entry, currentHp: participantHp(entry).effective })) return false;
      if (action !== "heroic-assault") return true;
      const character = participantCharacter(entry);
      return heroicAssaultEligible(character?.hitDice ?? entry.hitDice);
    });
  }

  function automaticTargetId(participant: SegmentedParticipant, action: SegmentedAction) {
    if (!attackActions.has(action) && action !== "spell" && action !== "spell-like-effect" && action !== "close" && action !== "parry-disengage") return null;
    const opposingTargets = targetsForAction(participant, action).filter((entry) => entry.side !== participant.side);
    return opposingTargets.length === 1 ? opposingTargets[0].id : null;
  }

  function declareAction(participant: SegmentedParticipant, action: SegmentedAction, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    if (missileDeclarationBlocked(participant, action)) return;
    const activeConditionNames = new Set(conditionsForParticipant(participant).filter((effect) => effect.remainingRounds > 0).map((effect) => effect.name));
    if (activeConditionNames.has("Prone") && !proneAllowedActions.has(action)) return;
    if (action === "stand-up" && (!activeConditionNames.has("Prone") || activeConditionNames.has("Overborne"))) return;
    const character = participantCharacter(participant);
    const psionics = normalizePsionics(participant.psionics);
    if (action === "psionic-combat" && (!psionics.enabled || psionics.attackModes.length === 0)) return;
    if (participant.action === "psionic-combat" && participant.psionicCombat && action !== "psionic-combat") return;
    if ((action === "hand-2-melee" || action === "two-weapon-melee") && (!character || !twoWeaponLoadout(character).eligible)) return;
    if (action === "grapple" && character && !canGrapple(character)) return;
    if (action === "small-weapon" && character && !hasDaggerLengthWeaponInHandOrQuick(character)) return;
    const hold = selectedHoldFor(participant);
    const grappleTarget = hold ? (hold.attackerId === participant.id ? hold.defenderId : hold.attackerId) : null;
    const automatic = ["maintain-hold", "improve-hold", "release-hold"].includes(action) ? grappleTarget : automaticTargetId(participant, action);
    const equipped = character ? characterWeapon(character, participant.equippedWeaponId ?? character.equippedWeaponId) : undefined;
    const actionWeapon = character && (rangedActions.has(action) || meleeActions.has(action))
      ? heldWeaponForCategory(character, rangedActions.has(action) ? "ranged" : "melee")
      : undefined;
    const closeWeapon = action === "close" && character && equipped?.category !== "melee"
      ? character.weapons.find((weapon) => weapon.name.trim() && weapon.category === "melee") ?? availableCharacterWeapons(character).find((weapon) => weapon.id === "unarmed")
      : undefined;
    const currentHands = character ? heldHandStacks(character) : [];
    const currentHandOne = currentHands.find((stack) => stack.handSlot === "main");
    const currentHandTwo = currentHands.find((stack) => stack.handSlot === "offhand");
    const npcBackupWeaponId = participant.stableNpcId && action === "switch-weapon"
      ? (participant.weaponRulesIds ?? []).find((weaponId) => weaponId !== participant.weaponRulesId) ?? null
      : null;
    setCampaign((current) => {
      let inventoryManagement = current.inventoryManagement;
      let selectedShortWeaponId: string | null = null;
      if (action === "small-weapon" && character) {
        const prepared = prepareShortWeaponHands(inventoryManagement, current.characters, character.id, participant.equippedWeaponId ?? character.equippedWeaponId);
        inventoryManagement = prepared.state;
        selectedShortWeaponId = prepared.selectedWeaponStackId;
      }
      const next = {
        ...current,
        inventoryManagement,
        characters: closeWeapon && character
          ? current.characters.map((entry) => entry.id === character.id ? { ...entry, equippedWeaponId: closeWeapon.id, handState: handStateForWeapon(entry, closeWeapon.id) } : entry)
          : current.characters,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participant.id ? {
            ...entry,
            action,
            actionDetail: ["maintain-hold", "improve-hold", "release-hold"].includes(action) ? hold?.id ?? "" : "",
            targetId: automatic,
            targetIds: action === "heroic-assault" && automatic ? [automatic] : [],
            areaOfEffect: false,
            psionicCombat: action === "psionic-combat" ? {
              targetIds: [],
              attackMode: psionics.attackModes[0] ?? "Mind Thrust",
              range: "short" as const,
              exchanges: 1,
              defenseOverrides: {},
              useArea: false,
            } : null,
            preparedSpellSlotId: null,
            equippedWeaponId: selectedShortWeaponId ? `inventory:${selectedShortWeaponId}` : actionWeapon?.id ?? closeWeapon?.id ?? entry.equippedWeaponId,
            pendingWeaponId: action === "switch-weapon" || action === "close" ? npcBackupWeaponId ?? closeWeapon?.id ?? (currentHandOne ? `inventory:${currentHandOne.id}` : null) : null,
            pendingOffhandWeaponId: action === "switch-weapon" || action === "close" ? currentHandTwo ? `inventory:${currentHandTwo.id}` : null : null,
            statusNote: closeWeapon ? `${closeWeapon.name} readied automatically for closing into melee` : "",
            ready: action !== "" && action !== "psionic-combat" && (action !== "heroic-assault" || Boolean(automatic)),
          } : entry),
        },
      };
      return action === "small-weapon" ? syncPhysicalEquipment(next) : next;
    });
  }

  function applyBulkEnemyAction() {
    if (!authorizeProgression()) return;
    const selectedIds = new Set(bulkEnemyIds);
    if (!selectedIds.size || !bulkEnemyAction) return;
    setCampaign((current) => ({
      ...current,
      segmentedInitiative: {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.map((entry) => {
          if (entry.kind !== "enemy" || !selectedIds.has(entry.id) || participantHp(entry).current <= 0) return entry;
          const activeConditionNames = new Set(current.segmentedInitiative.effects.filter((effect) => effect.remainingRounds > 0 && (effect.participantId === entry.id || (!effect.participantId && effect.target === entry.name))).map((effect) => effect.name));
          if (activeConditionNames.has("Prone") && !proneAllowedActions.has(bulkEnemyAction)) return { ...entry, statusNote: "Prone: choose unarmed combat or Stand Up." };
          if (bulkEnemyAction === "stand-up" && (!activeConditionNames.has("Prone") || activeConditionNames.has("Overborne"))) return { ...entry, statusNote: activeConditionNames.has("Overborne") ? "Cannot Stand Up while Overborne." : "Not Prone." };
          const legalTargets = targetsForAction(entry, bulkEnemyAction).filter((target) => target.side !== entry.side);
          const automatic = bulkEnemyRandomTarget && legalTargets.length
            ? legalTargets[secureRandomIndex(legalTargets.length)].id
            : automaticTargetId(entry, bulkEnemyAction);
          if (missileDeclarationBlocked(entry, bulkEnemyAction)) return { ...entry, statusNote: "Cannot use a missile weapon while engaged." };
          return {
            ...entry,
            action: bulkEnemyAction,
            actionDetail: "",
            targetId: automatic,
            targetIds: [],
            areaOfEffect: false,
            preparedSpellSlotId: null,
            pendingWeaponId: null,
            statusNote: "",
            ready: bulkEnemyAction !== "switch-weapon",
          };
        }),
      },
    }));
  }

  function toggleBulkEnemy(id: string) {
    setBulkEnemyIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  }

  function toggleHeroicTarget(participant: SegmentedParticipant, targetId: string) {
    const maximum = Math.max(1, participantCharacter(participant)?.level ?? 1);
    const selected = participant.targetIds.includes(targetId)
      ? participant.targetIds.filter((entry) => entry !== targetId)
      : [...participant.targetIds, targetId].slice(0, maximum);
    updateParticipant(participant.id, { targetIds: selected, targetId: selected[0] ?? null, ready: selected.length > 0 });
  }

  function toggleAreaTarget(participant: SegmentedParticipant, targetId: string) {
    const selected = participant.targetIds.includes(targetId)
      ? participant.targetIds.filter((entry) => entry !== targetId)
      : [...participant.targetIds, targetId];
    updateParticipant(participant.id, { targetIds: selected, targetId: selected[0] ?? null, ready: true });
  }

  function declarationBlocker(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    const hp = participantHp(participant).current;
    if ((participant.kind === "enemy" && hp <= 0)
      || ((participant.kind === "character" || participant.kind === "npc") && hp <= 0)) return "";
    if (!participant.action) return `${participant.name} needs a declared action.`;
    if (participant.action === "psionic-combat") {
      const psionics = normalizePsionics(participant.psionics);
      const setup = participant.psionicCombat;
      if (!psionics.enabled || !setup || !setup.attackMode) return `${participant.name} has no psionic combat setup.`;
      if (!psionics.attackModes.includes(setup.attackMode)) return `${participant.name} does not know ${setup.attackMode}.`;
      if (!setup.targetIds.length) return `${participant.name} needs at least one psionic target.`;
      if (!targetsForAction(participant, "psionic-combat").some((target) => target.id === setup.targetIds[0])) return `${participant.name}'s psionic target is no longer valid.`;
      if (setup.attackMode === "Psychic Crush" && !psionics.defenseModes.includes("Thought Shield")) return `${participant.name} needs Thought Shield to use Psychic Crush.`;
      if (psionics.currentAttackPoints < psionicAttackCost(setup.attackMode, setup.range)) return `${participant.name} lacks Attack Points for ${setup.attackMode}.`;
    }
    const activeConditions = conditionsForParticipant(participant).filter((effect) => effect.remainingRounds > 0);
    const conditionRule = combatConditionRule(activeConditions);
    const conditionNames = activeConditions.map((effect) => effect.name).join(", ");
    const prone = activeConditions.some((effect) => effect.name === "Prone");
    const overborne = activeConditions.some((effect) => effect.name === "Overborne");
    const nonProneConditionRule = combatConditionRule(activeConditions.filter((effect) => effect.name !== "Prone"));
    if (prone && !proneAllowedActions.has(participant.action)) return `${participant.name} is Prone and may only use unarmed-combat actions or Stand Up.`;
    if (participant.action === "stand-up" && !prone) return `${participant.name} is not Prone.`;
    if (participant.action === "stand-up" && overborne) return `${participant.name} cannot Stand Up while Overborne.`;
    if (conditionRule.cannotAct && participant.action !== "skip" && participant.action !== "inventory") return `${participant.name} cannot act while affected by ${conditionNames}; select Skip or Inventory management.`;
    if (conditionRule.cannotAttack && attackActions.has(participant.action) && !(prone && proneAllowedActions.has(participant.action) && !nonProneConditionRule.cannotAttack)) return `${participant.name} cannot attack while affected by ${conditionNames}; choose a non-attack action.`;
    const grappling = participantIsGrappling(tracker.grappleHolds, participant.id) || activeConditions.some((effect) => effect.name === "Grappling");
    if (grappling && participant.action === "spell") return `${participant.name} cannot cast a spell while Grappling.`;
    if (missileDeclarationBlocked(participant)) return `${participant.name} cannot use a missile weapon while engaged.`;
    if (participant.action === "spell" && character && spellNeedsFreeHand(character, participant.preparedSpellSlotId) && !hasFreeHand(character)) return `${participant.name} needs one free hand to cast this arcane spell.`;
    if ((participant.action === "hand-2-melee" || participant.action === "two-weapon-melee") && (!character || !twoWeaponLoadout(character).eligible)) return `${participant.name} needs a melee weapon in Hand 1 and a readied dagger or hand axe in Hand 2.`;
    if (participant.action === "grapple" && participant.unarmedOverrides?.cannotGrapple) return `${participant.name} cannot Grapple.`;
    if (participant.action === "grapple" && character && !canGrapple(character)) return `${participant.name} needs both hands free, or only one dagger-length weapon, to Grapple.`;
    if (participant.action === "grapple") {
      const target = tracker.participants.find((entry) => entry.id === participant.targetId);
      if (target?.unarmedOverrides?.cannotBeGrappled) return `${target.name} cannot be Grappled.`;
    }
    if (participant.action === "overbear" && participant.unarmedOverrides?.cannotOverbear) return `${participant.name} cannot Overbear.`;
    if (participant.action === "overbear") {
      const target = tracker.participants.find((entry) => entry.id === participant.targetId);
      if (target?.unarmedOverrides?.cannotBeOverborne) return `${target.name} cannot be Overborne.`;
    }
    if (["maintain-hold", "improve-hold", "release-hold"].includes(participant.action) && !selectedHoldFor(participant)) return `${participant.name} has no hold to ${participant.action === "maintain-hold" ? "maintain" : participant.action === "improve-hold" ? "improve" : "release"}.`;
    if (participant.action === "small-weapon" && (!grappling || !character || !hasDaggerLengthWeaponInHandOrQuick(character) || !isDaggerLengthWeapon(activeWeaponRules(participant)))) return `${participant.name} needs a dagger-length-or-smaller weapon while Grappling.`;
    if (participant.action === "natural-attack" && (!grappling || participant.attackMode !== "natural")) return `${participant.name} needs a usable natural attack while Grappling.`;
    if (grappling && ["melee", "spec-melee", "melee-combination", "heroic-assault", "set-charge"].includes(participant.action) && !isDaggerLengthWeapon(activeWeaponRules(participant))) return `${participant.name} is Grappling and may use only a dagger-length-or-smaller normal weapon.`;
    if (participant.action === "other" && !participant.actionDetail.trim()) return `${participant.name}'s Other action needs a name.`;
    if (participant.action === "heroic-assault") {
      const character = participantCharacter(participant);
      if (!character || !/fighter/i.test(character.className) || character.level < 2) return `${participant.name} must be a level 2+ fighter to use Heroic Assault.`;
      if (!participant.targetIds.length) return `${participant.name} needs at least one Heroic Assault target whose maximum possible HD roll is below 8 hp.`;
      if (participant.targetIds.length > character.level) return `${participant.name} can choose at most ${character.level} Heroic Assault targets.`;
      const eligibleIds = new Set(targetsForAction(participant, "heroic-assault").map((target) => target.id));
      if (participant.targetIds.some((targetId) => !eligibleIds.has(targetId))) return `${participant.name} has an ineligible Heroic Assault target.`;
    } else if (participant.action === "three-piece") {
      if (participant.onslaughtAttacks.length < 2 || participant.onslaughtAttacks.length > 10) return `${participant.name}'s Monster Onslaught must contain 2–10 attacks.`;
      const invalidAttack = participant.onslaughtAttacks.findIndex((attack) => !looksLikeDice(attack.damageExpression));
      if (invalidAttack >= 0) return `${participant.name}'s Monster Onslaught attack ${invalidAttack + 1} needs damage dice such as 1d4 or 2d6+1.`;
      if (!participant.targetId) return `${participant.name} needs an opposing target.`;
    } else if (((attackActions.has(participant.action) && attackRequiresDeclaredTarget(participant.action)) || participant.action === "close" || participant.action === "parry-disengage") && !participant.targetId) return `${participant.name} needs an opposing target.`;
    const mismatch = weaponMismatch(participant);
    if (mismatch) return `${participant.name}: ${mismatch}`;
    if ((participant.action === "spec-melee" || participant.action === "spec-ranged") && !equippedWeaponFor(participant)?.specialized) return `${participant.name}'s equipped weapon is not marked Specialized.`;
    return "";
  }

  const declaringParticipants = tracker.participants.filter((participant) => !isOngoingSpell(participant) && !belongsInIncapacitatedGroup(participant));
  const declarationBlockers = declaringParticipants.flatMap((participant) => {
    const message = declarationBlocker(participant);
    return message ? [{ participantId: participant.id, message }] : [];
  });
  function actionModifier(participant: SegmentedParticipant) {
    if (participant.action !== "missile" && participant.action !== "spec-ranged" && participant.action !== "close-hurl") return 0;
    const character = participant.characterId
      ? campaign.characters.find((entry) => entry.id === participant.characterId)
      : undefined;
    return character ? missileInitiativeAdjustment(character.stats[1]) : participant.segmentModifier;
  }

  function fighterLevelForParticipant(participant: SegmentedParticipant) {
    const character = participant.characterId
      ? campaign.characters.find((entry) => entry.id === participant.characterId)
      : undefined;
    return character ? Math.max(1, specialistClassLevel(character) || character.level) : fighterLevelFromHitDice(participant.hitDice) ?? 1;
  }

  function eventsForParticipant(participant: SegmentedParticipant, roster = tracker.participants) {
    const character = participantCharacter(participant);
    const weapon = character ? equippedWeaponFor(participant) : undefined;
    const training = character ? getWeaponTrainingState(character, weapon) : { specialized: false };
    const rules = activeWeaponRules(participant);
    const specialistLevel = fighterLevelForParticipant(participant);
    const ordinaryMissileRate = rules?.missileRateOfFire === .5 ? (tracker.round % 2 === 1 ? 1 : 0) : rules?.missileRateOfFire ?? 1;
    const missileShots = rules && training.specialized ? specializedMissileRate(rules, specialistLevel, tracker.round) : ordinaryMissileRate;
    const events = participantEvents(participant, specialistLevel, { melee: Boolean(training.specialized && weapon?.category === "melee"), missileShots: Math.max(0, Math.floor(missileShots)), missileSpecialized: Boolean(training.specialized) });
    const target = roster.find((entry) => entry.id === participant.targetId);
    if (!target || target.targetId !== participant.id) return events;
    const reachOrder = compareInitialChargeReach({
      mutualTargets: true,
      engagedAtRoundStart: wereEngagedAtStartOfRound(tracker.engagements, participant.id, target.id, tracker.round),
      leftAction: participant.action,
      rightAction: target.action,
      leftReach: weaponReachFeet(activeWeaponRules(participant)),
      rightReach: weaponReachFeet(activeWeaponRules(target)),
    });
    if (!reachOrder || participant.scheduledSegment === null || target.scheduledSegment === null) return events;
    const firstSegment = Math.min(participant.scheduledSegment, target.scheduledSegment);
    const secondSegment = Math.max(participant.scheduledSegment, target.scheduledSegment);
    const resolutionSegment = reachOrder < 0 ? firstSegment : secondSegment;
    return events.map((event) => isAttackEvent(event, participant) ? { ...event, segment: resolutionSegment } : event);
  }

  function participantSurpriseSegments(participant: SegmentedParticipant) {
    if (tracker.round !== 1) return 0;
    const baseSegments = participant.side === "party" ? tracker.partySurpriseSegments : tracker.oppositionSurpriseSegments;
    if (baseSegments <= 0) return 0;
    const character = participantCharacter(participant);
    if (!character) return baseSegments;
    const dexterityAdjustment = numericModifier(derivedAbilityItems(1, character.stats[1]).find((item) => item.key === "surprise")?.value);
    return adjustedSurpriseSegments(baseSegments, dexterityAdjustment);
  }

  function eventForfeitedBySurprise(participant: SegmentedParticipant, event: SegmentEvent) {
    if (event.round !== 1) return false;
    const surprisedThrough = participantSurpriseSegments(participant);
    if (participant.action === "spell" && event.key === "spell-complete") {
      return (participant.scheduledSegment ?? event.segment) <= surprisedThrough;
    }
    return event.segment <= surprisedThrough;
  }

  function rollInitiative(sourceParticipants = tracker.participants) {
    if (!authorizeProgression()) return;
    if (!sourceParticipants.length) return;
    const partyRoll = rollD6();
    const oppositionRoll = rollD6();
    const movementOnlyActions: SegmentedAction[] = ["move", "flee"];
    const participants = sourceParticipants.map((participant) => {
      const hp = participantHp(participant).current;
      const outOfCombat = (participant.kind === "enemy" && hp <= 0)
        || ((participant.kind === "character" || participant.kind === "npc") && hp <= -10);
      if (outOfCombat) return {
        ...participant,
        initiativeRoll: null,
        subInitiativeRoll: null,
        scheduledSegment: null,
        declarationRound: null,
        completedEvents: [],
        resolutions: {},
      };
      if (isOngoingSpell(participant)) {
        return { ...participant, subInitiativeRoll: participant.subInitiativeRoll ?? rollD6() };
      }
      const roll = tracker.rollMode === "individual"
        ? rollD6()
        : participant.side === "party" ? partyRoll : oppositionRoll;
      const missileCharacter = (participant.action === "missile" || participant.action === "spec-ranged" || participant.action === "close-hurl")
        ? participantCharacter(participant)
        : undefined;
      const baseSegment = movementOnlyActions.includes(participant.action)
        || participant.action === "set-charge"
        || participant.action === "heroic-assault"
        || participant.action === "melee-combination"
        ? 1
        : participant.action === "hold"
          ? clampSegment(participant.holdSegment)
          : missileCharacter
            ? missileInitiativeSegment(roll, missileCharacter.stats[1])
            : clampSegment(roll + actionModifier(participant));
      return {
        ...participant,
        initiativeRoll: roll,
        subInitiativeRoll: rollD6(),
        scheduledSegment: baseSegment,
        declarationRound: tracker.round,
        completedEvents: [],
        resolutions: {},
        onslaughtAttacks: participant.action === "three-piece"
          ? participant.onslaughtAttacks.map((attack) => ({ ...attack, rolledSegment: attack.timing === "rolled" ? rollD6() : null }))
          : participant.onslaughtAttacks,
        statusNote: participantSurpriseSegments(participant) > 0
          ? `Surprised through segment ${participantSurpriseSegments(participant)}${participant.side === "party" && participantCharacter(participant) ? " after DEX adjustment" : ""}`
          : "",
      };
    });
    const occupiedThisRound = participants
      .flatMap((participant) => eventsForParticipant(participant, participants))
      .filter((event) => event.round === tracker.round)
      .map((event) => event.segment);
    const firstOccupiedSegment = occupiedThisRound.length ? Math.min(...occupiedThisRound) : 0;
    const combatTallies = participants.reduce((all, participant) => {
      if (!(["move", "close", "close-hurl", "charge", "flee", "parry-disengage"] as SegmentedAction[]).includes(participant.action)) return all;
      const prior = all[participant.id] ?? { damageDealt: 0, damageReceived: 0, attacks: 0, attacksMissedAgainst: 0, savesSucceeded: 0, savesFailed: 0, moves: 0, currentHitStreak: 0, longestHitStreak: 0 };
      return { ...all, [participant.id]: { ...prior, moves: prior.moves + 1 } };
    }, tracker.combatTallies);
    updateTracker({
      partyRoll: tracker.rollMode === "group" ? partyRoll : null,
      oppositionRoll: tracker.rollMode === "group" ? oppositionRoll : null,
      participants,
      currentSegment: firstOccupiedSegment,
      phase: occupiedThisRound.length ? "active" : "round-complete",
      declarationStartedAt: null,
      combatTallies,
      engagements: tracker.engagements,
    });
  }

  function attemptRollInitiative(event?: React.MouseEvent<HTMLButtonElement>) {
    if (!canControlCombatProgression(combatIdentity, Boolean(event?.ctrlKey || controlHeld))) return;
    if (event?.ctrlKey) {
      const forcedParticipants = tracker.participants.map((participant) => {
        if (isOngoingSpell(participant)) return participant;
        const blocker = declarationBlocker(participant);
        return blocker ? {
          ...participant,
          action: "skip" as SegmentedAction,
          actionDetail: "",
          targetId: null,
          targetIds: [],
          pendingWeaponId: null,
          statusNote: `Forced to Skip: ${blocker}`,
          ready: true,
        } : participant;
      });
      const remainingBlockers = forcedParticipants.flatMap((participant) => {
        const message = declarationBlocker(participant);
        return message ? [{ participantId: participant.id, message }] : [];
      });
      if (!remainingBlockers.length) return rollInitiative(forcedParticipants);
      updateTracker({ participants: forcedParticipants });
      setBlockedParticipantId(remainingBlockers[0].participantId);
      window.requestAnimationFrame(() => document.getElementById(`combatant-${remainingBlockers[0].participantId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    const blocker = declarationBlockers[0];
    if (!blocker) return rollInitiative();
    setBlockedParticipantId(blocker.participantId);
    window.requestAnimationFrame(() => {
      document.getElementById(`combatant-${blocker.participantId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function interruptSpell(participantId: string) {
    if (!authorizeCombatant(participantId)) return;
    const participant = tracker.participants.find((entry) => entry.id === participantId);
    if (!participant) return;
    setCampaign((current) => ({
      ...current,
      characters: current.characters.map((character) => character.id === participant.characterId && participant.preparedSpellSlotId
        ? { ...character, spellSlots: character.spellSlots.map((slot) => slot.id === participant.preparedSpellSlotId ? { ...slot, expended: true } : slot) }
        : character),
      segmentedInitiative: {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.map((entry) => entry.id === participantId ? {
          ...entry,
          completedEvents: Array.from(new Set([...entry.completedEvents, "spell-complete"])),
          statusNote: "Spell interrupted and expended",
        } : entry),
      },
    }));
  }

  const declaredEvents = tracker.participants
    .filter((participant) => !isDefeatedForInitiative(participant))
    .flatMap((participant) => eventsForParticipant(participant));
  const disengageFreeAttacks = tracker.participants.flatMap((escapee) => {
    if (escapee.action !== "parry-disengage" || escapee.declarationRound === null || escapee.scheduledSegment === null || !escapee.targetId) return [];
    const pursuer = tracker.participants.find((participant) => participant.id === escapee.targetId);
    if (!pursuer || isDefeatedForInitiative(pursuer)) return [];
    return [{ key: `parry-disengage-free-${escapee.id}`, participantId: pursuer.id, targetId: escapee.id, round: escapee.declarationRound, segment: escapee.scheduledSegment, label: `Free attack on ${escapee.name} · +4`, emoji: "⚔️", freeAttackBonus: 4 }];
  });
  const allEvents = [...declaredEvents, ...disengageFreeAttacks];
  const eventsThisRound = allEvents.filter((event) => event.round === tracker.round);

  function isFinalMeleeEvent(participant: SegmentedParticipant, event: SegmentEvent) {
    if (event.freeAttackBonus || !isMeleeAction(participant.action) || !isAttackEvent(event, participant)) return false;
    const attacks = eventsThisRound.filter((candidate) => !candidate.freeAttackBonus && candidate.participantId === participant.id && isAttackEvent(candidate, participant));
    return attacks.at(-1)?.key === event.key;
  }

  function speedAttackCount(participant: SegmentedParticipant, event: SegmentEvent, target: SegmentedParticipant | undefined) {
    if (participant.action === "hand-2-melee" || participant.action === "two-weapon-melee") return 1;
    if (!target) return 1;
    return getSpeedFactorAttackCount({
      melee: isMeleeAction(participant.action),
      engagedAtRoundStart: wereEngagedAtStartOfRound(tracker.engagements, participant.id, target.id, tracker.round),
      finalMeleeAttack: isFinalMeleeEvent(participant, event),
      attackerSpeedFactor: activeSpeedFactor(participant),
      targetSpeedFactor: getDefendingSpeedFactor(target, equippedWeaponFor(target)),
    });
  }
  function eventOrder(event: SegmentEvent) {
    return tracker.participants.find((participant) => participant.id === event.participantId)?.subInitiativeRoll ?? 7;
  }

  function eventName(event: SegmentEvent) {
    const participant = tracker.participants.find((entry) => entry.id === event.participantId);
    const character = participant?.characterId
      ? campaign.characters.find((entry) => entry.id === participant.characterId)
      : undefined;
    return character?.name ?? participant?.name ?? "";
  }

  function sortSegmentEvents(events: SegmentEvent[]) {
    return [...events].sort((a, b) => {
      const aParticipant = tracker.participants.find((entry) => entry.id === a.participantId);
      const bParticipant = tracker.participants.find((entry) => entry.id === b.participantId);
      if (aParticipant && bParticipant && isAttackEvent(a, aParticipant) && isAttackEvent(b, bParticipant) && isMeleeAction(aParticipant.action) && isMeleeAction(bParticipant.action)) {
        const established = wereEngagedAtStartOfRound(tracker.engagements, aParticipant.id, bParticipant.id, tracker.round);
        const mutualTargets = (a.targetId ?? aParticipant.targetId) === bParticipant.id && (b.targetId ?? bParticipant.targetId) === aParticipant.id;
        const reachDifference = compareInitialChargeReach({
          mutualTargets,
          engagedAtRoundStart: established,
          leftAction: aParticipant.action,
          rightAction: bParticipant.action,
          leftReach: weaponReachFeet(activeWeaponRules(aParticipant)),
          rightReach: weaponReachFeet(activeWeaponRules(bParticipant)),
        });
        if (reachDifference) return reachDifference;
        const speedDifference = compareEstablishedMeleeSpeed({
          sameSegment: a.segment === b.segment,
          mutualTargets,
          engagedAtRoundStart: established,
          leftSpeedFactor: activeSpeedFactor(aParticipant),
          rightSpeedFactor: activeSpeedFactor(bParticipant),
        });
        if (speedDifference) return speedDifference;
        if (established && mutualTargets) return eventName(a).localeCompare(eventName(b));
      }
      const rollDifference = eventOrder(a) - eventOrder(b);
      if (rollDifference) return rollDifference;
      if (aParticipant?.side !== bParticipant?.side) return aParticipant?.side === "party" ? -1 : 1;
      return eventName(a).localeCompare(eventName(b));
    });
  }

  const selectedSegmentEvents = sortSegmentEvents(allEvents.filter((event) =>
    event.round === tracker.round && event.segment === tracker.currentSegment,
  ));
  const occupiedSegments = Array.from(new Set(eventsThisRound.map((event) => event.segment))).sort((a, b) => a - b);
  const nextOccupiedSegment = occupiedSegments.find((segment) => segment > tracker.currentSegment);
  const previousOccupiedSegment = [...occupiedSegments].reverse().find((segment) => segment < tracker.currentSegment);

  function advanceInitiative() {
    if (nextOccupiedSegment !== undefined) updateTracker({ currentSegment: nextOccupiedSegment, phase: "active" }, true);
    else updateTracker({ phase: "round-complete" }, true);
  }

  function previousSegment() {
    if (tracker.phase === "round-complete") {
      updateTracker({ phase: "active", currentSegment: occupiedSegments.at(-1) ?? tracker.currentSegment ?? 1 }, true);
    } else if (tracker.phase === "active" && previousOccupiedSegment !== undefined) {
      updateTracker({ currentSegment: previousOccupiedSegment }, true);
    }
  }

  function goToSegment(segment: number) {
    updateTracker({ currentSegment: segment, phase: "active" }, true);
  }

  const combatPhaseStep = tracker.phase === "declaration" ? 0 : tracker.phase === "active" ? 2 : 3;
  const combatPhaseTitle = tracker.phase === "declaration"
    ? "Declaration"
    : tracker.phase === "active"
      ? `Resolution · Segment ${tracker.currentSegment}`
      : "Round complete";
  const nextCombatStep = tracker.phase === "declaration"
    ? "Roll initiative"
    : tracker.phase === "active"
      ? nextOccupiedSegment !== undefined
        ? `Resolve Segment ${nextOccupiedSegment}`
        : "Complete the round"
      : `Declare Round ${tracker.round + 1}`;

  function advanceCombatProgression(event: React.MouseEvent<HTMLButtonElement>) {
    if (!hasProgressionAuthority) return;
    if (tracker.phase === "declaration") {
      attemptRollInitiative(event);
      return;
    }
    if (tracker.phase === "active") {
      advanceInitiative();
      return;
    }
    nextRound(Date.now());
  }

  function phaseAdvanceControl() {
    return <div className="combat-phase-anchor">
      <button
        type="button"
        className="combat-phase-advance"
        disabled={!hasProgressionAuthority || (tracker.phase === "declaration" && tracker.participants.length === 0)}
        onClick={advanceCombatProgression}
        title={hasProgressionAuthority ? "Advance the shared combat sequence" : "The GM controls combat progression"}
        aria-label={`${combatPhaseTitle}. ${hasProgressionAuthority ? `Activate to advance to ${nextCombatStep}` : `Next up: ${nextCombatStep}`}`}
      >
        <span className="combat-phase-current"><small>Round {tracker.round}</small><strong>{combatPhaseTitle}</strong><em>{hasProgressionAuthority ? "Click to advance" : "GM controlled"}</em></span>
        <span className="combat-phase-meter" aria-hidden="true">
          {(["Declare", "Initiative", "Resolve", "Complete"] as const).map((label, index) => <span className={index < combatPhaseStep ? "complete" : index === combatPhaseStep ? "current" : "upcoming"} key={label}><i />{label}</span>)}
        </span>
        <span className="combat-phase-next"><small>Next up</small><b>{nextCombatStep}</b></span>
      </button>
    </div>;
  }

  function nextRound(declarationStartedAt: number) {
    if (!authorizeProgression()) return;
    const nextRoundNumber = tracker.round + 1;
    const endedMeleeIds = tracker.participants.filter((participant) => participant.action === "flee" || participant.action === "parry-disengage").map((participant) => participant.id);
    const participants = tracker.participants.map((participant) => {
      const hp = participantHp(participant).current;
      const nextTemporary = Math.max(0, (participant.temporaryDamage ?? 0) - 1);
      const temporaryKo = hp > 0 && hp - nextTemporary <= 0;
      const mortal = participant.kind === "character" || participant.kind === "npc";
      const futureSpell = eventsForParticipant(participant).some((event) =>
        event.key === "spell-complete"
        && event.round >= nextRoundNumber
        && !participant.completedEvents.includes(event.key),
      );
      const enteredMelee = participant.action === "charge"
        || participant.action === "close"
        || participant.action === "close-hurl";
      const continuingEffects = tracker.effects.filter((effect) => (effect.participantId === participant.id || (!effect.participantId && effect.target === participant.name))
        && (effect.name === "Unconscious" ? effect.description.startsWith("Unconscious from Temporary Damage") ? temporaryKo : hp <= 0 && hp > -10 : effect.remainingRounds > 1));
      const continuingConditionRule = combatConditionRule(continuingEffects);
      const continuingConditionName = continuingEffects.find((effect) => combatConditionRule([effect]).cannotAct)?.name;
      const forcedAction = mortal && hp <= -10
        ? "skip" as SegmentedAction
        : mortal && hp < 0
          ? "die" as SegmentedAction
          : mortal && hp === 0
            ? "unconscious" as SegmentedAction
            : temporaryKo
              ? "unconscious" as SegmentedAction
            : continuingConditionRule.cannotAct
              ? "skip" as SegmentedAction
              : null;
      const maintainedHold = tracker.grappleHolds.find((hold) => hold.attackerId === participant.id);
      const defaultHoldAction = !forcedAction && maintainedHold ? "maintain-hold" as SegmentedAction : null;
      return futureSpell && !forcedAction ? { ...participant, temporaryDamage: nextTemporary } : {
        ...participant,
        temporaryDamage: nextTemporary,
        action: forcedAction ?? defaultHoldAction ?? (participant.action === "unconscious" && hp > 0 ? "" as SegmentedAction : enteredMelee ? "melee" as SegmentedAction : participant.action === "switch-weapon" ? "" as SegmentedAction : participant.action),
        actionDetail: forcedAction === "die" ? "Lose 1 HP this round" : forcedAction ? "" : maintainedHold ? maintainedHold.id : enteredMelee ? "" : participant.actionDetail,
        targetId: forcedAction ? null : maintainedHold?.defenderId ?? participant.targetId,
        targetIds: forcedAction ? [] : maintainedHold ? [] : participant.targetIds,
        pendingWeaponId: participant.action === "switch-weapon" ? null : participant.pendingWeaponId,
        initiativeRoll: null,
        subInitiativeRoll: null,
        scheduledSegment: null,
        declarationRound: null,
        completedEvents: [],
        resolutions: {},
        onslaughtAttacks: participant.onslaughtAttacks.map((attack) => ({ ...attack, rolledSegment: null })),
        statusNote: forcedAction === "skip" ? hp <= -10 ? "EXSANGUINATED" : continuingConditionName ?? "Cannot act" : forcedAction === "die" ? "Dying" : forcedAction === "unconscious" ? temporaryKo ? "Unconscious · Temporary Damage" : "Unconscious" : "",
        ready: Boolean(forcedAction),
      };
    });
    updateTracker({
      round: nextRoundNumber,
      currentSegment: 0,
      phase: "declaration",
      partyRoll: null,
      oppositionRoll: null,
      participants,
      engagements: endedMeleeIds.reduce((engagements, participantId) => removeEngagement(engagements, participantId), tracker.engagements),
      effects: tracker.effects.map((effect) => {
        if (effect.name === "Unconscious" && effect.participantId) {
          const participant = tracker.participants.find((entry) => entry.id === effect.participantId);
          const hp = participant ? participantHp(participant).current : 1;
          const nextTemporary = Math.max(0, (participant?.temporaryDamage ?? 0) - 1);
          if (effect.description.startsWith("Unconscious from Temporary Damage")) return { ...effect, remainingRounds: hp > 0 && hp - nextTemporary <= 0 ? 1 : 0 };
          if (hp <= 0 && hp > -10) return { ...effect, remainingRounds: 1 };
        }
        return { ...effect, remainingRounds: Math.max(0, effect.remainingRounds - 1) };
      }),
      declarationStartedAt,
    });
  }

  function resetCurrentRound() {
    if (!authorizeProgression()) return;
    updateTracker({
      currentSegment: 0,
      phase: "declaration",
      partyRoll: null,
      oppositionRoll: null,
      declarationStartedAt: Date.now(),
      participants: tracker.participants.map((participant) => ({
        ...participant,
        initiativeRoll: null,
        subInitiativeRoll: null,
        scheduledSegment: null,
        declarationRound: null,
        completedEvents: [],
        resolutions: {},
        onslaughtAttacks: participant.onslaughtAttacks.map((attack) => ({ ...attack, rolledSegment: null })),
        statusNote: participant.action === "die" || participant.action === "unconscious" || participant.statusNote === "EXSANGUINATED" ? participant.statusNote : "",
        ready: participant.action === "die" || participant.action === "unconscious" || participant.statusNote === "EXSANGUINATED",
      })),
    });
  }

  function cheersFor(participants: SegmentedParticipant[], tallies: SegmentedInitiativeState["combatTallies"]) {
    const party = participants.filter((participant) => participant.kind === "character");
    const label = (participant: SegmentedParticipant) => chatCombatantName(participant);
    const ranked = (key: keyof SegmentedInitiativeState["combatTallies"][string]) => [...party].sort((a, b) => (tallies[b.id]?.[key] ?? 0) - (tallies[a.id]?.[key] ?? 0));
    const cards: Array<{ title: string; participantId?: string; text: string }> = [];
    const used = new Set<string>();
    const add = (title: string, participant: SegmentedParticipant | undefined, text: string) => {
      if (!participant || used.has(participant.id)) return;
      used.add(participant.id);
      cards.push({ title, participantId: participant.id, text });
    };
    const damage = ranked("damageDealt")[0];
    if ((tallies[damage?.id ?? ""]?.damageDealt ?? 0) > 0) add("Most damage", damage, `${label(damage)} dealt ${tallies[damage.id].damageDealt} damage.`);
    const received = ranked("damageReceived")[0];
    if ((tallies[received?.id ?? ""]?.damageReceived ?? 0) > 0) add("Most received", received, `${label(received)} absorbed ${tallies[received.id].damageReceived} damage.`);
    const dead = party.filter((participant) => participantHp(participant).current <= -10);
    if (dead.length) cards.push({ title: "In memoriam", text: dead.map(label).join(", ") });
    const superlatives: Array<[keyof SegmentedInitiativeState["combatTallies"][string], string, (value: number) => string]> = [["longestHitStreak", "Longest hit streak", (value) => `${value} consecutive hits.`], ["savesSucceeded", "Most saves made", (value) => `${value} successful saves.`], ["savesFailed", "Most saves failed", (value) => `${value} failed saves.`], ["moves", "Most time moving", (value) => `${value} movement actions.`], ["attacks", "Most attacks", (value) => `${value} attacks declared.`], ["attacksMissedAgainst", "Hardest to hit", (value) => `${value} attacks missed them.`]];
    for (const [key, title, describe] of superlatives) {
      if (cards.length >= 5) break;
      const participant = ranked(key)[0];
      const value = tallies[participant?.id ?? ""]?.[key] ?? 0;
      if (value > 0) add(title, participant, `${label(participant)} · ${describe(value)}`);
    }
    return cards;
  }

  function endCombat() {
    if (!authorizeProgression()) return;
    if (!window.confirm("End combat? This removes opposition and resets the round and active effects. Party characters and party-side NPCs will remain.")) return;
    setCampaign((current) => {
      const faced = current.segmentedInitiative.participants
        .filter((participant) => participant.kind === "enemy" && participant.name.trim())
        .map((participant) => ({ id: id(), name: participant.name.trim(), hitDice: participant.hitDice || "1", typicalHp: Math.max(1, participant.maxHp), specialAbilities: 0, exceptionalAbilities: 0 }));
      const recent = [...faced, ...current.xpTracker.recentEnemies]
        .filter((entry, index, list) => list.findIndex((other) => other.name.toLowerCase() === entry.name.toLowerCase() && other.hitDice === entry.hitDice) === index)
        .slice(0, 20);
      const cheers = cheersFor(current.segmentedInitiative.participants, current.segmentedInitiative.combatTallies);
      return {
        ...current,
        xpTracker: { ...current.xpTracker, recentEnemies: recent },
        segmentedInitiative: {
          ...current.segmentedInitiative,
          round: 1,
          currentSegment: 0,
          phase: "declaration",
          partyRoll: null,
          oppositionRoll: null,
          partySurprised: false,
          oppositionSurprised: false,
          partySurpriseRoll: null,
          oppositionSurpriseRoll: null,
          partySurpriseSegments: 0,
          oppositionSurpriseSegments: 0,
          partySurpriseThreshold: 2,
          oppositionSurpriseThreshold: 2,
          declarationStartedAt: Date.now(),
          participants: current.segmentedInitiative.participants
            .filter((participant) => participant.kind === "character" || (participant.kind === "npc" && participant.side === "party"))
            .map((participant) => ({ ...participant, temporaryDamage: 0, action: "" as SegmentedAction, actionDetail: "", targetId: null, targetIds: [], pendingWeaponId: null, castingTime: 1, holdSegment: 6, initiativeRoll: null, subInitiativeRoll: null, scheduledSegment: null, declarationRound: null, completedEvents: [], resolutions: {}, statusNote: "", ready: false })),
          effects: [],
          engagements: [],
          grappleHolds: [],
          pendingUnarmed: null,
          combatTallies: {},
          lastCheers: cheers,
        },
      };
    });
  }

  function conditionDraft(participantId: string): ConditionDraft {
    return conditionDrafts[participantId] ?? { preset: "Bless", customName: "", rounds: conditionPresets[0].rounds };
  }

  function updateConditionDraft(participantId: string, patch: Partial<ConditionDraft>) {
    setConditionDrafts((current) => ({
      ...current,
      [participantId]: { ...(current[participantId] ?? { preset: "Bless", customName: "", rounds: conditionPresets[0].rounds }), ...patch },
    }));
  }

  function addCondition(participant: SegmentedParticipant) {
    if (!authorizeCombatant(participant.id)) return;
    const draft = conditionDraft(participant.id);
    const preset = conditionPresets.find((entry) => entry.name === draft.preset) ?? conditionPresets[0];
    const name = draft.preset === "Custom" ? draft.customName.trim() : preset.name;
    if (!name) return;
    const effect: CombatEffect = {
      id: id(),
      name,
      target: participant.name,
      participantId: participant.id,
      description: preset.description,
      remainingRounds: Math.max(0, Math.floor(draft.rounds)),
    };
    const rule = combatConditionRule([effect]);
    updateTracker({
      effects: [...tracker.effects, effect],
      participants: rule.cannotAct ? tracker.participants.map((entry) => entry.id === participant.id ? {
        ...entry,
        action: "skip",
        actionDetail: "",
        targetId: null,
        targetIds: [],
        statusNote: name,
        ready: true,
      } : entry) : tracker.participants,
    });
    updateConditionDraft(participant.id, { customName: "" });
  }

  function updateEffect(effectId: string, patch: Partial<CombatEffect>) {
    const effect = tracker.effects.find((entry) => entry.id === effectId);
    if (!effect?.participantId || !authorizeCombatant(effect.participantId)) return;
    updateTracker({ effects: tracker.effects.map((effect) => effect.id === effectId ? { ...effect, ...patch } : effect) });
  }

  function removeEffect(effectId: string) {
    const effect = tracker.effects.find((entry) => entry.id === effectId);
    if (!effect?.participantId || !authorizeCombatant(effect.participantId)) return;
    updateTracker({ effects: tracker.effects.filter((effect) => effect.id !== effectId) });
  }

  function conditionsForParticipant(participant: SegmentedParticipant) {
    return tracker.effects.filter((effect) => effect.participantId === participant.id
      || (!effect.participantId && effect.target === participant.name));
  }

  function conditionRuleFor(participant: SegmentedParticipant) {
    return combatConditionRule(conditionsForParticipant(participant));
  }

  function participantCharacter(participant: SegmentedParticipant) {
    return participant.characterId
      ? campaign.characters.find((entry) => entry.id === participant.characterId)
      : undefined;
  }

  function quickAccessItems(character: CampaignState["characters"][number]) {
    const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const quick = owner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
    if (!quick) return [];
    return campaign.inventoryManagement.stacks.filter((entry) => entry.containerId === quick.id).map((entry) => ({ id: `inventory:${entry.id}`, name: entry.name, requiresBothHands: stackRequiresBothHands(entry, character) }));
  }

  function participantStats(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (character) return `AC ${effectiveArmorClass(participant)} · THB ${signed(attackModifierFor(participant))} · Move ${characterEncumbrance(character).rate} ft`;
    if (participant.kind === "enemy") {
      const bonus = attackModifierFor(participant);
      return `HD ${participant.hitDice || "—"} · AC ${effectiveArmorClass(participant)}${bonus === null ? "" : ` · BTHB ${signed(bonus)}`}`;
    }
    return `AC ${effectiveArmorClass(participant)}${participant.attackBonus === null ? "" : ` · BTHB ${signed(attackModifierFor(participant))}`}`;
  }

  function matchupStats(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    const hitDice = character?.hitDice || participant.hitDice || "—";
    const baseAttackBonus = character?.toHit
      ?? (participant.kind === "enemy" ? monsterAttackBonus(participant.hitDice) : participant.attackBonus);
    const attackBonus = baseAttackBonus === null ? null : attackModifierFor(participant);
    return `HD ${hitDice} · THB ${attackBonus === null ? "—" : signed(attackBonus)} · AC ${effectiveArmorClass(participant)}`;
  }

  function marker(participant: SegmentedParticipant, compact = false) {
    const character = participantCharacter(participant);
    if (participant.kind === "enemy") {
      return <span className={`enemy-number-badge ${compact ? "compact" : ""}`}>{enemyNumbers.get(participant.id)}</span>;
    }
    if (participant.kind === "npc") {
      return <span className={`npc-number-badge ${participant.side} ${compact ? "compact" : ""}`}>{npcNumbers.get(participant.id)}</span>;
    }
    return <span className={`emoji-glyph ${compact ? "compact" : ""}`}>{safeEmoji(character?.emoji, "◆")}</span>;
  }

  function targetOptionLabel(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (participant.kind === "enemy") return `🔴 ${enemyNumbers.get(participant.id) ?? "?"} · ${participant.name}`;
    if (participant.kind === "npc") return `${participant.side === "party" ? "🟦" : "🟥"} ${npcNumbers.get(participant.id) ?? "?"} · ${participant.name}`;
    return `${safeEmoji(character?.emoji, "◆")} ${character?.name ?? participant.name}`;
  }

  function chatCombatantName(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (character) return `${safeEmoji(character.emoji, "◆")}${character.name}`;
    return `${participant.kind === "enemy" || participant.side === "opposition" ? "🔴" : "🟦"}${participant.name}`;
  }

  function scrollToDeclaration(participantId: string) {
    setShowIncapacitatedCombatants(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(`combatant-${participantId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  function segmentCombatantName(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (character) return <CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink>;
    if (participant.kind === "enemy") return <button className="segment-combatant-link" type="button" title={`Show ${participant.name} in declarations`} onClick={() => scrollToDeclaration(participant.id)}>{participant.name}</button>;
    return <strong>{participant.name}</strong>;
  }

  function participantHp(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    const current = character?.currentHp ?? participant.currentHp;
    const temporary = Math.max(0, participant.temporaryDamage ?? 0);
    return character
      ? { current, maximum: character.maxHp, temporary, effective: current - temporary }
      : { current, maximum: Math.max(0, participant.maxHp), temporary, effective: current - temporary };
  }

  function combatHpDisplay(participant: SegmentedParticipant) {
    const hp = participantHp(participant);
    return participant.kind === "enemy"
      ? <MonsterHpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showValues={viewerHasGmPermissions} />
      : <HpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showTemporaryValue={viewerHasGmPermissions} compact />;
  }

  function isDefeatedForInitiative(participant: SegmentedParticipant) {
    const hp = participantHp(participant).effective;
    return participant.kind === "enemy" ? hp <= 0 : hp <= -10;
  }

  function equippedWeapon(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    if (!character) return undefined;
    if (participant.action === "brawl") return characterWeapon(character, "unarmed");
    const weapon = characterWeapon(character, participant.equippedWeaponId ?? character.equippedWeaponId);
    return usesUnarmedDamage(character, weapon?.id) ? characterWeapon(character, "unarmed") : weapon;
  }

  function strengthCombatModifier(character: CampaignState["characters"][number], key: "melee-hit" | "damage") {
    return numericModifier(derivedAbilityItems(0, character.stats[0], character.exceptionalStrength).find((item) => item.key === key)?.value);
  }

  function dexterityHitModifier(character: CampaignState["characters"][number]) {
    return numericModifier(derivedAbilityItems(1, character.stats[1]).find((item) => item.key === "missile-hit")?.value);
  }

  function dexterityArmorModifier(character: CampaignState["characters"][number]) {
    return numericModifier(derivedAbilityItems(1, character.stats[1]).find((item) => item.key === "ac")?.value);
  }

  function effectiveArmorClass(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    const condition = conditionRuleFor(participant);
    let armorClass = character?.armorClass ?? participant.armorClass ?? 10;
    if (character && handStateHasShield(character.handState) && !String(character.equippedWeaponId ?? "").startsWith("inventory:") && equippedWeapon(participant)?.category === "melee" && !condition.disablesShieldAndDexterity) armorClass += 1;
    if (character && condition.disablesShieldAndDexterity) armorClass -= Math.max(0, dexterityArmorModifier(character));
    if (character && conditionsForParticipant(participant).some((effect) => effect.remainingRounds > 0 && effect.name === "Feet clutched")) armorClass -= Math.max(0, dexterityArmorModifier(character));
    armorClass += condition.armorClass;
    if ((participant.action === "parry" || participant.action === "parry-disengage") && character) {
      const weapon = equippedWeapon(participant);
      armorClass += Math.max(0, strengthCombatModifier(character, "melee-hit"));
      armorClass += Math.max(0, weapon?.attackBonus ?? 0);
    }
    return armorClass;
  }

  function attackModifierFor(participant: SegmentedParticipant, event?: SegmentEvent) {
    const character = participantCharacter(participant);
    const conditionAdjustment = conditionRuleFor(participant).attack;
    if (!character) return (participant.kind === "enemy"
      ? monsterAttackBonus(participant.hitDice) ?? 0
      : participant.attackBonus ?? 0) + conditionAdjustment;
    const weapon = participant.action === "brawl" ? undefined : equippedWeapon(participant);
    const twoWeaponAdjustment = event?.twoWeaponPenalty
      ? Math.min(0, dexterityHitModifier(character) + event.twoWeaponPenalty)
      : 0;
    const ability = event?.twoWeaponPenalty
      ? strengthCombatModifier(character, "melee-hit") + twoWeaponAdjustment
      : rangedActions.has(participant.action)
      ? dexterityHitModifier(character)
      : strengthCombatModifier(character, "melee-hit");
    const training = getWeaponTrainingState(character, weapon);
    const specialized = !event?.twoWeaponPenalty && participant.action !== "hand-2-melee" && participant.action !== "two-weapon-melee" && training.specialized;
    const proficiencyAdjustment = weapon && weapon.id !== "unarmed" && !training.proficient ? getNonProficiencyPenalty(character) : 0;
    const actionBonus = (participant.action === "charge" ? 2 : 0) + (specialized ? 1 : 0);
    return character.toHit + ability + (weapon?.attackBonus ?? 0) + actionBonus + proficiencyAdjustment + conditionAdjustment;
  }

  function damageBonusFor(participant: SegmentedParticipant, event: SegmentEvent) {
    const character = participantCharacter(participant);
    if (!character) return 0;
    const weaponAttack = isAttackEvent(event, participant);
    const strengthApplies = meleeActions.has(participant.action) || participant.action === "close-hurl";
    const weapon = participant.action === "brawl" ? undefined : equippedWeapon(participant);
    const specialized = weaponAttack && !event.twoWeaponPenalty && participant.action !== "hand-2-melee" && participant.action !== "two-weapon-melee" && getWeaponTrainingState(character, weapon).specialized;
    const equipmentBonus = weaponAttack ? weaponEquipmentBonus(weapon) : 0;
    const retainedWeaponDamage = weaponAttack && tracker.houseRuleHitDieDamage ? weaponDamageBonus(weapon?.damage ?? "") : 0;
    return (weaponAttack && strengthApplies ? strengthCombatModifier(character, "damage") : 0) + (specialized ? 2 : 0) + equipmentBonus + retainedWeaponDamage + conditionRuleFor(participant).damage;
  }

  function houseRuleDamageFormula(participant: SegmentedParticipant, event: SegmentEvent) {
    const character = participantCharacter(participant);
    if (!character || !tracker.houseRuleHitDieDamage || !isAttackEvent(event, participant)) return null;
    const bonus = damageBonusFor(participant, event);
    const weapon = equippedWeapon(participant);
    const base = participant.action === "brawl" || usesUnarmedDamage(character, weapon?.id) ? "1d2" : singleHitDieExpression(character.hitDice);
    return `${base}${bonus ? signed(bonus) : ""}`;
  }

  function isHostileActor(participant: SegmentedParticipant) {
    return participant.kind === "enemy" || (participant.kind === "npc" && participant.side === "opposition");
  }

  function defaultDamageExpression(participant: SegmentedParticipant, target?: SegmentedParticipant) {
    if (participant.action === "brawl") return "1d2";
    const character = participantCharacter(participant);
    const weapon = equippedWeapon(participant);
    if (character && usesUnarmedDamage(character, weapon?.id)) return "1d2";
    if (character && tracker.houseRuleHitDieDamage) return singleHitDieExpression(character.hitDice);
    if (character && target) return getWeaponDamageForTarget(activeWeaponRules(participant), target, weapon?.damage.trim() || participant.damageExpression.trim());
    return weapon?.damage.trim() || participant.damageExpression.trim();
  }

  function defaultResolution(event: SegmentEvent, participant: SegmentedParticipant): CombatEventResolution {
    const actor = eventActor(participant, event);
    const target = tracker.participants.find((entry) => entry.id === (event.targetId ?? participant.targetId));
    return {
      eventKey: resolutionKey(event),
      targetId: event.targetId ?? participant.targetId,
      attackRoll: null,
      attackModifier: attackModifierFor(eventActor(participant, event), event) + (event.freeAttackBonus ?? 0),
      targetArmorClass: null,
      requiredRoll: null,
      hit: null,
      automaticHit: false,
      headshotRoll: null,
      headshot: false,
      damageExpression: event.damageExpression?.trim() || defaultDamageExpression(actor, target),
      damageRoll: null,
      damageTotal: null,
      damageApplied: false,
      forcedSave: null,
      saveRoll: null,
      saveTarget: null,
      saveModifier: 0,
      saveSuccess: null,
      areaDamage: [],
    };
  }

  function updateResolution(participant: SegmentedParticipant, event: SegmentEvent, patch: Partial<CombatEventResolution>, skipPermissionCheck = false) {
    const key = resolutionKey(event);
    if (!skipPermissionCheck && !authorizeCombatant(participant.id)) return;
    setCampaign((current) => ({
      ...current,
      segmentedInitiative: {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.map((entry) => {
          if (entry.id !== participant.id) return entry;
          const existing = entry.resolutions[key] ?? defaultResolution(event, entry);
          return { ...entry, resolutions: { ...entry.resolutions, [key]: { ...existing, ...patch } } };
        }),
      },
    }));
  }

  function engagementTarget(participant: SegmentedParticipant, event: SegmentEvent) {
    return tracker.participants.find((entry) => entry.id === (event.targetId ?? participant.targetId));
  }

  function eventEstablishesEngagement(participant: SegmentedParticipant, event: SegmentEvent) {
    return participant.action === "close"
      || (participant.action === "charge" && event.key === "charge-attack")
      || (participant.action === "close-hurl" && event.key === "close-hurl-attack");
  }

  function engageAtResolution(participant: SegmentedParticipant, event: SegmentEvent, override = false) {
    if (!authorizeCombatant(participant.id, override) || !eventEstablishesEngagement(participant, event)) return;
    const target = engagementTarget(participant, event);
    if (!target || target.side === participant.side || !participantIsConscious({ ...participant, currentHp: participantHp(participant).effective }) || !participantIsConscious({ ...target, currentHp: participantHp(target).effective })) return;
    updateTracker({ engagements: establishEngagement(tracker.engagements, participant.id, target.id, tracker.round) });
    sendChatAction({ kind: "combat-result", content: `⚔ ${chatCombatantName(participant)} engages ${chatCombatantName(target)} in segment ${event.segment}.` });
  }

  function engageButton(participant: SegmentedParticipant, event: SegmentEvent, restricted: boolean) {
    if (!eventEstablishesEngagement(participant, event)) return null;
    const target = engagementTarget(participant, event);
    const engaged = Boolean(target && engagedOpponentIds(tracker.engagements, participant.id).includes(target.id));
    return <button className="secondary-button engage-resolution-button" type="button" disabled={!target || engaged} aria-disabled={restricted || undefined} onClick={(clickEvent) => engageAtResolution(participant, event, clickEvent.ctrlKey)}>{engaged ? "ENGAGED" : "ENGAGE"}</button>;
  }

  function requiredRollForAttack(participant: SegmentedParticipant, event: SegmentEvent, target: SegmentedParticipant) {
    const actor = eventActor(participant, event);
    return requiredAttackD20({
      armorClass: effectiveArmorClass(target),
      baseModifier: attackModifierFor(actor, event) + (event.freeAttackBonus ?? 0) + getWeaponVsArmorModifier(activeWeaponRules(actor), target, campaign, rangedActions.has(participant.action)),
      manualModifier: participant.manualHitModifier,
      automaticHit: conditionRuleFor(target).helpless,
    });
  }

  function rollAttack(participant: SegmentedParticipant, event: SegmentEvent, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    if (missileResolutionBlocked(participant)) return;
    const actor = eventActor(participant, event);
    const resolution = participant.resolutions[resolutionKey(event)] ?? defaultResolution(event, actor);
    let target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    if (!target) return;
    const originalTarget = target;
    let armorClass = effectiveArmorClass(target);
    const originalArmorClass = armorClass;
    const ranged = rangedActions.has(participant.action);
    const weaponRules = activeWeaponRules(actor);
    const attackerCharacter = participantCharacter(actor);
    if (ranged && weaponRules?.missileMode === "projectile" && attackerCharacter && ammoShotsForCharacter(campaign.inventoryManagement, attackerCharacter.id) <= 0) {
      updateParticipant(participant.id, { statusNote: "No Ammo available." }, true);
      return;
    }
    const armorMatchup = getWeaponVsArmorModifier(weaponRules, target, campaign, ranged);
    const baseModifier = attackModifierFor(actor, event) + (event.freeAttackBonus ?? 0) + armorMatchup;
    const automaticHit = conditionRuleFor(target).helpless;
    const roll = automaticHit ? 0 : rollD20();
    const resolvedRoll = resolvedAttackD20(roll);
    const manualHit = parseManualCombatModifier(participant.manualHitModifier);
    const finalAttackTotal = applyManualCombatModifier(resolvedRoll + baseModifier, participant.manualHitModifier);
    const modifier = finalAttackTotal - resolvedRoll;
    const required = armorClass - modifier;
    const ordinaryHit = attackHitsAscendingArmor({ roll, attackModifier: modifier, armorClass, automaticHit });
    const unhelmedHeadshotEligible = canCheckUnhelmedHeadshot({ targetIsEnemy: target.kind === "enemy", armoredHead: target.armoredHead, ascendingArmorClass: armorClass, attackRoll: roll, attackTotal: finalAttackTotal, ordinaryHit, automaticHit });
    const headshotRoll = unhelmedHeadshotEligible ? rollD6() : null;
    const headshot = headshotRoll === 1;
    let hit = ordinaryHit || headshot;
    let strayOutcome: "" | "wide" | "stray" = "";
    if (!hit && ranged) {
      if (secureRandomFloat() < 0.5) strayOutcome = "wide";
      else {
        const candidateIds = connectedEngagementClusterIds(tracker.engagements, target.id);
        const candidates = tracker.participants.filter((entry) => candidateIds.includes(entry.id)
          && entry.id !== participant.id
          && entry.id !== target?.id
          && !conditionsForParticipant(entry).some((effect) => effect.remainingRounds > 0 && effect.name === "Dead")
          && participantIsConscious({ ...entry, currentHp: participantHp(entry).effective }));
        const strayTarget = candidates[secureRandomIndex(candidates.length)];
        if (strayTarget) {
          target = strayTarget;
          armorClass = effectiveArmorClass(strayTarget);
          // A collateral shot keeps the original d20 and attack modifier. It
          // is resolved against the new target's AC; it is not an automatic hit.
          hit = attackHitsAscendingArmor({ roll, attackModifier: modifier, armorClass, automaticHit: false });
          strayOutcome = "stray";
        } else strayOutcome = "wide";
      }
    }
    const attackerName = chatCombatantName(participant);
    const targetName = chatCombatantName(target);
    const weapon = equippedWeapon(actor);
    const attackInstrument = attackInstrumentLabel(actor, weapon);
    const abilityLabel = ranged ? "DEX" : "STR";
    const abilityBonus = attackerCharacter ? (ranged ? dexterityHitModifier(attackerCharacter) : strengthCombatModifier(attackerCharacter, "melee-hit")) : 0;
    const training = attackerCharacter ? getWeaponTrainingState(attackerCharacter, weapon) : null;
    const specialized = Boolean(training?.specialized) && !event.twoWeaponPenalty && actor.action !== "hand-2-melee" && actor.action !== "two-weapon-melee";
    const proficiencyAdjustment = attackerCharacter && weapon && weapon.id !== "unarmed" && !training?.proficient ? getNonProficiencyPenalty(attackerCharacter) : 0;
    const actionBonus = actor.action === "charge" ? 2 : 0;
    const conditionBonus = conditionRuleFor(participant).attack;
    const attackMath = attackerCharacter
      ? [`d20 [${markedNaturalRoll(roll)}]`, roll === 20 ? "+5 natural" : "", `${abilityLabel} ${signed(abilityBonus)}`, event.twoWeaponPenalty ? `two-weapon ${signed(Math.min(0, dexterityHitModifier(attackerCharacter) + event.twoWeaponPenalty))}` : "", attackerCharacter.toHit ? `class ${signed(attackerCharacter.toHit)}` : "", weapon?.attackBonus ? `weapon ${signed(weapon.attackBonus)}` : "", proficiencyAdjustment ? `non-proficiency ${signed(proficiencyAdjustment)}` : "", specialized ? "specialization +1" : "", actionBonus ? "charge +2" : "", conditionBonus ? `conditions ${signed(conditionBonus)}` : "", armorMatchup ? `armour matchup ${signed(armorMatchup)}` : "", manualHit.normalized !== "+0" ? `manual ${manualHit.normalized}` : ""].filter(Boolean).join(" · ")
      : [`d20 [${markedNaturalRoll(roll)}]`, `attack ${signed(attackModifierFor(actor, event))}`, armorMatchup ? `armour matchup ${signed(armorMatchup)}` : "", manualHit.normalized !== "+0" ? `manual ${manualHit.normalized}` : ""].filter(Boolean).join(" · ");
    const freeAttackText = event.freeAttackBonus ? ` · disengage +${event.freeAttackBonus}` : "";
    updateResolution(participant, event, {
      targetId: target.id,
      attackRoll: roll,
      attackModifier: modifier,
      targetArmorClass: armorClass,
      requiredRoll: required,
      hit,
      automaticHit,
      missileMissOutcome: strayOutcome || null,
      missileOriginalTargetId: strayOutcome ? originalTarget.id : null,
      headshotRoll,
      headshot,
      damageExpression: event.damageExpression?.trim() || defaultDamageExpression(participant, target),
      damageRoll: null,
      damageTotal: null,
      damageApplied: false,
    }, true);
    setCampaign((current) => {
      const blank = { damageDealt: 0, damageReceived: 0, attacks: 0, attacksMissedAgainst: 0, savesSucceeded: 0, savesFailed: 0, moves: 0, currentHitStreak: 0, longestHitStreak: 0 };
      const attacker = current.segmentedInitiative.combatTallies[participant.id] ?? blank;
      const defender = current.segmentedInitiative.combatTallies[target.id] ?? blank;
      const streak = hit ? attacker.currentHitStreak + 1 : 0;
      const meleeAttack = isMeleeAction(participant.action) || Boolean(event.freeAttackBonus);
      const attackerStillConscious = current.segmentedInitiative.participants.find((entry) => entry.id === participant.id);
      const targetStillConscious = current.segmentedInitiative.participants.find((entry) => entry.id === target.id);
      const canEngage = meleeAttack && attackerStillConscious && targetStillConscious && participantIsConscious(attackerStillConscious) && participantIsConscious(targetStillConscious);
      let next: CampaignState = { ...current, segmentedInitiative: { ...current.segmentedInitiative, engagements: canEngage ? establishEngagement(current.segmentedInitiative.engagements, participant.id, target.id, current.segmentedInitiative.round) : current.segmentedInitiative.engagements, combatTallies: { ...current.segmentedInitiative.combatTallies, [participant.id]: { ...attacker, attacks: attacker.attacks + 1, currentHitStreak: streak, longestHitStreak: Math.max(attacker.longestHitStreak, streak) }, [target.id]: { ...defender, attacksMissedAgainst: defender.attacksMissedAgainst + (hit ? 0 : 1) } } } };
      if (ranged && weaponRules?.missileMode === "projectile" && attackerCharacter) {
        const consumed = consumeAmmoShotForCharacter(current.inventoryManagement, attackerCharacter.id);
        if (consumed.consumed) next = { ...next, inventoryManagement: consumed.state };
      }
      if (ranged && attackerCharacter && weaponIsThrown(weapon)) {
        const owner = current.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === attackerCharacter.id);
        const quick = owner && current.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
        const source = quick && (current.inventoryManagement.stacks.find((stack) => stack.id === weapon?.sourceInventoryStackId && stack.containerId === quick.id)
          ?? current.inventoryManagement.stacks.find((stack) => stack.containerId === quick.id && stack.equipment?.kind === "weapon" && (stack.equipment.weaponRulesId === weapon?.weaponRulesId || stack.name === weapon?.name)));
        if (source) {
          const thrown = throwOneStackToGround(current.inventoryManagement, source.id);
          if (thrown.moved) next = syncPhysicalEquipment({ ...next, inventoryManagement: thrown.state });
        }
      }
      return next;
    });
      sendChatAction({
      kind: "combat-result",
      content: strayOutcome === "stray"
        ? `${hit ? "✅" : "❌"} STRAY SHOT — ${attackerName} misses ${chatCombatantName(originalTarget)} with ${attackInstrument}, then ${hit ? "hits" : "misses"} ${targetName} with the same roll\nAttack — ${attackMath}${freeAttackText} = ${finalAttackTotal} vs AC ${armorClass}\nRESULT — ORIGINAL MISS · stray target ${hit ? "hit" : "miss"} · no second attack roll`
        : automaticHit
        ? `✅ AUTOMATIC HIT — ${attackerName} attacks helpless ${targetName} with ${attackInstrument}`
        : headshot
        ? `🎯 HEADSHOT! — ${attackerName} strikes ${targetName}'s unhelmed head with ${attackInstrument}\nAttack — ${attackMath}${freeAttackText} = ${finalAttackTotal} vs AC ${armorClass}\nRESULT — HEADSHOT · damage applies`
        : `${hit ? "✅ HIT" : "❌ MISS"} — ${attackerName} attacks ${targetName} with ${attackInstrument}\nAttack — ${attackMath}${freeAttackText} = ${finalAttackTotal} vs AC ${armorClass}\nRESULT — ${hit ? "HIT" : "MISS"}${roll === 1 ? " · natural 1" : ""}${strayOutcome === "wide" ? "\nSHOT GOES WIDE." : ""}`,
      rollDetail: strayOutcome === "stray" ? `d20 ${roll}; modifier ${signed(modifier)}; original AC ${originalArmorClass}; original miss; stray target AC ${armorClass}; ${hit ? "hit" : "miss"} without a second roll` : automaticHit ? `Automatic hit against helpless ${target.name}` : headshot ? `d20 ${roll}${roll === 20 ? "+5" : ""}; modifier ${signed(modifier)}; AC ${armorClass}; headshot hit` : `d20 ${roll}${roll === 20 ? "+5" : ""}; modifier ${signed(modifier)}${armorMatchup ? `; armour matchup ${signed(armorMatchup)}` : ""}; resolved ${resolvedRoll + modifier}; AC ${armorClass}; required ${required}+`,
      tone: isHostileActor(participant) ? "hostile" : undefined,
    });
  }

  useEffect(() => {
    const controls = selectedSegmentEvents.flatMap((event) => {
      const participant = tracker.participants.find((entry) => entry.id === event.participantId);
      if (!participant?.characterId || !isAttackEvent(event, participant)) return [];
      const target = tracker.participants.find((entry) => entry.id === (event.targetId ?? participant.targetId));
      const required = target ? requiredRollForAttack(participant, event, target) : null;
      return [{ characterId: participant.characterId, participantId: participant.id, eventKey: event.key, label: `ROLL ATTACK [${required ?? "—"}]`, disabled: !target || missileResolutionBlocked(participant) }];
    });
    publishAttackControls(controls);
    return () => publishAttackControls([]);
  });

  useEffect(() => subscribeAttackRequests(({ participantId, eventKey }) => {
    const participant = tracker.participants.find((entry) => entry.id === participantId);
    const event = selectedSegmentEvents.find((entry) => entry.participantId === participantId && entry.key === eventKey);
    if (participant && event) rollAttack(participant, event);
  }));

  function rollDamage(participant: SegmentedParticipant, event: SegmentEvent, adjustment = 0, multiplier = 1, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const key = resolutionKey(event);
    const resolution = participant.resolutions[key] ?? defaultResolution(event, participant);
    const actor = eventActor(participant, event);
    const character = participantCharacter(actor);
    const weapon = equippedWeapon(actor);
    const target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    const setAgainstCharge = actor.action === "set-charge" && target?.action === "charge" && Boolean(activeWeaponRules(actor)?.canSetVsCharge);
    const ruleMultiplier = setAgainstCharge ? 2 : 1;
    const houseExpression = isAttackEvent(event, participant) && character && tracker.houseRuleHitDieDamage
      ? actor.action === "brawl" || usesUnarmedDamage(character, weapon?.id) ? "1d2" : singleHitDieExpression(character.hitDice)
      : "";
    const expression = houseExpression || resolution.damageExpression.trim() || defaultDamageExpression(actor, target);
    if (!looksLikeDice(expression)) return updateResolution(participant, event, { damageExpression: expression }, true);
    try {
      const rolled = evaluateDiceExpression(expression)[0];
      const damageBonus = damageBonusFor(actor, event);
      const attackDamage = isAttackEvent(event, participant)
        ? applyManualCombatModifier(rolled.total + damageBonus + adjustment, participant.manualDamageModifier)
        : rolled.total + damageBonus + adjustment;
      const total = Math.max(0, Math.floor(attackDamage * multiplier * ruleMultiplier));
      const attackerCharacter = participantCharacter(participant);
      const strengthDamageApplies = meleeActions.has(actor.action) || actor.action === "close-hurl";
      const strengthBonus = attackerCharacter && strengthDamageApplies ? strengthCombatModifier(attackerCharacter, "damage") : 0;
      const specialized = Boolean(attackerCharacter && !event.twoWeaponPenalty && actor.action !== "hand-2-melee" && actor.action !== "two-weapon-melee" && getWeaponTrainingState(attackerCharacter, weapon).specialized);
      const equipmentBonus = attackerCharacter ? weaponEquipmentBonus(weapon) : 0;
      const retainedWeaponDamage = attackerCharacter && tracker.houseRuleHitDieDamage ? weaponDamageBonus(weapon?.damage ?? "") : 0;
      const conditionBonus = conditionRuleFor(participant).damage;
      const manualDamage = parseManualCombatModifier(participant.manualDamageModifier);
      const damageMath = attackerCharacter
        ? [`weapon ${expression}`, `roll ${rolled.lines.join(" · ")}`, strengthDamageApplies && strengthBonus ? `STR ${signed(strengthBonus)}` : "", specialized ? "specialization +2" : "", equipmentBonus ? `weapon bonus ${signed(equipmentBonus)}` : "", retainedWeaponDamage ? `weapon add ${signed(retainedWeaponDamage)}` : "", conditionBonus ? `conditions ${signed(conditionBonus)}` : "", adjustment ? `adjustment ${signed(adjustment)}` : "", isAttackEvent(event, participant) && manualDamage.normalized !== "+0" ? `manual ${manualDamage.normalized}` : "", setAgainstCharge ? "set vs charge ×2" : "", multiplier !== 1 ? `×${multiplier}` : ""].filter(Boolean).join(" · ")
        : [expression, isAttackEvent(event, participant) && manualDamage.normalized !== "+0" ? `manual ${manualDamage.normalized}` : ""].filter(Boolean).join(" · ");
      updateResolution(participant, event, { damageExpression: expression, damageRoll: rolled.total, damageTotal: total, damageApplied: false }, true);
      sendChatAction({ kind: "combat-result", content: `🎲 ${chatCombatantName(participant)}${target ? ` → ${chatCombatantName(target)}` : ""} damage\nDamage — ${damageMath}${damageBonus ? ` = ${rolled.total} ${signed(damageBonus)}` : ` = ${rolled.total}`}\nTOTAL — ${total} damage`, rollDetail: `${expression} = ${rolled.total}; total ${total}`, tone: isHostileActor(participant) ? "hostile" : undefined });
    } catch {
      updateParticipant(participant.id, { statusNote: "Enter damage such as 1d8+2, 2d6, or d4*2." }, true);
    }
  }

  function rollAttackGroupDamage(participant: SegmentedParticipant, event: SegmentEvent, hitCount: number, override = false) {
    if (!authorizeCombatant(participant.id, override) || hitCount < 1) return;
    const resolution = participant.resolutions[resolutionKey(event)] ?? defaultResolution(event, participant);
    const character = participantCharacter(participant);
    const weapon = equippedWeapon(participant);
    const target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    const setAgainstCharge = participant.action === "set-charge" && target?.action === "charge" && Boolean(activeWeaponRules(participant)?.canSetVsCharge);
    const ruleMultiplier = setAgainstCharge ? 2 : 1;
    const houseExpression = character && tracker.houseRuleHitDieDamage
      ? participant.action === "brawl" || usesUnarmedDamage(character, weapon?.id) ? "1d2" : singleHitDieExpression(character.hitDice)
      : "";
    const expression = houseExpression || resolution.damageExpression.trim() || defaultDamageExpression(participant, target);
    if (!looksLikeDice(expression)) return updateResolution(participant, event, { damageExpression: expression }, true);
    try {
      const damageBonus = damageBonusFor(participant, event);
      const manualDamage = parseManualCombatModifier(participant.manualDamageModifier);
      const rolls = Array.from({ length: hitCount }, () => evaluateDiceExpression(expression)[0]);
      const totals = rolls.map((rolled) => Math.max(0, Math.floor(applyManualCombatModifier(rolled.total + damageBonus, participant.manualDamageModifier) * ruleMultiplier)));
      const total = totals.reduce((sum, value) => sum + value, 0);
      updateResolution(participant, event, { damageExpression: expression, damageRoll: rolls.reduce((sum, rolled) => sum + rolled.total, 0), damageTotal: total, damageApplied: false }, true);
      sendChatAction({
        kind: "combat-result",
        content: `🎲 ${chatCombatantName(participant)}${target ? ` → ${chatCombatantName(target)}` : ""} damage${hitCount > 1 ? ` · ${hitCount} hits` : ""}\n${rolls.map((rolled, index) => `Hit ${index + 1} — ${expression} = ${rolled.total}${damageBonus ? ` ${signed(damageBonus)}` : ""}${manualDamage.normalized !== "+0" ? ` · manual ${manualDamage.normalized}` : ""}${setAgainstCharge ? " ×2 set vs charge" : ""} = ${totals[index]}`).join("\n")}\nTOTAL — ${total} damage`,
        rollDetail: `${hitCount} hit${hitCount === 1 ? "" : "s"}; ${rolls.map((rolled) => `${expression} = ${rolled.total}`).join("; ")}; total ${total}`,
        tone: isHostileActor(participant) ? "hostile" : undefined,
      });
    } catch {
      updateParticipant(participant.id, { statusNote: "Enter damage such as 1d8+2, 2d6, or d4*2." }, true);
    }
  }

  function setParticipantHp(participantId: string, requested: number, skipPermissionCheck = false, override = false) {
    if (!skipPermissionCheck && !authorizeCombatant(participantId, override)) return;
    setCampaign((current) => {
      const participant = current.segmentedInitiative.participants.find((entry) => entry.id === participantId);
      if (!participant) return current;
      const character = participant.characterId ? current.characters.find((entry) => entry.id === participant.characterId) : undefined;
      const maximum = Math.max(0, character?.maxHp ?? participant.maxHp);
      const nextHp = Math.max(-10, requested);
      const currentAbsoluteSegment = (current.segmentedInitiative.round - 1) * 10 + current.segmentedInitiative.currentSegment;
      const spellStartSegment = participant.declarationRound === null || participant.scheduledSegment === null
        ? Number.POSITIVE_INFINITY
        : (participant.declarationRound - 1) * 10 + participant.scheduledSegment;
      const spellEffectSegment = spellStartSegment + Math.max(0, participant.castingTime - 1);
      const spellFizzles = requested < participant.currentHp
        && participant.action === "spell"
        && participant.castingTime > 0
        && !participant.completedEvents.includes("spell-complete")
        && current.segmentedInitiative.phase === "active"
        && currentAbsoluteSegment >= spellStartSegment
        && currentAbsoluteSegment <= spellEffectSegment;
      const mortal = participant.kind === "character" || participant.kind === "npc";
      const automaticAction: Partial<SegmentedParticipant> = !mortal ? {} : nextHp <= -10 ? {
        action: "skip",
        actionDetail: "",
        targetId: null,
        targetIds: [],
        statusNote: "EXSANGUINATED",
        ready: true,
      } : nextHp < 0 ? {
        action: "die",
        actionDetail: "Lose 1 HP this round",
        targetId: null,
        targetIds: [],
        statusNote: "Dying",
        ready: true,
      } : nextHp === 0 ? {
        action: "unconscious",
        actionDetail: "",
        targetId: null,
        targetIds: [],
        statusNote: "Unconscious",
        ready: true,
      } : participant.action === "die" || participant.action === "unconscious" ? {
        action: "",
        actionDetail: "",
        statusNote: "",
        ready: false,
      } : {};
      const unconsciousEffect = current.segmentedInitiative.effects.find((effect) => effect.participantId === participantId && effect.name === "Unconscious");
      const effects = mortal && nextHp <= 0 && nextHp > -10
        ? unconsciousEffect
          ? current.segmentedInitiative.effects.map((effect) => effect.id === unconsciousEffect.id ? { ...effect, remainingRounds: Math.max(1, effect.remainingRounds) } : effect)
          : [...current.segmentedInitiative.effects, { id: id(), name: "Unconscious", target: participant.name, participantId, description: "Cannot take voluntary actions while at 0 or negative HP.", remainingRounds: 1 }]
        : current.segmentedInitiative.effects.filter((effect) => !(effect.participantId === participantId && effect.name === "Unconscious"));
      if (participant.kind === "enemy" && participant.currentHp > 0 && nextHp <= 0) {
        const enemies = current.segmentedInitiative.participants.filter((entry) => entry.kind === "enemy");
        const leader = [...enemies].sort((a, b) => b.maxHp - a.maxHp)[0];
        const defeatedAfter = enemies.filter((entry) => entry.id === participantId || entry.currentHp <= 0).length;
        if (leader?.id === participantId) setMoraleReminder(`Morale reminder — ${participant.name}, the highest-HP enemy leader, has fallen. Check morale.`);
        else if (enemies.length > 1 && defeatedAfter * 2 >= enemies.length) setMoraleReminder(`Morale reminder — ${defeatedAfter} of ${enemies.length} enemies are defeated. Check morale.`);
      }
      return {
        ...current,
        characters: current.characters.map((entry) => entry.id === character?.id ? {
          ...entry,
          currentHp: nextHp,
          spellSlots: spellFizzles && participant.preparedSpellSlotId
            ? entry.spellSlots.map((slot) => slot.id === participant.preparedSpellSlotId ? { ...slot, expended: true } : slot)
            : entry.spellSlots,
        } : entry),
        stableNpcs: participant.stableNpcId ? current.stableNpcs.map((entry) => entry.id === participant.stableNpcId ? { ...entry, currentHp: nextHp } : entry) : current.stableNpcs,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          engagements: nextHp <= 0
            ? removeEngagement(current.segmentedInitiative.engagements, participantId)
            : current.segmentedInitiative.engagements,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participantId ? {
            ...entry,
            currentHp: nextHp,
            maxHp: maximum,
            ...automaticAction,
            completedEvents: spellFizzles ? Array.from(new Set([...entry.completedEvents, "spell-complete"])) : entry.completedEvents,
            statusNote: spellFizzles ? "Spell fizzled by damage · slot expended" : automaticAction.statusNote ?? entry.statusNote,
          } : entry),
          effects,
        },
      };
    });
  }

  function adjustParticipantTemporaryDamage(participantId: string, amount: number, override = false) {
    if (!authorizeCombatant(participantId, override)) return;
    setCampaign((current) => {
      const participant = current.segmentedInitiative.participants.find((entry) => entry.id === participantId);
      if (!participant || (amount > 0 && participant.unarmedOverrides?.immuneTemporaryDamage)) return current;
      const character = participant.characterId ? current.characters.find((entry) => entry.id === participant.characterId) : undefined;
      const realHp = character?.currentHp ?? participant.currentHp;
      const previousTemporary = Math.max(0, participant.temporaryDamage ?? 0);
      const nextTemporary = Math.max(0, previousTemporary + amount);
      if (nextTemporary === previousTemporary) return current;
      const wasTemporaryKo = realHp > 0 && realHp - previousTemporary <= 0;
      const temporaryKo = realHp > 0 && realHp - nextTemporary <= 0;
      const temporaryEffect = current.segmentedInitiative.effects.find((effect) => effect.participantId === participantId && effect.name === "Unconscious" && effect.description.startsWith("Unconscious from Temporary Damage"));
      let effects = current.segmentedInitiative.effects;
      if (temporaryKo && !effects.some((effect) => effect.participantId === participantId && effect.name === "Unconscious")) {
        effects = [...effects, { id: id(), name: "Unconscious", target: participant.name, participantId, description: "Unconscious from Temporary Damage; wakes automatically when effective HP rises above 0.", remainingRounds: 2 }];
      } else if (!temporaryKo && temporaryEffect) {
        effects = effects.filter((effect) => effect.id !== temporaryEffect.id);
      }
      const anotherUnconsciousEffect = effects.some((effect) => effect.participantId === participantId && effect.name === "Unconscious" && effect.remainingRounds > 0);
      const wakesFromTemporaryKo = wasTemporaryKo && !temporaryKo && !anotherUnconsciousEffect;
      return {
        ...current,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          effects,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participantId ? {
            ...entry,
            temporaryDamage: nextTemporary,
            ...(temporaryKo ? { action: "unconscious" as SegmentedAction, actionDetail: "", targetId: null, targetIds: [], statusNote: "Unconscious · Temporary Damage", ready: true }
              : wakesFromTemporaryKo ? { action: "" as SegmentedAction, actionDetail: "", statusNote: "", ready: false } : {}),
          } : entry),
        },
      };
    });
  }

  function announceHpAdjustment(target: SegmentedParticipant, amount: number) {
    const operations: CampaignOperation[] = [{
      type: "increment",
      path: ["segmentedInitiative", "participants", { id: target.id }, "currentHp"],
      amount,
      minimum: -10,
    }];
    if (target.characterId) operations.push({
      type: "increment",
      path: ["characters", { id: target.characterId }, "currentHp"],
      amount,
      minimum: -10,
    });
    if (target.stableNpcId) operations.push({
      type: "increment",
      path: ["stableNpcs", { id: target.stableNpcId }, "currentHp"],
      amount,
      minimum: -10,
    });
    announceCampaignOperations(operations);
  }

  function setParticipantMaxHp(participantId: string, requested: number) {
    if (!authorizeCombatant(participantId)) return;
    setCampaign((current) => {
      const participant = current.segmentedInitiative.participants.find((entry) => entry.id === participantId);
      if (!participant) return current;
      const character = participant.characterId ? current.characters.find((entry) => entry.id === participant.characterId) : undefined;
      const nextMaximum = Math.max(0, requested);
      return {
        ...current,
        characters: character ? current.characters.map((entry) => entry.id === character.id ? { ...entry, maxHp: nextMaximum } : entry) : current.characters,
        stableNpcs: participant.stableNpcId ? current.stableNpcs.map((entry) => entry.id === participant.stableNpcId ? { ...entry, maxHp: nextMaximum } : entry) : current.stableNpcs,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participantId ? { ...entry, maxHp: nextMaximum } : entry),
        },
      };
    });
  }

  function applyDamage(participant: SegmentedParticipant, event: SegmentEvent, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const key = resolutionKey(event);
    const resolution = participant.resolutions[key];
    const targetId = resolution?.targetId ?? event.targetId ?? participant.targetId;
    const target = tracker.participants.find((entry) => entry.id === targetId);
    if (!target || resolution?.damageTotal === null || resolution?.damageTotal === undefined || resolution.damageApplied) return;
    const hp = participantHp(target);
    announceHpAdjustment(target, -resolution.damageTotal);
    setParticipantHp(target.id, hp.current - resolution.damageTotal, true);
    updateResolution(participant, event, { damageApplied: true }, true);
    recordCombatTally(participant.id, { damageDealt: resolution.damageTotal });
    recordCombatTally(target.id, { damageReceived: resolution.damageTotal });
  }

  function targetSave(target: SegmentedParticipant, save: keyof SaveBlock) {
    const character = participantCharacter(target);
    return character?.saves[save] ?? monsterSaves(target.hitDice, target.nonIntelligent)[save];
  }

  function rollCombatantSave(combatant: SegmentedParticipant, save: keyof SaveBlock, override = false) {
    if (!authorizeCombatant(combatant.id, override)) return;
    const targetNumber = targetSave(combatant, save);
    const roll = rollD20();
    const modifier = conditionRuleFor(combatant).saves;
    const total = roll + modifier;
    const success = total >= targetNumber;
    const label = enemySaveLabels.find(([keyName]) => keyName === save)?.[1] ?? compactSaveLabels[save];
    sendChatAction({
      kind: "combat-result",
      content: `${success ? "✅ SAVE" : "❌ FAILED SAVE"} — ${chatCombatantName(combatant)}\n${label}: d20 [${roll}]${modifier ? ` ${signed(modifier)} = ${total}` : ""} vs ${targetNumber}+`,
      rollDetail: `d20 ${roll}; modifier ${signed(modifier)}; total ${total}; target ${targetNumber}+`,
      tone: isHostileActor(combatant) ? "hostile" : undefined,
    });
    recordCombatTally(combatant.id, success ? { savesSucceeded: 1 } : { savesFailed: 1 });
  }

  function combatantSaveTiles(combatant: SegmentedParticipant, role: "Attacker" | "Defender") {
    const modifier = conditionRuleFor(combatant).saves;
    const restricted = !canControlCombatant(combatIdentity, combatant) && !controlHeld;
    return <div className="segment-save-combatant">
      <span>{role} · {chatCombatantName(combatant)}</span>
      <div>{enemySaveLabels.map(([save]) => {
        const targetNumber = targetSave(combatant, save);
        return <button type="button" key={save} disabled={restricted} title={restricted ? "Hold Ctrl to override control restrictions" : `Roll ${compactSaveLabels[save]} save for ${combatant.name}${modifier ? ` · current modifier ${signed(modifier)}` : ""}`} onClick={() => rollCombatantSave(combatant, save)}><i aria-hidden="true">{saveIcons[save]}</i><small>{compactSaveLabels[save]}</small><b>{targetNumber}</b></button>;
      })}</div>
    </div>;
  }

  function forceSave(participant: SegmentedParticipant, event: SegmentEvent, save: keyof SaveBlock, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const key = resolutionKey(event);
    const resolution = participant.resolutions[key] ?? defaultResolution(event, participant);
    const target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    if (!target) return;
    const targetNumber = targetSave(target, save);
    const roll = rollD20();
    const modifier = conditionRuleFor(target).saves;
    const total = roll + modifier;
    const success = total >= targetNumber;
    updateResolution(participant, event, { targetId: target.id, forcedSave: save, saveRoll: roll, saveTarget: targetNumber, saveModifier: modifier, saveSuccess: success }, true);
    recordCombatTally(target.id, success ? { savesSucceeded: 1 } : { savesFailed: 1 });
    sendChatAction({ kind: "combat-result", content: `${success ? "✅ SAVE" : "❌ FAILED SAVE"} — ${chatCombatantName(target)}\n${enemySaveLabels.find(([keyName]) => keyName === save)?.[1] ?? save}: d20 [${roll}]${modifier ? ` ${signed(modifier)} = ${total}` : ""} vs ${targetNumber}+`, rollDetail: `d20 ${roll}; modifier ${signed(modifier)}; total ${total}; target ${targetNumber}+`, tone: isHostileActor(target) || (isHostileActor(participant) && target.side === "party") ? "hostile" : undefined });
  }

  function areaTargetsFor(participant: SegmentedParticipant) {
    return tracker.participants.filter((entry) => participant.targetIds.includes(entry.id));
  }

  function rollAreaDamage(participant: SegmentedParticipant, event: SegmentEvent, adjustment = 0, multiplier = 1, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const resolution = participant.resolutions[resolutionKey(event)] ?? defaultResolution(event, participant);
    const expression = resolution.damageExpression.trim();
    const targets = areaTargetsFor(participant);
    if (!looksLikeDice(expression)) return updateResolution(participant, event, { damageExpression: expression }, true);
    if (!targets.length) return;
    try {
      const results = targets.map((target) => {
        const rolled = evaluateDiceExpression(expression)[0];
        const total = Math.max(0, Math.floor((rolled.total + adjustment) * multiplier));
        return { target, rolled, total };
      });
      const effectName = participant.actionDetail || (participant.action === "spell-like-effect" ? "Spell-like effect" : "Spell");
      updateResolution(participant, event, {
        damageExpression: expression,
        areaDamage: results.map(({ target, rolled, total }) => ({ targetId: target.id, roll: rolled.total, total, applied: false })),
      }, true);
      sendChatAction({
        kind: "combat-result",
        content: `🌀 ${chatCombatantName(participant)} — ${effectName} (area effect)\n${results.map(({ target, rolled, total }) => `🎲 ${chatCombatantName(target)} — ${expression} · [${rolled.total}]\nTOTAL — ${total} damage`).join("\n")}`,
        rollDetail: results.map(({ target, rolled, total }) => `${target.name}: ${expression} = ${rolled.total}; total ${total}`).join(" | "),
        tone: isHostileActor(participant) ? "hostile" : undefined,
      });
    } catch {
      updateParticipant(participant.id, { statusNote: "Enter damage such as 1d8+2, 2d6, or d4*2." }, true);
    }
  }

  function applyAreaDamage(participant: SegmentedParticipant, event: SegmentEvent, targetId: string, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const key = resolutionKey(event);
    const resolution = participant.resolutions[key] ?? defaultResolution(event, participant);
    const result = (resolution.areaDamage ?? []).find((entry) => entry.targetId === targetId);
    const target = tracker.participants.find((entry) => entry.id === targetId);
    if (!result || result.applied || !target) return;
    announceHpAdjustment(target, -result.total);
    setParticipantHp(target.id, participantHp(target).current - result.total, true);
    updateResolution(participant, event, { areaDamage: (resolution.areaDamage ?? []).map((entry) => entry.targetId === targetId ? { ...entry, applied: true } : entry) }, true);
    recordCombatTally(participant.id, { damageDealt: result.total });
    recordCombatTally(target.id, { damageReceived: result.total });
  }

  function forceAreaSaves(participant: SegmentedParticipant, event: SegmentEvent, save: keyof SaveBlock, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const targets = areaTargetsFor(participant);
    if (!targets.length) return;
    const saveLabel = enemySaveLabels.find(([keyName]) => keyName === save)?.[1] ?? save;
    const results = targets.map((target) => {
      const targetNumber = targetSave(target, save);
      const roll = rollD20();
      const modifier = conditionRuleFor(target).saves;
      const total = roll + modifier;
      return { target, targetNumber, roll, modifier, total, success: total >= targetNumber };
    });
    updateResolution(participant, event, { forcedSave: save }, true);
    sendChatAction({
      kind: "combat-result",
      content: `🛡️ ${participant.actionDetail || "Area effect"} — ${saveLabel} saves\n${results.map(({ target, targetNumber, roll, modifier, total, success }) => `${success ? "✅ SAVE" : "❌ FAILED SAVE"} — ${chatCombatantName(target)} · d20 [${roll}]${modifier ? ` ${signed(modifier)} = ${total}` : ""} vs ${targetNumber}+`).join("\n")}`,
      rollDetail: results.map(({ target, roll, modifier, total, targetNumber }) => `${target.name}: d20 ${roll}; ${signed(modifier)}; ${total} vs ${targetNumber}+`).join(" | "),
      tone: isHostileActor(participant) ? "hostile" : undefined,
    });
  }

  function expendSpellSlot(participant: SegmentedParticipant) {
    if (!authorizeCombatant(participant.id)) return false;
    const character = participantCharacter(participant);
    const slotId = participant.preparedSpellSlotId;
    if (!character || !slotId) return false;
    const slot = character.spellSlots.find((entry) => entry.id === slotId && !entry.expended);
    if (!slot) return false;
    setCampaign((current) => ({
      ...current,
      characters: current.characters.map((entry) => entry.id === character.id ? {
        ...entry,
        spellSlots: entry.spellSlots.map((candidate) => candidate.id === slotId ? { ...candidate, expended: true } : candidate),
      } : entry),
    }));
    return true;
  }

  function completeWeaponSwitch(participant: SegmentedParticipant, event: SegmentEvent, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const completionKey = `switch:${resolutionKey(event)}`;
    if (participant.stableNpcId) {
      const rules = weaponRulesById(participant.pendingWeaponId);
      if (!rules || !(participant.weaponRulesIds ?? []).includes(rules.id)) return;
      setCampaign((current) => ({
        ...current,
        stableNpcs: current.stableNpcs.map((npc) => npc.id === participant.stableNpcId ? { ...npc, activeWeaponRulesId: rules.id, attackMode: "weapon", damageExpression: rules.damageSM } : npc),
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === participant.id ? {
            ...entry,
            weaponRulesId: rules.id,
            attackMode: "weapon",
            damageExpression: rules.damageSM,
            completedEvents: Array.from(new Set([...entry.completedEvents, completionKey])),
            statusNote: `${rules.name} readied`,
          } : entry),
        },
      }));
      sendChatAction({ kind: "combat-result", content: `🔄 ${participant.name} switches to ${rules.name}.` });
      return;
    }
    const character = participantCharacter(participant);
    if (!character) return;
    const currentOwner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const currentQuick = currentOwner && campaign.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === currentOwner.id);
    const requestedMainId = String(participant.pendingWeaponId ?? "").replace(/^inventory:/, "");
    const requestedOffhandId = String(participant.pendingOffhandWeaponId ?? "").replace(/^inventory:/, "");
    const requestedMain = campaign.inventoryManagement.stacks.find((stack) => stack.id === requestedMainId && stack.containerId === currentQuick?.id);
    const requestedOffhand = campaign.inventoryManagement.stacks.find((stack) => stack.id === requestedOffhandId && stack.containerId === currentQuick?.id);
    const mainTakesBoth = Boolean(requestedMain && stackRequiresBothHands(requestedMain, character));
    const offhandTakesBoth = Boolean(requestedOffhand && stackRequiresBothHands(requestedOffhand, character));
    const completedHandOne = mainTakesBoth ? `${requestedMain?.name} · two-handed` : offhandTakesBoth ? `${requestedOffhand?.name} · two-handed` : requestedMain?.name ?? "Empty";
    const completedHandTwo = mainTakesBoth ? `${requestedMain?.name} · two-handed` : offhandTakesBoth ? `${requestedOffhand?.name} · two-handed` : requestedOffhand?.name ?? "Empty";
    setCampaign((current) => {
      const owner = current.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
      const quick = owner && current.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id);
      const mainId = String(participant.pendingWeaponId ?? "").replace(/^inventory:/, "");
      const offhandId = String(participant.pendingOffhandWeaponId ?? "").replace(/^inventory:/, "");
      const mainStack = current.inventoryManagement.stacks.find((stack) => stack.id === mainId && stack.containerId === quick?.id);
      const offhandStack = current.inventoryManagement.stacks.find((stack) => stack.id === offhandId && stack.containerId === quick?.id);
      const currentCharacter = current.characters.find((entry) => entry.id === character.id) ?? character;
      const mainRequiresBoth = Boolean(mainStack && stackRequiresBothHands(mainStack, currentCharacter));
      const offhandRequiresBoth = Boolean(offhandStack && stackRequiresBothHands(offhandStack, currentCharacter));
      const resolvedMainId = mainRequiresBoth ? mainId : offhandRequiresBoth ? "" : mainId;
      const resolvedOffhandId = mainRequiresBoth ? "" : offhandId;
      const inventoryManagement = quick ? { ...current.inventoryManagement, stacks: current.inventoryManagement.stacks.map((stack) => stack.containerId !== quick.id ? stack : stack.id === resolvedMainId ? { ...stack, handSlot: "main" as const } : stack.id === resolvedOffhandId ? { ...stack, handSlot: "offhand" as const } : { ...stack, handSlot: null }) } : current.inventoryManagement;
      return syncPhysicalEquipment({ ...current, inventoryManagement, segmentedInitiative: { ...current.segmentedInitiative, participants: current.segmentedInitiative.participants.map((entry) => entry.id === participant.id ? { ...entry, completedEvents: Array.from(new Set([...entry.completedEvents, completionKey])), statusNote: `Hand 1: ${completedHandOne} · Hand 2: ${completedHandTwo}` } : entry) } });
    });
    sendChatAction({ kind: "combat-result", content: `🔄 ${safeEmoji(character.emoji, "◆")}${character.name} rearranges Quick Access — Hand 1: ${completedHandOne}; Hand 2: ${completedHandTwo}.` });
  }

  function eligibleFenders(attacker: SegmentedParticipant, defender: SegmentedParticipant) {
    return tracker.participants.filter((candidate) => {
      if (candidate.id === attacker.id || candidate.side !== defender.side) return false;
      if (!participantIsConscious({ ...candidate, currentHp: participantHp(candidate).effective })) return false;
      if (conditionRuleFor(candidate).cannotAttack) return false;
      if (participantIsGrappling(tracker.grappleHolds, candidate.id)) return false;
      if (conditionsForParticipant(candidate).some((effect) => effect.remainingRounds > 0 && effect.name === "Grappling")) return false;
      const character = participantCharacter(candidate);
      return character
        ? Boolean(heldWeaponForCategory(character, "melee"))
        : candidate.attackMode !== "weapon" || activeWeaponRules(candidate)?.weaponType === "melee";
    });
  }

  function startUnarmedResolution(participant: SegmentedParticipant, event: SegmentEvent, skipFending = false, followUpGrappleBonus = 0) {
    if (!authorizeCombatant(participant.id)) return;
    const target = tracker.participants.find((entry) => entry.id === (event.targetId ?? participant.targetId));
    const action = participant.action === "overbear" ? "overbear" : "grapple";
    if (!target) return;
    const fenders = skipFending ? [] : eligibleFenders(participant, target).map((entry) => entry.id);
    updateTracker({
      engagements: establishEngagement(tracker.engagements, participant.id, target.id, tracker.round),
      pendingUnarmed: {
        id: id(), eventKey: resolutionKey(event), attackerId: participant.id, defenderId: target.id, action,
        phase: fenders.length ? "fending" : "unarmed-hit", eligibleFenderIds: fenders, attemptedFenderIds: [], cancelledById: null,
        hitRoll: null, hitTarget: null, hitModifier: 0, hit: null, resultRoll: null, resultModifier: 0, adjustedResult: null,
        outcomeLabel: "", realDamage: 0, temporaryDamage: 0, followUpGrappleBonus, repeatCappedAtEight: false,
      },
    });
  }

  function fendingAttackModifier(fender: SegmentedParticipant, attacker: SegmentedParticipant) {
    const character = participantCharacter(fender);
    const weapon = character ? heldWeaponForCategory(character, "melee") : undefined;
    const base = character
      ? character.toHit
        + strengthCombatModifier(character, "melee-hit")
        + (weapon?.attackBonus ?? 0)
        + (getWeaponTrainingState(character, weapon).specialized ? 1 : 0)
        + (weapon && !getWeaponTrainingState(character, weapon).proficient ? getNonProficiencyPenalty(character) : 0)
      : fender.kind === "enemy" ? monsterAttackBonus(fender.hitDice) ?? 0 : fender.attackBonus ?? 0;
    return base + conditionRuleFor(fender).attack + getWeaponVsArmorModifier(participantAttackRules(fender, weapon), attacker, campaign, false);
  }

  function rollFend(fender: SegmentedParticipant) {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    if (!pending || pending.phase !== "fending" || !attacker || !pending.eligibleFenderIds.includes(fender.id) || pending.attemptedFenderIds.includes(fender.id)) return;
    if (!authorizeCombatant(fender.id)) return;
    const roll = rollD20();
    const modifier = fendingAttackModifier(fender, attacker);
    const armorClass = effectiveArmorClass(attacker);
    const hit = attackHitsAscendingArmor({ roll, attackModifier: modifier, armorClass, automaticHit: conditionRuleFor(attacker).helpless });
    updateTracker({ pendingUnarmed: { ...pending, attemptedFenderIds: [...pending.attemptedFenderIds, fender.id], cancelledById: hit ? fender.id : null, phase: hit ? "cancelled" : pending.phase } });
    sendChatAction({ kind: "combat-result", content: `${hit ? "🛡️ FEND — GRAB CANCELLED" : "❌ FEND MISSED"} — ${chatCombatantName(fender)} protects ${tracker.participants.find((entry) => entry.id === pending.defenderId)?.name ?? "the target"} from ${chatCombatantName(attacker)}\nAttack — d20 [${markedNaturalRoll(roll)}] ${signed(modifier)} = ${resolvedAttackD20(roll) + modifier} vs AC ${armorClass}\nRESULT — ${hit ? "HIT · no damage" : "MISS"}`, rollDetail: `Fend d20 ${roll}; modifier ${signed(modifier)}; AC ${armorClass}; ${hit ? "hit" : "miss"}` });
  }

  function continueAfterFending() {
    const pending = tracker.pendingUnarmed;
    if (!pending || pending.phase !== "fending") return;
    updateTracker({ pendingUnarmed: { ...pending, phase: "unarmed-hit" } });
  }

  function rollSpecialUnarmedHit() {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    const defender = pending && tracker.participants.find((entry) => entry.id === pending.defenderId);
    if (!pending || pending.phase !== "unarmed-hit" || pending.hit !== null || !attacker || !defender || !authorizeCombatant(attacker.id)) return;
    const pileOn = pileOnApplies(tracker.grappleHolds, attacker.id, defender.id);
    const breakdown = unarmedHitBreakdown({
      attacker: participantUnarmedArmor(attacker), defender: participantUnarmedArmor(defender),
      attackerDexterity: participantAbility(attacker, 1), attackerMove: participantMoveRate(attacker), defenderMove: participantMoveRate(defender),
      attackerWornAscendingAc: participantWornArmorAscendingAc(attacker), defenderWornAscendingAc: participantWornArmorAscendingAc(defender),
      attackerMagicArmorBonus: unarmedMagicArmorBonus(attacker), magicalArmorReduction: tracker.magicalArmorWrestling,
      conditionModifier: conditionRuleFor(attacker).attack,
    });
    const roll = rollD20();
    const hit = unarmedHitSucceeds(roll, breakdown.targetNumber, breakdown.modifier, pileOn);
    updateTracker({ pendingUnarmed: { ...pending, hitRoll: roll, hitTarget: breakdown.targetNumber, hitModifier: breakdown.modifier, hit, phase: hit ? "unarmed-hit" : "complete", outcomeLabel: hit ? "Inside the guard" : "Unarmed Hit missed" } });
    sendChatAction({ kind: "combat-result", content: `${hit ? "✅ UNARMED HIT" : "❌ UNARMED MISS"} — ${chatCombatantName(attacker)} → ${chatCombatantName(defender)}\nUnarmed Hit — d20 [${markedNaturalRoll(roll)}] ${signed(breakdown.modifier)} = ${roll + breakdown.modifier} vs TN ${breakdown.targetNumber}${pileOn ? " · pile-on succeeds except natural 1" : ""}\nRESULT — ${hit ? "HIT" : "MISS"}`, rollDetail: `Unarmed d20 ${roll}; modifier ${signed(breakdown.modifier)}; TN ${breakdown.targetNumber}; ${hit ? "hit" : "miss"}` });
  }

  function addUnarmedEffect(effects: CombatEffect[], participant: SegmentedParticipant, name: string, description: string, rounds = 2) {
    const existing = effects.find((effect) => effect.participantId === participant.id && effect.name === name);
    return existing
      ? effects.map((effect) => effect.id === existing.id ? { ...effect, remainingRounds: Math.max(effect.remainingRounds, rounds), description } : effect)
      : [...effects, { id: id(), name, target: participant.name, participantId: participant.id, description, remainingRounds: rounds }];
  }

  function applyUnarmedDamage(target: SegmentedParticipant, realDamage: number, temporaryDamage: number) {
    const immune = target.unarmedOverrides?.immuneTemporaryDamage;
    const temp = immune ? 0 : Math.max(0, temporaryDamage);
    setCampaign((current) => {
      const currentParticipant = current.segmentedInitiative.participants.find((entry) => entry.id === target.id);
      if (!currentParticipant) return current;
      const character = currentParticipant.characterId ? current.characters.find((entry) => entry.id === currentParticipant.characterId) : undefined;
      const realHp = character?.currentHp ?? currentParticipant.currentHp;
      const nextRealHp = Math.max(-10, realHp - Math.max(0, realDamage));
      const nextTemporary = Math.max(0, (currentParticipant.temporaryDamage ?? 0) + temp);
      const temporaryKo = nextRealHp - nextTemporary <= 0 && nextRealHp > 0;
      let effects = current.segmentedInitiative.effects;
      if (temporaryKo) effects = addUnarmedEffect(effects, currentParticipant, "Unconscious", "Unconscious from Temporary Damage; wakes automatically when effective HP rises above 0.", 2);
      return {
        ...current,
        characters: character ? current.characters.map((entry) => entry.id === character.id ? { ...entry, currentHp: nextRealHp } : entry) : current.characters,
        stableNpcs: currentParticipant.stableNpcId ? current.stableNpcs.map((entry) => entry.id === currentParticipant.stableNpcId ? { ...entry, currentHp: nextRealHp } : entry) : current.stableNpcs,
        segmentedInitiative: {
          ...current.segmentedInitiative,
          effects,
          participants: current.segmentedInitiative.participants.map((entry) => entry.id === target.id ? { ...entry, currentHp: nextRealHp, temporaryDamage: nextTemporary, ...(temporaryKo ? { action: "unconscious" as SegmentedAction, statusNote: "Unconscious · Temporary Damage", ready: true } : {}) } : entry),
        },
      };
    });
  }

  function rollUnarmedResult() {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    const defender = pending && tracker.participants.find((entry) => entry.id === pending.defenderId);
    if (!pending || pending.phase !== "unarmed-hit" || !pending.hit || !attacker || !defender || !authorizeCombatant(attacker.id)) return;
    const dieSize = pending.action === "overbear" ? 6 : 8;
    const roll = rollSecureDie(dieSize);
    const modifierDetail = pending.action === "overbear"
      ? overbearResultModifier({ attacker, defender, attackerStrength: participantAbility(attacker, 0), defenderStrength: participantAbility(defender, 0), attackerFourLegged: attacker.unarmedOverrides?.fourLegged })
      : grappleResultModifier({ attacker, defender, attackerAppendages: attacker.unarmedOverrides?.appendages, defenderAppendages: defender.unarmedOverrides?.appendages });
    const rawAdjusted = roll + modifierDetail.total + pending.followUpGrappleBonus;
    const adjusted = pending.repeatCappedAtEight ? Math.min(8, rawAdjusted) : rawAdjusted;
    const outcome = pending.action === "overbear" ? overbearOutcome(adjusted) : grappleOutcome(adjusted);
    const character = participantCharacter(attacker);
    const strengthDamage = character ? strengthCombatModifier(character, "damage") : 0;
    const realDamage = outcome.realDamage;
    const temporaryDamage = Math.max(0, outcome.temporaryDamage + strengthDamage);
    applyUnarmedDamage(defender, realDamage, temporaryDamage);
    setCampaign((current) => {
      let holds = current.segmentedInitiative.grappleHolds;
      let effects = current.segmentedInitiative.effects;
      if (outcome.tier === "decisive-throw") holds = holds.filter((hold) => !((hold.attackerId === attacker.id && hold.defenderId === defender.id) || (hold.attackerId === defender.id && hold.defenderId === attacker.id)));
      if (outcome.establishesHold) {
        holds = holds.filter((hold) => hold.attackerId !== attacker.id || hold.defenderId === defender.id);
        holds = [...holds, { id: id(), attackerId: attacker.id, defenderId: defender.id, result: adjusted, label: outcome.controllingLabel ?? outcome.label, inferiorLabel: outcome.inferiorLabel, realDamage, temporaryDamage, establishedRound: current.segmentedInitiative.round, establishedOrder: Date.now(), footGrab: outcome.tier === "partial-failure" }];
      }
      if (outcome.proneAttacker) effects = addUnarmedEffect(effects, attacker, "Prone", "Only unarmed combat actions; attacks against the target gain +4. Stand Up removes Prone unless Overborne.");
      if (outcome.proneDefender) effects = addUnarmedEffect(effects, defender, "Prone", "Only unarmed combat actions; attacks against the target gain +4. Stand Up removes Prone unless Overborne.");
      if (outcome.staggeredDefender) effects = addUnarmedEffect(effects, defender, "Staggered", "Attacks against the target gain +2.");
      if (outcome.overborneDefender) effects = addUnarmedEffect(effects, defender, "Overborne", "Cannot normally recover from Prone or Staggered while the overbearing situation continues.", 99);
      if (outcome.defenderMoveZero) effects = addUnarmedEffect(effects, defender, "Overbear pin", "Effective movement is 0 while the total-success overbear remains in force.", 99);
      if (outcome.tier === "partial-failure") effects = addUnarmedEffect(effects, defender, "Feet clutched", "Loses DEX AC bonus and Move −30 while the grip is maintained.", 99);
      if (outcome.defenderLosesNextAction) effects = addUnarmedEffect(effects, defender, "Lost next action", "Cannot act during the next declaration.", 2);
      return { ...current, segmentedInitiative: { ...current.segmentedInitiative, grappleHolds: holds, effects } };
    });
    const repeats = outcome.repeatsGrappleAtBonus && !pending.repeatCappedAtEight;
    updateTracker({ pendingUnarmed: { ...pending, resultRoll: roll, resultModifier: modifierDetail.total + pending.followUpGrappleBonus, adjustedResult: adjusted, outcomeLabel: outcome.label, realDamage, temporaryDamage, phase: repeats ? "unarmed-hit" : outcome.followUp ? "follow-up" : "complete", followUpGrappleBonus: repeats ? 2 : outcome.followUpGrappleBonus, repeatCappedAtEight: Boolean(repeats) } });
    sendChatAction({ kind: "combat-result", content: `${pending.action === "overbear" ? "🐂 OVERBEAR" : "🤼 GRAPPLE"} — ${chatCombatantName(attacker)} → ${chatCombatantName(defender)}\nResult — d${dieSize} [${roll}] ${signed(modifierDetail.total + pending.followUpGrappleBonus)} = ${adjusted}${pending.repeatCappedAtEight ? " · capped at 8" : ""}\n${outcome.label.toUpperCase()} — ${realDamage} real${temporaryDamage ? " · temporary damage applied" : ""}${repeats ? " · roll another Grapple Result at +2, capped at 8" : ""}`, rollDetail: `d${dieSize} ${roll}; modifier ${signed(modifierDetail.total + pending.followUpGrappleBonus)}; adjusted ${adjusted}; ${realDamage} real${temporaryDamage ? "; temporary damage applied" : ""}` });
  }

  function chooseUnarmedFollowUp(choice: "melee" | "brawl" | "grapple" | "end") {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    if (!pending || pending.phase !== "follow-up" || !attacker || !authorizeCombatant(attacker.id)) return;
    if (choice === "grapple") {
      updateTracker({ pendingUnarmed: { ...pending, action: "grapple", phase: "unarmed-hit", hit: true, hitRoll: 0, resultRoll: null, adjustedResult: null, followUpGrappleBonus: pending.followUpGrappleBonus, repeatCappedAtEight: false } });
      return;
    }
    updateParticipant(attacker.id, { action: choice === "end" ? attacker.action : choice, statusNote: choice === "end" ? pending.outcomeLabel : `Immediate ${choice} follow-up`, ready: true }, true);
    updateTracker({ pendingUnarmed: { ...pending, phase: "complete" } });
  }

  function maintainHold(participant: SegmentedParticipant) {
    const hold = selectedHoldFor(participant);
    const target = hold && tracker.participants.find((entry) => entry.id === hold.defenderId);
    if (!hold || hold.attackerId !== participant.id || !target || !authorizeCombatant(participant.id)) return;
    applyUnarmedDamage(target, hold.realDamage, hold.temporaryDamage);
    updateParticipant(participant.id, { statusNote: `${hold.label} ${hold.result} maintained`, completedEvents: Array.from(new Set([...participant.completedEvents, `hold:${tracker.round}`])) }, true);
    sendChatAction({ kind: "combat-result", content: `🔒 ${chatCombatantName(participant)} maintains ${hold.label} ${hold.result} on ${chatCombatantName(target)} — ${hold.realDamage} real${hold.temporaryDamage ? " · temporary damage applied" : ""}.` });
  }

  function releaseHold(participant: SegmentedParticipant) {
    const hold = selectedHoldFor(participant);
    if (!hold || !authorizeCombatant(participant.id)) return;
    updateTracker({ grappleHolds: tracker.grappleHolds.filter((entry) => entry.id !== hold.id), effects: hold.footGrab ? tracker.effects.filter((effect) => !(effect.participantId === hold.defenderId && effect.name === "Feet clutched")) : tracker.effects });
    updateParticipant(participant.id, { statusNote: `${hold.label} released`, completedEvents: Array.from(new Set([...participant.completedEvents, `release:${tracker.round}`])) }, true);
  }

  function standUp(participant: SegmentedParticipant, event: SegmentEvent, override = false) {
    if (!authorizeCombatant(participant.id, override)) return;
    const activeConditions = conditionsForParticipant(participant).filter((effect) => effect.remainingRounds > 0);
    if (!activeConditions.some((effect) => effect.name === "Prone") || activeConditions.some((effect) => effect.name === "Overborne")) return;
    const completionKey = `stand-up:${resolutionKey(event)}`;
    setCampaign((current) => ({
      ...current,
      segmentedInitiative: {
        ...current.segmentedInitiative,
        effects: current.segmentedInitiative.effects.filter((effect) => !(effect.participantId === participant.id && effect.name === "Prone")),
        participants: current.segmentedInitiative.participants.map((entry) => entry.id === participant.id ? {
          ...entry,
          completedEvents: Array.from(new Set([...entry.completedEvents, completionKey])),
          statusNote: "Standing",
        } : entry),
      },
    }));
    sendChatAction({ kind: "combat-result", content: `⬆️ ${chatCombatantName(participant)} stands up and is no longer Prone.` });
  }

  function attemptGrappleDisarm() {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    const defender = pending && tracker.participants.find((entry) => entry.id === pending.defenderId);
    if (!pending || !attacker || !defender || pending.action !== "grapple" || (pending.adjustedResult ?? 0) < 2 || (pending.adjustedResult ?? 0) > 4 || !authorizeCombatant(attacker.id)) return;
    const roll = rollD20();
    const dexterity = participantCharacter(defender) ? numericModifier(derivedAbilityItems(1, participantCharacter(defender)!.stats[1]).find((item) => item.key === "agility")?.value) : 0;
    const modifier = conditionRuleFor(defender).saves + dexterity;
    const target = targetSave(defender, "death");
    const saved = roll + modifier >= target;
    setCampaign((current) => {
      let next = current;
      if (saved) {
        next = { ...next, segmentedInitiative: { ...next.segmentedInitiative, grappleHolds: next.segmentedInitiative.grappleHolds.filter((hold) => !((hold.attackerId === attacker.id && hold.defenderId === defender.id) || (hold.attackerId === defender.id && hold.defenderId === attacker.id))) } };
      } else if (defender.characterId) {
        const owner = next.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === defender.characterId);
        const held = owner && next.inventoryManagement.stacks.find((stack) => stack.handSlot && stack.containerId && next.inventoryManagement.containers.some((container) => container.id === stack.containerId && container.holderType === "owner" && container.holderId === owner.id));
        if (held) next = syncPhysicalEquipment({ ...next, inventoryManagement: throwOneStackToGround(next.inventoryManagement, held.id).state });
      } else {
        next = { ...next, segmentedInitiative: { ...next.segmentedInitiative, participants: next.segmentedInitiative.participants.map((entry) => entry.id === defender.id ? { ...entry, weaponRulesId: null, attackMode: "natural" as const, statusNote: "Disarmed by Arm Grab" } : entry) } };
      }
      return next;
    });
    updateTracker({ pendingUnarmed: { ...pending, phase: "complete", outcomeLabel: saved ? "Disarm save succeeded · defender freed" : "Disarm failed save · defender disarmed" } });
    sendChatAction({ kind: "combat-result", content: `${saved ? "✅ DISARM SAVE" : "❌ DISARMED"} — ${chatCombatantName(defender)}\nParalysis save — d20 [${roll}] ${signed(modifier)} = ${roll + modifier} vs ${target}+\n${saved ? "Defender keeps the weapon and is freed from this grapple." : "Defender drops a held weapon; the Arm Grab remains."}` });
  }

  function grappleControlOption(choice: "prone" | "disengage") {
    const pending = tracker.pendingUnarmed;
    const attacker = pending && tracker.participants.find((entry) => entry.id === pending.attackerId);
    const defender = pending && tracker.participants.find((entry) => entry.id === pending.defenderId);
    if (!pending || !attacker || !defender || !authorizeCombatant(attacker.id)) return;
    if (choice === "prone") {
      updateTracker({ effects: addUnarmedEffect(tracker.effects, defender, "Prone", "Only unarmed combat actions; attacks against the target gain +4. Stand Up removes Prone unless Overborne."), pendingUnarmed: { ...pending, phase: "complete", outcomeLabel: `${pending.outcomeLabel} · defender made Prone` } });
      return;
    }
    updateTracker({
      grappleHolds: tracker.grappleHolds.filter((hold) => !((hold.attackerId === attacker.id && hold.defenderId === defender.id) || (hold.attackerId === defender.id && hold.defenderId === attacker.id))),
      effects: tracker.effects.filter((effect) => !(effect.participantId === attacker.id && effect.name === "Prone")),
      pendingUnarmed: { ...pending, phase: "complete", outcomeLabel: `${pending.outcomeLabel} · controller disengaged` },
    });
  }

  function unarmedBottomTray() {
    const pending = tracker.pendingUnarmed;
    if (!pending) return null;
    const attacker = tracker.participants.find((entry) => entry.id === pending.attackerId);
    const defender = tracker.participants.find((entry) => entry.id === pending.defenderId);
    if (!attacker || !defender) return null;
    const fenders = pending.eligibleFenderIds.flatMap((fenderId) => {
      const fender = tracker.participants.find((entry) => entry.id === fenderId);
      return fender ? [fender] : [];
    });
    const controllerHold = tracker.grappleHolds.find((hold) => hold.attackerId === attacker.id && hold.defenderId === defender.id && controllingHoldId(tracker.grappleHolds, attacker.id, defender.id) === hold.id);
    const canDisarm = pending.action === "grapple" && (pending.adjustedResult ?? 0) >= 2 && (pending.adjustedResult ?? 0) <= 4 && controllerHold;
    const canLockOption = pending.action === "grapple" && ((pending.adjustedResult ?? 0) === 7 || (pending.adjustedResult ?? 0) === 8) && controllerHold;
    const canWaistDisengage = pending.action === "grapple" && (pending.adjustedResult ?? 0) === 5 && controllerHold;
    const attackerWornAc = participantWornArmorAscendingAc(attacker);
    const defenderWornAc = participantWornArmorAscendingAc(defender);
    const hitBreakdown = unarmedHitBreakdown({
      attacker: participantUnarmedArmor(attacker), defender: participantUnarmedArmor(defender),
      attackerDexterity: participantAbility(attacker, 1), attackerMove: participantMoveRate(attacker), defenderMove: participantMoveRate(defender),
      attackerWornAscendingAc: attackerWornAc, defenderWornAscendingAc: defenderWornAc,
      attackerMagicArmorBonus: unarmedMagicArmorBonus(attacker), magicalArmorReduction: tracker.magicalArmorWrestling,
      conditionModifier: conditionRuleFor(attacker).attack,
    });
    const pileOn = pileOnApplies(tracker.grappleHolds, attacker.id, defender.id);
    const neededRoll = Math.max(2, hitBreakdown.targetNumber - hitBreakdown.modifier);
    const unarmedAttacker = participantUnarmedArmor(attacker);
    const armorReason = attacker.unarmedOverrides?.hitTargetNumber !== null && attacker.unarmedOverrides?.hitTargetNumber !== undefined
      ? `Entered monster/NPC Unarmed Hit TN override: ${attacker.unarmedOverrides.hitTargetNumber}`
      : unarmedAttacker.armorMode === "worn"
        ? `Attacker worn armour AC ${attackerWornAc ?? 10}`
        : `Attacker natural armour: ${unarmedAttacker.armorProfile ?? "flesh"}`;
    const hitReason = `${armorReason}. Roll modifier: DEX ${signed(hitBreakdown.dexterity)}, attacker Move ${signed(hitBreakdown.attackerMove)}, defender armour ${signed(hitBreakdown.defenderArmor)}, defender Move ${signed(hitBreakdown.defenderMove)}, Hit ATK override ${signed(hitBreakdown.attackerOverride)}, Hit DEF override ${signed(hitBreakdown.defenderOverride)}, conditions ${signed(hitBreakdown.conditions)}. Natural 1 always fails.${pileOn ? " Target is already Grappling, so every other roll succeeds." : ""}`;
    const resultModifier = pending.action === "overbear"
      ? overbearResultModifier({ attacker, defender, attackerStrength: participantAbility(attacker, 0), defenderStrength: participantAbility(defender, 0), attackerFourLegged: attacker.unarmedOverrides?.fourLegged })
      : grappleResultModifier({ attacker, defender, attackerAppendages: attacker.unarmedOverrides?.appendages, defenderAppendages: defender.unarmedOverrides?.appendages });
    const resultBonus = resultModifier.total + pending.followUpGrappleBonus;
    const resultReason = `${pending.action === "overbear" ? "Overbear" : "Grapple"} Result modifier: attacker ${signed(resultModifier.attacker)}, defender ${signed(resultModifier.defender)}${pending.followUpGrappleBonus ? `, follow-up ${signed(pending.followUpGrappleBonus)}` : ""}. The adjusted result selects the outcome band; this is not a to-hit target.`;
    const damageSummary = (realDamage: number, temporaryDamage: number) => viewerHasGmPermissions
      ? `${realDamage} REAL · ${temporaryDamage} TEMP`
      : `${realDamage} REAL`;
    return <aside className="unarmed-bottom-sheet" role="dialog" aria-label={`${pending.action} resolution`}>
      <header><span><small>{pending.phase === "fending" ? "FENDING" : pending.action === "overbear" ? "OVERBEAR" : "GRAPPLE"}</small><strong>{attacker.name} → {defender.name}</strong></span><button type="button" aria-label="Close unarmed resolution" onClick={() => updateTracker({ pendingUnarmed: null })}>×</button></header>
      <div className="unarmed-number-strip">
        <span className="unarmed-number-tile" title={hitReason} tabIndex={0} aria-label={`Unarmed Hit: ${pileOn ? "2 or higher, pile-on" : `target number ${hitBreakdown.targetNumber}, needs ${neededRoll} or higher`}. ${hitReason}`}><span>Unarmed Hit</span><b>{pileOn ? "2+ · PILE-ON" : `TN ${hitBreakdown.targetNumber} · NEED ${neededRoll}+`}</b></span>
        <span className="unarmed-number-tile" title={resultReason} tabIndex={0} aria-label={`${pending.action === "overbear" ? "Overbear" : "Grapple"} Result: d${pending.action === "overbear" ? 6 : 8} ${signed(resultBonus)}. ${resultReason}`}><span>{pending.action === "overbear" ? "Overbear" : "Grapple"} Result</span><b>d{pending.action === "overbear" ? 6 : 8} {signed(resultBonus)}</b></span>
      </div>
      {pending.phase === "fending" && <div className="fending-list">{fenders.map((fender) => <div key={fender.id}><span><b>{fender.name}</b><small>{attackInstrumentLabel(fender, equippedWeaponFor(fender))}</small></span><button type="button" disabled={pending.attemptedFenderIds.includes(fender.id)} onClick={() => rollFend(fender)}>{pending.attemptedFenderIds.includes(fender.id) ? "MISSED" : "FEND"}</button></div>)}<button className="primary-button" type="button" onClick={continueAfterFending}>CONTINUE</button></div>}
      {pending.phase === "cancelled" && <div className="unarmed-outcome cancelled"><strong>Grab cancelled</strong><span>{tracker.participants.find((entry) => entry.id === pending.cancelledById)?.name} hit while Fending. No damage was rolled.</span><button onClick={() => updateTracker({ pendingUnarmed: null })}>Done</button></div>}
      {pending.phase === "unarmed-hit" && pending.hit === null && <div className="unarmed-roll-step"><span>Special OSRIC Unarmed Hit · not THAC0</span><button className="primary-button" onClick={rollSpecialUnarmedHit}>Roll Unarmed Hit</button></div>}
      {pending.phase === "unarmed-hit" && pending.hit === true && <div className="unarmed-roll-step"><span>{pending.repeatCappedAtEight ? "Decisive Throw · another Grapple Result at +2, capped at 8" : `Unarmed Hit ${pending.hitRoll ? `[${pending.hitRoll}] ${signed(pending.hitModifier)} vs TN ${pending.hitTarget}` : "automatically carried into this follow-up"}`}</span><button className="primary-button" onClick={rollUnarmedResult}>Roll d{pending.action === "overbear" ? 6 : 8} {pending.action === "overbear" ? "Overbear" : "Grapple"} Result</button></div>}
      {pending.phase === "follow-up" && <div className="unarmed-outcome success"><strong>{pending.outcomeLabel}</strong><span>{damageSummary(pending.realDamage, pending.temporaryDamage)}</span><div><button onClick={() => chooseUnarmedFollowUp("melee")}>MELEE</button><button onClick={() => chooseUnarmedFollowUp("brawl")}>BRAWL</button><button onClick={() => chooseUnarmedFollowUp("grapple")}>GRAPPLE</button><button onClick={() => chooseUnarmedFollowUp("end")}>END</button></div></div>}
      {pending.phase === "complete" && <div className="unarmed-outcome"><strong>{pending.outcomeLabel || (pending.hit ? "Resolved" : "Unarmed Hit missed")}</strong>{pending.adjustedResult !== null && <span>Result {pending.adjustedResult} · {damageSummary(pending.realDamage, pending.temporaryDamage)}</span>}{canDisarm && <button onClick={attemptGrappleDisarm}>DISARM</button>}{canWaistDisengage && <button onClick={() => grappleControlOption("disengage")}>DISENGAGE</button>}{canLockOption && <div><button onClick={() => grappleControlOption("prone")}>MAKE PRONE</button><button onClick={() => grappleControlOption("disengage")}>DISENGAGE</button></div>}<button onClick={() => updateTracker({ pendingUnarmed: null })}>Done</button></div>}
    </aside>;
  }

  function attackResolutionControls(participant: SegmentedParticipant, event: SegmentEvent) {
    const key = resolutionKey(event);
    const actor = eventActor(participant, event);
    const resolution = participant.resolutions[key] ?? defaultResolution(event, actor);
    const target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    const attackCount = speedAttackCount(participant, event, target);
    const longerReach = Boolean(target && compareInitialChargeReach({
      mutualTargets: target.targetId === participant.id,
      engagedAtRoundStart: wereEngagedAtStartOfRound(tracker.engagements, participant.id, target.id, tracker.round),
      leftAction: participant.action,
      rightAction: target.action,
      leftReach: weaponReachFeet(activeWeaponRules(participant)),
      rightReach: weaponReachFeet(activeWeaponRules(target)),
    }) < 0);
    const attackEvents = Array.from({ length: attackCount }, (_, index) => index === 0 ? event : { ...event, key: `${event.key}-weapon-speed-${index + 1}`, label: `${event.label} · weapon speed ${index + 1}/${attackCount}` });
    const attackResolutions = attackEvents.map((attackEvent) => participant.resolutions[resolutionKey(attackEvent)] ?? defaultResolution(attackEvent, participant));
    const attacksRolled = attackResolutions.every((entry) => entry.attackRoll !== null);
    const hitCount = attackResolutions.filter((entry) => entry.hit).length;
    const groupResolution = attackResolutions[0];
    if (missileResolutionBlocked(participant)) {
      const character = participantCharacter(participant);
      const noAmmo = Boolean(character && activeWeaponRules(participant)?.missileMode === "projectile" && ammoShotsForCharacter(campaign.inventoryManagement, character.id) <= 0);
      return <div className="event-adjudication missile-engagement-lockout" role="status"><strong>Missile attack unavailable</strong><span>{noAmmo ? `${participant.name} has no Ammo.` : `${participant.name} is engaged in melee and cannot use a missile weapon.`}</span></div>;
    }
    const requiredRoll = target ? requiredRollForAttack(participant, event, target) : null;
    const actionLabel = !attacksRolled
      ? attackCount > 1 ? `ROLL ${attackCount} ATTACKS [${requiredRoll ?? "—"}]` : `ROLL ATTACK [${requiredRoll ?? "—"}]`
      : hitCount === 0
        ? attackCount > 1 ? "No attacks hit" : "Attack missed"
        : groupResolution.damageTotal === null
          ? hitCount === 1 ? "Roll damage" : hitCount === 2 ? "Roll double damage" : `Roll damage ×${hitCount}`
          : groupResolution.damageApplied ? `${groupResolution.damageTotal} damage applied` : `Apply ${groupResolution.damageTotal} damage`;
    const randomTargets = tracker.participants.filter((entry) => {
      if (entry.id === participant.id) return false;
      if (conditionsForParticipant(entry).some((effect) => effect.remainingRounds > 0 && effect.name === "Dead")) return false;
      return participantIsConscious({ ...entry, currentHp: participantHp(entry).effective });
    });
    const restricted = !canControlCombatant(combatIdentity, participant) && !controlHeld;
    return <div className={`attack-resolution attack-resolution-unified combat-action-fieldset ${restricted ? "control-restricted" : ""}`} aria-disabled={restricted || undefined} title={restricted ? "Hold Ctrl to override control restrictions" : undefined}>
      {!target && rangedActions.has(participant.action) && <label className="random-missile-target">Random missile target<select value="" onChange={(changeEvent) => updateResolution(participant, event, { targetId: changeEvent.target.value || null })}><option value="">Assign the randomly determined combatant</option>{randomTargets.map((entry) => <option value={entry.id} key={entry.id}>{targetOptionLabel(entry)} · AC {effectiveArmorClass(entry)}{entry.kind === "enemy" && !viewerHasGmPermissions ? "" : ` · HP ${participantHp(entry).current}/${participantHp(entry).maximum}`}</option>)}</select></label>}
      {attackCount > 1 && <small className="weapon-speed-context">Established melee · final attack · weapon speed grants {attackCount} total attacks.</small>}
      {longerReach && <small className="weapon-speed-context">Longer weapon · resolves first in the initial charge exchange.</small>}
      <div className="attack-unified-action-row">
        <label>Damage<input value={houseRuleDamageFormula(actor, event) ?? groupResolution.damageExpression} disabled={Boolean(houseRuleDamageFormula(actor, event))} onChange={(changeEvent) => updateResolution(participant, event, { damageExpression: changeEvent.target.value })} placeholder="1d8+2" /></label>
        <label className="manual-combat-modifier">To hit mod<input aria-label={`${participant.name} manual to-hit modifier`} value={participant.manualHitModifier ?? "+0"} disabled={restricted} onChange={(changeEvent) => updateParticipant(participant.id, { manualHitModifier: changeEvent.target.value })} onBlur={() => updateParticipant(participant.id, { manualHitModifier: parseManualCombatModifier(participant.manualHitModifier).normalized })} placeholder="+0" /></label>
        <label className="manual-combat-modifier">Damage mod<input aria-label={`${participant.name} manual damage modifier`} value={participant.manualDamageModifier ?? "+0"} disabled={restricted} onChange={(changeEvent) => updateParticipant(participant.id, { manualDamageModifier: changeEvent.target.value })} onBlur={() => updateParticipant(participant.id, { manualDamageModifier: parseManualCombatModifier(participant.manualDamageModifier).normalized })} placeholder="+0" /></label>
        {engageButton(participant, event, restricted)}
        <button className={`primary-button attack-unified-button ${groupResolution.damageTotal !== null && !groupResolution.damageApplied ? "apply-damage-button" : ""}`} disabled={!target || (attacksRolled && (hitCount === 0 || groupResolution.damageApplied))} onClick={(clickEvent) => {
          if (!attacksRolled) attackEvents.forEach((attackEvent) => rollAttack(participant, attackEvent, clickEvent.ctrlKey));
          else if (groupResolution.damageTotal === null) rollAttackGroupDamage(participant, event, hitCount, clickEvent.ctrlKey);
          else applyDamage(participant, event, clickEvent.ctrlKey);
        }}>{actionLabel}</button>
      </div>
      <small className="manual-modifier-hint">Manual: 5 becomes +5 · dd doubles · +5dd adds then doubles · dd+5 doubles then adds.</small>
      {attacksRolled && <strong className={`attack-group-outcome ${hitCount ? "attack-hit" : "attack-miss"}`}>{attackResolutions.map((entry, index) => {
        const shotPrefix = attackCount > 1 ? `${index + 1}. ` : "";
        if (entry.missileMissOutcome === "wide") return `${shotPrefix}MISS [${entry.attackRoll}] · SHOT WIDE`;
        if (entry.missileMissOutcome === "stray") {
          const original = tracker.participants.find((entryParticipant) => entryParticipant.id === entry.missileOriginalTargetId);
          const redirected = tracker.participants.find((entryParticipant) => entryParticipant.id === entry.targetId);
          return `${shotPrefix}STRAY HIT [${entry.attackRoll}] · missed ${original ? chatCombatantName(original) : "original target"} → ${redirected ? chatCombatantName(redirected) : "stray target"}`;
        }
        return `${shotPrefix}${entry.automaticHit ? "AUTOMATIC HIT" : entry.headshot ? `HEADSHOT [${entry.attackRoll}]` : `${entry.hit ? "HIT" : "MISS"} [${entry.attackRoll}]`}`;
      }).join(" · ")}{groupResolution.damageTotal !== null ? ` · ${groupResolution.damageTotal} damage` : ""}</strong>}
    </div>;
  }

  function participantMentalTotal(participant: SegmentedParticipant) {
    const character = participantCharacter(participant);
    return character ? Math.max(0, Number(character.stats[3]) || 0) + Math.max(0, Number(character.stats[4]) || 0) : 20;
  }

  function psionicEffect(result: string, target: SegmentedParticipant, attackerName: string) {
    const duration = result === "Sleep" ? rollSecureDie(4) * 5 : result === "Stun" || result === "Confused" || result === "Panicked" || result === "Enraged" ? rollSecureDie(4) * 2 : result === "Coma" ? rollSecureDie(4) * 7 * 24 * 60 : 0;
    const description = result === "Death" || result === "Killed" ? "Psionic fatality." : result === "Coma" ? "Cannot be awakened; duration is tracked in minutes." : result === "Feebleminded" ? "Persists until cure; cannot attack or defend." : `${result} caused by ${attackerName}'s psionic attack.`;
    return { id: id(), name: result === "Killed" ? "Dead" : result, target: target.name, participantId: target.id, description, remainingRounds: duration || 9999 } satisfies CombatEffect;
  }

  function resolvePsionicExchange(participant: SegmentedParticipant, event: SegmentEvent) {
    if (!authorizeCombatant(participant.id)) return;
    const setup = participant.psionicCombat;
    const attackMode = setup?.attackMode;
    if (!setup || !attackMode || participant.completedEvents.includes(`psionic:${resolutionKey(event)}`)) return;
    const attackerPsionics = normalizePsionics(participant.psionics);
    const targets = tracker.participants.filter((entry) => setup.targetIds.includes(entry.id) && entry.side !== participant.side);
    if (!attackerPsionics.enabled || !targets.length) return;
    const cost = psionicAttackCost(attackMode, setup.range);
    if (attackerPsionics.currentAttackPoints < cost) return;
    const attackerTotal = attackerPsionics.currentAttackPoints + attackerPsionics.currentDefensePoints;
    const matrixTotal = setup.range === "long" ? Math.max(1, attackerTotal - 25) : attackerTotal;
    setCampaign((current) => {
      const currentAttacker = current.segmentedInitiative.participants.find((entry) => entry.id === participant.id);
      if (!currentAttacker) return current;
      const currentAttackPsionics = normalizePsionics(currentAttacker.psionics);
      const effects: CombatEffect[] = [...current.segmentedInitiative.effects];
      const logs = [...(current.segmentedInitiative.psionicExchanges ?? [])];
      const participants = current.segmentedInitiative.participants.map((entry) => {
        if (entry.id === currentAttacker.id) return { ...entry, psionics: normalizePsionics({ ...currentAttackPsionics, currentAttackPoints: currentAttackPsionics.currentAttackPoints - cost }), completedEvents: Array.from(new Set([...entry.completedEvents, `psionic:${resolutionKey(event)}`])), statusNote: `Psionic exchange ${event.segment} resolved` };
        if (!targets.some((target) => target.id === entry.id)) return entry;
        const defenderPsionics = normalizePsionics(entry.psionics);
        if (!defenderPsionics.enabled) {
          if (attackMode !== "Psionic Blast" || currentAttackPsionics.currentAttackPoints < 100) return entry;
          const targetNumber = psionicBlastSaveTarget(participantMentalTotal(entry), setup.range);
          const saveRoll = rollSecureDie(20);
          const success = saveRoll >= targetNumber;
          const effectRoll = success ? null : rollSecureDie(100);
          const result = effectRoll === null ? "Saved" : psionicBlastEffect(participantMentalTotal(entry), effectRoll);
          if (!success) effects.push(psionicEffect(result, entry, currentAttacker.name));
          logs.push({ id: id(), round: current.segmentedInitiative.round, segment: event.segment, attackerId: currentAttacker.id, defenderId: entry.id, attackMode, defenseMode: null, range: setup.range, attackCost: cost, defenseCost: 0, loss: null, result, rolls: effectRoll === null ? [saveRoll] : [saveRoll, effectRoll] });
          return entry;
        }
        const override = setup.defenseOverrides[entry.id];
        const defense = override && defenderPsionics.defenseModes.includes(override) ? override : bestPsionicDefense(defenderPsionics, matrixTotal, attackMode);
        const defenseCost = psionicDefenseRules[defense].cost;
        const raw = defenderPsionics.currentDefensePoints <= 0
          ? defenselessPsionicResult(currentAttackPsionics.currentAttackPoints, defenderPsionics.originalPsionicAbility, attackMode)
          : normalPsionicLoss(matrixTotal, attackMode, defense).loss;
        const instantDeath = defenderPsionics.currentDefensePoints <= 0 || attackMode === "Psychic Crush";
        const resultRoll = instantDeath ? rollSecureDie(100) : null;
        const adjusted = typeof raw === "number" ? psionicRangeAdjustedLoss(raw, setup.range, attackerTotal) : raw;
        const killed = attackMode === "Psychic Crush" && typeof raw === "number" && resultRoll !== null && resultRoll <= raw;
        const nextDefense = Math.max(0, defenderPsionics.currentDefensePoints - defenseCost - (typeof adjusted === "number" ? adjusted : 0));
        const nextAttack = defenderPsionics.currentAttackPoints;
        const hpLoss = defenderPsionics.currentDefensePoints <= 0 && typeof adjusted === "number" ? Math.max(0, adjusted - nextAttack) : 0;
        const finalAttack = defenderPsionics.currentDefensePoints <= 0 && typeof adjusted === "number" ? Math.max(0, nextAttack - adjusted) : nextAttack;
        const result = killed ? "Dead" : typeof adjusted === "string" ? adjusted : `${adjusted} DP loss`;
        if (killed || typeof adjusted === "string") effects.push(psionicEffect(result, entry, currentAttacker.name));
        logs.push({ id: id(), round: current.segmentedInitiative.round, segment: event.segment, attackerId: currentAttacker.id, defenderId: entry.id, attackMode, defenseMode: defense, range: setup.range, attackCost: cost, defenseCost, loss: typeof adjusted === "number" ? adjusted : null, result, rolls: resultRoll === null ? [] : [resultRoll] });
        return { ...entry, currentHp: hpLoss ? entry.currentHp - hpLoss : entry.currentHp, psionics: normalizePsionics({ ...defenderPsionics, currentAttackPoints: finalAttack, currentDefensePoints: nextDefense }) };
      });
      const characters = current.characters.map((character) => {
        const linked = participants.find((entry) => entry.characterId === character.id);
        return linked?.psionics ? { ...character, psionics: normalizePsionics(linked.psionics), currentHp: linked.currentHp } : character;
      });
      const stableNpcs = current.stableNpcs.map((npc) => {
        const linked = participants.find((entry) => entry.stableNpcId === npc.id);
        return linked?.psionics ? { ...npc, psionics: normalizePsionics(linked.psionics), currentHp: linked.currentHp } : npc;
      });
      return { ...current, characters, stableNpcs, segmentedInitiative: { ...current.segmentedInitiative, participants, effects, psionicExchanges: logs.slice(-250) } };
    });
  }

  function eventAdjudication(participant: SegmentedParticipant, event: SegmentEvent) {
    const key = resolutionKey(event);
    const resolution = participant.resolutions[key] ?? defaultResolution(event, participant);
    const target = tracker.participants.find((entry) => entry.id === (resolution.targetId ?? event.targetId ?? participant.targetId));
    const attack = isAttackEvent(event, participant);
    const spellEffect = participant.action === "spell" && event.key === "spell-complete";
    const spellLikeEffect = participant.action === "spell-like-effect";
    const magicDevice = participant.action === "use-magic";
    const areaEffect = participant.areaOfEffect || spellLikeEffect;
    const areaTargets = areaTargetsFor(participant);
    const weaponSwitch = participant.action === "switch-weapon" || participant.action === "close";
    const restricted = !canControlCombatant(combatIdentity, participant) && !controlHeld;
    const closedOut = meleeActions.has(participant.action) && target && tracker.participants.some((closer) => closer.action === "close" && closer.targetId === participant.id && (event.targetId ?? participant.targetId) === closer.id && closer.declarationRound === event.round);
    if (closedOut) return <div className="event-adjudication close-lockout-notice"><strong>Closed into combat</strong><span>{target.name} closed with {participant.name}; this declared melee attack cannot be made against the closer this turn.</span></div>;
    if (participant.action === "psionic-combat") {
      const setup = participant.psionicCombat;
      const complete = participant.completedEvents.includes(`psionic:${resolutionKey(event)}`);
      return <div className={`event-adjudication psionic-event-control ${restricted ? "control-restricted" : ""}`}><span>{setup ? `${setup.attackMode} · ${setup.range} range · ${setup.targetIds.length} target${setup.targetIds.length === 1 ? "" : "s"}` : "Psionic setup incomplete"}</span><button className="primary-button" disabled={!setup || complete} onClick={() => resolvePsionicExchange(participant, event)}>{complete ? "Exchange resolved" : `Resolve exchange ${event.segment}`}</button></div>;
    }
    if (participant.action === "stand-up") {
      const activeConditions = conditionsForParticipant(participant).filter((effect) => effect.remainingRounds > 0);
      const prone = activeConditions.some((effect) => effect.name === "Prone");
      const overborne = activeConditions.some((effect) => effect.name === "Overborne");
      const completed = participant.completedEvents.includes(`stand-up:${resolutionKey(event)}`);
      return <div className={`event-adjudication unarmed-event-control ${restricted ? "control-restricted" : ""}`}><span>{overborne ? "Overborne prevents recovery from Prone." : prone ? "Spend this action to remove Prone." : "This combatant is no longer Prone."}</span><button className="primary-button" disabled={!prone || overborne || completed} onClick={(clickEvent) => standUp(participant, event, clickEvent.ctrlKey)}>{completed || !prone ? "Standing" : overborne ? "Blocked by Overborne" : "Stand up"}</button></div>;
    }
    if (weaponSwitch) {
      const character = participantCharacter(participant);
      if (participant.stableNpcId) {
        const nextWeapon = weaponRulesById(participant.pendingWeaponId);
        const completed = participant.completedEvents.includes(`switch:${resolutionKey(event)}`);
        return <div className={`event-adjudication weapon-switch-resolution combat-action-fieldset ${restricted ? "control-restricted" : ""}`} aria-disabled={restricted || undefined}><span>Switch expedition NPC weapon</span><b>{nextWeapon?.name ?? "No backup weapon selected"}</b><button className="primary-button" disabled={!nextWeapon || completed} onClick={(clickEvent) => completeWeaponSwitch(participant, event, clickEvent.ctrlKey)}>{completed ? "Weapon switched" : "Switch weapon"}</button></div>;
      }
      const items = character ? quickAccessItems(character) : [];
      const handOne = items.find((item) => item.id === participant.pendingWeaponId);
      const handTwo = items.find((item) => item.id === participant.pendingOffhandWeaponId);
      const completed = participant.completedEvents.includes(`switch:${resolutionKey(event)}`);
      const closingWithoutItem = participant.action === "close" && !handOne;
      return <div className={`event-adjudication weapon-switch-resolution combat-action-fieldset ${restricted ? "control-restricted" : ""}`} aria-disabled={restricted || undefined} title={restricted ? "Hold Ctrl to override control restrictions" : undefined}><span>{participant.action === "close" ? "Ready hands while closing" : "Move items between hands and Quick Access"}</span><b>Hand 1: {handOne?.name ?? "Empty"} · Hand 2: {handTwo?.name ?? "Empty"}</b><div className="weapon-switch-resolution-actions">{engageButton(participant, event, restricted)}<button className="primary-button" disabled={closingWithoutItem || completed} onClick={(clickEvent) => completeWeaponSwitch(participant, event, clickEvent.ctrlKey)}>{completed ? "Items moved" : "Apply inventory changes"}</button></div></div>;
    }
    if (participant.action === "grapple" || participant.action === "overbear" || participant.action === "improve-hold") {
      const pending = tracker.pendingUnarmed;
      const active = pending?.attackerId === participant.id && pending.eventKey === resolutionKey(event) && pending.phase !== "complete";
      const blockedByOther = Boolean(pending && pending.phase !== "complete" && !active);
      return <div className={`event-adjudication unarmed-event-control ${restricted ? "control-restricted" : ""}`}><span>{participant.action === "overbear" ? "Fend → Unarmed Hit → d6 Overbear Result" : participant.action === "improve-hold" ? "Already inside the grapple · no Fending" : "Fend → Unarmed Hit → d8 Grapple Result"}</span><button className="primary-button" disabled={Boolean(active || blockedByOther)} onClick={() => startUnarmedResolution(participant, event, participant.action === "improve-hold")}>{active ? "Unarmed resolution open below" : blockedByOther ? "Finish the open unarmed resolution" : participant.action === "improve-hold" ? "Improve hold" : `Begin ${actionLabels[participant.action]}`}</button></div>;
    }
    if (participant.action === "maintain-hold") {
      const completed = participant.completedEvents.includes(`hold:${tracker.round}`);
      const hold = selectedHoldFor(participant);
      return <div className={`event-adjudication unarmed-event-control ${restricted ? "control-restricted" : ""}`}><span>{hold ? `${hold.label} ${hold.result} · ${hold.realDamage} real${viewerHasGmPermissions ? ` · ${hold.temporaryDamage} Temporary` : ""}` : "No maintained hold selected"}</span><button className="primary-button" disabled={!hold || completed} onClick={() => maintainHold(participant)}>{completed ? "Hold maintained" : "Maintain hold"}</button></div>;
    }
    if (participant.action === "release-hold") {
      const completed = participant.completedEvents.includes(`release:${tracker.round}`);
      const hold = selectedHoldFor(participant);
      return <div className={`event-adjudication unarmed-event-control ${restricted ? "control-restricted" : ""}`}><span>{hold ? `${hold.label} ${hold.result}` : "No hold selected"}</span><button className="primary-button" disabled={!hold || completed} onClick={() => releaseHold(participant)}>{completed ? "Hold released" : "Release"}</button></div>;
    }
    if (!attack && !spellEffect && !spellLikeEffect && !magicDevice) return null;
    if (event.key === "spec-ranged") {
      const rules = activeWeaponRules(participant);
      const character = participantCharacter(participant);
      const shots = event.attackCount ?? (participant.action === "spec-ranged"
        ? Math.max(2, Math.floor(participant.specializedRof || 2))
        : Math.max(2, Math.floor(character && rules ? specializedMissileRate(rules, specialistClassLevel(character), tracker.round) : 2)));
      return <div className="event-adjudication multi-attack-resolution"><strong>{shots} missile attacks in this segment</strong>{Array.from({ length: shots }, (_, index) => {
        const shotEvent = { ...event, key: `spec-ranged-shot-${index + 1}` };
        return <section key={shotEvent.key}><b>Shot {index + 1}</b>{attackResolutionControls(participant, shotEvent)}</section>;
      })}</div>;
    }
    const areaDamage = resolution.areaDamage ?? [];
    return <div className={`event-adjudication ${restricted ? "control-restricted" : ""}`} aria-disabled={restricted || undefined} title={restricted ? "Hold Ctrl to override control restrictions" : undefined}>
      {!target && !areaEffect && <div className="event-target-line"><span>Target</span><b>No target selected</b></div>}
      {attack && attackResolutionControls(participant, event)}
      {(spellEffect || spellLikeEffect || magicDevice) && <div className="spell-resolution">
        <span className="spell-auto-hit">No attack roll: the effect takes place. Enter damage and/or force the target to save.</span>
        {spellEffect && participant.preparedSpellSlotId && <button className="primary-button" disabled={!participantCharacter(participant)?.spellSlots.some((slot) => slot.id === participant.preparedSpellSlotId && !slot.expended)} onClick={() => expendSpellSlot(participant)}>{participantCharacter(participant)?.spellSlots.some((slot) => slot.id === participant.preparedSpellSlotId && !slot.expended) ? "Cast spell · expend slot" : "Spell slot expended"}</button>}
        <label>Damage / effect roll<input value={resolution.damageExpression} onChange={(changeEvent) => updateResolution(participant, event, { damageExpression: changeEvent.target.value })} placeholder="Optional, e.g. 3d6" /></label>
        <div className="damage-roll-buttons"><button className="primary-button damage-roll-primary" disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event) : rollDamage(participant, event)}>🎲 Roll {areaEffect ? "area damage" : "damage"}</button><button disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event, 1) : rollDamage(participant, event, 1)}>+1</button><button disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event, 2) : rollDamage(participant, event, 2)}>+2</button><button disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event, 3) : rollDamage(participant, event, 3)}>+3</button><button disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event, 0, .5) : rollDamage(participant, event, 0, .5)}>Half</button><button disabled={areaEffect && !areaTargets.length} onClick={() => areaEffect ? rollAreaDamage(participant, event, 0, 2) : rollDamage(participant, event, 0, 2)}>Double</button></div>
        {areaEffect && areaDamage.length > 0 && <div className="area-damage-results">{areaDamage.map((result) => { const areaTarget = tracker.participants.find((entry) => entry.id === result.targetId); return areaTarget ? <div key={result.targetId}><strong>{chatCombatantName(areaTarget)} · <b>{result.total} damage</b></strong><button className="apply-damage-button" disabled={result.applied} onClick={() => applyAreaDamage(participant, event, result.targetId)}>{result.applied ? "Damage applied" : `Apply ${result.total} damage`}</button></div> : null; })}</div>}
        {!areaEffect && resolution.damageTotal !== null && target && <button className="apply-damage-button" disabled={resolution.damageApplied} onClick={() => applyDamage(participant, event)}>{resolution.damageApplied ? `${resolution.damageTotal} damage applied` : `Apply ${resolution.damageTotal} damage`}</button>}
        <label>Force save<select value={resolution.forcedSave ?? "spells"} onChange={(changeEvent) => updateResolution(participant, event, { forcedSave: changeEvent.target.value as keyof SaveBlock })}>{enemySaveLabels.map(([save, label]) => <option value={save} key={save}>{label}</option>)}</select></label><button disabled={areaEffect ? !areaTargets.length : !target} onClick={() => areaEffect ? forceAreaSaves(participant, event, resolution.forcedSave ?? "spells") : forceSave(participant, event, resolution.forcedSave ?? "spells")}>{areaEffect ? "Roll all target saves" : "Roll target save"}</button>{!areaEffect && resolution.saveRoll !== null && <strong className={resolution.saveSuccess ? "save-success" : "save-failure"}>{resolution.saveSuccess ? "SAVE" : "FAILED SAVE"} · {resolution.saveRoll}{resolution.saveModifier ? ` ${signed(resolution.saveModifier)} = ${resolution.saveRoll + resolution.saveModifier}` : ""} vs {resolution.saveTarget}+</strong>}
      </div>}
      {target && <div className="segment-save-access" aria-label="Combatant saving throws">{combatantSaveTiles(participant, "Attacker")}{combatantSaveTiles(target, "Defender")}</div>}
    </div>;
  }

  return (
    <section className="section-stack segmented-panel">
      <div className="combat-toolbar">
        <div><button className="end-combat-button" disabled={!hasProgressionAuthority} title={hasProgressionAuthority ? undefined : "The GM controls combat progression"} onClick={endCombat}>End combat</button><button disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} onClick={() => addNonPlayer("npc")}>+ NPC</button><button disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} onClick={() => addNonPlayer("enemy")}>+ Enemy</button></div>
      </div>
      {unarmedBottomTray()}

      <section className="panel segmented-setup">
        <div className="panel-heading split-heading">
          <div><h2>1. Declare actions</h2></div>
          {tracker.participants.length > 0 && <span className="combatant-collapse-controls"><button type="button" onClick={() => setAllCombatantsExpanded(true)}>Expand all</button><button type="button" onClick={() => setAllCombatantsExpanded(false)}>Collapse all</button></span>}
        </div>
        {moraleReminder && <div className="morale-reminder" role="status"><span>⚑ {moraleReminder}</span><button type="button" onClick={() => setMoraleReminder("")}>Dismiss</button></div>}
        {tracker.lastCheers.length > 0 && !tracker.participants.some((participant) => participant.kind === "enemy") && <section className="combat-cheers"><div><p className="eyebrow">Combat concluded</p><h3>🥂 Cheers</h3></div><div>{tracker.lastCheers.map((cheer, index) => <article key={`${cheer.title}-${index}`}><strong>{cheer.title}</strong><span>{cheer.text}</span></article>)}</div></section>}

        {availableCharacters.length > 0 && <div className="mission-add-strip">
          <strong>Mission pool</strong>
          {availableCharacters.map((character) => <button disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} key={character.id} onClick={() => addMissionCharacter(character.id)}><span className="emoji-inline">{safeEmoji(character.emoji)}</span>{character.name}</button>)}
          <button className="action-link" disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} onClick={addAllMissionCharacters}>Add all</button>
        </div>}
        {availableExpeditionNpcs.length > 0 && <div className="mission-add-strip expedition-combat-strip">
          <strong>Expedition NPCs</strong>
          {availableExpeditionNpcs.map((npc) => <button disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} key={npc.id} onClick={() => addExpeditionNpc(npc.id)}><b>{npc.token}</b><span>{npc.name}</span></button>)}
          <button className="action-link" disabled={tracker.phase !== "declaration" || !hasProgressionAuthority} onClick={addAllExpeditionNpcs}>Add all</button>
        </div>}

        {tracker.participants.length === 0 ? <div className="compact-empty">Add a mission character, enemy, or NPC to begin.</div> : (
          <div className="segmented-combatant-list">
            {displayedParticipants.map((participant, participantIndex) => {
              const character = participantCharacter(participant);
              const hp = participantHp(participant);
              const exsanguinated = (participant.kind === "character" || participant.kind === "npc") && hp.current <= -10;
              const defeatedEnemy = participant.kind === "enemy" && hp.current <= 0;
              const incapacitated = belongsInIncapacitatedGroup(participant);
              const involuntaryAction = (participant.kind === "character" || participant.kind === "npc") && incapacitated;
              const participantControlled = canControlCombatant(combatIdentity, participant);
              const controlRestricted = !participantControlled && !controlHeld;
              const locked = tracker.phase !== "declaration" || isOngoingSpell(participant) || involuntaryAction;
              const modifier = actionModifier(participant);
              const participantConditions = conditionsForParticipant(participant);
              const participantIsProne = participantConditions.some((effect) => effect.remainingRounds > 0 && effect.name === "Prone");
              const participantIsOverborne = participantConditions.some((effect) => effect.remainingRounds > 0 && effect.name === "Overborne");
              const draft = conditionDraft(participant.id);
              const selectedCondition = conditionPresets.find((entry) => entry.name === draft.preset) ?? conditionPresets[0];
              const statIndex = character ? combatAbilityIndex(participant.action) : null;
              const statItems = character && statIndex !== null ? combatAbilityItems(statIndex, character.stats[statIndex], character.exceptionalStrength) : [];
              const statDamageItem = statItems.find((item) => item.key === "damage");
              const currentWeapon = equippedWeaponFor(participant);
              const npcWeaponChoices = participant.stableNpcId ? (participant.weaponRulesIds ?? []).flatMap((weaponId) => {
                const rules = weaponRulesById(weaponId);
                return rules ? [rules] : [];
              }) : [];
              const handContents = character ? combatHandContents(character) : null;
              const specialized = Boolean(character && getWeaponTrainingState(character, currentWeapon).specialized);
              const specializedMeleeHeld = Boolean(specialized && currentWeapon?.category === "melee");
              const specializedRangedHeld = Boolean(specialized && currentWeapon && weaponCanMakeMissileAttack(currentWeapon));
              const actionHitBonus = (participant.action === "charge" ? 2 : 0) + (specialized ? 1 : 0);
              const actionDamageBonus = specialized ? 2 : 0;
              const totalAttackBonus = character
                ? attackModifierFor(participant)
                : null;
              const totalDamageBonus = character
                ? numericModifier(statDamageItem?.value) + actionDamageBonus + conditionRuleFor(participant).damage
                : null;
              const enemyLevel = participant.kind === "enemy" ? fighterLevelFromHitDice(participant.hitDice) : null;
              const enemyAttack = participant.kind === "enemy" ? monsterAttackBonus(participant.hitDice) : null;
              const npcAttack = participant.kind === "npc" ? participant.attackBonus : null;
              const nonPlayerAttack = enemyAttack !== null || npcAttack !== null ? attackModifierFor(participant) : null;
              const enemySaves = participant.kind === "enemy" && participant.hitDice.trim() ? monsterSaves(participant.hitDice, participant.nonIntelligent) : null;
              const meleeRate = participant.action === "melee" && specialized && currentWeapon?.category === "melee" ? specializedMeleeRate(character ? specialistClassLevel(character) : enemyLevel ?? 1) : null;
              const validTargets = targetsForAction(participant, participant.action);
              const mismatch = weaponMismatch(participant);
              const suggestedWeapon = suggestedWeaponSwitch(participant);
              const fighterCharacter = Boolean(character && /fighter/i.test(character.className));
              const warriorClassLevel = character ? specialistClassLevel(character) : 0;
              const grappling = participantIsGrappling(tracker.grappleHolds, participant.id);
              const participantHolds = activeHolds(participant.id);
              const shortcutActions: SegmentedAction[] = ["charge", "melee", "missile", "close", "move", "parry-disengage", "spell"];
              const availableActionGroups = actionGroups.map((group) => ({
                ...group,
                actions: group.actions.filter((action) => (!participantIsProne || proneAllowedActions.has(action))
                  && (action !== "stand-up" || participantIsProne)
                  && (group.label !== "Current grapple" || grappling)
                  && (action !== "three-piece" || participant.kind === "enemy")
                  && (action !== "switch-weapon" || Boolean(character) || npcWeaponChoices.some((weapon) => weapon.id !== participant.weaponRulesId))
                  && (action !== "heroic-assault" || Boolean(fighterCharacter && character && character.level >= 2))
                  && (action !== "melee-combination" || Boolean(warriorClassLevel >= 7 && !specialized))
                  && (action !== "spec-melee" || specializedMeleeHeld)
                  && (action !== "spec-ranged" || specializedRangedHeld)
                  && (action !== "grapple" || !participant.unarmedOverrides?.cannotGrapple)
                  && (action !== "grapple" || participant.kind !== "character" || !character || canGrapple(character))
                  && (action !== "overbear" || !participant.unarmedOverrides?.cannotOverbear)
                  && (action !== "small-weapon" || participant.kind !== "character" || !character || hasDaggerLengthWeaponInHandOrQuick(character))
                  && (action !== "natural-attack" || participant.attackMode === "natural")
                  && (action !== "psionic-combat" || (normalizePsionics(participant.psionics).enabled && normalizePsionics(participant.psionics).attackModes.length > 0))),
              })).filter((group) => group.actions.length);
              const accentStyle = character ? characterTileStyle(character.tileColor) : undefined;
              const declarationHidden = combatDeclarationIsHidden({
                phase: tracker.phase,
                showAllDeclarations: tracker.showAllDeclarations,
                role: viewerRole,
                controlHeld,
                participantKind: participant.kind,
              });
              const exactEnemyHpVisible = participant.kind !== "enemy" || viewerHasGmPermissions;
              const expanded = expandedCombatantIds.includes(participant.id);
              const currentSpeedFactor = isMeleeAction(participant.action) ? activeSpeedFactor(participant) : null;
              const currentSpeedLabel = currentSpeedFactor === null ? participant.subInitiativeRoll ?? "—" : activeSpeedLabel(participant);
              const engagementOpponents = engagedOpponentIds(tracker.engagements, participant.id).flatMap((opponentId) => {
                const opponent = tracker.participants.find((entry) => entry.id === opponentId);
                return opponent && participantIsConscious({ ...opponent, currentHp: participantHp(opponent).effective }) ? [opponent] : [];
              });
              const hasSingleTargetControl = participant.action !== "heroic-assault"
                && participant.action !== "spell-like-effect"
                && !(participant.action === "spell" && participant.areaOfEffect)
                && (attackActions.has(participant.action)
                  || participant.action === "spell"
                  || participant.action === "use-magic"
                  || participant.action === "close"
                  || participant.action === "parry-disengage");
              return <Fragment key={participant.id}>
                {participantIndex === firstOppositionIndex && <div className="combat-side-divider" role="separator" aria-label="Party and opposition divide" />}
                {participantIndex === firstIncapacitatedIndex && <button className={`combatant-category-divider inactive-combatant-toggle ${showIncapacitatedCombatants ? "open" : ""}`} type="button" aria-expanded={showIncapacitatedCombatants} onClick={() => setShowIncapacitatedCombatants((current) => !current)}><span><strong>{showIncapacitatedCombatants ? "Hide incapacitated combatants" : "Show incapacitated combatants"}</strong><small>{incapacitatedCombatants.length} KO&apos;d, dead, or defeated</small></span><b>{showIncapacitatedCombatants ? "Collapse" : "Expand"}</b></button>}
                <article id={`combatant-${participant.id}`} hidden={incapacitated && !showIncapacitatedCombatants} className={`segmented-combatant kind-${participant.kind} side-${participant.side} phase-${tracker.phase} ${character ? "player-combatant" : ""} ${expanded ? "is-expanded" : "is-collapsed"} ${participant.ready ? "is-ready" : ""} ${controlRestricted ? "control-restricted" : ""} ${blockedParticipantId === participant.id ? "needs-attention" : ""} ${incapacitated ? "is-incapacitated" : ""} ${exsanguinated ? "is-exsanguinated" : ""} ${defeatedEnemy ? "is-defeated-enemy" : ""}`} style={accentStyle}>
                <header className="combatant-header clickable-card-header" onClick={(event) => { if ((event.target as HTMLElement).closest("button, input, select, textarea, label, details, summary, a")) return; toggleCombatantExpanded(participant.id); }}>
                  <div className="segmented-identity">
                    {marker(participant)}
                    {participant.kind === "character"
                      ? <span><button type="button" className="character-name-link combatant-name-toggle" aria-expanded={expanded} onClick={() => toggleCombatantExpanded(participant.id)}>{character?.name ?? participant.name}</button><small>{character?.className} {character?.level} · {participantStats(participant)}</small></span>
                      : false && expanded && exactEnemyHpVisible ? <span className="nonplayer-editor">
                        <input aria-label={`${participant.kind} label`} value={participant.name} onChange={(event) => updateParticipant(participant.id, { name: event.target.value })} disabled={locked} />
                        {participant.kind === "enemy" && <span className="enemy-stat-inputs">
                          <label>HD<input aria-label={`${participant.name} hit dice`} value={participant.hitDice} onChange={(event) => updateParticipant(participant.id, { hitDice: event.target.value })} onBlur={() => { const rolled = rollMonsterHp(participant.hitDice); if (rolled !== null) updateParticipant(participant.id, { currentHp: rolled, maxHp: rolled }); }} placeholder="2+1" /></label>
                          <label>AC<input aria-label={`${participant.name} armor class`} type="number" value={participant.armorClass ?? ""} onChange={(event) => updateParticipant(participant.id, { armorClass: event.target.value === "" ? null : Number(event.target.value) })} placeholder="AC" /></label>
                          <label>HP<HpMathInput ariaLabel={`${participant.name} current hit points`} value={participant.currentHp} minimum={-10} onCommit={(currentHp) => setParticipantHp(participant.id, currentHp)} /></label>
                          <label>Max<HpMathInput ariaLabel={`${participant.name} maximum hit points`} value={participant.maxHp} minimum={0} onCommit={(maxHp) => setParticipantMaxHp(participant.id, maxHp)} /></label>
                          <button className="roll-hp-compact" type="button" onClick={() => { const rolled = rollMonsterHp(participant.hitDice); if (rolled !== null) updateParticipant(participant.id, { currentHp: rolled, maxHp: rolled }); }}>Roll HP</button>
                        </span>}
                        {participant.kind === "npc" && <span className="enemy-stat-inputs npc-stat-inputs"><label>BTHB<input aria-label={`${participant.name} base to-hit bonus`} type="number" value={participant.attackBonus ?? ""} onChange={(event) => updateParticipant(participant.id, { attackBonus: event.target.value === "" ? null : Number(event.target.value) })} placeholder="+0" /></label><label>AC<input type="number" value={participant.armorClass ?? ""} onChange={(event) => updateParticipant(participant.id, { armorClass: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>HP<HpMathInput ariaLabel={`${participant.name} current hit points`} value={participant.currentHp} minimum={-10} onCommit={(currentHp) => setParticipantHp(participant.id, currentHp)} /></label><label>Max<HpMathInput ariaLabel={`${participant.name} maximum hit points`} value={participant.maxHp} minimum={0} onCommit={(maxHp) => setParticipantMaxHp(participant.id, maxHp)} /></label></span>}
                      </span> : <span className="nonplayer-summary"><strong>{participant.name || (participant.kind === "enemy" ? "Unnamed enemy" : "Unnamed NPC")}</strong><small>{participant.kind === "enemy" ? `HD ${participant.hitDice || "—"}` : `BTHB ${signed(participant.attackBonus ?? 0)}`} · AC {participant.armorClass ?? "—"}</small></span>}
                    <span className={`side-badge ${participant.side}`}>{participant.side === "party" ? "Party" : "Opposition"}</span>
                    {participant.side === "opposition" && !defeatedEnemy && <span className="identity-kind-label enemy-label">Enemy</span>}
                    {exsanguinated
                      ? <span className="combat-state-label" role="status">☠ Dead</span>
                      : defeatedEnemy
                        ? <span className="combat-state-label" role="status">☠ Defeated</span>
                        : incapacitated && <span className="combat-state-label incapacitated" role="status">! Unconscious</span>}
                    {viewerHasGmPermissions && (participant.temporaryDamage ?? 0) > 0 && <span className="temporary-damage-chip">{participant.temporaryDamage} TEMP</span>}
                    {participantHolds.slice(0, 2).map((hold) => {
                      const otherId = hold.attackerId === participant.id ? hold.defenderId : hold.attackerId;
                      const control = controllingHoldId(tracker.grappleHolds, participant.id, otherId) === hold.id;
                      return <span className={`grapple-state-chip ${control ? "controlling" : "inferior"}`} key={hold.id}>{control ? hold.label : hold.inferiorLabel ?? hold.label} {hold.result}{control ? " · CONTROL" : " · INFERIOR"}</span>;
                    })}
                    {engagementOpponents.length > 0 && <details className="engagement-indicator"><summary aria-label={`${participant.name} engaged with ${engagementOpponents.length} opponent${engagementOpponents.length === 1 ? "" : "s"}`} title="Melee engagements"><span aria-hidden>⚔</span>{engagementOpponents.length > 1 && <b>{engagementOpponents.length}</b>}</summary><div><strong>Engaged with</strong>{engagementOpponents.map((opponent) => <span key={opponent.id}>{opponent.name}{hasProgressionAuthority && <button type="button" className="action-link" onClick={() => updateTracker({ engagements: removeEngagement(tracker.engagements, participant.id, opponent.id) })}>Break</button>}</span>)}</div></details>}
                  </div>

                  {participant.kind === "npc" && <label className="combatant-side-control">Side<select value={participant.side} disabled={locked} onChange={(event) => updateParticipant(participant.id, { side: event.target.value as SegmentedParticipant["side"] })}><option value="party">Party side</option><option value="opposition">Opposition</option></select></label>}

                  {nonPlayerAttack !== null && <div className="enemy-combat-tiles">
                    <span><small>{participant.kind === "enemy" ? "Monster HD" : "NPC"}</small><b>{participant.kind === "enemy" ? participant.hitDice : participant.side === "party" ? "Ally" : "Enemy"}</b></span>
                    <button title="Roll this attack in Party Chat" onClick={() => sendChatAction({ kind: "external-roll", label: `${participant.name} · attack`, roll: "attack", modifier: nonPlayerAttack, tone: isHostileActor(participant) ? "hostile" : undefined })}><small>Total to hit</small><b>{signed(nonPlayerAttack)}</b></button>
                  </div>}
                  {!expanded && <span className="combatant-collapsed-summary">{participant.kind === "enemy" ? <MonsterHpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showValues={viewerHasGmPermissions} /> : <HpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showTemporaryValue={viewerHasGmPermissions} compact />}<span>{declarationHidden ? "Declaration hidden" : participant.action ? `${actionEmojis[participant.action]} ${actionLabels[participant.action]}` : "No action"}</span></span>}
                  <button className="combatant-collapse-toggle" type="button" aria-expanded={expanded} aria-controls={`combatant-body-${participant.id}`} onClick={() => toggleCombatantExpanded(participant.id)}>{expanded ? "Collapse" : "Expand"}</button>
                </header>

                {expanded && <div className="combatant-body" id={`combatant-body-${participant.id}`}>
                  {controlRestricted && <p className="combat-control-notice" role="note">View only · hold Ctrl while using a control to override.</p>}
                  {tracker.phase === "active" && <p className="combat-phase-guidance"><b>Resolution · Segment {tracker.currentSegment}</b><span>{participant.scheduledSegment === tracker.currentSegment ? "Eligible to act now." : participant.scheduledSegment ? `Waiting for segment ${participant.scheduledSegment}.` : "No action is scheduled this round."}</span></p>}
                  {tracker.phase === "round-complete" && <p className="combat-phase-guidance"><b>Round complete</b><span>Review conditions and ongoing effects while the GM prepares the next round.</span></p>}
                  {participant.kind !== "character" && hasProgressionAuthority && tracker.phase === "declaration" && <details className="combatant-setup-panel"><summary><span><b>Combatant setup</b><small>{monsterArmorProfileLabel(participant)} · {participant.attackMode === "weapon" ? weaponRulesById(participant.weaponRulesId)?.name ?? "weapon unmapped" : `${participant.naturalSpeed ?? "normal"} natural attack`}</small></span><i aria-hidden>▸</i></summary><div className="combatant-setup-grid">
                    <label>Name<input value={participant.name} onChange={(event) => updateParticipant(participant.id, { name: event.target.value })} /></label>
                    {participant.kind === "enemy" ? <label>HD<input value={participant.hitDice} onChange={(event) => updateParticipant(participant.id, { hitDice: event.target.value })} onBlur={() => { const rolled = rollMonsterHp(participant.hitDice); if (rolled !== null && participant.maxHp <= 1) updateParticipant(participant.id, { currentHp: rolled, maxHp: rolled }); }} placeholder="2+1" /></label> : <label>BTHB<input type="number" value={participant.attackBonus ?? ""} onChange={(event) => updateParticipant(participant.id, { attackBonus: event.target.value === "" ? null : Number(event.target.value) })} /></label>}
                    <label>Ascending AC<input type="number" value={participant.armorClass ?? ""} onChange={(event) => updateParticipant(participant.id, { armorClass: event.target.value === "" ? null : Number(event.target.value) })} /></label>
                    <label>Current HP<HpMathInput ariaLabel={`${participant.name} current hit points`} value={participant.currentHp} minimum={participant.kind === "enemy" ? 0 : -10} onCommit={(currentHp) => setParticipantHp(participant.id, currentHp)} /></label>
                    <label className="monster-max-hp">Maximum HP<span><input type="number" min="0" value={participant.maxHp} onChange={(event) => setParticipantMaxHp(participant.id, Number(event.target.value) || 0)} /><button type="button" aria-label={`Reroll ${participant.name} hit points`} title="Reroll current and maximum HP from Hit Dice" onClick={() => { const rolled = rollMonsterHp(participant.hitDice); if (rolled !== null) updateParticipant(participant.id, { currentHp: rolled, maxHp: rolled }); }}>↻</button></span></label>
                    <label>Movement<input type="number" min="0" step="30" value={participant.movementRate ?? 0} onChange={(event) => updateParticipant(participant.id, { movementRate: Math.max(0, Number(event.target.value) || 0) })} /></label>
                    <fieldset className="monster-armour-setup"><legend>Armour</legend><div className="compact-segmented-control">{(["natural", "worn"] as const).map((mode) => <button type="button" className={participant.armorMode === mode ? "active" : ""} aria-pressed={participant.armorMode === mode} onClick={() => { const armorProfile = defaultMonsterArmorProfile(mode); const preset = mode === "worn" ? wornArmorProfile(armorProfile) : null; updateParticipant(participant.id, { armorMode: mode, armorProfile, ...(preset ? { armorClass: preset.ascendingAc } : {}) }); }} key={mode}>{mode}</button>)}</div><select aria-label={`${participant.name} armour profile`} value={participant.armorProfile ?? defaultMonsterArmorProfile(participant.armorMode ?? "natural")} onChange={(event) => { const armorProfile = event.target.value as MonsterArmorProfile; const preset = participant.armorMode === "worn" ? wornArmorProfile(armorProfile) : null; updateParticipant(participant.id, { armorProfile, ...(preset ? { armorClass: preset.ascendingAc } : {}) }); }}>{participant.armorMode === "worn" ? wornArmorProfiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.label} · AC {profile.ascendingAc}</option>) : naturalArmorProfiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.label}</option>)}</select></fieldset>
                    <fieldset><legend>Attack</legend><div className="compact-segmented-control">{(["natural", "weapon"] as const).map((mode) => <button type="button" className={participant.attackMode === mode ? "active" : ""} aria-pressed={participant.attackMode === mode} onClick={() => { const rules = mode === "weapon" ? weaponRulesById(participant.weaponRulesId) : null; updateParticipant(participant.id, { attackMode: mode, ...(rules ? { damageExpression: rules.damageSM } : {}) }); }} key={mode}>{mode}</button>)}</div></fieldset>
                    <label>Damage<input value={participant.damageExpression} onChange={(event) => updateParticipant(participant.id, { damageExpression: event.target.value })} placeholder="1d8 or 1d8+1" /></label>
                    {participant.attackMode === "natural" ? <fieldset className="natural-speed-control"><legend>Natural speed <NaturalSpeedInfoButton /></legend><div className="compact-segmented-control">{(["fast", "normal", "slow"] as const).map((speed) => <button type="button" className={(participant.naturalSpeed ?? "normal") === speed ? "active" : ""} aria-pressed={(participant.naturalSpeed ?? "normal") === speed} onClick={() => updateParticipant(participant.id, { naturalSpeed: speed })} key={speed}>{speed}</button>)}</div></fieldset> : <label className="combatant-rules-weapon">Rules weapon<span><select value={participant.weaponRulesId ?? ""} onChange={(event) => { const rules = weaponRulesById(event.target.value); updateParticipant(participant.id, { weaponRulesId: rules?.id ?? null, weaponRulesIds: rules ? Array.from(new Set([rules.id, ...(participant.weaponRulesIds ?? [])])) : participant.weaponRulesIds, ...(rules ? { damageExpression: rules.damageSM } : {}) }); }}><option value="">Choose PHB weapon</option>{phbWeaponRules.map((rules) => <option value={rules.id} key={rules.id}>{rules.name}{rules.weaponType === "ranged" ? " · missile" : rules.missileMode ? " · melee / thrown" : ""}</option>)}</select>{participant.weaponRulesId && <WeaponRulesTooltip rulesId={participant.weaponRulesId} name={weaponRulesById(participant.weaponRulesId)?.name}>ⓘ</WeaponRulesTooltip>}</span></label>}
                    <fieldset className="monster-traits"><legend>Traits</legend><label>Size<select value={participant.size ?? (participant.large ? "large" : "medium")} onChange={(event) => { const size = event.target.value as NonNullable<SegmentedParticipant["size"]>; updateParticipant(participant.id, { size, large: ["large", "huge", "gargantuan"].includes(size) }); }}>{(["tiny", "small", "medium", "large", "huge", "gargantuan"] as const).map((size) => <option value={size} key={size}>{size[0].toUpperCase() + size.slice(1)}</option>)}</select></label>{participant.kind === "enemy" && <label><input type="checkbox" checked={participant.armoredHead} onChange={(event) => updateParticipant(participant.id, { armoredHead: event.target.checked })} />Armored head</label>}{participant.kind === "enemy" && canChooseNonIntelligentSaveTable(tracker.round, participant.joinedRound, tracker.phase) && <label><input type="checkbox" checked={participant.nonIntelligent} onChange={(event) => updateParticipant(participant.id, { nonIntelligent: event.target.checked })} />Non-intelligent saves</label>}</fieldset>
                    <details className="unarmed-override-editor"><summary><span><b>UNARMED</b><small>Optional OSRIC overrides · blanks derive automatically</small></span><i aria-hidden>▸</i></summary><div>
                      {([['hitTargetNumber','Unarmed Hit TN'],['hitAttackModifier','Hit ATK Mod'],['hitDefenseModifier','Hit DEF Mod'],['overbearAttackModifier','Overbear ATK'],['overbearDefenseModifier','Overbear DEF'],['grappleAttackModifier','Grapple ATK'],['grappleDefenseModifier','Grapple DEF'],['magicArmorBonus','Magic armour +']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" value={participant.unarmedOverrides?.[key] ?? ""} onChange={(event) => updateUnarmedOverride(participant, key, event.target.value === "" ? null : Number(event.target.value))} /></label>)}
                      <label>Appendages<input type="number" min="1" value={participant.unarmedOverrides?.appendages ?? 2} onChange={(event) => updateUnarmedOverride(participant, "appendages", Math.max(1, Number(event.target.value) || 2))} /></label>
                      <fieldset><legend>Capabilities</legend>{([['cannotGrapple','Cannot Grapple'],['cannotBeGrappled','Cannot Be Grappled'],['cannotOverbear','Cannot Overbear'],['cannotBeOverborne','Cannot Be Overborne'],['immuneTemporaryDamage','Immune to Temporary Damage'],['fourLegged','Four-legged movement']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(participant.unarmedOverrides?.[key])} onChange={(event) => updateUnarmedOverride(participant, key, event.target.checked)} />{label}</label>)}</fieldset>
                    </div></details>
                    <details className="unarmed-override-editor psionics-setup-editor"><summary><span><b>PSIONICS</b><small>Attack/defense pools and known combat modes</small></span><i aria-hidden>▸</i></summary><div>
                      {(() => { const psionics = normalizePsionics(participant.psionics); return <>
                        <fieldset><legend>Psionic status</legend><label><input type="checkbox" checked={psionics.enabled} onChange={(event) => updatePsionics(participant, { enabled: event.target.checked })} />Psionic combatant</label>{psionics.enabled && <small>Mind Blank is automatic. Add other known modes below.</small>}</fieldset>
                        <label>Attack points<input type="number" min="0" disabled={!psionics.enabled} value={psionics.currentAttackPoints} onChange={(event) => updatePsionics(participant, { currentAttackPoints: Number(event.target.value) || 0 })} /></label>
                        <label>Attack maximum<input type="number" min="0" disabled={!psionics.enabled} value={psionics.maxAttackPoints} onChange={(event) => updatePsionics(participant, { maxAttackPoints: Number(event.target.value) || 0 })} /></label>
                        <label>Defense points<input type="number" min="0" disabled={!psionics.enabled} value={psionics.currentDefensePoints} onChange={(event) => updatePsionics(participant, { currentDefensePoints: Number(event.target.value) || 0 })} /></label>
                        <label>Defense maximum<input type="number" min="0" disabled={!psionics.enabled} value={psionics.maxDefensePoints} onChange={(event) => updatePsionics(participant, { maxDefensePoints: Number(event.target.value) || 0 })} /></label>
                        <fieldset disabled={!psionics.enabled}><legend>Attack modes</legend>{psionicAttackModes.map((mode) => <label key={mode}><input type="checkbox" checked={psionics.attackModes.includes(mode)} onChange={(event) => updatePsionics(participant, { attackModes: event.target.checked ? [...psionics.attackModes, mode] : psionics.attackModes.filter((entry) => entry !== mode) })} />{mode}</label>)}</fieldset>
                        <fieldset disabled={!psionics.enabled}><legend>Defense modes</legend>{psionicDefenseModes.map((mode) => mode === "Mind Blank" ? <label key={mode}><input type="checkbox" checked disabled />{mode} · automatic</label> : <label key={mode}><input type="checkbox" checked={psionics.defenseModes.includes(mode)} onChange={(event) => updatePsionics(participant, { defenseModes: event.target.checked ? [...psionics.defenseModes, mode] : psionics.defenseModes.filter((entry) => entry !== mode) })} />{mode}</label>)}</fieldset>
                      </>; })()}
                    </div></details>
                  </div></details>}
                  {declarationHidden ? <div className="declaration-hidden-notice">{viewerRole === "gm" && participant.kind === "character" ? "Hidden for propriety, CTRL to show" : "Monster declaration hidden for players."}</div> : involuntaryAction || defeatedEnemy ? <div className="inactive-declaration-notice"><strong>{defeatedEnemy ? "Defeated" : hp.current <= -10 ? "Dead" : "Unconscious"}</strong><span>No declaration required. This combatant is automatically skipped while incapacitated; conditions remain until removed or expired.</span></div> : <>
                  <div className="declaration-controls">
                    <label className="declared-action-field">Declared action<select className="emoji-select" aria-label={`${participant.name} declared action`} aria-disabled={controlRestricted || undefined} title={controlRestricted ? "Hold Ctrl to override control restrictions" : undefined} value={participant.action} disabled={locked} onChange={(event) => {
                      const action = event.target.value as SegmentedAction;
                      setBlockedParticipantId(null);
                      declareAction(participant, action);
                    }}><option value="">◆ Select declared action</option>{(participant.action === "unconscious" || participant.action === "die") && <option value={participant.action}>{actionEmojis[participant.action]} {actionLabels[participant.action]}</option>}{availableActionGroups.map((group) => <optgroup label={group.label} key={group.label}>{group.actions.filter((action) => (action !== "spell-like-effect" || participant.kind === "enemy") && (action !== "spell" || !character || hasFreeHand(character) || preparedSpells(character).some((spell) => getSpellcastingTracks(character).find((track) => track.id === spell.trackId)?.tradition === "divine")) && ((action !== "hand-2-melee" && action !== "two-weapon-melee") || Boolean(character && twoWeaponLoadout(character).eligible))).map((action) => <option value={action} disabled={missileDeclarationBlocked(participant, action) || (action === "stand-up" && participantIsOverborne)} key={action}>{actionEmojis[action]} {actionLabels[action]}{missileDeclarationBlocked(participant, action) ? " · engaged" : action === "stand-up" && participantIsOverborne ? " · blocked by Overborne" : ""}</option>)}</optgroup>)}</select></label>
                    {hasSingleTargetControl && <label className="combat-target-field declaration-target-field">Target{(participant.action === "spell" || participant.action === "use-magic" || rangedActions.has(participant.action)) && <small> optional</small>}<select value={participant.targetId ?? ""} disabled={locked} onChange={(event) => updateParticipant(participant.id, { targetId: event.target.value || null, targetIds: [], ready: true })}><option value="">{rangedActions.has(participant.action) ? "No declared target · determine randomly in melee" : (attackActions.has(participant.action) || participant.action === "close" || participant.action === "parry-disengage") ? "Select target" : "No target"}</option>{validTargets.map((target) => <option value={target.id} key={target.id}>{targetOptionLabel(target)} · AC {effectiveArmorClass(target)}{target.kind === "enemy" && !viewerHasGmPermissions ? "" : ` · HP ${participantHp(target).current}/${participantHp(target).maximum}`}</option>)}</select><div className="target-shortcuts">{validTargets.slice(0, 10).map((target) => <button type="button" className={participant.targetId === target.id ? "active" : ""} disabled={locked} onClick={() => updateParticipant(participant.id, { targetId: target.id, targetIds: [], ready: true })} key={target.id}>{targetOptionLabel(target)}</button>)}</div></label>}
                    {(participant.action === "maintain-hold" || participant.action === "release-hold") && <label className="combat-target-field">Hold<select value={participant.actionDetail} disabled={locked} onChange={(event) => { const hold = tracker.grappleHolds.find((entry) => entry.id === event.target.value); updateParticipant(participant.id, { actionDetail: event.target.value, targetId: hold?.defenderId ?? null, ready: Boolean(hold) }); }}><option value="">Select hold</option>{tracker.grappleHolds.filter((hold) => hold.attackerId === participant.id).map((hold) => <option value={hold.id} key={hold.id}>{hold.label} {hold.result} · {tracker.participants.find((entry) => entry.id === hold.defenderId)?.name}</option>)}</select></label>}
                    {participant.action === "psionic-combat" && participant.psionicCombat && (() => {
                      const psionic = normalizePsionics(participant.psionics);
                      const setup = participant.psionicCombat;
                      const targets = targetsForAction(participant, "psionic-combat").filter((target) => target.side !== participant.side);
                      return <fieldset className="psionic-combat-declaration"><legend>Psionic exchange</legend>
                        <label>Attack mode<select value={setup.attackMode ?? ""} disabled={locked} onChange={(event) => updateParticipant(participant.id, { psionicCombat: { ...setup, attackMode: event.target.value as typeof psionic.attackModes[number], useArea: event.target.value === "Id Insinuation" || event.target.value === "Psionic Blast" } })}>{psionic.attackModes.map((mode) => <option value={mode} key={mode}>{mode} · {psionicAttackRules[mode].cost} AP · {psionicAttackRules[mode].area}</option>)}</select></label>
                        <label>Range<select value={setup.range} disabled={locked} onChange={(event) => updateParticipant(participant.id, { psionicCombat: { ...setup, range: event.target.value as typeof setup.range } })}><option value="short">Short</option><option value="medium">Medium · 20% loss</option><option value="long" disabled={setup.attackMode === "Psychic Crush"}>Long · lower band / 20% loss</option></select></label>
                        <label>Exchanges<input type="number" min="1" max="10" value={setup.exchanges} disabled={locked} onChange={(event) => updateParticipant(participant.id, { psionicCombat: { ...setup, exchanges: Math.max(1, Math.min(10, Number(event.target.value) || 1)) } })} /></label>
                        <fieldset><legend>{setup.useArea ? "Area targets" : "Target"}</legend>{targets.map((target) => <label key={target.id}><input type={setup.useArea ? "checkbox" : "radio"} name={`psionic-target-${participant.id}`} checked={setup.targetIds.includes(target.id)} disabled={locked} onChange={(event) => { const targetIds = setup.useArea ? (event.target.checked ? [...setup.targetIds, target.id] : setup.targetIds.filter((id) => id !== target.id)) : [target.id]; updateParticipant(participant.id, { psionicCombat: { ...setup, targetIds }, targetId: targetIds[0] ?? null, ready: targetIds.length > 0 }); }} />{targetOptionLabel(target)}{normalizePsionics(target.psionics).enabled ? " · psionic" : " · non-psionic"}</label>)}</fieldset>
                        {viewerHasGmPermissions && setup.targetIds.map((targetId) => { const target = tracker.participants.find((entry) => entry.id === targetId); const targetPsionic = normalizePsionics(target?.psionics); return target && targetPsionic.enabled ? <label key={`defense-${targetId}`}>Defense · {target.name}<select value={setup.defenseOverrides[targetId] ?? ""} disabled={locked} onChange={(event) => updateParticipant(participant.id, { psionicCombat: { ...setup, defenseOverrides: { ...setup.defenseOverrides, [targetId]: event.target.value ? event.target.value as PsionicDefenseMode : null } } })}><option value="">Auto · best available</option>{targetPsionic.defenseModes.map((mode) => <option value={mode} key={mode}>{mode} · {psionicDefenseRules[mode].cost} DP</option>)}</select></label> : null; })}
                        <small>One exchange is added for each occupied segment. Defenses default to the matrix-favorable known mode; GM may override at resolution.</small>
                      </fieldset>;
                    })()}
                    {tracker.phase === "declaration" && <details className="participant-condition-picker">
                      <summary>Conditions{participantConditions.length ? ` · ${participantConditions.length}` : ""}</summary>
                      <div>
                        <label>Condition<select value={draft.preset} onChange={(event) => {
                          const preset = conditionPresets.find((entry) => entry.name === event.target.value) ?? conditionPresets[0];
                          updateConditionDraft(participant.id, { preset: preset.name, rounds: preset.rounds });
                        }}>{conditionPresets.map((preset) => <option value={preset.name} key={preset.name}>{preset.name}</option>)}</select></label>
                        {draft.preset === "Custom" && <label>Name<input maxLength={28} value={draft.customName} onChange={(event) => updateConditionDraft(participant.id, { customName: event.target.value })} placeholder="Condition name" /></label>}
                        <label>Rounds<input type="number" min="0" value={draft.rounds} onChange={(event) => updateConditionDraft(participant.id, { rounds: Math.max(0, Number(event.target.value) || 0) })} /></label>
                        <p>{selectedCondition.description}</p>
                        <button type="button" disabled={draft.preset === "Custom" && !draft.customName.trim()} onClick={() => addCondition(participant)}>Add to {character?.name ?? participant.name}</button>
                      </div>
                    </details>}
                    {enemySaves && <details className="enemy-save-roller">
                      <summary>Monster saves</summary>
                      <div>{enemySaveLabels.map(([save, label]) => { const saveModifier = conditionRuleFor(participant).saves; const adjustedTarget = enemySaves[save] - saveModifier; return <button title={`Roll ${label} save in Party Chat`} onClick={() => sendChatAction({ kind: "external-roll", label: `${participant.name} · ${label} save`, roll: "save", target: adjustedTarget, tone: "hostile" })} key={save}><small>{saveIcons[save]} {label}</small><b>{adjustedTarget}{saveModifier ? ` (${signed(saveModifier)})` : ""}</b></button>; })}</div>
                    </details>}
                  </div>

                  {participant.kind === "character" && tracker.phase === "declaration" && !participantIsProne && <div className="declaration-shortcuts" aria-label={`${participant.name} common action shortcuts`}><span>Quick actions</span>{shortcutActions.map((action) => <button type="button" className={participant.action === action ? "active" : ""} aria-disabled={controlRestricted || undefined} title={missileDeclarationBlocked(participant, action) ? "Missile attacks are unavailable while engaged" : controlRestricted ? "Hold Ctrl to override control restrictions" : undefined} disabled={locked || missileDeclarationBlocked(participant, action)} onClick={(clickEvent) => { setBlockedParticipantId(null); declareAction(participant, action, clickEvent.ctrlKey); }} key={action}>{actionEmojis[action]} {actionLabels[action]}</button>)}</div>}

                  {participantConditions.length > 0 && <div className="participant-condition-list">{participantConditions.map((effect) => <article className={effect.remainingRounds === 0 ? "expired" : ""} key={effect.id}>
                    <span><strong>{effect.name}</strong><small>{effect.description}</small>{conditionSummary(combatConditionRule([effect])) && <small className="condition-adjustment">Applied: {conditionSummary(combatConditionRule([effect]))}</small>}</span>
                    <label>Rounds<input type="number" min="0" value={effect.remainingRounds} onChange={(event) => updateEffect(effect.id, { remainingRounds: Math.max(0, Number(event.target.value) || 0) })} /></label>
                    <b>{effect.remainingRounds === 0 ? "Expired" : `${effect.remainingRounds} left`}</b>
                    <button className="action-link danger-link" onClick={() => removeEffect(effect.id)}>Remove</button>
                  </article>)}</div>}

                  <div className="action-parameters">
                    {participant.kind !== "character" && participant.attackMode === "weapon" && participant.weaponRulesId && <div className="combat-loadout-strip"><span className="current-combat-weapon"><small>Weapon</small><b><WeaponRulesTooltip rulesId={participant.weaponRulesId} name={weaponRulesById(participant.weaponRulesId)?.name}>{weaponRulesById(participant.weaponRulesId)?.name ?? "Mapped weapon"}</WeaponRulesTooltip></b></span></div>}
                    {(participant.action === "spell" || participant.action === "spell-like-effect" || participant.action === "other" || participant.action === "use-magic") && <label className="action-detail-field">{participant.action === "spell" ? "Spell" : participant.action === "spell-like-effect" ? "Spell-like effect" : participant.action === "use-magic" ? "Device / effect" : "Other action"}{participant.action === "spell" && character && preparedSpells(character).length > 0 ? <select value={participant.preparedSpellSlotId ?? ""} disabled={locked} onChange={(event) => { const spell = preparedSpells(character).find((entry) => entry.slotId === event.target.value); updateParticipant(participant.id, { preparedSpellSlotId: event.target.value || null, actionDetail: spell?.name ?? "", castingTime: spell?.castingTime ?? 1, ready: true }); }}><option value="">Choose prepared spell</option>{preparedSpells(character).map((spell) => <option value={spell.slotId} key={spell.slotId}>{spell.name} · L{spell.level} · {spell.castingTime} seg</option>)}</select> : <input value={participant.actionDetail} disabled={locked} onChange={(event) => updateParticipant(participant.id, { actionDetail: event.target.value, ready: true })} placeholder={participant.action === "spell-like-effect" ? "Breath weapon, gaze…" : participant.action === "spell" ? "Optional spell name" : participant.action === "use-magic" ? "Wand of frost, potion…" : "Drink potion, pull lever..."} />}</label>}
                    {(participant.action === "spell" || participant.action === "spell-like-effect") && <label className="casting-time-field"><span>Casting segments</span>{character && participant.action === "spell" ? <span><b>{participant.castingTime === 0 ? "Instant" : participant.castingTime}</b><small>{participant.castingTime === 0 ? "0 · spellbook" : "spellbook"}</small></span> : <input aria-label={`${participant.name} casting segments`} type="number" min="0" max="10" value={participant.castingTime} disabled={locked} onChange={(event) => updateParticipant(participant.id, { castingTime: Math.max(0, Math.min(10, Number(event.target.value) || 0)), ready: true })} />}</label>}
                    {participant.action === "heroic-assault" ? <fieldset className="heroic-target-picker"><legend>Eligible targets · choose up to {character?.level ?? 1}</legend>{validTargets.length === 0 ? <span>No opponent has HD whose maximum possible roll is below 8 hp.</span> : validTargets.map((target) => <label key={target.id}><input type="checkbox" checked={participant.targetIds.includes(target.id)} disabled={locked || (!participant.targetIds.includes(target.id) && participant.targetIds.length >= (character?.level ?? 1))} onChange={() => toggleHeroicTarget(participant, target.id)} /><span>{targetOptionLabel(target)}</span><small>HD {participantCharacter(target)?.hitDice || target.hitDice || "—"} · maximum {maximumHitPointsFromHitDice(participantCharacter(target)?.hitDice || target.hitDice) ?? "?"} hp</small></label>)}</fieldset> : ((participant.action === "spell" && participant.areaOfEffect) || participant.action === "spell-like-effect") ? <fieldset className="heroic-target-picker"><legend>Area targets</legend>{validTargets.map((target) => <label key={target.id}><input type="checkbox" checked={participant.targetIds.includes(target.id)} disabled={locked} onChange={() => toggleAreaTarget(participant, target.id)} /><span>{targetOptionLabel(target)}</span></label>)}</fieldset> : null}
                    {participant.action === "spell" && <label className="mindless-save-toggle"><input type="checkbox" checked={participant.areaOfEffect} disabled={locked} onChange={(event) => updateParticipant(participant.id, { areaOfEffect: event.target.checked, targetId: null, targetIds: [] })} />Area of effect</label>}
                    {character && (participant.action === "switch-weapon" || participant.action === "close") && <div className="combat-weapon-switch"><label>Hand 1<select value={participant.pendingWeaponId ?? ""} disabled={locked} onChange={(event) => { const item = quickAccessItems(character).find((entry) => entry.id === event.target.value); updateParticipant(participant.id, { pendingWeaponId: event.target.value || null, pendingOffhandWeaponId: item?.requiresBothHands ? null : participant.pendingOffhandWeaponId, ready: true }); }}><option value="">Empty / return to Quick Access</option>{quickAccessItems(character).map((item) => <option value={item.id} key={item.id}>{item.name}{item.requiresBothHands ? " · both hands" : ""}</option>)}</select></label><label>Hand 2<select value={participant.pendingOffhandWeaponId ?? ""} disabled={locked} onChange={(event) => { const item = quickAccessItems(character).find((entry) => entry.id === event.target.value); updateParticipant(participant.id, { pendingOffhandWeaponId: event.target.value || null, pendingWeaponId: item?.requiresBothHands ? null : participant.pendingWeaponId, ready: true }); }}><option value="">Empty / return to Quick Access</option>{quickAccessItems(character).filter((item) => item.id !== participant.pendingWeaponId).map((item) => <option value={item.id} key={item.id}>{item.name}{item.requiresBothHands ? " · both hands" : ""}</option>)}</select></label><small>Anything not selected remains in Quick Access.</small></div>}
                    {participant.stableNpcId && participant.action === "switch-weapon" && <div className="combat-weapon-switch npc-weapon-switch"><label>Ready weapon<select value={participant.pendingWeaponId ?? ""} disabled={locked} onChange={(event) => updateParticipant(participant.id, { pendingWeaponId: event.target.value || null, ready: Boolean(event.target.value) })}><option value="">Choose backup weapon</option>{npcWeaponChoices.filter((weapon) => weapon.id !== participant.weaponRulesId).map((weapon) => <option value={weapon.id} key={weapon.id}>{weapon.name}</option>)}</select></label><small>The selected backup becomes this NPC&apos;s active canonical weapon when the action resolves.</small></div>}
                    {participant.action === "hold" && <label>Act in segment<select value={participant.holdSegment} disabled={locked} onChange={(event) => updateParticipant(participant.id, { holdSegment: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>Segment {index + 1}</option>)}</select></label>}
                    {((participant.action === "missile" && specialized) || meleeRate || (character && participant.action !== "switch-weapon" && handContents)) && <div className="combat-loadout-strip">
                      {participant.action === "missile" && specialized && activeWeaponRules(participant) && <span className="specialized-rate-note">This round: <b>{specializedMissileRate(activeWeaponRules(participant)!, character ? specialistClassLevel(character) : 1, tracker.round)} attack{specializedMissileRate(activeWeaponRules(participant)!, character ? specialistClassLevel(character) : 1, tracker.round) === 1 ? "" : "s"}</b> in the same DEX-adjusted segment · +1 hit / +2 damage.</span>}
                      {meleeRate && <span className="specialized-rate-note">Specialist level {character ? specialistClassLevel(character) : enemyLevel ?? 1} rate <b>{meleeRate}</b> · {tracker.round % 2 ? "odd" : "even"} round · <b>{meleeRate === "3/2" ? tracker.round % 2 ? "segments 1 and 10" : "rolled segment" : meleeRate === "2/1" ? "segments 1 and 10" : tracker.round % 2 ? "segments 1, 5, and 10" : "segments 1 and 10"}</b> · +1 hit / +2 damage.</span>}
                      {character && participant.action !== "switch-weapon" && handContents && <span className="current-combat-weapon combat-hand-readout"><span><small>Hand 1</small><b>{handContents.handOneRulesId ? <WeaponRulesTooltip rulesId={handContents.handOneRulesId}>{handContents.handOne}</WeaponRulesTooltip> : handContents.handOne}</b></span><span><small>Hand 2</small><b>{handContents.handTwoRulesId ? <WeaponRulesTooltip rulesId={handContents.handTwoRulesId}>{handContents.handTwo}</WeaponRulesTooltip> : handContents.handTwo}</b></span></span>}
                    </div>}
                    {participant.action === "three-piece" && <fieldset className="monster-onslaught-editor"><legend>Monster Onslaught · {participant.onslaughtAttacks.length}/10 attacks</legend><div>{participant.onslaughtAttacks.map((attack, index) => <label key={attack.id}><b>Attack {index + 1}</b><small>{attack.timing === "segment-1" ? "Segment 1" : attack.timing === "segment-10" ? "Segment 10" : attack.rolledSegment ? `d6 → segment ${attack.rolledSegment}` : "Roll its own d6 segment"}</small><input aria-label={`Monster Onslaught attack ${index + 1} damage`} value={attack.damageExpression} disabled={locked} onChange={(event) => updateOnslaughtAttack(participant, attack.id, event.target.value)} placeholder="1d6+1" />{attack.timing === "rolled" && participant.onslaughtAttacks.length > 2 && !locked && <button className="action-link danger-link" type="button" onClick={() => removeOnslaughtAttack(participant, attack.id)}>Remove</button>}</label>)}</div><footer><span>Segment 1 and 10 attacks are fixed. Every middle attack rolls its own d6 segment.</span><button type="button" disabled={locked || participant.onslaughtAttacks.length >= 10} onClick={() => addOnslaughtAttack(participant)}>+ Rolled attack</button></footer></fieldset>}
                    {(participant.action === "missile" || participant.action === "spec-ranged" || participant.action === "close-hurl") && (character
                      ? <span className="segment-modifier-note">DEX initiative adjustment: {modifier === 0 ? "0" : signed(modifier)} segment{Math.abs(modifier) === 1 ? "" : "s"}.</span>
                      : <label>Missile modifier<input type="number" min="-3" max="3" value={participant.segmentModifier} disabled={locked} onChange={(event) => updateParticipant(participant.id, { segmentModifier: Number(event.target.value) || 0 })} /></label>)}
                  </div>

                  {mismatch && suggestedWeapon && !locked
                      ? <button className="weapon-mismatch weapon-switch-shortcut" type="button" onClick={() => updateParticipant(participant.id, { action: "switch-weapon", actionDetail: "", targetId: null, targetIds: [], pendingWeaponId: suggestedWeapon.id, statusNote: `Move ${suggestedWeapon.name} to a hand`, ready: true })}>⚠ {mismatch} Move {suggestedWeapon.name} to a hand this round.</button>
                    : mismatch && <div className="weapon-mismatch" role="alert">⚠ {mismatch}{!suggestedWeapon ? " No valid weapon is listed on this character sheet." : ""}</div>}
                  {((attackActions.has(participant.action) && attackRequiresDeclaredTarget(participant.action)) || participant.action === "close" || participant.action === "parry-disengage") && (participant.action === "heroic-assault" ? !participant.targetIds.length : !participant.targetId) && <div className="target-required" role="status">{participant.action === "heroic-assault" ? "Choose one or more eligible low-HD opponents." : "Choose an opposing target before initiative can be rolled."}</div>}
                  {(participant.action === "parry" || participant.action === "parry-disengage") && <div className="parry-ac-note">Parry AC this round: <b>{effectiveArmorClass(participant)}</b>. Ascending AC includes positive STR melee and equipped-weapon to-hit bonuses{character && handStateHasShield(character.handState) ? ", plus the equipped shield" : ""}. {participant.action === "parry-disengage" ? "The chosen enemy receives one free +4 attack." : ""}</div>}

                  <div className="action-explanation">{participant.action ? <><span className="emoji-inline">{actionEmojis[participant.action]}</span><span>{actionHelp[participant.action]}{actionPages[participant.action] && <small>{actionPages[participant.action]}</small>}</span></> : null}</div>

                  {character && statIndex !== null && <div className="initiative-stat-reference">
                    <span className="initiative-stat-label">Attack reference</span>
                    <button className="initiative-score-tile" title="Click: full roll · Shift: roll under · Ctrl: post score" onClick={(event) => sendChatAction({ kind: "ability", characterId: character.id, statIndex, mode: event.ctrlKey ? "value" : event.shiftKey ? "under" : "full" })}><span>{abilityNames[statIndex]}</span><b>{character.stats[statIndex]}</b></button>
                    <button className="initiative-derived-tile" title="Class-based bonus applied to every attack" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "To-hit bonus", value: signed(character.toHit) })}><span>Class to hit</span><b>{signed(character.toHit)}</b></button>
                    {statItems.map((item) => <button className="initiative-derived-tile" key={item.key} onClick={() => sendChatAction({ kind: "derived", characterId: character.id, statIndex, key: item.key })}><span>{initiativeReferenceLabel(item.key, item.label)}</span><b>{item.value}</b></button>)}
                    {totalAttackBonus !== null && <button className="initiative-derived-tile attack-total-tile" title="Roll this attack in Party Chat" onClick={() => sendChatAction({ kind: "external-roll", label: `${character.name} · ${actionLabels[participant.action] || "attack"}`, roll: "attack", modifier: totalAttackBonus })}><span>Total to hit</span><b>{signed(totalAttackBonus)}</b></button>}
                    {specialized && totalDamageBonus !== null && <button className="initiative-derived-tile" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "Specialized damage bonus", value: signed(totalDamageBonus) })}><span>Total damage</span><b>{signed(totalDamageBonus)}</b></button>}
                    {actionHitBonus !== 0 && <strong className="charge-bonus-reminder">Action bonus: {signed(actionHitBonus)} hit{actionDamageBonus ? ` / ${signed(actionDamageBonus)} damage` : ""}</strong>}
                  </div>}
                  </>}
                </div>}

                {expanded && <footer className="combatant-footer">
                  {tracker.phase === "declaration" && !involuntaryAction && !defeatedEnemy && <button disabled={controlRestricted} title={controlRestricted ? "Hold Ctrl to override control restrictions" : undefined} className={`ready-toggle ${participant.ready ? "active" : ""}`} onClick={() => updateParticipant(participant.id, { ready: !participant.ready })}>{participant.ready ? "✓ Ready" : participant.side === "opposition" ? "Mark enemy ready" : "Mark ready"}</button>}
                  <div className="combat-hp-controls">{participant.kind !== "enemy" || viewerHasGmPermissions ? <><button aria-disabled={controlRestricted || undefined} title={controlRestricted ? "Hold Ctrl to override control restrictions · Shift-click adjusts temporary damage" : "Shift-click to subtract temporary damage"} aria-label={`Remove one HP from ${participant.name}; hold Shift to subtract one temporary damage`} onClick={(clickEvent) => clickEvent.shiftKey ? adjustParticipantTemporaryDamage(participant.id, -1, clickEvent.ctrlKey) : setParticipantHp(participant.id, hp.current - 1, false, clickEvent.ctrlKey)}>−</button>{participant.kind === "enemy" ? <MonsterHpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showValues /> : <HpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showTemporaryValue={viewerHasGmPermissions} compact />}<button aria-disabled={controlRestricted || undefined} title={controlRestricted ? "Hold Ctrl to override control restrictions · Shift-click adjusts temporary damage" : "Shift-click to add temporary damage"} aria-label={`Add one HP to ${participant.name}; hold Shift to add one temporary damage`} onClick={(clickEvent) => clickEvent.shiftKey ? adjustParticipantTemporaryDamage(participant.id, 1, clickEvent.ctrlKey) : setParticipantHp(participant.id, hp.current + 1, false, clickEvent.ctrlKey)}>+</button></> : <MonsterHpBar current={hp.current} maximum={hp.maximum} temporary={hp.temporary} showValues={false} />}</div>
                  {tracker.phase !== "declaration" && <div className="participant-timing"><button type="button" className="combat-timing-tile" disabled={!hasProgressionAuthority || participant.scheduledSegment === null} onClick={() => participant.scheduledSegment !== null && goToSegment(participant.scheduledSegment)}><small>Initiative d6</small><b>{participant.initiativeRoll ?? "—"}</b></button><button type="button" className="combat-timing-tile" disabled={!hasProgressionAuthority || participant.scheduledSegment === null} onClick={() => participant.scheduledSegment !== null && goToSegment(participant.scheduledSegment)}><small>Segment</small><b>{participant.scheduledSegment ?? "—"}</b></button><button type="button" className="combat-timing-tile" disabled={!hasProgressionAuthority || participant.scheduledSegment === null} onClick={() => participant.scheduledSegment !== null && goToSegment(participant.scheduledSegment)}><small>{currentSpeedFactor === null ? "Within d6" : participant.kind !== "character" && participant.attackMode !== "weapon" ? "Natural speed" : "Weapon speed"}</small><b>{currentSpeedLabel}</b></button></div>}
                  {participant.statusNote && <strong className="participant-status">{participant.statusNote}</strong>}
                  {participant.action === "spell" && tracker.phase !== "declaration" && !participant.completedEvents.includes("spell-complete") && <button className="secondary-button danger-link" onClick={() => interruptSpell(participant.id)}>Spell interrupted</button>}
                  {participant.kind === "enemy" && tracker.phase === "declaration" && hasProgressionAuthority && <button className="secondary-button duplicate-monster-button" onClick={() => copyMonster(participant)}>Duplicate monster</button>}
                  {hasProgressionAuthority && <button className="action-link danger-link remove-combatant" disabled={tracker.phase === "active"} onClick={() => removeParticipant(participant.id)}>Remove</button>}
                </footer>}
              </article>
              </Fragment>;
            })}
          </div>
        )}

        {tracker.phase === "declaration" && declaringEnemies.length > 0 && viewerHasGmPermissions && <details className="monster-group-declaration">
          <summary>⚑ Monster group declaration <span>{bulkEnemyIds.filter((id) => declaringEnemies.some((enemy) => enemy.id === id)).length || "No"} selected</span></summary>
          <div>
            <p>Set one action for every living monster, or check only the monsters that should receive it.</p>
            <label className="monster-group-all"><input type="checkbox" checked={declaringEnemies.length > 0 && declaringEnemies.every((enemy) => bulkEnemyIds.includes(enemy.id))} onChange={(event) => setBulkEnemyIds(event.target.checked ? declaringEnemies.map((enemy) => enemy.id) : [])} />All monsters</label>
            <div className="monster-group-checklist">
              {declaringEnemies.map((enemy) => <label key={enemy.id}><input type="checkbox" checked={bulkEnemyIds.includes(enemy.id)} onChange={() => toggleBulkEnemy(enemy.id)} /><span>{enemy.name || "Unnamed monster"}</span><small>HD {enemy.hitDice || "—"} · AC {enemy.armorClass ?? "—"}</small></label>)}
            </div>
            <div className="monster-group-apply">
              <label>Declared action<select className="emoji-select" value={bulkEnemyAction} onChange={(event) => setBulkEnemyAction(event.target.value as SegmentedAction)}>{actionGroups.map((group) => {
                const actions = group.actions.filter((action) => !["spec-melee", "spec-ranged", "heroic-assault", "melee-combination", "switch-weapon"].includes(action));
                return actions.length ? <optgroup label={group.label} key={group.label}>{actions.map((action) => <option value={action} key={action}>{actionEmojis[action]} {actionLabels[action]}</option>)}</optgroup> : null;
              })}</select></label>
              <label><input type="checkbox" checked={bulkEnemyRandomTarget} onChange={(event) => setBulkEnemyRandomTarget(event.target.checked)} /> RANDOM TARGET</label>
              <button className="primary-button" type="button" disabled={!bulkEnemyIds.some((id) => declaringEnemies.some((enemy) => enemy.id === id))} onClick={applyBulkEnemyAction}>Apply to selected</button>
            </div>
          </div>
        </details>}

        <details className="action-guide"><summary>Action explanations</summary><div>{(Object.keys(actionHelp) as Array<Exclude<SegmentedAction, "">>).map((action) => <article key={action}><span className="emoji-glyph compact">{actionEmojis[action]}</span><span><strong>{actionLabels[action]}</strong><small>{actionHelp[action]}</small>{actionPages[action] && <em>{actionPages[action]}</em>}</span></article>)}</div></details>

        {(tracker.psionicExchanges?.length ?? 0) > 0 && <details className="psionic-combat-log"><summary>Psionic combat log <span>{tracker.psionicExchanges?.length}</span></summary><div>{[...(tracker.psionicExchanges ?? [])].slice(-20).reverse().map((entry) => { const attacker = tracker.participants.find((participant) => participant.id === entry.attackerId); const defender = tracker.participants.find((participant) => participant.id === entry.defenderId); return <article key={entry.id}><strong>S{entry.segment} · {attacker?.name ?? "Unknown"} → {defender?.name ?? "Unknown"}</strong><span>{entry.attackMode} vs {entry.defenseMode ?? "non-psionic"} · {entry.range}</span><small>{entry.attackCost} AP · {entry.defenseCost} DP · {entry.result ?? "no result"}{entry.rolls.length ? ` · rolls ${entry.rolls.join(", ")}` : ""}</small></article>; })}</div></details>}
      </section>

      <section className="panel segmented-round-controls">
        <div className="panel-heading split-heading">
          <div><p className="round-kicker">Round {tracker.round}</p><h2>{tracker.phase === "declaration" ? "2. Roll initiative" : tracker.phase === "active" ? `Segment ${tracker.currentSegment}` : "Round complete"}</h2></div>
          {hasProgressionAuthority ? <button className="secondary-button" onClick={resetCurrentRound}>Reset this round</button> : <span className="combat-authority-status">GM controls phase and segment</span>}
        </div>

        {tracker.phase === "declaration" && <fieldset className="roll-setup-grid" disabled={!hasProgressionAuthority} aria-label={hasProgressionAuthority ? "Initiative controls" : "Initiative controls are managed by the GM"}>
          {tracker.round === 1 && <section className="surprise-panel" aria-labelledby="surprise-panel-title">
            <header><span><strong id="surprise-panel-title">Opening surprise</strong><small>Roll once at the start of combat</small></span><div className="surprise-color-key" aria-label="Surprise segment colors"><span className="party">Players</span><span className="opposition">Monsters</span><span className="both">Both</span></div></header>
            <div className="surprise-sides">
              <article className="surprise-side party">
                <div className="surprise-side-title"><strong>Players</strong><label><input type="checkbox" checked={tracker.partySurprised} onChange={(event) => setSurpriseChecked("party", event.target.checked)} />Manual surprise</label></div>
                {partyEncumbranceModifier !== 0 && <small className="surprise-encumbrance">Encumbrance {partyEncumbranceModifier > 0 ? "+" : ""}{partyEncumbranceModifier}</small>}
                <button type="button" onClick={() => rollSurprise("party")}>Roll d6</button>
                <output className="surprise-result">{tracker.partySurpriseRoll === null ? tracker.partySurpriseSegments ? `Manual · ${tracker.partySurpriseSegments} segment${tracker.partySurpriseSegments === 1 ? "" : "s"}` : "Not rolled" : <>d6 <b>{tracker.partySurpriseRoll}</b> · {tracker.partySurpriseSegments ? `${tracker.partySurpriseSegments} segment${tracker.partySurpriseSegments === 1 ? "" : "s"}` : "alert"}</>}</output>
              </article>
              <article className="surprise-side opposition">
                <div className="surprise-side-title"><strong>Monsters</strong><label><input type="checkbox" checked={tracker.oppositionSurprised} onChange={(event) => setSurpriseChecked("opposition", event.target.checked)} />Manual surprise</label></div>
                <button type="button" onClick={() => rollSurprise("opposition")}>Roll d6</button>
                <output className="surprise-result">{tracker.oppositionSurpriseRoll === null ? tracker.oppositionSurpriseSegments ? `Manual · ${tracker.oppositionSurpriseSegments} segment${tracker.oppositionSurpriseSegments === 1 ? "" : "s"}` : "Not rolled" : <>d6 <b>{tracker.oppositionSurpriseRoll}</b> · {tracker.oppositionSurpriseSegments ? `${tracker.oppositionSurpriseSegments} segment${tracker.oppositionSurpriseSegments === 1 ? "" : "s"}` : "alert"}</>}</output>
              </article>
            </div>
          </section>}

          <div className="roll-initiative-card phase-advance-readiness"><div className="roll-button-line"><strong className={`initiative-readiness ${readyPlayers === playerParticipants.length && readyEnemies === enemyParticipants.length && tracker.participants.length ? "ready-complete" : readyPlayers || readyEnemies ? "ready-partial" : "ready-none"}`}>Party {readyPlayers}/{playerParticipants.length} · Enemies {readyEnemies}/{enemyParticipants.length} ready</strong><div className="declaration-stopwatch" aria-label={`${declarationElapsedSeconds} seconds spent declaring actions`}><span>Declaration time</span><b>⏱ {declarationClock}</b></div></div><small className="force-roll-hint">Use the phase tracker below to roll initiative. Ctrl-click it to force blocked combatants to Skip.</small>{declarationBlockers.length > 0 && <button className="declaration-blocker" type="button" onClick={() => scrollToDeclaration(declarationBlockers[0].participantId)}><strong>Waiting on:</strong> {declarationBlockers[0].message}{declarationBlockers.length > 1 ? ` · ${declarationBlockers.length - 1} more` : ""} <u>Show blocker</u></button>}</div>
        </fieldset>}

        {tracker.phase === "declaration" && phaseAdvanceControl()}

        {tracker.phase !== "declaration" && <>
          {tracker.rollMode === "group" && <div className="group-rolls"><span>Party d6 <b>{tracker.partyRoll}</b></span><span>Opposition d6 <b>{tracker.oppositionRoll}</b></span></div>}
          {tracker.round === 1 && (tracker.partySurpriseRoll !== null || tracker.oppositionSurpriseRoll !== null || tracker.partySurpriseSegments > 0 || tracker.oppositionSurpriseSegments > 0) && <div className="surprise-result-summary"><span className="party"><b>Player surprise</b>{tracker.partySurpriseRoll === null ? "Manual" : `d6 ${tracker.partySurpriseRoll}`} · {tracker.partySurpriseSegments ? `${tracker.partySurpriseSegments} segment${tracker.partySurpriseSegments === 1 ? "" : "s"}` : "alert"}</span><span className="opposition"><b>Monster surprise</b>{tracker.oppositionSurpriseRoll === null ? "Manual" : `d6 ${tracker.oppositionSurpriseRoll}`} · {tracker.oppositionSurpriseSegments ? `${tracker.oppositionSurpriseSegments} segment${tracker.oppositionSurpriseSegments === 1 ? "" : "s"}` : "alert"}</span></div>}

          <div ref={timelineScrollRef} className="combat-timeline-scroll" data-authority={hasProgressionAuthority ? "gm" : "read-only"} tabIndex={0} aria-label={hasProgressionAuthority ? "GM-controlled combat timeline" : "Read-only combat timeline controlled by the GM"}><div className="segment-track" aria-label="Combat segments">{Array.from({ length: 10 }, (_, index) => {
            const segment = index + 1;
            const segmentEvents = sortSegmentEvents(eventsThisRound.filter((event) => event.segment === segment));
            const shown = segmentEvents.slice(0, 4);
            const playerSurpriseSegment = tracker.round === 1 && segment <= tracker.partySurpriseSegments;
            const monsterSurpriseSegment = tracker.round === 1 && segment <= tracker.oppositionSurpriseSegments;
            const surpriseClass = playerSurpriseSegment && monsterSurpriseSegment ? "surprise-both" : playerSurpriseSegment ? "surprise-party" : monsterSurpriseSegment ? "surprise-opposition" : "";
            const surpriseLabel = playerSurpriseSegment && monsterSurpriseSegment ? "Both surprised" : playerSurpriseSegment ? "Players surprised" : monsterSurpriseSegment ? "Monsters surprised" : "";
            return <button data-combat-segment={segment} type="button" disabled={!hasProgressionAuthority || !segmentEvents.length} aria-current={segment === tracker.currentSegment && tracker.phase === "active" ? "step" : undefined} aria-label={`${hasProgressionAuthority && segmentEvents.length ? `Go to combat segment ${segment}` : `Combat segment ${segment}`}${segmentEvents.length ? "" : ", empty"}${surpriseLabel ? `, ${surpriseLabel}` : ""}`} className={`segment-card ${!hasProgressionAuthority ? "read-only" : ""} ${segment < tracker.currentSegment || tracker.phase === "round-complete" ? "past" : ""} ${segment === tracker.currentSegment && tracker.phase === "active" ? "current" : ""} ${segmentEvents.length ? "has-event" : "empty"} ${surpriseClass}`} onClick={() => hasProgressionAuthority && goToSegment(segment)} key={segment}>
              <span className="segment-number">{segment}</span>
              {surpriseLabel && <span className="segment-surprise-label">{surpriseLabel}</span>}
              <span className="segment-card-events">{shown.map((event) => {
                const participant = tracker.participants.find((entry) => entry.id === event.participantId);
                if (!participant) return null;
                const character = participantCharacter(participant);
                const forfeited = eventForfeitedBySurprise(participant, event);
                const eventStyle = participant.kind === "enemy"
                  ? ({ backgroundColor: "var(--enemy-bg)", color: "var(--enemy-fg)", "--tile-foreground": "var(--enemy-fg)" } as React.CSSProperties)
                  : character
                    ? characterFillStyle(character.tileColor)
                    : ({ backgroundColor: "var(--bg-surface-inset)", color: "var(--text-primary)", "--tile-foreground": "var(--text-primary)" } as React.CSSProperties);
                return <span className={`segment-mini-event ${forfeited ? "surprise-forfeit" : ""}`} style={eventStyle} title={`${participant.name}: ${event.label}${forfeited ? " — forfeited by surprise" : ""}`} key={`${event.participantId}-${event.key}`}>{marker(participant, true)}<span className="emoji-glyph compact action">{event.emoji}</span>{forfeited && <i>×</i>}</span>;
              })}{segmentEvents.length > 4 && <span className="segment-overflow">…</span>}</span>
            </button>;
          })}</div></div>

          {phaseAdvanceControl()}

          <section className="segment-detail-panel">
            <div className="segment-detail-heading"><div><p className="round-kicker">Round {tracker.round}</p><h3>{tracker.currentSegment ? `Segment ${tracker.currentSegment}` : "No scheduled events"}</h3></div><span>{selectedSegmentEvents.length} {selectedSegmentEvents.length === 1 ? "entry" : "entries"}</span></div>
            {selectedSegmentEvents.length === 0 ? <div className="compact-empty">Nothing is scheduled in this segment.</div> : <div className="segment-detail-list">{selectedSegmentEvents.map((event) => {
              const participant = tracker.participants.find((entry) => entry.id === event.participantId);
              if (!participant) return null;
              const eventTargetId = event.targetId ?? participant.targetId;
              const target = eventTargetId ? tracker.participants.find((entry) => entry.id === eventTargetId) : undefined;
              const eventTargets = (participant.areaOfEffect || participant.action === "spell-like-effect")
                ? areaTargetsFor(participant)
                : target ? [target] : [];
              const targetDied = Boolean(target
                && !participant.areaOfEffect
                && participant.action !== "spell-like-effect"
                && isDefeatedForInitiative(target)
                && ((participant.action === "spell" && event.key === "spell-complete") || meleeActions.has(participant.action) || rangedActions.has(participant.action)));
              const forfeited = eventForfeitedBySurprise(participant, event);
              const surprisedThrough = participantSurpriseSegments(participant);
              return <article className={`segment-event-entry actor-${participant.kind} ${forfeited ? "surprise-forfeited-event" : ""}`} key={`${participant.id}-${event.key}`}>
                <div className="segment-event-summary">
                  <span className="segment-order-roll" title={isMeleeAction(participant.action) && activeSpeedFactor(participant) !== null ? `Attack speed ${activeSpeedFactor(participant)} breaks established melee segment ties` : "Within-segment d6"}>{isMeleeAction(participant.action) && activeSpeedFactor(participant) !== null ? activeSpeedLabel(participant, true) : participant.subInitiativeRoll}</span>
                  <div className="segment-matchup">
                    <div className="segment-matchup-card attacker">
                      {marker(participant)}
                      <span className="emoji-glyph action-large">{event.emoji}</span>
                      <span>{segmentCombatantName(participant)}<small>{event.label}{forfeited ? " · FORFEITED" : ""}</small><small className="combatant-stats-summary">{matchupStats(participant)}</small>{combatHpDisplay(participant)}</span>
                    </div>
                    {eventTargets.length > 0 && <><span className="matchup-vs">{eventTargets.length > 1 ? "AREA" : "VS"}</span><div className="segment-area-targets">{eventTargets.map((areaTarget) => <div className="segment-matchup-card target" key={areaTarget.id}><span className="target-role">Target</span>{marker(areaTarget)}<span>{segmentCombatantName(areaTarget)}<small className="combatant-stats-summary">{matchupStats(areaTarget)}</small>{combatHpDisplay(areaTarget)}</span></div>)}</div></>}
                  </div>
                  <b>{participant.side === "party" ? "Party" : "Opposition"}</b>
                </div>
                {forfeited ? <div className="event-adjudication surprise-forfeit-notice"><strong>Action forfeited by surprise</strong><span>{participant.name} is unable to act through segment {surprisedThrough}. No attack, movement, spellcasting, or other action resolves here.</span></div> : targetDied ? <div className="event-adjudication target-died-notice"><strong>Target died</strong><span>{target?.name} is defeated; {participant.name}&apos;s declared action does not resolve.</span></div> : eventAdjudication(participant, event)}
              </article>;
            })}</div>}
          </section>

          {hasProgressionAuthority && <div className="segment-navigation segment-navigation-review"><button className="previous-segment-button" disabled={tracker.phase === "active" ? previousOccupiedSegment === undefined : !occupiedSegments.length} onClick={previousSegment}>{tracker.phase === "active" ? <>← Previous occupied<small>{previousOccupiedSegment !== undefined ? `segment ${previousOccupiedSegment}` : "no earlier events"}</small></> : "Review last occupied segment"}</button></div>}
        </>}
      </section>

      <section className="panel combat-marching-reference">
        <div className="panel-heading"><div><h2>Marching reference</h2><p>{campaign.dashboard.marchColumns === 5 ? "5-column formation" : `${campaign.dashboard.marchColumns}-column formation`} · read front to rear.</p></div></div>
        <span className="compact-march-direction">Front</span>
        <div className={`combat-march-grid columns-${campaign.dashboard.marchColumns}`} style={{ "--combat-march-columns": campaign.dashboard.marchColumns } as React.CSSProperties}>
          {combatMarchSlots.length === 0 ? <span className="compact-empty">No marching order set.</span> : combatMarchSlots.map((characterId, index) => {
            const character = characterId ? campaign.characters.find((entry) => entry.id === characterId) : undefined;
            return character
              ? <span className="combat-march-chip" style={characterFillStyle(character.tileColor)} title={`Position ${index + 1}: ${character.name}`} key={`${character.id}-${index}`}><b>{index + 1}</b><i>{character.emoji}</i><CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink></span>
              : <span className="combat-march-chip empty" key={`empty-${index}`}><b>{index + 1}</b><span>Empty</span></span>;
          })}
        </div>
        <span className="compact-march-direction rear">Rear</span>
        <div className="combat-scout-reference"><strong>Scouting ahead</strong>{combatScout ? <span style={characterFillStyle(combatScout.tileColor)}><i>{combatScout.emoji}</i><CharacterNameLink characterId={combatScout.id}>{combatScout.name}</CharacterNameLink><small>AC {combatScout.armorClass} · HP {combatScout.currentHp}/{combatScout.maxHp}</small></span> : <em>No scout assigned</em>}</div>
      </section>

      <details className="panel segmented-rules"><summary>Combat sequence</summary><div className="combat-sequence"><p><b>1. Check surprise (opening only).</b> Each eligible side rolls once. A surprised combatant forfeits actions scheduled during its surprise segments; player DEX can shorten that character&apos;s duration. <small>Player Guide pp.90-91</small></p><p><b>2. Declare actions.</b> Choose each combatant&apos;s action, target when required, hand and Quick Access changes, and casting time before initiative. <small>p.91</small></p><p><b>3. Roll initiative.</b> Use the side d6 or individual d6 option. Lower results act earlier; missile initiative is shifted by DEX. <small>pp.92-93</small></p><p><b>4. Resolve occupied segments.</b> The tracker jumps over empty segments. Within one segment, resolve the secondary d6 from lowest to highest, with movement, attacks, spells, and inventory changes shown separately. <small>pp.93-96</small></p><p><b>5. Finish the round.</b> Apply automatic dying HP loss, reduce timed conditions, then declare the next round. Characters who charged or closed begin the next declaration with melee selected but are not marked ready.</p></div></details>

      <details className="panel combat-referee-settings"><summary><span><b>Combat settings</b><small>{tracker.rollMode === "individual" ? "Individual initiative" : "Group initiative"} · HD damage {tracker.houseRuleHitDieDamage ? "on" : "off"} · declarations {tracker.showAllDeclarations ? "viewable" : "private"}</small></span><i aria-hidden>▸</i></summary><fieldset disabled={!hasProgressionAuthority} aria-label={hasProgressionAuthority ? "GM and Solo combat settings" : "Combat settings controlled by the GM"}>
        <label><input type="checkbox" checked={tracker.rollMode === "individual"} onChange={(event) => updateTracker({ rollMode: event.target.checked ? "individual" : "group" }, true)} /><span><strong>Individual initiative</strong><small>Unchecked uses one d6 for each side.</small></span></label>
        <label><input type="checkbox" checked={tracker.houseRuleHitDieDamage} onChange={(event) => updateTracker({ houseRuleHitDieDamage: event.target.checked }, true)} /><span><strong>HD is damage</strong><small>Player weapon dice use the character&apos;s hit die.</small></span></label>
        <label><input type="checkbox" checked={tracker.magicalArmorWrestling} onChange={(event) => updateTracker({ magicalArmorWrestling: event.target.checked }, true)} /><span><strong>Magical armour helps wrestling</strong><small>Optional OSRIC rule: reduce Unarmed Hit TN by 2 per armour +, minimum TN 2.</small></span></label>
        <label><input type="checkbox" checked={tracker.showAllDeclarations} onChange={(event) => updateTracker({ showAllDeclarations: event.target.checked }, true)} /><span><strong>All declarations viewable</strong><small>Shows declarations to both sides during declaration.</small></span></label>
      </fieldset></details>
    </section>
  );
}
