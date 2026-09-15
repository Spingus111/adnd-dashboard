import type {
  InventoryManagementState,
  PhysicalInventoryOwner,
  SegmentedParticipant,
  StableNpc,
  StableNpcTemplateId,
} from "./types";
import { carrierBagsForOwner, stoneToUnits } from "./inventory-management.ts";
import { sharedId } from "./shared-id.ts";
import { weaponRulesById } from "./weapon-rules.ts";
import { normalizeUnarmedOverrides } from "./unarmed-combat.ts";
import { normalizePsionics } from "./psionics.ts";
import { rollSecureDie } from "./random.ts";

export type StableNpcTemplate = {
  id: StableNpcTemplateId;
  label: string;
  prefix: string;
  subtypes?: Array<{ id: string; label: string }>;
};

export const stableNpcTemplates: StableNpcTemplate[] = [
  { id: "heavy-foot", label: "Heavy Foot", prefix: "H" },
  { id: "light-foot", label: "Light Foot", prefix: "L" },
  { id: "archer", label: "Archer", prefix: "A", subtypes: [{ id: "shortbowman", label: "Shortbowman" }, { id: "longbowman", label: "Longbowman" }] },
  { id: "crossbowman", label: "Crossbowman", prefix: "C" },
  { id: "pikeman", label: "Pikeman", prefix: "P" },
  { id: "sergeant", label: "Sergeant", prefix: "S" },
  { id: "torchbearer", label: "Torchbearer", prefix: "T" },
  { id: "porter", label: "Porter", prefix: "B" },
  { id: "mule", label: "Mule", prefix: "M" },
  { id: "horse", label: "Horse", prefix: "R", subtypes: [
    { id: "draft", label: "Draft Horse" },
    { id: "riding", label: "Riding Horse" },
    { id: "all-purpose", label: "All-Purpose Horse" },
    { id: "light-warhorse", label: "Light Warhorse" },
    { id: "medium-warhorse", label: "Medium Warhorse" },
    { id: "heavy-warhorse", label: "Heavy Warhorse" },
  ] },
  { id: "ox", label: "Ox", prefix: "O" },
  { id: "dog", label: "Dog", prefix: "D", subtypes: [{ id: "ordinary", label: "Ordinary / Guard Dog" }, { id: "war", label: "War Dog" }] },
];

const templateMap = new Map(stableNpcTemplates.map((template) => [template.id, template]));

function die(size: number) {
  return rollSecureDie(size);
}

function rollHp(count: number, size: number, bonus = 0) {
  return Math.max(1, Array.from({ length: count }, () => die(size)).reduce((sum, value) => sum + value, bonus));
}

function horseDefaults(subtypeId: string | null) {
  // OSRIC horse table: riding/all-purpose are dashboard labels mapped to the
  // closest ordinary and medium horse profiles; warhorse profiles are direct.
  if (subtypeId === "heavy-warhorse") return { label: "Heavy Warhorse", hitDice: "3+3", hp: rollHp(3, 8, 3), move: 150, damage: "1d8", onslaught: ["1d8", "1d8", "1d3"] };
  if (subtypeId === "medium-warhorse" || subtypeId === "all-purpose") return { label: subtypeId === "all-purpose" ? "All-Purpose Horse" : "Medium Warhorse", hitDice: "2+2", hp: rollHp(2, 8, 2), move: 180, damage: "1d6", onslaught: ["1d6", "1d6", "1d3"] };
  if (subtypeId === "light-warhorse") return { label: "Light Warhorse", hitDice: "2", hp: rollHp(2, 8), move: 240, damage: "1d4", onslaught: ["1d4", "1d4"] };
  if (subtypeId === "riding") return { label: "Riding Horse", hitDice: "2", hp: rollHp(2, 8), move: 240, damage: "1d3", onslaught: ["1d3"] };
  return { label: "Draft Horse", hitDice: "3", hp: rollHp(3, 8), move: 120, damage: "1d3", onslaught: ["1d3"] };
}

type Defaults = Omit<StableNpc, "id" | "campaignId" | "templateId" | "subtypeId" | "name" | "token" | "notes">;

