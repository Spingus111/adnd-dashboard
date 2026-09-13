import type {
  CampaignState,
  CatalogItem,
  Character,
  EncumbranceClass,
  InventoryContainer,
  InventoryDiscardEntry,
  InventoryManagementState,
  InventoryShoppingLine,
  InventoryStack,
  PhysicalInventoryOwner,
} from "./types";
import { dexterityArmorClassModifier, strengthEncumbranceStone } from "./osric-stats.ts";
import { maximumMovableLoadUnits } from "./movement.ts";
import { CURRENCY_BY_CODE, copperPiecesToGp, currencyBreakdownFromGp, currencyCodeFromName, currencyGpValueFromName, formatGpAsPrice, gpToCopperPieces, SHOP_CURRENCY_DEFINITIONS, type CurrencyCode } from "./currency.ts";
import { getHandsRequired, weaponIsThrown, weaponRulesForItem, weaponRulesForName } from "./weapon-rules.ts";
import { getWeaponTrainingState } from "./osric-advancement.ts";
import { equipmentDisplayName } from "./equipment-defaults.ts";

export const UNITS_PER_STONE = 400;
export const UNITS_PER_POCKET = 100;
export const POUNDS_PER_STONE = 14;
export const AMMO_CAPACITY = 10;

function legacyAmmoName(value: string) {
  return /^(?:arrows?(?: \(\d+\))?|(?:heavy |light )?crossbow bolts?|bolts?|sling bullets?|sling stones?)$/i.test(value.trim());
}

export function isAmmoStack(stack: Pick<InventoryStack, "name" | "equipment">) {
  return !stack.equipment && (stack.name.trim().toLowerCase() === "ammo" || legacyAmmoName(stack.name));
}

export function ammoShotsInStack(stack: Pick<InventoryStack, "name" | "quantity" | "shotsRemaining" | "equipment">) {
  if (!isAmmoStack(stack)) return 0;
  if (stack.shotsRemaining !== null && stack.shotsRemaining !== undefined) return Math.max(0, Math.trunc(stack.shotsRemaining));
  return Math.max(1, Math.trunc(stack.quantity || 1)) * AMMO_CAPACITY;
}

export function inventoryStackDisplayName(stack: Pick<InventoryStack, "name" | "quantity" | "shotsRemaining" | "equipment">) {
  return isAmmoStack(stack) ? `Ammo ${ammoShotsInStack(stack)}/${AMMO_CAPACITY}` : equipmentDisplayName(stack.name, stack.equipment);
}

/** Canonicalizes Ammo independently inside each physical container. */
export function normalizeAmmoStacks(state: InventoryManagementState): InventoryManagementState {
  const next = cloneInventory(state);
  const containerIds = new Set(next.stacks.filter((stack) => stack.containerId && isAmmoStack(stack)).map((stack) => stack.containerId!));
  for (const containerId of containerIds) {
    const ammo = next.stacks.filter((stack) => stack.containerId === containerId && isAmmoStack(stack)).sort((left, right) => left.id.localeCompare(right.id));
    const totalShots = ammo.reduce((sum, stack) => sum + ammoShotsInStack(stack), 0);
    const bundleCount = Math.ceil(totalShots / AMMO_CAPACITY);
    const keepIds = new Set(ammo.slice(0, bundleCount).map((stack) => stack.id));
    next.stacks = next.stacks.filter((stack) => !ammo.some((entry) => entry.id === stack.id) || keepIds.has(stack.id));
    for (let index = 0; index < bundleCount; index += 1) {
      let stack = ammo[index];
      if (!stack) {
        const template = ammo[0];
        stack = { ...template, id: inventoryId("ammo"), equipment: null, trainingByCharacter: {} };
        next.stacks.push(stack);
      }
      const remainder = totalShots - index * AMMO_CAPACITY;
      stack.name = "Ammo";
      stack.catalogItemId = "catalog-ammo";
      stack.customIdentity = null;
      stack.quantity = 1;
      stack.shotsRemaining = Math.min(AMMO_CAPACITY, remainder);
      stack.unitEncumbranceUnits = UNITS_PER_POCKET;
      stack.encumbranceClass = "pocket";
      stack.itemKind = "normal";
      stack.gpValue = 1;
      stack.handSlot = null;
      stack.equipment = null;
    }
  }
  return next;
}

export function ammoShotsForOwner(state: InventoryManagementState, ownerId: string) {
  return inventoryStacksForOwner(state, ownerId).reduce((sum, stack) => sum + ammoShotsInStack(stack), 0);
}

export function ammoShotsForCharacter(state: InventoryManagementState, characterId: string) {
  const owner = state.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
  return owner ? ammoShotsForOwner(state, owner.id) : 0;
}

export function consumeAmmoShotForCharacter(state: InventoryManagementState, characterId: string) {
  const owner = state.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
  if (!owner) return { state, consumed: false };
  const quickId = state.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id)?.id;
  const source = inventoryStacksForOwner(state, owner.id).filter(isAmmoStack).filter((stack) => ammoShotsInStack(stack) > 0)
    .sort((left, right) => Number(right.containerId === quickId) - Number(left.containerId === quickId) || ammoShotsInStack(left) - ammoShotsInStack(right) || left.id.localeCompare(right.id))[0];
  if (!source) return { state, consumed: false };
  const next = cloneInventory(state);
  const target = next.stacks.find((entry) => entry.id === source.id)!;
  const remaining = ammoShotsInStack(target) - 1;
  if (remaining <= 0) next.stacks = next.stacks.filter((entry) => entry.id !== target.id);
  else {
    target.name = "Ammo";
    target.quantity = 1;
    target.shotsRemaining = remaining;
  }
  return { state: normalizeAmmoStacks(next), consumed: true };
}

export function characterCoinGp(state: InventoryManagementState, characterId: string) {
  const owner = state.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
  return owner ? inventoryStacksGpValue(inventoryCoinStacksForOwner(state, owner.id)) : 0;
}

export function inventoryId(prefix = "inventory") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Added carriers use a normal movable container rather than an intrinsic carrier slot. */
export function carrierBagsForOwner(owner: PhysicalInventoryOwner): InventoryContainer {
  return {
    id: inventoryId("npc-bags"),
    campaignId: owner.campaignId,
    name: `${owner.name}'s Bags`,
    capacityUnits: Math.max(1, cleanUnits(owner.capacityUnits, 1)),
    tareWeightUnits: 0,
    holderType: "owner",
    holderId: owner.id,
    containerType: "container",
    intrinsic: false,
    movable: true,
  };
}

export function stoneToUnits(stone: number) {
  return Math.max(0, Math.round((Number(stone) || 0) * UNITS_PER_STONE));
}

export function pocketsToUnits(pockets: number) {
  return Math.max(0, Math.round(Number(pockets) || 0) * UNITS_PER_POCKET);
}

export function poundsToRawUnits(pounds: number) {
  return Math.max(0, ((Number(pounds) || 0) / POUNDS_PER_STONE) * UNITS_PER_STONE);
}

export function roundToQuarterStoneUnits(units: number) {
  return Math.max(0, Math.round((Number(units) || 0) / UNITS_PER_POCKET) * UNITS_PER_POCKET);
}

export function capacityUnitsFromOSRICPounds(pounds: number) {
  // The campaign uses a deliberately generous stone abstraction for player capacity.
  return Math.ceil((poundsToRawUnits(pounds) * 1.1) / UNITS_PER_STONE) * UNITS_PER_STONE;
}

export function getCharacterCapacityUnits(character: Pick<Character, "stats" | "exceptionalStrength">) {
  return strengthEncumbranceStone(character.stats[0], character.exceptionalStrength) * UNITS_PER_STONE;
}

/** The total load at which a character can still move at quarter speed. */
export function getMaximumMovableCharacterCapacityUnits(character: Pick<Character, "stats" | "exceptionalStrength">) {
  return maximumMovableLoadUnits(getCharacterCapacityUnits(character));
}

export function getBackpackCapacityUnits(character: Pick<Character, "stats" | "exceptionalStrength">) {
  return getMaximumMovableCharacterCapacityUnits(character) - getQuickAccessCapacityUnits(character);
}

export function getQuickAccessCapacityUnits(character: Pick<Character, "stats" | "exceptionalStrength">) {
  return roundToQuarterStoneUnits(getMaximumMovableCharacterCapacityUnits(character) / 4);
}

export function formatStoneUnits(units: number) {
  const safe = Math.max(0, Math.round(Number(units) || 0));
  const whole = Math.floor(safe / UNITS_PER_STONE);
  const remainder = safe % UNITS_PER_STONE;
  if (remainder === 0) return `${whole} st`;
  const fractions: Record<number, string> = { 100: "¼", 200: "½", 300: "¾" };
  if (fractions[remainder]) return `${whole ? whole : ""}${fractions[remainder]} st`;
  const decimal = (safe / UNITS_PER_STONE).toFixed(safe < 40 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "");
  return `${decimal} st`;
}

export function encumbranceClassLabel(value: EncumbranceClass) {
  return value === "coin" ? "Tiny" : value === "pocket" ? "Pocket" : value === "sack" ? "Sack" : value === "container" ? "Container" : "Large / bulky";
}

export function catalogEncumbranceFor(item: Pick<CatalogItem, "name" | "category"> | { name: string; category: string }) {
  const name = item.name.toLowerCase();
  const category = item.category.toLowerCase();
  const bulky = /armou?r|barding|plate|mail|shield|anvil|barrel|cauldron|chest|boat|ship|wagon|cart|coach|howdah|tent|ladder|ram\b|siege|cannon|ballista|catapult|trebuchet|mount|saddle/.test(`${name} ${category}`);
  if (bulky) {
    let units = 800;
    if (/plate|field plate|full plate|barding|anvil|boat|ship|wagon|cart|coach|siege|cannon|ballista|catapult|trebuchet/.test(name)) units = 1600;
    if (/ship|longship|galley|barge|wagon|coach|siege|cannon|ballista|catapult|trebuchet/.test(name)) units = 4000;
    return { encumbranceUnits: units, encumbranceClass: "bulky" as const };
  }
  if (/\b(coin|gem|jewel|key|bead|marble|needle|fish ?hook|arrowhead|bullet|bolt|arrow|quarrel|sling stone)\b/.test(name) || /ammunition/.test(category)) {
    return { encumbranceUnits: 1, encumbranceClass: "coin" as const };
  }
  if (/\b(dagger|knife|torch|potion|flask|ration|food|meal|book|scroll|tome|grimoire|lantern|oil|waterskin|holy symbol|mirror|rope|spike|chalk|bell|pouch|case|map|quill|ink|candle|herb|bandage)\b/.test(name)) {
    return { encumbranceUnits: UNITS_PER_POCKET, encumbranceClass: "pocket" as const };
  }
  if (/weapon|sword|axe|bow|crossbow|spear|mace|hammer|staff|polearm|club|whip|flail|pick|javelin|trident/.test(`${name} ${category}`)) {
    return { encumbranceUnits: UNITS_PER_STONE, encumbranceClass: "sack" as const };
  }
  return { encumbranceUnits: UNITS_PER_POCKET, encumbranceClass: "pocket" as const };
}

