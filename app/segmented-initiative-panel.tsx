Warning: truncated output (original token count: 83798)
Total output lines: 4039

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
    if (partic…53798 tokens truncated…ssion: event.target.value })} placeholder="1d8 or 1d8+1" /></label>
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