function defaultsFor(templateId: StableNpcTemplateId, subtypeId: string | null): Defaults {
  const human = {
    hitDice: "1d6 hp", attackBonus: 0, armorClass: 10, armorMode: "worn" as const,
    armorProfile: "flesh" as const, movementRate: 120, size: "medium" as const,
    morale: 50, moraleImmune: false, noncombatant: false, attackMode: "weapon" as const,
    naturalSpeed: "normal" as const, onslaughtDamage: [] as string[], carryingCapacityStone: null,
    equipmentRefs: [] as StableNpc["equipmentRefs"],
    unarmedOverrides: normalizeUnarmedOverrides(null),
    psionics: normalizePsionics(null),
  };
  if (templateId === "heavy-foot") return { ...human, currentHp: 1, maxHp: 1, armorClass: 14, armorProfile: "scale", weaponRulesIds: ["halberd", "short-sword"], equipmentRefs: [{ source: "equipment", id: "scale", quantity: 1 }, { source: "equipment", id: "halberd", quantity: 1 }, { source: "equipment", id: "short-sword", quantity: 1 }], activeWeaponRulesId: "halberd", damageExpression: "1d10" };
  if (templateId === "light-foot") return { ...human, currentHp: 1, maxHp: 1, armorClass: 14, armorProfile: "studded-shield", weaponRulesIds: ["spear", "hand-axe"], equipmentRefs: [{ source: "equipment", id: "studded", quantity: 1 }, { source: "equipment", id: "large-shield", quantity: 1 }, { source: "equipment", id: "spear", quantity: 1 }, { source: "equipment", id: "hand-axe", quantity: 1 }], activeWeaponRulesId: "spear", damageExpression: "1d6" };
  if (templateId === "archer") {
    const longbow = subtypeId === "longbowman";
    return { ...human, currentHp: 1, maxHp: 1, armorClass: 13, armorProfile: "studded", weaponRulesIds: [longbow ? "long-bow" : "short-bow", "hand-axe"], equipmentRefs: [{ source: "equipment", id: "studded", quantity: 1 }, { source: "equipment", id: longbow ? "long-bow" : "short-bow", quantity: 1 }, { source: "catalog", id: "catalog-ammunition-81", quantity: 1 }, { source: "equipment", id: "hand-axe", quantity: 1 }], activeWeaponRulesId: longbow ? "long-bow" : "short-bow", damageExpression: "1d6" };
  }
  if (templateId === "crossbowman") return { ...human, currentHp: 1, maxHp: 1, armorClass: 13, armorProfile: "studded", weaponRulesIds: ["light-crossbow", "hand-axe"], equipmentRefs: [{ source: "equipment", id: "studded", quantity: 1 }, { source: "equipment", id: "light-crossbow", quantity: 1 }, { source: "catalog", id: "catalog-ammunition-85", quantity: 1 }, { source: "equipment", id: "hand-axe", quantity: 1 }], activeWeaponRulesId: "light-crossbow", damageExpression: "1d4+1" };
  if (templateId === "pikeman") return { ...human, currentHp: 1, maxHp: 1, armorClass: 14, armorProfile: "scale", weaponRulesIds: ["awl-pike", "short-sword"], equipmentRefs: [{ source: "equipment", id: "scale", quantity: 1 }, { source: "equipment", id: "awl-pike", quantity: 1 }, { source: "equipment", id: "short-sword", quantity: 1 }], activeWeaponRulesId: "awl-pike", damageExpression: "1d6" };
  if (templateId === "sergeant") return { ...human, hitDice: "1d10", currentHp: 1, maxHp: 1, armorClass: 14, armorProfile: "scale", weaponRulesIds: ["halberd", "short-sword"], equipmentRefs: [{ source: "equipment", id: "scale", quantity: 1 }, { source: "equipment", id: "halberd", quantity: 1 }, { source: "equipment", id: "short-sword", quantity: 1 }], activeWeaponRulesId: "halberd", damageExpression: "1d10" };
  if (templateId === "torchbearer") return { ...human, hitDice: "1d4 hp", currentHp: 1, maxHp: 1, armorMode: "natural", armorProfile: "flesh", weaponRulesIds: ["fist-open-hand"], activeWeaponRulesId: null, attackMode: "natural", damageExpression: "1d4" };
  if (templateId === "porter") return { ...human, hitDice: "1d4 hp", currentHp: 1, maxHp: 1, armorMode: "natural", armorProfile: "flesh", weaponRulesIds: ["fist-open-hand"], activeWeaponRulesId: "fist-open-hand", damageExpression: "1d2", carryingCapacityStone: 10 };
  const quadruped = normalizeUnarmedOverrides({ ...human.unarmedOverrides, fourLegged: true, cannotGrapple: true, cannotBeGrappled: true, cannotBeOverborne: true });
  if (templateId === "mule") { const hp = rollHp(3, 8); return { ...human, hitDice: "3", currentHp: hp, maxHp: hp, attackBonus: 2, armorClass: 13, armorMode: "natural", armorProfile: "flesh", movementRate: 120, size: "large", morale: 60, weaponRulesIds: [], activeWeaponRulesId: null, attackMode: "natural", naturalSpeed: "slow", damageExpression: "1d2", onslaughtDamage: ["1d6", "1d6"], carryingCapacityStone: 20, unarmedOverrides: quadruped }; }
  if (templateId === "horse") { const horse = horseDefaults(subtypeId); return { ...human, hitDice: horse.hitDice, currentHp: horse.hp, maxHp: horse.hp, attackBonus: 1, armorClass: 13, armorMode: "natural", armorProfile: "flesh", movementRate: horse.move, size: "large", morale: 60, weaponRulesIds: [], activeWeaponRulesId: null, attackMode: "natural", naturalSpeed: "slow", damageExpression: horse.damage, onslaughtDamage: horse.onslaught, carryingCapacityStone: 30, unarmedOverrides: quadruped }; }
  if (templateId === "ox") { const hp = rollHp(3, 8); return { ...human, hitDice: "3", currentHp: hp, maxHp: hp, armorClass: 12, armorMode: "natural", armorProfile: "flesh", movementRate: 90, size: "large", morale: 60, noncombatant: true, weaponRulesIds: [], activeWeaponRulesId: null, attackMode: "natural", naturalSpeed: "slow", damageExpression: "", carryingCapacityStone: 40, unarmedOverrides: quadruped }; }
  const warDog = subtypeId === "war";
  const hp = warDog ? rollHp(2, 8, 2) : rollHp(1, 8);
  return { ...human, hitDice: warDog ? "2+2" : "1", currentHp: hp, maxHp: hp, attackBonus: warDog ? 1 : 0, armorClass: warDog ? 14 : 13, armorMode: "natural", armorProfile: warDog ? "hide" : "flesh", movementRate: warDog ? 120 : 150, size: warDog ? "medium" : "small", morale: warDog ? null : 50, moraleImmune: warDog, weaponRulesIds: [], activeWeaponRulesId: null, attackMode: "natural", naturalSpeed: "fast", damageExpression: warDog ? "2d4" : "1d4", carryingCapacityStone: null, unarmedOverrides: quadruped };
}