function cleanUnits(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function characterForOwner(owner: PhysicalInventoryOwner, characters: Character[]) {
  return owner.characterId ? characters.find((character) => character.id === owner.characterId) : undefined;
}

export function getOwnerCapacityUnits(owner: PhysicalInventoryOwner, characters: Character[]) {
  const character = characterForOwner(owner, characters);
  return character ? getCharacterCapacityUnits(character) : cleanUnits(owner.capacityUnits);
}

export function getContainerCapacityUnits(container: InventoryContainer, characters: Character[]) {
  const origin = container.originCharacterId ? characters.find((character) => character.id === container.originCharacterId) : undefined;
  if (origin && container.containerType === "quick-access") return getQuickAccessCapacityUnits(origin);
  if (origin && container.containerType === "character-backpack") return getBackpackCapacityUnits(origin);
  if (container.containerType === "worn") return Number.MAX_SAFE_INTEGER;
  return cleanUnits(container.capacityUnits);
}

export function getStackEncumbranceUnits(stack: InventoryStack) {
  return cleanUnits(stack.quantity) * Math.max(1, cleanUnits(stack.unitEncumbranceUnits, 1));
}

export function getHandEncumbranceUnits(stack: InventoryStack) {
  if (!stack.handSlot) return getStackEncumbranceUnits(stack);
  // Held gear is easier to manage. Round down after halving, in quarter-stone steps.
  return Math.floor(getStackEncumbranceUnits(stack) / 2 / UNITS_PER_POCKET) * UNITS_PER_POCKET;
}

export function getContainerPathToRoot(state: InventoryManagementState, containerId: string) {
  const path: InventoryContainer[] = [];
  const seen = new Set<string>();
  let current = state.containers.find((container) => container.id === containerId);
  while (current && !seen.has(current.id)) {
    path.push(current);
    seen.add(current.id);
    current = current.holderType === "container" ? state.containers.find((container) => container.id === current!.holderId) : undefined;
  }
  return path;
}

export function getContainerRootHolder(state: InventoryManagementState, containerId: string) {
  const path = getContainerPathToRoot(state, containerId);
  const root = path[path.length - 1];
  if (!root) return null;
  return root.holderType === "container" ? null : { type: root.holderType, id: root.holderId } as const;
}

export function getContainerDescendantIds(state: InventoryManagementState, containerId: string) {
  const result = new Set<string>();
  const visit = (id: string) => {
    for (const child of state.containers.filter((container) => container.holderType === "container" && container.holderId === id)) {
      if (result.has(child.id)) continue;
      result.add(child.id);
      visit(child.id);
    }
  };
  visit(containerId);
  return result;
}

function containerUsedRecursive(state: InventoryManagementState, containerId: string, visited: Set<string>): number {
  if (visited.has(containerId)) return 0;
  visited.add(containerId);
  const directStacks = state.stacks.filter((stack) => stack.containerId === containerId).reduce((sum, stack) => sum + getStackEncumbranceUnits(stack), 0);
  const childLoads = state.containers
    .filter((container) => container.holderType === "container" && container.holderId === containerId)
    .reduce((sum, child) => sum + containerUsedRecursive(state, child.id, visited) + cleanUnits(child.tareWeightUnits), 0);
  return directStacks + childLoads;
}

function ownerLoadRecursive(state: InventoryManagementState, containerId: string, visited: Set<string>): number {
  if (visited.has(containerId)) return 0;
  visited.add(containerId);
  const directStacks = state.stacks.filter((stack) => stack.containerId === containerId).reduce((sum, stack) => sum + getHandEncumbranceUnits(stack), 0);
  const childLoads = state.containers
    .filter((container) => container.holderType === "container" && container.holderId === containerId)
    .reduce((sum, child) => sum + ownerLoadRecursive(state, child.id, visited) + cleanUnits(child.tareWeightUnits), 0);
  return directStacks + childLoads;
}

export function getContainerUsedUnits(state: InventoryManagementState, containerId: string) {
  return containerUsedRecursive(state, containerId, new Set());
}

export function getContainerRemainingUnits(state: InventoryManagementState, containerId: string, characters: Character[]) {
  const container = state.containers.find((entry) => entry.id === containerId);
  return container ? Math.max(0, getContainerCapacityUnits(container, characters) - getContainerUsedUnits(state, containerId)) : 0;
}

export function getContainerEffectiveLoadUnits(state: InventoryManagementState, containerId: string) {
  const container = state.containers.find((entry) => entry.id === containerId);
  return container ? getContainerUsedUnits(state, containerId) + cleanUnits(container.tareWeightUnits) : 0;
}

export function getOwnerUsedUnits(state: InventoryManagementState, ownerId: string) {
  return state.containers
    .filter((container) => container.holderType === "owner" && container.holderId === ownerId && container.containerType !== "worn")
    .reduce((sum, container) => sum + ownerLoadRecursive(state, container.id, new Set()) + cleanUnits(container.tareWeightUnits), 0);
}

export function getOwnerRemainingUnits(state: InventoryManagementState, ownerId: string, characters: Character[]) {
  const owner = state.owners.find((entry) => entry.id === ownerId);
  return owner ? Math.max(0, getOwnerCapacityUnits(owner, characters) - getOwnerUsedUnits(state, ownerId)) : 0;
}

export function canOwnerCarry(state: InventoryManagementState, ownerId: string, units: number, characters: Character[]) {
  // Characters may carry past their comfortable capacity; encumbrance determines
  // their movement instead of blocking the transfer.
  if (state.owners.some((owner) => owner.id === ownerId && owner.type === "character")) return true;
  return getOwnerRemainingUnits(state, ownerId, characters) >= units;
}

export function stackIdentity(stack: InventoryStack) {
  const identity = stack.catalogItemId ? `catalog:${stack.catalogItemId}` : stack.customIdentity ? `custom:${stack.customIdentity}` : `name:${stack.name.trim().toLowerCase()}`;
  const equipment = stack.equipment ? JSON.stringify(stack.equipment) : "";
  const training = stack.trainingByCharacter ? JSON.stringify(stack.trainingByCharacter) : "";
  return [identity, stack.itemKind, stack.unitEncumbranceUnits, stack.encumbranceClass, stack.gpValue ?? "", stack.notes ?? "", equipment, training, stack.characterShopPurchaseUndoId ?? ""].join("|");
}

export function stacksMatch(left: InventoryStack, right: InventoryStack) {
  return stackIdentity(left) === stackIdentity(right);
}

function cloneInventory(state: InventoryManagementState): InventoryManagementState {
  return {
    owners: state.owners.map((entry) => ({ ...entry })),
    locations: state.locations.map((entry) => ({ ...entry })),
    containers: state.containers.map((entry) => ({ ...entry })),
    stacks: state.stacks.map((entry) => ({
      ...entry,
      equipment: entry.equipment ? { ...entry.equipment } : null,
      trainingByCharacter: entry.trainingByCharacter ? Object.fromEntries(Object.entries(entry.trainingByCharacter).map(([id, training]) => [id, { ...training }])) : {},
    })),
    layoutPositions: { ...state.layoutPositions },
    activityLog: (state.activityLog ?? []).map((entry) => ({ ...entry, details: [...entry.details] })),
    sellVisible: state.sellVisible !== false,
    shoppingCart: (state.shoppingCart ?? []).map((entry) => ({ ...entry })),
    discarded: (state.discarded ?? []).map((entry) => ({
      ...entry,
      owners: entry.owners.map((owner) => ({ ...owner })),
      locations: entry.locations.map((location) => ({ ...location })),
      containers: entry.containers.map((container) => ({ ...container })),
      stacks: entry.stacks.map((stack) => ({ ...stack, equipment: stack.equipment ? { ...stack.equipment } : null, trainingByCharacter: { ...(stack.trainingByCharacter ?? {}) } })),
    })),
    characterShopPurchaseUndoByOwnerId: state.characterShopPurchaseUndoByOwnerId ? Object.fromEntries(Object.entries(state.characterShopPurchaseUndoByOwnerId).map(([ownerId, purchase]) => [ownerId, { ...purchase }])) : undefined,
  };
}

export function emptyInventoryManagement(): InventoryManagementState {
  return { owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] };
}

export function appendInventoryActivity(state: InventoryManagementState, action: string, details: string[] | string) {
  const cleanDetails = (Array.isArray(details) ? details : [details]).map((entry) => String(entry).trim()).filter(Boolean);
  return {
    ...state,
    activityLog: [{ id: inventoryId("log"), timestamp: Date.now(), action, details: cleanDetails.length ? cleanDetails : ["No changes."] }, ...(state.activityLog ?? [])].slice(0, 50),
  };
}

export function normalizeInventoryManagement(raw: Partial<InventoryManagementState> | null | undefined, characters: Character[], fallbackCampaignId = "default") {
  const state: InventoryManagementState = {
    owners: Array.isArray(raw?.owners) ? raw.owners.map((owner) => ({ ...owner, campaignId: owner.campaignId ?? fallbackCampaignId, name: String(owner.name ?? "Inventory"), type: owner.type ?? "other", capacityUnits: cleanUnits(owner.capacityUnits), notes: String(owner.notes ?? "") })) : [],
    locations: Array.isArray(raw?.locations) ? raw.locations.map((location) => ({ ...location, campaignId: location.campaignId ?? fallbackCampaignId, name: String(location.name ?? "Location"), notes: String(location.notes ?? ""), infiniteCapacity: true, hidden: Boolean(location.hidden) })) : [],
    containers: Array.isArray(raw?.containers) ? raw.containers.map((container) => ({
      ...container,
      campaignId: container.campaignId ?? fallbackCampaignId,
      name: String(container.name ?? "Container"),
      capacityUnits: cleanUnits(container.capacityUnits),
      tareWeightUnits: cleanUnits(container.tareWeightUnits),
      holderType: ["owner", "location", "container", "ground"].includes(container.holderType) ? container.holderType : "ground",
      holderId: String(container.holderId ?? container.campaignId ?? fallbackCampaignId),
      intrinsic: Boolean(container.intrinsic),
      movable: container.containerType === "quick-access" ? false : container.movable !== false,
      lastHolder: container.lastHolder ? String(container.lastHolder) : null,
      hidden: Boolean(container.hidden),
    })) : [],
    stacks: Array.isArray(raw?.stacks) ? raw.stacks.map((stack) => {
      const inStorage = Boolean(stack.containerId || stack.locationId);
      const storedName = String(stack.name ?? "Item");
      const migratedAmmo = !stack.equipment && (storedName.trim().toLowerCase() === "ammo" || legacyAmmoName(storedName));
      const currencyCode = currencyCodeFromName(storedName);
      const name = currencyCode ? CURRENCY_BY_CODE[currencyCode].name : storedName;
      const currencyGpValue = currencyGpValueFromName(storedName);
      return {
        ...stack,
        campaignId: stack.campaignId ?? fallbackCampaignId,
        name: migratedAmmo ? "Ammo" : name,
        quantity: Math.max(1, cleanUnits(stack.quantity, 1)),
        unitEncumbranceUnits: migratedAmmo ? UNITS_PER_POCKET : Math.max(1, cleanUnits(stack.unitEncumbranceUnits, 100)),
        encumbranceClass: migratedAmmo ? "pocket" : stack.encumbranceClass ?? "pocket",
        itemKind: currencyGpValue != null ? "treasure" : stack.itemKind === "treasure" ? "treasure" : "normal",
        gpValue: currencyGpValue ?? (stack.gpValue == null ? null : Math.max(0, Number(stack.gpValue) || 0)),
        placement: inStorage ? null : ["sell", "payment", "counter"].includes(String(stack.placement)) ? stack.placement as "sell" | "payment" | "counter" : "ground",
        handSlot: stack.handSlot === "main" || stack.handSlot === "offhand" ? stack.handSlot : null,
        lastHolder: stack.lastHolder ? String(stack.lastHolder) : null,
        notes: String(stack.notes ?? ""),
        equipment: stack.equipment && ["weapon", "armor", "shield"].includes(stack.equipment.kind) ? {
          ...stack.equipment,
          kind: stack.equipment.kind,
          weaponType: ["melee", "ranged", "other"].includes(String(stack.equipment.weaponType)) ? stack.equipment.weaponType : undefined,
          attackBonus: Number.isFinite(Number(stack.equipment.attackBonus)) ? Number(stack.equipment.attackBonus) : 0,
          ascendingAc: Number.isFinite(Number(stack.equipment.ascendingAc)) ? Number(stack.equipment.ascendingAc) : undefined,
          shieldBonus: Number.isFinite(Number(stack.equipment.shieldBonus)) ? Number(stack.equipment.shieldBonus) : undefined,
          twoHanded: Boolean(stack.equipment.twoHanded),
          weaponRulesId: stack.equipment.kind === "weapon"
            ? stack.equipment.weaponRulesId ?? weaponRulesForName(storedName)?.id ?? null
            : null,
        } : null,
        trainingByCharacter: stack.trainingByCharacter && typeof stack.trainingByCharacter === "object"
          ? Object.fromEntries(Object.entries(stack.trainingByCharacter).map(([id, training]) => [id, { proficient: Boolean(training?.proficient), skilled: Boolean(training?.skilled) }]))
          : {},
        shotsRemaining: migratedAmmo ? Math.max(0, Math.trunc(stack.shotsRemaining == null ? Math.max(1, cleanUnits(stack.quantity, 1)) * AMMO_CAPACITY : Number(stack.shotsRemaining))) : null,
        initialAmmoGranted: Boolean(stack.initialAmmoGranted),
      };
    }) : [],
    layoutPositions: raw?.layoutPositions && typeof raw.layoutPositions === "object" ? Object.fromEntries(Object.entries(raw.layoutPositions).map(([key, position]) => [key, { x: cleanUnits(position?.x), y: cleanUnits(position?.y) }])) : {},
    activityLog: Array.isArray(raw?.activityLog) ? raw.activityLog.slice(0, 50).map((entry) => ({ id: String(entry.id ?? inventoryId("log")), timestamp: Number(entry.timestamp) || Date.now(), action: String(entry.action ?? "Inventory updated"), details: Array.isArray(entry.details) ? entry.details.map(String) : [] })) : [],
    sellVisible: raw?.sellVisible !== false,
    shoppingCart: Array.isArray(raw?.shoppingCart) ? raw.shoppingCart.map((entry) => ({
      id: String(entry.id ?? inventoryId("cart")),
      campaignId: String(entry.campaignId ?? fallbackCampaignId),
      catalogId: entry.catalogId ? String(entry.catalogId) : null,
      name: String(entry.name ?? "Item"),
      category: String(entry.category ?? "Custom"),
      priceGp: Math.max(0, Number(entry.priceGp) || 0),
      quantity: Math.max(1, Math.trunc(Number(entry.quantity) || 1)),
    } satisfies InventoryShoppingLine)) : [],
    discarded: Array.isArray(raw?.discarded) ? raw.discarded.map((entry) => ({
      id: String(entry.id ?? inventoryId("discard")),
      kind: ["stack", "container", "location", "owner"].includes(entry.kind) ? entry.kind : "stack",
      label: String(entry.label ?? "Discarded inventory"),
      discardedAt: Number(entry.discardedAt) || Date.now(),
      owners: Array.isArray(entry.owners) ? entry.owners.map((owner) => ({ ...owner })) : [],
      locations: Array.isArray(entry.locations) ? entry.locations.map((location) => ({ ...location })) : [],
      containers: Array.isArray(entry.containers) ? entry.containers.map((container) => ({ ...container })) : [],
      stacks: Array.isArray(entry.stacks) ? entry.stacks.map((stack) => ({ ...stack })) : [],
    })) : [],
    characterShopPurchaseUndoByOwnerId: raw?.characterShopPurchaseUndoByOwnerId && typeof raw.characterShopPurchaseUndoByOwnerId === "object"
      ? Object.fromEntries(Object.entries(raw.characterShopPurchaseUndoByOwnerId).flatMap(([ownerId, purchase]) => {
        if (!purchase || typeof purchase !== "object" || !purchase.id || !purchase.characterId || !purchase.itemName) return [];
        return [[ownerId, {
          id: String(purchase.id),
          characterId: String(purchase.characterId),
          campaignId: String(purchase.campaignId ?? fallbackCampaignId),
          itemName: String(purchase.itemName),
          quantity: Math.max(1, Math.trunc(Number(purchase.quantity) || 1)),
          costGp: Math.max(0, Number(purchase.costGp) || 0),
          kind: purchase.kind === "container" ? "container" as const : "stack" as const,
        }]];
      }))
      : undefined,
  };

  for (const character of characters) {
    const owners = state.owners.filter((owner) => owner.type === "character" && owner.characterId === character.id);
    let owner = owners[0];
    if (!owner) {
      owner = { id: inventoryId("owner"), campaignId: character.campaignId, name: character.name, type: "character", capacityUnits: getCharacterCapacityUnits(character), characterId: character.id, notes: "" };
      state.owners.push(owner);
    } else {
      owner.name = character.name;
      owner.campaignId = character.campaignId;
      owner.capacityUnits = getCharacterCapacityUnits(character);
    }
    for (const duplicate of owners.slice(1)) {
      state.containers.forEach((container) => { if (container.holderType === "owner" && container.holderId === duplicate.id) container.holderId = owner!.id; });
      state.owners = state.owners.filter((entry) => entry.id !== duplicate.id);
    }

    const quickContainers = state.containers.filter((container) => container.containerType === "quick-access" && container.originCharacterId === character.id);
    let quick = quickContainers[0];
    if (!quick) {
      quick = { id: inventoryId("quick"), campaignId: character.campaignId, name: "Quick Access", capacityUnits: getQuickAccessCapacityUnits(character), tareWeightUnits: 0, holderType: "owner", holderId: owner.id, containerType: "quick-access", intrinsic: true, movable: false, originCharacterId: character.id };
      state.containers.push(quick);
    }
    quick.name = `${character.name} quick access`;
    quick.capacityUnits = getQuickAccessCapacityUnits(character);
    quick.holderType = "owner";
    quick.holderId = owner.id;
    quick.intrinsic = true;
    quick.movable = false;
    quick.hidden = false;
    for (const duplicate of quickContainers.slice(1)) {
      state.stacks.forEach((stack) => { if (stack.containerId === duplicate.id) stack.containerId = quick!.id; });
      state.containers.forEach((container) => { if (container.holderType === "container" && container.holderId === duplicate.id) container.holderId = quick!.id; });
      state.containers = state.containers.filter((entry) => entry.id !== duplicate.id);
    }

    const wornContainers = state.containers.filter((container) => container.containerType === "worn" && container.originCharacterId === character.id);
    let worn = wornContainers[0];
    if (!worn) {
      worn = { id: inventoryId("worn"), campaignId: character.campaignId, name: `${character.name} worn`, capacityUnits: 0, tareWeightUnits: 0, holderType: "owner", holderId: owner.id, containerType: "worn", intrinsic: true, movable: false, originCharacterId: character.id };
      state.containers.push(worn);
    }
    worn.name = `${character.name} worn`;
    worn.holderType = "owner";
    worn.holderId = owner.id;
    worn.intrinsic = true;
    worn.movable = false;
    worn.hidden = false;
    for (const duplicate of wornContainers.slice(1)) {
      state.stacks.forEach((stack) => { if (stack.containerId === duplicate.id) stack.containerId = worn!.id; });
      state.containers = state.containers.filter((entry) => entry.id !== duplicate.id);
    }

    const backpacks = state.containers.filter((container) => container.containerType === "character-backpack" && container.originCharacterId === character.id);
    let backpack = backpacks[0];
    if (!backpack) {
      backpack = { id: inventoryId("backpack"), campaignId: character.campaignId, name: `${character.name}'s Backpack`, capacityUnits: getBackpackCapacityUnits(character), tareWeightUnits: 0, holderType: "owner", holderId: owner.id, containerType: "character-backpack", intrinsic: false, movable: true, originCharacterId: character.id };
      state.containers.push(backpack);
    }
    backpack.name = `${character.name}'s Backpack`;
    backpack.capacityUnits = getBackpackCapacityUnits(character);
    backpack.intrinsic = false;
    backpack.movable = true;
    for (const duplicate of backpacks.slice(1)) {
      state.stacks.forEach((stack) => { if (stack.containerId === duplicate.id) stack.containerId = backpack!.id; });
      state.containers.forEach((container) => { if (container.holderType === "container" && container.holderId === duplicate.id) container.holderId = backpack!.id; });
      state.containers = state.containers.filter((entry) => entry.id !== duplicate.id);
    }
  }

  const containerIds = new Set(state.containers.map((container) => container.id));
  const locationIds = new Set(state.locations.map((location) => location.id));
  for (const container of state.containers) {
    if (container.holderType === "container" && (!containerIds.has(container.holderId) || container.holderId === container.id)) {
      container.holderType = "ground";
      container.holderId = container.campaignId;
    }
  }
  // A legacy or interrupted move can leave two (or more) containers pointing
  // at each other. The board renders nested containers recursively, so ground
  // one member of any loop before it reaches the UI.
  for (const container of state.containers) {
    const seen = new Set<string>([container.id]);
    let current = container;
    while (current.holderType === "container") {
      const parent = state.containers.find((entry) => entry.id === current.holderId);
      if (!parent || seen.has(parent.id)) {
        container.holderType = "ground";
        container.holderId = container.campaignId;
        break;
      }
      seen.add(parent.id);
      current = parent;
    }
  }
  for (const stack of state.stacks) {
    if (stack.containerId && !containerIds.has(stack.containerId)) stack.containerId = null;
    if (stack.locationId && !locationIds.has(stack.locationId)) stack.locationId = null;
    if (stack.containerId || stack.locationId) stack.placement = null;
    else if (!["sell", "payment", "counter"].includes(String(stack.placement))) stack.placement = "ground";
    const holder = stack.containerId ? state.containers.find((container) => container.id === stack.containerId) : undefined;
    if (holder?.containerType !== "quick-access") stack.handSlot = null;
  }
  return normalizeAmmoStacks(state);
}

function rootOwnerIdForStack(state: InventoryManagementState, stack: InventoryStack) {
  if (!stack.containerId) return null;
  const root = getContainerRootHolder(state, stack.containerId);
  return root?.type === "owner" ? root.id : null;
}

export function inventoryStacksForOwner(state: InventoryManagementState, ownerId: string) {
  return state.stacks.filter((stack) => rootOwnerIdForStack(state, stack) === ownerId);
}

export function inventoryCoinStacksForOwner(state: InventoryManagementState, ownerId: string) {
  return inventoryStacksForOwner(state, ownerId).filter(isCoinStack);
}

function stackSourceContainerIds(state: InventoryManagementState, stack: InventoryStack) {
  return new Set(stack.containerId ? getContainerPathToRoot(state, stack.containerId).map((container) => container.id) : []);
}

function destinationContainerRoom(state: InventoryManagementState, destinationId: string, sourceContainerIds: Set<string>, characters: Character[]) {
  const constraints = getContainerPathToRoot(state, destinationId)
    .filter((container) => !sourceContainerIds.has(container.id))
    .map((container) => getContainerRemainingUnits(state, container.id, characters));
  return constraints.length ? Math.min(...constraints) : Number.POSITIVE_INFINITY;
}