function rollHumanHp(templateId: StableNpcTemplateId) {
  if (templateId === "sergeant") return rollHp(1, 10);
  if (templateId === "torchbearer" || templateId === "porter") return rollHp(1, 4);
  return rollHp(1, 6);
}

export function templateForStableNpc(templateId: StableNpcTemplateId) {
  return templateMap.get(templateId) ?? stableNpcTemplates[0];
}

export function nextStableNpcNumber(npcs: StableNpc[], campaignId: string, templateId: StableNpcTemplateId) {
  const prefix = templateForStableNpc(templateId).prefix;
  return Math.max(0, ...npcs.filter((npc) => npc.campaignId === campaignId && npc.templateId === templateId).map((npc) => Number(npc.token.slice(prefix.length)) || 0)) + 1;
}

export function createStableNpc(campaignId: string, templateId: StableNpcTemplateId, subtypeId: string | null, number: number): StableNpc {
  const template = templateForStableNpc(templateId);
  const normalizedSubtype = subtypeId ?? template.subtypes?.[0]?.id ?? null;
  const defaults = defaultsFor(templateId, normalizedSubtype);
  const humanHp = ["heavy-foot", "light-foot", "archer", "crossbowman", "pikeman", "sergeant", "torchbearer", "porter"].includes(templateId) ? rollHumanHp(templateId) : null;
  const subtype = template.subtypes?.find((entry) => entry.id === normalizedSubtype);
  const baseLabel = templateId === "horse" ? subtype?.label ?? template.label : template.label;
  const hp = humanHp ?? defaults.maxHp;
  return {
    id: sharedId(), campaignId, templateId, subtypeId: normalizedSubtype,
    name: `${baseLabel} ${number}`, token: `${template.prefix}${number}`,
    ...defaults, currentHp: hp, maxHp: hp, notes: "",
  };
}