export function maxStackQuantityForContainer(state: InventoryManagementState, stack: InventoryStack, containerId: string, characters: Character[]) {
  const destination = state.containers.find((entry) => entry.id === containerId);
  if (!destination) return 0;
  if (stack.containerId === containerId) return stack.quantity;
  const root = getContainerRootHolder(state, containerId);
  const perItem = Math.max(1, stack.unitEncumbranceUnits);
  const containerRoom = destinationContainerRoom(state, containerId, stackSourceContainerIds(state, stack), characters);
  const destinationRoot = root;
  const sourceOwnerId = rootOwnerIdForStack(state, stack);
  // Encumbrance may exceed a character's overall limit, but every destination
  // container (including every outer container) still has a hard capacity.
  const characterDestination = destinationRoot?.type === "owner" && state.owners.some((owner) => owner.id === destinationRoot.id && owner.type === "character");
  const ownerRoom = destinationRoot?.type === "owner" && sourceOwnerId !== destinationRoot.id && !characterDestination ? getOwnerRemainingUnits(state, destinationRoot.id, characters) : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor(Math.min(containerRoom, ownerRoom) / perItem));
}

function holderLabelForStack(state: InventoryManagementState, stack: InventoryStack) {
  if (stack.containerId) {
    const container = state.containers.find((entry) => entry.id === stack.containerId);
    const root = getContainerRootHolder(state, stack.containerId);
    const rootName = root?.type === "owner" ? state.owners.find((owner) => owner.id === root.id)?.name : root?.type === "location" ? state.locations.find((location) => location.id === root.id)?.name : root?.type === "ground" ? "Ground" : "";
    return [rootName, container?.name].filter(Boolean).join(" · ") || "Unknown holder";
  }
  if (stack.locationId) return state.locations.find((location) => location.id === stack.locationId)?.name ?? "Location";
  return stack.placement === "sell" ? "Sell" : stack.placement === "payment" ? "Payment" : stack.placement === "counter" ? "Purchases & change" : "Ground";
}

function holderLabelForContainer(state: InventoryManagementState, container: InventoryContainer) {
  if (container.holderType === "owner") return state.owners.find((owner) => owner.id === container.holderId)?.name ?? "Carrier";
  if (container.holderType === "location") return state.locations.find((location) => location.id === container.holderId)?.name ?? "Location";
  if (container.holderType === "container") return state.containers.find((entry) => entry.id === container.holderId)?.name ?? "Container";
  return "Ground";
}

export type StackDestination = { type: "container" | "location"; id: string } | { type: "ground" | "sell" | "payment" | "counter" };

export function moveStack(state: InventoryManagementState, stackId: string, destination: StackDestination, characters: Character[], requestedQuantity?: number, preserveFullMoveId = false) {
  const current = state.stacks.find((entry) => entry.id === stackId);
  if (!current) return { state, moved: 0, reason: "That stack no longer exists." };
  const wanted = Math.max(1, Math.min(current.quantity, Math.trunc(requestedQuantity ?? current.quantity)));
  if (destination.type === "container" && current.containerId === destination.id) {
    // A hand is a position inside Quick Access. Returning an item to that same
    // container should simply free the hand rather than report a no-op.
    if (current.handSlot) return { state: normalizeAmmoStacks({ ...state, stacks: state.stacks.map((stack) => stack.id === stackId ? { ...stack, handSlot: null } : stack) }), moved: wanted, reason: "Returned to Quick Access." };
    return { state, moved: 0, reason: "Already there." };
  }
  if (destination.type === "location" && current.locationId === destination.id && !current.containerId) return { state, moved: 0, reason: "Already there." };
  if (destination.type === current.placement && !current.containerId && !current.locationId) return { state, moved: 0, reason: "Already there." };
  const possible = destination.type === "location"
    ? state.locations.some((entry) => entry.id === destination.id) ? wanted : 0
    : destination.type === "container"
      ? Math.min(wanted, maxStackQuantityForContainer(state, current, destination.id, characters))
      : wanted;
  if (possible <= 0) return { state, moved: 0, reason: "No legal capacity is available at that destination." };

  const next = cloneInventory(state);
  const source = next.stacks.find((entry) => entry.id === stackId)!;
  const lastHolder = holderLabelForStack(state, current);
  let movedStack: InventoryStack;
  if (preserveFullMoveId && possible === source.quantity) {
    // A complete move is an update to one shared record. Keeping its stable ID
    // prevents realtime reconciliation from treating the item as delete + add.
    movedStack = source;
  } else {
    movedStack = { ...source, id: inventoryId("stack"), quantity: possible };
    if (possible === source.quantity) next.stacks = next.stacks.filter((entry) => entry.id !== source.id);
    else source.quantity -= possible;
    next.stacks.push(movedStack);
  }
  movedStack.containerId = destination.type === "container" ? destination.id : null;
  movedStack.locationId = destination.type === "location" ? destination.id : null;
  movedStack.placement = ["ground", "sell", "payment", "counter"].includes(destination.type) ? destination.type as "ground" | "sell" | "payment" | "counter" : null;
  movedStack.handSlot = null;
  if (destination.type === "ground") movedStack.lastHolder = lastHolder;

  const keepPileSeparate = movedStack.placement === "sell" || movedStack.placement === "payment" || movedStack.placement === "counter";
  const matching = keepPileSeparate ? undefined : next.stacks.find((entry) => entry.id !== movedStack.id
    && entry.containerId === movedStack.containerId
    && entry.locationId === movedStack.locationId
    && (movedStack.containerId || movedStack.locationId || (entry.placement ?? "ground") === (movedStack.placement ?? "ground"))
    && !entry.handSlot
    && stacksMatch(entry, movedStack));
  if (matching) {
    matching.quantity += movedStack.quantity;
    if (destination.type === "ground") matching.lastHolder = movedStack.lastHolder;
    next.stacks = next.stacks.filter((entry) => entry.id !== movedStack.id);
  }
  return { state: normalizeAmmoStacks(next), moved: possible, reason: possible < wanted ? `${wanted - possible} could not fit.` : "Moved." };
}

export function moveStackToGround(state: InventoryManagementState, stackId: string) {
  return moveStack(state, stackId, { type: "ground" }, [], undefined);
}

/** A thrown weapon leaves one physical item on Ground while preserving the rest of its stack. */
export function throwOneStackToGround(state: InventoryManagementState, stackId: string) {
  return moveStack(state, stackId, { type: "ground" }, [], 1);
}

export function stackRequiresBothHands(stack: Pick<InventoryStack, "name" | "unitEncumbranceUnits" | "equipment">, character?: Pick<Character, "stats"> | null) {
  if (stack.unitEncumbranceUnits > stoneToUnits(2)) return true;
  if (stack.equipment?.kind !== "weapon") return false;
  return getHandsRequired({ name: stack.name, weaponRulesId: stack.equipment.weaponRulesId, twoHanded: stack.equipment.twoHanded }, character) === 2;
}

export function handLoadoutIssue(main: InventoryStack | undefined, offhand: InventoryStack | undefined, character?: Pick<Character, "stats"> | null) {
  if (!main || !offhand) return "";
  const requiringBoth = stackRequiresBothHands(main, character) ? main : stackRequiresBothHands(offhand, character) ? offhand : undefined;
  return requiringBoth ? `${requiringBoth.name} requires both hands at the character's current STR. Clear the other hand.` : "";
}

export function moveStackToHand(state: InventoryManagementState, stackId: string, ownerId: string, slot: "main" | "offhand", characters: Character[]) {
  const stack = state.stacks.find((entry) => entry.id === stackId);
  const quick = state.containers.find((container) => container.containerType === "quick-access" && container.holderType === "owner" && container.holderId === ownerId);
  if (!stack || !quick) return { state, moved: false, reason: "This character has no Quick Access container." };
  const owner = state.owners.find((entry) => entry.id === ownerId);
  const character = owner?.characterId ? characters.find((entry) => entry.id === owner.characterId) : undefined;
  const occupied = state.stacks.find((entry) => entry.containerId === quick.id && entry.handSlot === slot && entry.id !== stack.id);
  if (occupied) return { state, moved: false, reason: `Hand ${slot === "main" ? "1" : "2"} is already holding ${occupied.name}.` };
  const otherSlot = slot === "main" ? "offhand" : "main";
  const otherHeld = state.stacks.find((entry) => entry.containerId === quick.id && entry.handSlot === otherSlot && entry.id !== stack.id);
  if (otherHeld && stackRequiresBothHands(stack, character)) return { state, moved: false, reason: `${stack.name} requires both hands at the character's current STR, but ${otherHeld.name} is in Hand ${otherSlot === "main" ? "1" : "2"}.` };
  if (otherHeld && stackRequiresBothHands(otherHeld, character)) return { state, moved: false, reason: `${otherHeld.name} already reserves both hands at the character's current STR.` };
  if (stack.containerId === quick.id && stack.handSlot === slot && stack.quantity === 1) return { state, moved: true, reason: "Already in hand." };
  if (maxStackQuantityForContainer(state, stack, quick.id, characters) < 1) return { state, moved: false, reason: "Quick Access does not have enough capacity." };

  const next = cloneInventory(state);
  const source = next.stacks.find((entry) => entry.id === stackId)!;
  const lastHolder = holderLabelForStack(state, stack);
  let held: InventoryStack;
  if (source.quantity === 1) held = source;
  else {
    source.quantity -= 1;
    held = { ...source, id: inventoryId("stack"), quantity: 1 };
    next.stacks.push(held);
  }
  held.containerId = quick.id;
  held.locationId = null;
  held.placement = null;
  held.handSlot = slot;
  held.lastHolder = lastHolder;
  const rules = held.equipment?.kind === "weapon" ? weaponRulesForItem({ name: held.name, weaponRulesId: held.equipment.weaponRulesId }) : null;
  let granted = false;
  if (rules?.missileMode === "projectile" && !held.initialAmmoGranted) {
    held.initialAmmoGranted = true;
    next.stacks.push({
      id: inventoryId("ammo"), campaignId: held.campaignId, catalogItemId: "catalog-ammo", customIdentity: null,
      name: "Ammo", quantity: 1, unitEncumbranceUnits: UNITS_PER_POCKET, encumbranceClass: "pocket", itemKind: "normal", gpValue: 1,
      containerId: quick.id, locationId: null, placement: null, handSlot: null, lastHolder: held.name, notes: `Initial Ammo from ${held.name}`,
      equipment: null, trainingByCharacter: {}, shotsRemaining: AMMO_CAPACITY,
    });
    granted = true;
  }
  return { state: normalizeAmmoStacks(next), moved: true, reason: `${held.name} moved to Hand ${slot === "main" ? "1" : "2"}.${granted ? " Initial Ammo 10/10 added." : ""}` };
}

export function moveStackToWorn(state: InventoryManagementState, stackId: string, ownerId: string) {
  const stack = state.stacks.find((entry) => entry.id === stackId);
  const worn = state.containers.find((container) => container.containerType === "worn" && container.holderType === "owner" && container.holderId === ownerId);
  if (!stack || !worn) return { state, moved: false, reason: "This character has no Worn area." };
  if (stack.equipment?.kind === "shield") return { state, moved: false, reason: "Shields must be equipped in a hand." };
  if (stack.containerId === worn.id && stack.quantity === 1) return { state, moved: true, reason: "Already worn." };
  const next = cloneInventory(state);
  const source = next.stacks.find((entry) => entry.id === stackId)!;
  const lastHolder = holderLabelForStack(state, stack);
  let wornStack: InventoryStack;
  if (source.quantity === 1) wornStack = source;
  else {
    source.quantity -= 1;
    wornStack = { ...source, id: inventoryId("stack"), quantity: 1 };
    next.stacks.push(wornStack);
  }
  wornStack.containerId = worn.id;
  wornStack.locationId = null;
  wornStack.placement = null;
  wornStack.handSlot = null;
  wornStack.lastHolder = lastHolder;
  return { state: next, moved: true, reason: `${wornStack.name} added to Worn.` };
}

export type HolderDestination = { type: "owner" | "location" | "container"; id: string } | { type: "ground" };

export function moveContainer(state: InventoryManagementState, containerId: string, destination: HolderDestination, characters: Character[]) {
  const container = state.containers.find((entry) => entry.id === containerId);
  if (!container) return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "That container no longer exists." };
  if (!container.movable || container.containerType === "quick-access") return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "Quick Access cannot move." };
  if (destination.type === "container") {
    if (destination.id === container.id || getContainerDescendantIds(state, container.id).has(destination.id)) return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "A container cannot be placed inside itself or one of its contents." };
    if (!state.containers.some((entry) => entry.id === destination.id)) return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "That destination container no longer exists." };
  }
  if (destination.type === "location" && !state.locations.some((entry) => entry.id === destination.id)) return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "That location no longer exists." };
  if (destination.type === "owner" && !state.owners.some((entry) => entry.id === destination.id)) return { state, moved: false, requiredUnits: 0, availableUnits: 0, reason: "That carrier no longer exists." };

  const requiredUnits = getContainerEffectiveLoadUnits(state, container.id);
  const sourceRoot = getContainerRootHolder(state, container.id);
  const sourceAncestors = new Set(getContainerPathToRoot(state, container.id).slice(1).map((entry) => entry.id));
  let availableUnits = Number.POSITIVE_INFINITY;
  let destinationRoot: ReturnType<typeof getContainerRootHolder> = null;
  if (destination.type === "container") {
    availableUnits = destinationContainerRoom(state, destination.id, sourceAncestors, characters);
    destinationRoot = getContainerRootHolder(state, destination.id);
  } else if (destination.type === "owner") destinationRoot = { type: "owner", id: destination.id };
  else if (destination.type === "location") destinationRoot = { type: "location", id: destination.id };
  else destinationRoot = { type: "ground", id: container.campaignId };
  if (destinationRoot?.type === "owner" && !(sourceRoot?.type === "owner" && sourceRoot.id === destinationRoot.id) && !state.owners.some((owner) => owner.id === destinationRoot.id && owner.type === "character")) availableUnits = Math.min(availableUnits, getOwnerRemainingUnits(state, destinationRoot.id, characters));
  if (requiredUnits > availableUnits) {
    const reason = destination.type === "container" ? "The destination container or one of its outer containers is too full." : "The destination carrier does not have enough capacity.";
    return { state, moved: false, requiredUnits, availableUnits, reason };
  }
  const next = cloneInventory(state);
  const moved = next.containers.find((entry) => entry.id === container.id)!;
  moved.lastHolder = holderLabelForContainer(state, container);
  moved.holderType = destination.type;
  moved.holderId = destination.type === "ground" ? moved.campaignId : destination.id;
  return { state: next, moved: true, requiredUnits, availableUnits, reason: "Container and contents moved." };
}

export function splitStack(state: InventoryManagementState, stackId: string, quantity: number) {
  const stack = state.stacks.find((entry) => entry.id === stackId);
  const amount = Math.trunc(quantity);
  if (!stack || amount <= 0 || amount >= stack.quantity) return state;
  const next = cloneInventory(state);
  const source = next.stacks.find((entry) => entry.id === stackId)!;
  source.quantity -= amount;
  next.stacks.push({ ...source, id: inventoryId("stack"), quantity: amount, handSlot: null });
  return next;
}

function stackHolderKey(stack: InventoryStack) {
  if (stack.containerId) return `container:${stack.containerId}:hand:${stack.handSlot ?? "loose"}`;
  if (stack.locationId) return `location:${stack.locationId}`;
  return `placement:${stack.placement ?? "ground"}`;
}

export function combinableInventoryStackIds(state: InventoryManagementState, stackId: string) {
  const stack = state.stacks.find((entry) => entry.id === stackId);
  if (!stack) return [];
  const name = stack.name.trim().toLocaleLowerCase();
  const holder = stackHolderKey(stack);
  return state.stacks.filter((entry) => entry.campaignId === stack.campaignId && entry.name.trim().toLocaleLowerCase() === name && stackHolderKey(entry) === holder).map((entry) => entry.id);
}

export function combineInventoryStacks(state: InventoryManagementState, stackId: string) {
  const ids = combinableInventoryStackIds(state, stackId);
  if (ids.length < 2) return { state, combined: 0, reason: "There are no matching piles in this inventory." };
  const idSet = new Set(ids);
  const target = state.stacks.find((entry) => entry.id === stackId)!;
  const quantity = state.stacks.filter((entry) => idSet.has(entry.id)).reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    state: { ...state, stacks: state.stacks.filter((entry) => !idSet.has(entry.id) || entry.id === target.id).map((entry) => entry.id === target.id ? { ...entry, quantity } : entry) },
    combined: ids.length,
    reason: `${ids.length} ${target.name} piles combined into one stack of ${quantity}.`,
  };
}

function containersForOwner(state: InventoryManagementState, ownerId: string) {
  return state.containers.filter((container) => container.containerType !== "worn" && (() => {
    const root = getContainerRootHolder(state, container.id);
    return root?.type === "owner" && root.id === ownerId;
  })());
}

function ownerContainers(state: InventoryManagementState, ownerId: string, stack: InventoryStack, characters: Character[]) {
  return containersForOwner(state, ownerId)
    .filter((container) => container.id !== stack.containerId && !container.hidden)
    .filter((container) => maxStackQuantityForContainer(state, stack, container.id, characters) > 0)
    .sort((left, right) => {
      const leftMatch = state.stacks.some((entry) => entry.containerId === left.id && !entry.handSlot && stacksMatch(entry, stack));
      const rightMatch = state.stacks.some((entry) => entry.containerId === right.id && !entry.handSlot && stacksMatch(entry, stack));
      if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
      return getContainerRemainingUnits(state, left.id, characters) - getContainerRemainingUnits(state, right.id, characters);
    });
}

function placeWithOwner(state: InventoryManagementState, stackId: string, ownerId: string, characters: Character[], requested: number) {
  let next = state;
  let remaining = requested;
  let moved = 0;
  const details: string[] = [];
  while (remaining > 0) {
    const stack = next.stacks.find((entry) => entry.id === stackId);
    if (!stack) break;
    const options = ownerContainers(next, ownerId, stack, characters);
    if (!options.length) break;
    const result = moveStack(next, stackId, { type: "container", id: options[0].id }, characters, remaining);
    if (!result.moved) break;
    details.push(`${result.moved} × ${stack.name} → ${options[0].name}`);
    next = result.state;
    moved += result.moved;
    remaining -= result.moved;
  }
  return { state: next, moved, details };
}

export function smartStack(state: InventoryManagementState, stackId: string, scopeOwnerIds: string[], characters: Character[]) {
  const source = state.stacks.find((entry) => entry.id === stackId);
  if (!source) return { state, assigned: 0, remaining: 0, reason: "That stack no longer exists." };
  const originalQuantity = source.quantity;
  let next = state;
  const details: string[] = [];
  const validOwners = scopeOwnerIds.filter((ownerId) => state.owners.some((owner) => owner.id === ownerId));
  const candidates = validOwners.flatMap((ownerId) => containersForOwner(state, ownerId))
    .filter((container) => !container.hidden && container.id !== source.containerId && maxStackQuantityForContainer(state, source, container.id, characters) > 0)
    .sort((left, right) => {
      const leftMatch = state.stacks.some((entry) => entry.containerId === left.id && !entry.handSlot && stacksMatch(entry, source));
      const rightMatch = state.stacks.some((entry) => entry.containerId === right.id && !entry.handSlot && stacksMatch(entry, source));
      if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
      return getContainerRemainingUnits(state, left.id, characters) - getContainerRemainingUnits(state, right.id, characters);
    });
  for (const container of candidates) {
    const remainingStack = next.stacks.find((entry) => entry.id === stackId);
    if (!remainingStack) break;
    const result = moveStack(next, stackId, { type: "container", id: container.id }, characters, remainingStack.quantity);
    if (result.moved) {
      details.push(`${result.moved} × ${remainingStack.name} → ${container.name}`);
      next = result.state;
    }
  }
  const remaining = next.stacks.find((entry) => entry.id === stackId)?.quantity ?? 0;
  return { state: next, assigned: originalQuantity - remaining, remaining, details, reason: remaining ? `${remaining} remain because the selected inventories are full.` : "Smart stack complete." };
}

export function placeStackInNonQuickInventory(state: InventoryManagementState, stackId: string, ownerId: string, characters: Character[]) {
  const source = state.stacks.find((entry) => entry.id === stackId);
  if (!source) return { state, assigned: 0, remaining: 0, reason: "That stack no longer exists." };
  const originalQuantity = source.quantity;
  let next = state;
  const candidates = containersForOwner(state, ownerId)
    .filter((container) => container.containerType !== "quick-access" && container.containerType !== "worn" && !container.hidden)
    .filter((container) => maxStackQuantityForContainer(state, source, container.id, characters) > 0)
    .sort((left, right) => {
      const leftMatch = state.stacks.some((entry) => entry.containerId === left.id && !entry.handSlot && stacksMatch(entry, source));
      const rightMatch = state.stacks.some((entry) => entry.containerId === right.id && !entry.handSlot && stacksMatch(entry, source));
      if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
      const leftBackpack = left.containerType === "character-backpack";
      const rightBackpack = right.containerType === "character-backpack";
      if (leftBackpack !== rightBackpack) return leftBackpack ? -1 : 1;
      return getContainerRemainingUnits(state, left.id, characters) - getContainerRemainingUnits(state, right.id, characters);
    });
  for (const container of candidates) {
    const remainingStack = next.stacks.find((entry) => entry.id === stackId);
    if (!remainingStack) break;
    const result = moveStack(next, stackId, { type: "container", id: container.id }, characters, remainingStack.quantity);
    if (result.moved) next = result.state;
  }
  const remaining = next.stacks.find((entry) => entry.id === stackId)?.quantity ?? 0;
  return { state: next, assigned: originalQuantity - remaining, remaining, reason: remaining ? `${remaining} remain on Ground because non-Quick Access inventory is full.` : "Stored outside Quick Access." };
}

export function autoAssign(state: InventoryManagementState, stackId: string, scopeOwnerIds: string[], characters: Character[]) {
  return smartStack(state, stackId, scopeOwnerIds, characters);
}

export function spreadEvenly(state: InventoryManagementState, stackId: string, scopeOwnerIds: string[], characters: Character[]) {
  const source = state.stacks.find((entry) => entry.id === stackId);
  const owners = scopeOwnerIds.filter((ownerId) => state.owners.some((owner) => owner.id === ownerId));
  if (!source || !owners.length) return { state, assigned: 0, remaining: source?.quantity ?? 0, reason: "Select at least one eligible carrier." };
  const originalQuantity = source.quantity;
  const base = Math.floor(originalQuantity / owners.length);
  const extra = originalQuantity % owners.length;
  let next = state;
  const details: string[] = [];
  owners.forEach((ownerId, index) => {
    if (!next.stacks.some((entry) => entry.id === stackId)) return;
    const result = placeWithOwner(next, stackId, ownerId, characters, base + (index < extra ? 1 : 0));
    next = result.state;
    details.push(...result.details);
  });
  let progress = true;
  while (next.stacks.some((entry) => entry.id === stackId) && progress) {
    progress = false;
    for (const ownerId of owners) {
      if (!next.stacks.some((entry) => entry.id === stackId)) break;
      const result = placeWithOwner(next, stackId, ownerId, characters, 1);
      if (result.moved) { next = result.state; details.push(...result.details); progress = true; }
    }
  }
  const remaining = next.stacks.find((entry) => entry.id === stackId)?.quantity ?? 0;
  return { state: next, assigned: originalQuantity - remaining, remaining, details, reason: remaining ? `${remaining} remain because the selected inventories are full.` : "Spread evenly." };
}