export function stableNpcInventoryOwner(npc: StableNpc): PhysicalInventoryOwner | null {
  if (npc.carryingCapacityStone == null) return null;
  return {
    id: npc.id,
    campaignId: npc.campaignId,
    name: npc.name,
    type: npc.templateId === "porter" ? "npc" : "animal",
    capacityUnits: stoneToUnits(npc.carryingCapacityStone),
    notes: `${npc.token} · NPC Stable`,
  };
}

export function addStableNpcInventory(state: InventoryManagementState, npc: StableNpc) {
  const owner = stableNpcInventoryOwner(npc);
  if (!owner || state.owners.some((entry) => entry.id === owner.id)) return state;
  return { ...state, owners: [...state.owners, owner], containers: [...state.containers, carrierBagsForOwner(owner)] };
}

export function syncStableNpcInventory(state: InventoryManagementState, npc: StableNpc) {
  const owner = stableNpcInventoryOwner(npc);
  if (!owner) return state;
  return {
    ...state,
    owners: state.owners.map((entry) => entry.id === npc.id ? { ...entry, name: npc.name, capacityUnits: owner.capacityUnits } : entry),
    containers: state.containers.map((entry) => entry.holderType === "owner" && entry.holderId === npc.id && entry.name.endsWith("'s Bags") ? { ...entry, name: `${npc.name}'s Bags`, capacityUnits: owner.capacityUnits } : entry),
  };
}

export function stableNpcToParticipant(npc: StableNpc, joinedRound: number): SegmentedParticipant {
  const onslaughtAttacks = npc.onslaughtDamage.map((damageExpression, index) => ({ id: sharedId(), timing: index === 0 ? "segment-1" as const : "rolled" as const, damageExpression, rolledSegment: null }));
  const activeRules = weaponRulesById(npc.activeWeaponRulesId);
  return {
    id: npc.id, stableNpcId: npc.id, kind: "npc", markerNumber: null, name: npc.name,
    hitDice: npc.hitDice, attackBonus: npc.attackBonus, armorClass: npc.armorClass,
    currentHp: npc.currentHp, maxHp: npc.maxHp, nonIntelligent: npc.templateId === "ox" || npc.templateId === "mule" || npc.templateId === "horse" || npc.templateId === "dog",
    armoredHead: true, joinedRound, side: "party", action: "", actionDetail: "", castingTime: 1,
    holdSegment: 6, specializedRof: 2, segmentModifier: 0, initiativeRoll: null, subInitiativeRoll: null,
    scheduledSegment: null, declarationRound: null, completedEvents: [], statusNote: npc.noncombatant ? "Noncombatant" : "",
    ready: false, targetId: null, targetIds: [], areaOfEffect: false, preparedSpellSlotId: null,
    damageExpression: activeRules?.damageSM ?? npc.damageExpression,
    onslaughtAttacks, equippedWeaponId: null, pendingWeaponId: null, pendingOffhandWeaponId: null, resolutions: {},
    armorMode: npc.armorMode, armorProfile: npc.armorProfile, attackMode: npc.attackMode,
    naturalSpeed: npc.naturalSpeed, weaponRulesId: npc.activeWeaponRulesId, weaponRulesIds: npc.weaponRulesIds,
    manualHitModifier: "+0", manualDamageModifier: "+0", movementRate: npc.movementRate, size: npc.size, large: npc.size === "large",
    temporaryDamage: 0, unarmedOverrides: normalizeUnarmedOverrides(npc.unarmedOverrides), psionics: normalizePsionics(npc.psionics),
  };
}

export function normalizeStableNpc(raw: StableNpc): StableNpc {
  const template = templateForStableNpc(raw.templateId);
  const number = Number(raw.token?.slice(template.prefix.length)) || 1;
  const fresh = createStableNpc(raw.campaignId || "default", template.id, raw.subtypeId ?? null, number);
  return { ...fresh, ...raw, id: raw.id || fresh.id, campaignId: raw.campaignId || "default", token: raw.token || fresh.token, weaponRulesIds: Array.isArray(raw.weaponRulesIds) ? raw.weaponRulesIds : fresh.weaponRulesIds, equipmentRefs: Array.isArray(raw.equipmentRefs) ? raw.equipmentRefs : fresh.equipmentRefs, onslaughtDamage: Array.isArray(raw.onslaughtDamage) ? raw.onslaughtDamage : fresh.onslaughtDamage, unarmedOverrides: normalizeUnarmedOverrides(raw.unarmedOverrides ?? fresh.unarmedOverrides), psionics: normalizePsionics(raw.psionics ?? fresh.psionics) };
}