export function giveAllTo(state: InventoryManagementState, stackId: string, ownerId: string, characters: Character[]) {
  const source = state.stacks.find((entry) => entry.id === stackId);
  if (!source) return { state, moved: false, fitQuantity: 0, missingUnits: 0, reason: "That stack no longer exists." };
  const originalQuantity = source.quantity;
  const attempt = placeWithOwner(state, stackId, ownerId, characters, originalQuantity);
  if (attempt.moved !== originalQuantity) {
    const missingUnits = (originalQuantity - attempt.moved) * source.unitEncumbranceUnits;
    return { state, moved: false, fitQuantity: attempt.moved, missingUnits, details: attempt.details, reason: `${attempt.moved} can fit; ${formatStoneUnits(missingUnits)} more capacity is required.` };
  }
  return { state: attempt.state, moved: true, fitQuantity: originalQuantity, missingUnits: 0, details: attempt.details, reason: "Entire stack moved." };
}

function groundDirectStack(stack: InventoryStack, lastHolder: string) {
  stack.containerId = null;
  stack.locationId = null;
  stack.placement = "ground";
  stack.handSlot = null;
  stack.lastHolder = lastHolder;
}

export function dumpContainerContentsToGround(state: InventoryManagementState, containerId: string) {
  const container = state.containers.find((entry) => entry.id === containerId);
  if (!container) return { state, dumped: 0, reason: "That container no longer exists." };
  const next = cloneInventory(state);
  let dumped = 0;
  for (const stack of next.stacks.filter((entry) => entry.containerId === containerId)) {
    groundDirectStack(stack, container.name);
    dumped += 1;
  }
  for (const child of next.containers.filter((entry) => entry.holderType === "container" && entry.holderId === containerId)) {
    child.lastHolder = container.name;
    child.holderType = "ground";
    child.holderId = child.campaignId;
    dumped += 1;
  }
  return { state: next, dumped, reason: dumped ? `${dumped} entr${dumped === 1 ? "y" : "ies"} dumped on the Ground.` : `${container.name} is already empty.` };
}

export function dumpHolderToGround(state: InventoryManagementState, holder: { type: "owner" | "location"; id: string }) {
  const next = cloneInventory(state);
  const label = holder.type === "owner" ? next.owners.find((owner) => owner.id === holder.id)?.name : next.locations.find((location) => location.id === holder.id)?.name;
  if (!label) return { state, dumped: 0, reason: "That holder no longer exists." };
  let dumped = 0;
  if (holder.type === "location") {
    for (const stack of next.stacks.filter((entry) => !entry.containerId && entry.locationId === holder.id)) {
      groundDirectStack(stack, label);
      dumped += 1;
    }
  }
  const roots = next.containers.filter((container) => container.holderType === holder.type && container.holderId === holder.id);
  for (const container of roots) {
    if (container.containerType === "worn") continue;
    if (!container.movable) {
      for (const stack of next.stacks.filter((entry) => entry.containerId === container.id)) {
        groundDirectStack(stack, container.name);
        dumped += 1;
      }
      for (const child of next.containers.filter((entry) => entry.holderType === "container" && entry.holderId === container.id)) {
        child.lastHolder = container.name;
        child.holderType = "ground";
        child.holderId = child.campaignId;
        dumped += 1;
      }
    } else {
      container.lastHolder = label;
      container.holderType = "ground";
      container.holderId = container.campaignId;
      dumped += 1;
    }
  }
  return { state: next, dumped, reason: dumped ? `${dumped} entr${dumped === 1 ? "y" : "ies"} dumped on the Ground.` : `${label} has nothing to dump.` };
}

export function containerIsHidden(state: InventoryManagementState, containerId: string) {
  const path = getContainerPathToRoot(state, containerId);
  if (path.some((container) => container.hidden)) return true;
  const root = getContainerRootHolder(state, containerId);
  return root?.type === "location" && Boolean(state.locations.find((location) => location.id === root.id)?.hidden);
}

export function setContainerHidden(state: InventoryManagementState, containerId: string, hidden: boolean) {
  const container = state.containers.find((entry) => entry.id === containerId);
  if (!container || !container.movable) return state;
  return { ...state, containers: state.containers.map((entry) => entry.id === containerId ? { ...entry, hidden } : entry) };
}

export function setLocationHidden(state: InventoryManagementState, locationId: string, hidden: boolean) {
  if (!state.locations.some((entry) => entry.id === locationId)) return state;
  return { ...state, locations: state.locations.map((entry) => entry.id === locationId ? { ...entry, hidden } : entry) };
}

function discardEntry(
  state: InventoryManagementState,
  kind: InventoryDiscardEntry["kind"],
  label: string,
  owners: PhysicalInventoryOwner[],
  locations: InventoryDiscardEntry["locations"],
  containers: InventoryContainer[],
  stacks: InventoryStack[],
) {
  const ownerIds = new Set(owners.map((entry) => entry.id));
  const locationIds = new Set(locations.map((entry) => entry.id));
  const containerIds = new Set(containers.map((entry) => entry.id));
  const stackIds = new Set(stacks.map((entry) => entry.id));
  const entry: InventoryDiscardEntry = {
    id: inventoryId("discard"),
    kind,
    label,
    discardedAt: Date.now(),
    owners: owners.map((owner) => ({ ...owner })),
    locations: locations.map((location) => ({ ...location })),
    containers: containers.map((container) => ({ ...container })),
    stacks: stacks.map((stack) => ({ ...stack, equipment: stack.equipment ? { ...stack.equipment } : null, trainingByCharacter: { ...(stack.trainingByCharacter ?? {}) } })),
  };
  return {
    ...state,
    owners: state.owners.filter((owner) => !ownerIds.has(owner.id)),
    locations: state.locations.filter((location) => !locationIds.has(location.id)),
    containers: state.containers.filter((container) => !containerIds.has(container.id)),
    stacks: state.stacks.filter((stack) => !stackIds.has(stack.id)),
    layoutPositions: Object.fromEntries(Object.entries(state.layoutPositions).filter(([key]) => !ownerIds.has(key.replace("owner:", "")) && !locationIds.has(key.replace("location:", "")))),
    discarded: [entry, ...(state.discarded ?? [])],
  };
}

export function discardInventoryStack(state: InventoryManagementState, stackId: string, requestedQuantity?: number) {
  const stack = state.stacks.find((entry) => entry.id === stackId);
  if (!stack) return { state, discarded: false, reason: "That stack no longer exists." };
  const quantity = Math.max(1, Math.min(stack.quantity, Math.trunc(requestedQuantity ?? stack.quantity)));
  if (quantity === stack.quantity) return { state: discardEntry(state, "stack", `${stack.quantity} × ${stack.name}`, [], [], [], [stack]), discarded: true, reason: `${stack.quantity} × ${stack.name} moved to discard.` };
  const remainingState = { ...state, stacks: state.stacks.map((entry) => entry.id === stack.id ? { ...entry, quantity: entry.quantity - quantity } : entry) };
  const discardedStack = { ...stack, id: inventoryId("discarded-stack"), quantity };
  return { state: discardEntry(remainingState, "stack", `${quantity} × ${stack.name}`, [], [], [], [discardedStack]), discarded: true, reason: `${quantity} × ${stack.name} moved to discard; ${stack.quantity - quantity} remain.` };
}

export function discardInventoryContainer(state: InventoryManagementState, containerId: string) {
  const container = state.containers.find((entry) => entry.id === containerId);
  if (!container || container.intrinsic || container.containerType !== "container") return { state, discarded: false, reason: "That container cannot be discarded." };
  const containerIds = new Set([container.id, ...getContainerDescendantIds(state, container.id)]);
  const containers = state.containers.filter((entry) => containerIds.has(entry.id));
  const stacks = state.stacks.filter((stack) => Boolean(stack.containerId && containerIds.has(stack.containerId)));
  return { state: discardEntry(state, "container", container.name, [], [], containers, stacks), discarded: true, reason: `${container.name} and its contents moved to discard.` };
}

export function discardInventoryLocation(state: InventoryManagementState, locationId: string) {
  const location = state.locations.find((entry) => entry.id === locationId);
  if (!location) return { state, discarded: false, reason: "That location no longer exists." };
  const rootIds = state.containers.filter((container) => container.holderType === "location" && container.holderId === locationId).map((container) => container.id);
  const containerIds = new Set(rootIds.flatMap((id) => [id, ...getContainerDescendantIds(state, id)]));
  const containers = state.containers.filter((container) => containerIds.has(container.id));
  const stacks = state.stacks.filter((stack) => stack.locationId === locationId || Boolean(stack.containerId && containerIds.has(stack.containerId)));
  return { state: discardEntry(state, "location", location.name, [], [location], containers, stacks), discarded: true, reason: `${location.name} and everything stored there moved to discard.` };
}

export function discardInventoryOwner(state: InventoryManagementState, ownerId: string) {
  const owner = state.owners.find((entry) => entry.id === ownerId);
  if (!owner) return { state, discarded: false, reason: "That inventory no longer exists." };
  if (owner.type === "character") return { state, discarded: false, reason: "Character inventories follow their characters and cannot be discarded here." };
  const rootIds = state.containers.filter((container) => container.holderType === "owner" && container.holderId === ownerId).map((container) => container.id);
  const containerIds = new Set(rootIds.flatMap((id) => [id, ...getContainerDescendantIds(state, id)]));
  const containers = state.containers.filter((container) => containerIds.has(container.id));
  const stacks = state.stacks.filter((stack) => Boolean(stack.containerId && containerIds.has(stack.containerId)));
  return { state: discardEntry(state, "owner", owner.name, [owner], [], containers, stacks), discarded: true, reason: `${owner.name} and its inventory moved to discard.` };
}

export function restoreInventoryDiscard(state: InventoryManagementState, discardId: string) {
  const entry = (state.discarded ?? []).find((discard) => discard.id === discardId);
  if (!entry) return { state, restored: false, reason: "That discard entry no longer exists." };
  const ownerIds = new Set(state.owners.map((owner) => owner.id));
  const locationIds = new Set(state.locations.map((location) => location.id));
  const containerIds = new Set(state.containers.map((container) => container.id));
  const restoredOwners = entry.owners.map((owner) => ({ ...owner, id: ownerIds.has(owner.id) ? inventoryId("owner") : owner.id }));
  const restoredLocations = entry.locations.map((location) => ({ ...location, id: locationIds.has(location.id) ? inventoryId("location") : location.id }));
  const ownerMap = new Map(entry.owners.map((owner, index) => [owner.id, restoredOwners[index].id]));
  const locationMap = new Map(entry.locations.map((location, index) => [location.id, restoredLocations[index].id]));
  const containerMap = new Map(entry.containers.map((container) => [container.id, containerIds.has(container.id) ? inventoryId("container") : container.id]));
  const restoredContainers = entry.containers.map((container) => {
    const holderId = container.holderType === "owner" ? ownerMap.get(container.holderId) ?? container.holderId : container.holderType === "location" ? locationMap.get(container.holderId) ?? container.holderId : container.holderType === "container" ? containerMap.get(container.holderId) ?? container.holderId : container.holderId;
    const validHolder = container.holderType === "ground" || container.holderType === "container" && (containerMap.has(container.holderId) || state.containers.some((existing) => existing.id === container.holderId)) || container.holderType === "owner" && (ownerMap.has(container.holderId) || state.owners.some((existing) => existing.id === container.holderId)) || container.holderType === "location" && (locationMap.has(container.holderId) || state.locations.some((existing) => existing.id === container.holderId));
    return { ...container, id: containerMap.get(container.id)!, holderType: validHolder ? container.holderType : "ground", holderId: validHolder ? holderId : container.campaignId };
  });
  const stackIds = new Set(state.stacks.map((stack) => stack.id));
  const restoredStacks = entry.stacks.map((stack) => {
    const containerId = stack.containerId ? containerMap.get(stack.containerId) ?? (state.containers.some((container) => container.id === stack.containerId) ? stack.containerId : null) : null;
    const locationId = stack.locationId ? locationMap.get(stack.locationId) ?? (state.locations.some((location) => location.id === stack.locationId) ? stack.locationId : null) : null;
    const placement = ["sell", "payment", "counter"].includes(String(stack.placement)) ? stack.placement as "sell" | "payment" | "counter" : "ground";
    return { ...stack, id: stackIds.has(stack.id) ? inventoryId("stack") : stack.id, containerId, locationId, placement: containerId || locationId ? null : placement, handSlot: containerId ? stack.handSlot : null } as InventoryStack;
  });
  return {
    state: {
      ...state,
      owners: [...state.owners, ...restoredOwners],
      locations: [...state.locations, ...restoredLocations],
      containers: [...state.containers, ...restoredContainers],
      stacks: [...state.stacks, ...restoredStacks],
      discarded: state.discarded.filter((discard) => discard.id !== discardId),
    },
    restored: true,
    reason: `${entry.label} restored.`,
  };
}

export function clearInventoryDiscard(state: InventoryManagementState, campaignId?: string) {
  if (!campaignId) return { ...state, discarded: [] };
  const belongsToCampaign = (entry: InventoryDiscardEntry) => entry.owners.some((owner) => owner.campaignId === campaignId) || entry.locations.some((location) => location.campaignId === campaignId) || entry.containers.some((container) => container.campaignId === campaignId) || entry.stacks.some((stack) => stack.campaignId === campaignId);
  return { ...state, discarded: state.discarded.filter((entry) => !belongsToCampaign(entry)) };
}

export function isCoinStack(stack: InventoryStack) {
  return currencyCodeFromName(stack.name) != null;
}

export function inventoryStacksGpValue(stacks: InventoryStack[]) {
  const totalCopper = stacks.reduce((sum, stack) => {
    const denominationValue = currencyGpValueFromName(stack.name);
    const unitValue = denominationValue ?? Math.max(0, Number(stack.gpValue) || 0);
    return sum + gpToCopperPieces(unitValue) * Math.max(1, stack.quantity);
  }, 0);
  return copperPiecesToGp(totalCopper);
}

export function spendInventoryCoinsSmallestFirst(state: InventoryManagementState, ownerId: string, costGp: number, characters: Character[]) {
  const costCopper = gpToCopperPieces(Math.max(0, Number(costGp) || 0));
  const ownedCoins = inventoryCoinStacksForOwner(state, ownerId).map((stack) => ({
    stack,
    definition: CURRENCY_BY_CODE[currencyCodeFromName(stack.name)!],
  })).sort((left, right) => left.definition.copperValue - right.definition.copperValue || left.stack.id.localeCompare(right.stack.id));
  const totalCopper = ownedCoins.reduce((sum, entry) => sum + entry.definition.copperValue * entry.stack.quantity, 0);
  if (totalCopper < costCopper) return { state, paid: false, totalGp: copperPiecesToGp(totalCopper), changeGp: 0, reason: `Short by ${formatGpAsPrice(copperPiecesToGp(costCopper - totalCopper))}.` };

  let remainingCopper = costCopper;
  let paidCopper = 0;
  const deductions = new Map<string, number>();
  for (const { stack, definition } of ownedCoins) {
    if (remainingCopper <= 0) break;
    const quantity = Math.min(stack.quantity, Math.ceil(remainingCopper / definition.copperValue));
    deductions.set(stack.id, quantity);
    const value = quantity * definition.copperValue;
    remainingCopper -= value;
    paidCopper += value;
  }

  let next: InventoryManagementState = {
    ...state,
    stacks: state.stacks.flatMap((stack) => {
      const quantity = deductions.get(stack.id) ?? 0;
      if (!quantity) return [stack];
      return quantity >= stack.quantity ? [] : [{ ...stack, quantity: stack.quantity - quantity }];
    }),
  };
  const changeCopper = Math.max(0, paidCopper - costCopper);
  const change = currencyBreakdownFromGp(copperPiecesToGp(changeCopper), SHOP_CURRENCY_DEFINITIONS);
  for (const definition of SHOP_CURRENCY_DEFINITIONS) {
    const quantity = change[definition.code];
    if (!quantity) continue;
    const stack: InventoryStack = {
      id: inventoryId("change"), campaignId: state.owners.find((owner) => owner.id === ownerId)?.campaignId ?? "default",
      catalogItemId: null, customIdentity: null, name: definition.name, quantity, unitEncumbranceUnits: 1,
      encumbranceClass: "coin", itemKind: "treasure", gpValue: definition.gpValue, containerId: null,
      locationId: null, placement: "ground", handSlot: null, lastHolder: "Shopping change", notes: "Shopping change",
      equipment: null, trainingByCharacter: {},
    };
    next = { ...next, stacks: [...next.stacks, stack] };
    next = placeStackInNonQuickInventory(next, stack.id, ownerId, characters).state;
  }
  return { state: next, paid: true, totalGp: copperPiecesToGp(totalCopper), changeGp: copperPiecesToGp(changeCopper), reason: "Paid from carried coins, smallest denomination first." };
}

export function refundInventoryCoins(state: InventoryManagementState, ownerId: string, refundGp: number, characters: Character[], lastHolder = "Character sheet refund") {
  const owner = state.owners.find((entry) => entry.id === ownerId);
  if (!owner) return { state, refunded: false, reason: "That inventory no longer exists." };
  const safeRefund = copperPiecesToGp(gpToCopperPieces(refundGp));
  if (safeRefund <= 0) return { state, refunded: false, reason: "There is no refund to return." };
  const output = gpToCoinOutputs(owner.campaignId, safeRefund, lastHolder);
  let next: InventoryManagementState = { ...state, stacks: [...state.stacks, ...output.stacks.map((stack) => ({ ...stack, placement: "ground" as const }))] };
  for (const stack of output.stacks) next = placeStackInNonQuickInventory(next, stack.id, ownerId, characters).state;
  return { state: next, refunded: true, refundGp: safeRefund, reason: `${formatGpAsPrice(safeRefund)} refunded to inventory.` };
}

function coinOutputStack(campaignId: string, code: CurrencyCode, quantity: number, lastHolder: string): InventoryStack {
  const definition = CURRENCY_BY_CODE[code];
  return { id: inventoryId("coin"), campaignId, catalogItemId: null, customIdentity: `currency:${code}:${inventoryId("pile")}`, name: definition.name, quantity, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: definition.gpValue, containerId: null, locationId: null, placement: "counter", handSlot: null, lastHolder, notes: lastHolder, equipment: null, trainingByCharacter: {} };
}

function gpToCoinOutputs(campaignId: string, valueGp: number, lastHolder: string) {
  const breakdown = currencyBreakdownFromGp(valueGp, SHOP_CURRENCY_DEFINITIONS);
  return {
    ...breakdown,
    stacks: SHOP_CURRENCY_DEFINITIONS.filter((definition) => breakdown[definition.code] > 0).map((definition) => coinOutputStack(campaignId, definition.code, breakdown[definition.code], lastHolder)),
  };
}

export function initiateInventorySale(state: InventoryManagementState, campaignId: string) {
  const saleStacks = state.stacks.filter((stack) => stack.campaignId === campaignId && stack.placement === "sell" && !stack.containerId && !stack.locationId);
  if (!saleStacks.length) return { state, sold: 0, pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, reason: "The Sell tile is empty." };
  const saleValueGp = saleStacks.reduce((sum, stack) => {
    const grossGp = Math.max(0, Number(stack.gpValue) || 0) * Math.max(1, stack.quantity);
    const rate = isCoinStack(stack) ? 0.95 : stack.itemKind === "treasure" ? 1 : 0.1;
    return sum + grossGp * rate;
  }, 0);
  const output = gpToCoinOutputs(campaignId, saleValueGp, "Sale proceeds");
  const { pp, gp, ep, sp, cp } = output;
  const saleIds = new Set(saleStacks.map((stack) => stack.id));
  const next: InventoryManagementState = { ...state, stacks: [...state.stacks.filter((stack) => !saleIds.has(stack.id)), ...output.stacks] };
  return { state: next, sold: saleStacks.length, pp, gp, ep, sp, cp, reason: `Sale complete: ${formatGpAsPrice(saleValueGp)} placed in Purchases & change.` };
}

export function completeInventoryPurchase(state: InventoryManagementState, campaignId: string, purchases: InventoryStack[], costGp: number) {
  const paymentStacks = state.stacks.filter((stack) => stack.campaignId === campaignId && stack.placement === "payment" && !stack.containerId && !stack.locationId);
  const paymentGp = inventoryStacksGpValue(paymentStacks);
  const safeCost = Math.max(0, Number(costGp) || 0);
  if (!purchases.length) return { state, purchased: false, paymentGp, changeGp: 0, reason: "There is nothing to purchase." };
  if (gpToCopperPieces(paymentGp) < gpToCopperPieces(safeCost)) return { state, purchased: false, paymentGp, changeGp: 0, reason: `Payment is short by ${formatGpAsPrice(safeCost - paymentGp)}.` };
  const paymentIds = new Set(paymentStacks.map((stack) => stack.id));
  const changeGp = Math.max(0, paymentGp - safeCost);
  const change = gpToCoinOutputs(campaignId, changeGp, "Shopping change");
  const heldPurchases = purchases.map((stack) => ({ ...stack, campaignId, containerId: null, locationId: null, placement: "counter" as const, handSlot: null, lastHolder: "Shopping counter" }));
  return {
    state: { ...state, stacks: [...state.stacks.filter((stack) => !paymentIds.has(stack.id)), ...heldPurchases, ...change.stacks] },
    purchased: true,
    paymentGp,
    changeGp: copperPiecesToGp(gpToCopperPieces(changeGp)),
    reason: `Purchase complete. ${heldPurchases.length} item pile${heldPurchases.length === 1 ? "" : "s"} and ${formatGpAsPrice(changeGp)} change are ready for pickup.`,
  };
}

export function syncPhysicalEquipment(campaign: CampaignState): CampaignState {
  const state = campaign.inventoryManagement;
  let changed = false;
  const characters = campaign.characters.map((character) => {
    const owner = state.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
    const carried = owner ? state.stacks.filter((stack) => {
      if (!stack.equipment || !stack.containerId) return false;
      const root = getContainerRootHolder(state, stack.containerId);
      return root?.type === "owner" && root.id === owner.id;
    }) : [];
    const physicalWeapons = carried.filter((stack) => stack.equipment?.kind === "weapon").map((stack) => {
      const weaponRulesId = stack.equipment?.weaponRulesId ?? weaponRulesForName(stack.name)?.id ?? null;
      const training = getWeaponTrainingState(character, { name: stack.name, weaponRulesId });
      const legacyTraining = stack.trainingByCharacter?.[character.id];
      return {
        id: `inventory:${stack.id}`,
        name: stack.name,
        attackBonus: Number(stack.equipment?.attackBonus) || 0,
        damage: stack.equipment?.damage || "",
        notes: [stack.equipment?.damageLarge ? `vs Large ${stack.equipment.damageLarge}` : "", stack.notes ?? ""].filter(Boolean).join(" · "),
        category: stack.equipment?.weaponType ?? "other",
        specialized: training.specialized || Boolean(legacyTraining?.skilled),
        proficient: training.proficient || Boolean(legacyTraining?.proficient || legacyTraining?.skilled),
        sourceInventoryStackId: stack.id,
        weaponRulesId,
      } as Character["weapons"][number];
    });
    const manualWeapons = character.weapons.filter((weapon) => !weapon.sourceInventoryStackId);
    const weapons = [...manualWeapons, ...physicalWeapons];
    const main = carried.find((stack) => stack.handSlot === "main");
    const offhand = carried.find((stack) => stack.handSlot === "offhand");
    const heldWeapon = main?.equipment?.kind === "weapon" ? main : offhand?.equipment?.kind === "weapon" ? offhand : undefined;
    const invalidHandLoadout = Boolean(handLoadoutIssue(main, offhand, character));
    let equippedWeaponId = character.equippedWeaponId;
    let handState = character.handState;
    if (owner) {
      // The two physical hand slots are authoritative whenever this character has inventory.
      if (heldWeapon && !invalidHandLoadout) {
        equippedWeaponId = `inventory:${heldWeapon.id}`;
        if (stackRequiresBothHands(heldWeapon, character)) handState = heldWeapon.equipment?.weaponType === "ranged" ? "two-hand-ranged" : "two-hand-melee";
        else if ([main, offhand].some((stack) => stack?.equipment?.kind === "shield")) handState = "one-hand-shield";
        else if (main?.equipment?.kind === "weapon" && offhand?.equipment?.kind === "weapon") handState = "one-hand-offhand";
        else if ([main, offhand].some((stack) => /torch|lantern/i.test(stack?.name ?? ""))) handState = "one-hand-light";
        else if (heldWeapon.equipment?.weaponType === "ranged") handState = "one-hand-missile";
        else handState = "one-hand-empty";
      } else {
        equippedWeaponId = "unarmed";
        handState = "unarmed";
      }
    } else if (String(equippedWeaponId ?? "").startsWith("inventory:")) {
      equippedWeaponId = "unarmed";
      handState = "unarmed";
    }

    const wornContainer = owner ? state.containers.find((container) => container.containerType === "worn" && container.holderType === "owner" && container.holderId === owner.id) : undefined;
    const worn = wornContainer ? state.stacks.filter((stack) => stack.containerId === wornContainer.id && stack.equipment) : [];
    const armorPieces = worn.filter((stack) => stack.equipment?.kind === "armor" && Number.isFinite(stack.equipment.ascendingAc));
    const bestArmor = armorPieces.reduce<number | null>((best, stack) => best == null ? Number(stack.equipment?.ascendingAc) : Math.max(best, Number(stack.equipment?.ascendingAc)), null);
    const shieldBonus = invalidHandLoadout ? 0 : Math.max(0, ...[main, offhand].filter(Boolean).filter((stack) => stack?.equipment?.kind === "shield").map((stack) => Number(stack?.equipment?.shieldBonus) || 0));
    const baseArmorClass = Number.isFinite(Number(character.baseArmorClass)) ? Number(character.baseArmorClass) : Number(character.armorClass) || 10;
    const automaticArmorClass = bestArmor == null ? baseArmorClass + shieldBonus : bestArmor + dexterityArmorClassModifier(character.stats[1]) + shieldBonus;
    const armorClassOverride = character.armorClassOverride !== null && character.armorClassOverride !== undefined && Number.isFinite(Number(character.armorClassOverride)) ? Number(character.armorClassOverride) : null;
    const armorClass = armorClassOverride ?? automaticArmorClass;
    const next = { ...character, weapons, equippedWeaponId, handState, baseArmorClass, armorClassOverride, armorClass };
    if (JSON.stringify(next) !== JSON.stringify(character)) changed = true;
    return next;
  });
  if (!changed) return campaign;
  const equipmentByCharacterId = new Map(characters.map((character) => [character.id, character.equippedWeaponId]));
  return {
    ...campaign,
    characters,
    segmentedInitiative: {
      ...campaign.segmentedInitiative,
      participants: campaign.segmentedInitiative.participants.map((participant) => participant.characterId && equipmentByCharacterId.has(participant.characterId)
        ? { ...participant, equippedWeaponId: equipmentByCharacterId.get(participant.characterId) ?? "unarmed" }
        : participant),
    },
  };
}

function stackIsWithinContainer(state: InventoryManagementState, stack: InventoryStack, containerId: string) {
  return Boolean(stack.containerId && getContainerPathToRoot(state, stack.containerId).some((container) => container.id === containerId));
}

function heaviestFirst(stacks: InventoryStack[]) {
  return [...stacks].sort((left, right) => right.unitEncumbranceUnits - left.unitEncumbranceUnits || getStackEncumbranceUnits(right) - getStackEncumbranceUnits(left));
}

export function sortAndRebalanceInventory(state: InventoryManagementState, ownerIds: string[], characters: Character[]) {
  let next = state;
  let groundedItems = 0;
  let movedItems = 0;
  const details: string[] = [];
  for (const ownerId of ownerIds) {
    let guard = 0;
    while (guard++ < 200) {
      const overfull = containersForOwner(next, ownerId)
        .filter((container) => container.containerType !== "worn" && getContainerUsedUnits(next, container.id) > getContainerCapacityUnits(container, characters))
        .sort((left, right) => getContainerPathToRoot(next, right.id).length - getContainerPathToRoot(next, left.id).length)[0];
      if (!overfull) break;
      let overflow = getContainerUsedUnits(next, overfull.id) - getContainerCapacityUnits(overfull, characters);
      const candidates = heaviestFirst(next.stacks.filter((stack) => stackIsWithinContainer(next, stack, overfull.id)));
      if (!candidates.length) {
        const child = next.containers
          .filter((container) => container.holderType === "container" && container.holderId === overfull.id && container.movable)
          .sort((left, right) => getContainerEffectiveLoadUnits(next, right.id) - getContainerEffectiveLoadUnits(next, left.id))[0];
        if (!child) break;
        const result = moveContainer(next, child.id, { type: "ground" }, characters);
        if (!result.moved) break;
        next = result.state;
        groundedItems += 1;
        details.push(`${child.name} → Ground`);
        continue;
      }
      const source = candidates[0];
      let quantityNeeded = Math.min(source.quantity, Math.max(1, Math.ceil(overflow / source.unitEncumbranceUnits)));
      const alternateContainers = containersForOwner(next, ownerId)
        .filter((container) => !getContainerPathToRoot(next, container.id).some((entry) => entry.id === overfull.id))
        .filter((container) => maxStackQuantityForContainer(next, source, container.id, characters) > 0)
        .sort((left, right) => getContainerRemainingUnits(next, left.id, characters) - getContainerRemainingUnits(next, right.id, characters));
      for (const destination of alternateContainers) {
        if (quantityNeeded <= 0 || !next.stacks.some((stack) => stack.id === source.id)) break;
        const result = moveStack(next, source.id, { type: "container", id: destination.id }, characters, quantityNeeded);
        if (!result.moved) continue;
        next = result.state;
        movedItems += result.moved;
        details.push(`${result.moved} × ${source.name} → ${destination.name}`);
        quantityNeeded -= result.moved;
        overflow = getContainerUsedUnits(next, overfull.id) - getContainerCapacityUnits(overfull, characters);
        if (overflow <= 0) break;
      }
      if (overflow > 0 && quantityNeeded > 0 && next.stacks.some((stack) => stack.id === source.id)) {
        const result = moveStack(next, source.id, { type: "ground" }, characters, quantityNeeded);
        if (!result.moved) break;
        next = result.state;
        groundedItems += result.moved;
        details.push(`${result.moved} × ${source.name} → Ground`);
      }
    }

    guard = 0;
    while (getOwnerRemainingUnits(next, ownerId, characters) === 0 && getOwnerUsedUnits(next, ownerId) > (next.owners.find((owner) => owner.id === ownerId) ? getOwnerCapacityUnits(next.owners.find((owner) => owner.id === ownerId)!, characters) : 0) && guard++ < 200) {
      const candidate = heaviestFirst(next.stacks.filter((stack) => rootOwnerIdForStack(next, stack) === ownerId && next.containers.find((container) => container.id === stack.containerId)?.containerType !== "worn"))[0];
      if (candidate) {
        const owner = next.owners.find((entry) => entry.id === ownerId)!;
        const overflow = getOwnerUsedUnits(next, ownerId) - getOwnerCapacityUnits(owner, characters);
        const quantity = Math.min(candidate.quantity, Math.max(1, Math.ceil(overflow / candidate.unitEncumbranceUnits)));
        const result = moveStack(next, candidate.id, { type: "ground" }, characters, quantity);
        if (!result.moved) break;
        next = result.state;
        groundedItems += result.moved;
        details.push(`${result.moved} × ${candidate.name} → Ground`);
        continue;
      }
      const rootContainer = next.containers
        .filter((container) => container.holderType === "owner" && container.holderId === ownerId && container.movable && container.containerType !== "worn")
        .sort((left, right) => getContainerEffectiveLoadUnits(next, right.id) - getContainerEffectiveLoadUnits(next, left.id))[0];
      if (!rootContainer) break;
      const result = moveContainer(next, rootContainer.id, { type: "ground" }, characters);
      if (!result.moved) break;
      next = result.state;
      groundedItems += 1;
      details.push(`${rootContainer.name} → Ground`);
    }
  }
  return { state: next, groundedItems, movedItems, details, reason: groundedItems ? `${movedItems} item${movedItems === 1 ? "" : "s"} repacked; ${groundedItems} moved to Ground to clear overflow.` : movedItems ? `${movedItems} item${movedItems === 1 ? "" : "s"} repacked.` : "All selected inventories are within capacity." };
}

export function activeCharacterOwnerIds(state: InventoryManagementState, campaign: Pick<CampaignState, "characters" | "missionCharacterIds" | "activeCharacterCampaignId" | "dashboard">) {
  const missionIds = new Set(campaign.missionCharacterIds);
  const orderedCharacterIds = [...campaign.dashboard.marchingOrderSlots, ...campaign.dashboard.marchingOrderIds, ...campaign.missionCharacterIds]
    .filter((value): value is string => Boolean(value && missionIds.has(value)))
    .filter((value, index, values) => values.indexOf(value) === index);
  const characterOwnerIds = orderedCharacterIds
    .filter((characterId) => campaign.characters.some((character) => character.id === characterId && character.campaignId === campaign.activeCharacterCampaignId))
    .map((characterId) => state.owners.find((owner) => owner.characterId === characterId)?.id)
    .filter((value): value is string => Boolean(value));
  const marchingCarrierOwnerIds = [...campaign.dashboard.marchingOrderSlots, ...campaign.dashboard.marchingOrderIds]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((ownerId) => state.owners.some((owner) => owner.id === ownerId && owner.campaignId === campaign.activeCharacterCampaignId));
  return Array.from(new Set([...characterOwnerIds, ...marchingCarrierOwnerIds]));
}

export function visibleInventoryOwners(state: InventoryManagementState, campaign: Pick<CampaignState, "characters" | "missionCharacterIds" | "activeCharacterCampaignId">) {
  const missionIds = new Set(campaign.missionCharacterIds);
  return state.owners.filter((owner) => owner.campaignId === campaign.activeCharacterCampaignId && (owner.type !== "character" || Boolean(owner.characterId && missionIds.has(owner.characterId))));
}
