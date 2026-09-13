import { siteCatalog } from "./catalog-data.ts";
import { equipmentDefaultForName } from "./equipment-defaults.ts";
import { AMMO_CAPACITY, inventoryId, normalizeAmmoStacks, normalizeInventoryManagement, UNITS_PER_POCKET } from "./inventory-management.ts";
import { rollStartingMoneyGp } from "./osric-character-creation.ts";
import { weaponRulesById } from "./weapon-rules.ts";
import type { Character, InventoryManagementState, InventoryStack } from "./types.ts";
import { secureRandomFloat } from "./random.ts";

const LOW_STRENGTH_THRESHOLD = 5;

function catalogItem(name: string) {
  return siteCatalog.find((item) => item.name === name);
}

/** Adds a new character's first supplies to their intrinsic named backpack. */
export function addStarterKit(
  rawInventory: InventoryManagementState,
  characters: Character[],
  character: Character,
  random = secureRandomFloat,
) {
  const inventory = normalizeInventoryManagement(rawInventory, characters, character.campaignId);
  const backpack = inventory.containers.find((container) => container.containerType === "character-backpack" && container.originCharacterId === character.id);
  if (!backpack) return inventory;

  const lowStrength = Number(character.stats[0]) <= LOW_STRENGTH_THRESHOLD;
  const supplies = [
    { name: "Torch", quantity: lowStrength ? 4 : 8 },
    { name: "Standard rations (1 day)", quantity: lowStrength ? 2 : 4 },
    { name: "Waterskin", quantity: 1 },
    { name: "Dagger", quantity: 1 },
    ...(lowStrength ? [] : [{ name: random() < 0.5 ? "Hemp rope (50 ft.)" : "Collapsing pole (10 ft.)", quantity: 1 }]),
  ];

  const stacks: InventoryStack[] = supplies.flatMap(({ name, quantity }) => {
    const item = catalogItem(name);
    if (!item) return [];
    const equipment = equipmentDefaultForName(item.name)?.equipment;
    return [{
      id: inventoryId("starter"),
      campaignId: character.campaignId,
      catalogItemId: item.id,
      customIdentity: null,
      name: item.name,
      quantity,
      unitEncumbranceUnits: item.encumbranceUnits,
      encumbranceClass: item.encumbranceClass,
      itemKind: "normal",
      gpValue: item.priceGp,
      containerId: backpack.id,
      locationId: null,
      placement: null,
      handSlot: null,
      lastHolder: null,
      notes: "Starter kit",
      equipment: equipment ? { ...equipment } : null,
      trainingByCharacter: {},
    }];
  });

  return { ...inventory, stacks: [...inventory.stacks, ...stacks] };
}

function stackFromCatalog(item: NonNullable<ReturnType<typeof catalogItem>>, character: Character, containerId: string, notes: string): InventoryStack {
  const equipment = equipmentDefaultForName(item.name)?.equipment;
  return {
    id: inventoryId("starting"), campaignId: character.campaignId, catalogItemId: item.id, customIdentity: null,
    name: item.name, quantity: 1, unitEncumbranceUnits: item.encumbranceUnits, encumbranceClass: item.encumbranceClass,
    itemKind: "normal", gpValue: item.priceGp, containerId, locationId: null, placement: null, handSlot: null,
    lastHolder: null, notes, equipment: equipment ? { ...equipment, weaponRulesId: item.weaponRulesId ?? equipment.weaponRulesId } : null,
    trainingByCharacter: {},
  };
}

function ammoStack(character: Character, containerId: string, sourceName: string): InventoryStack {
  return {
    id: inventoryId("ammo"), campaignId: character.campaignId, catalogItemId: "catalog-ammo", customIdentity: null,
    name: "Ammo", quantity: 1, unitEncumbranceUnits: UNITS_PER_POCKET, encumbranceClass: "pocket", itemKind: "normal", gpValue: 1,
    containerId, locationId: null, placement: null, handSlot: null, lastHolder: sourceName, notes: `Initial Ammo from ${sourceName}`,
    equipment: null, trainingByCharacter: {}, shotsRemaining: AMMO_CAPACITY,
  };
}

/** Idempotent, persisted character-generation grants backed only by physical inventory items. */
export function addCharacterGenerationGrants(
  rawInventory: InventoryManagementState,
  characters: Character[],
  rawCharacter: Character,
  random = secureRandomFloat,
) {
  let character = { ...rawCharacter };
  let inventory = normalizeInventoryManagement(rawInventory, characters, character.campaignId);
  const backpack = inventory.containers.find((container) => container.containerType === "character-backpack" && container.originCharacterId === character.id);
  const quick = inventory.containers.find((container) => container.containerType === "quick-access" && container.originCharacterId === character.id);
  if (!backpack || !quick || character.className === "Unassigned" || character.statAssignmentComplete === false) return { character, inventory };

  if (!character.startingInventoryGranted) {
    const startingGp = rollStartingMoneyGp(character.className, random);
    if (startingGp > 0) inventory.stacks.push({
      id: inventoryId("starting-gp"), campaignId: character.campaignId, catalogItemId: null, customIdentity: `currency:gp:${inventoryId("starting")}`,
      name: "Gold Coins", quantity: startingGp, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1,
      containerId: backpack.id, locationId: null, placement: null, handSlot: null, lastHolder: null, notes: "OSRIC starting money", equipment: null, trainingByCharacter: {},
    });
    const spellbookCaster = character.className.split("/").some((entry) => ["Magic-User", "Illusionist"].includes(entry.trim()));
    if (spellbookCaster) {
      const book = catalogItem("Spell Book");
      if (book) inventory.stacks.push(stackFromCatalog(book, character, quick.id, "Starting spellbook"));
    }
    character.startingInventoryGranted = true;
  }

  if (character.weaponTrainingLocked && !character.startingWeaponsGranted) {
    const selectedIds = new Set((character.weaponTraining ?? []).filter((entry) => entry.proficient || entry.specialized).map((entry) => weaponRulesById(entry.weaponRulesId)?.id ?? entry.weaponRulesId));
    for (const weaponRulesId of selectedIds) {
      const rules = weaponRulesById(weaponRulesId);
      if (!rules) continue;
      let weaponStack = inventory.stacks.find((stack) => stack.containerId === backpack.id && stack.equipment?.kind === "weapon" && (weaponRulesById(stack.equipment.weaponRulesId)?.id ?? stack.equipment.weaponRulesId) === rules.id);
      if (!weaponStack) {
        const item = siteCatalog.find((entry) => entry.weaponRulesId === rules.id);
        if (!item) continue;
        weaponStack = stackFromCatalog(item, character, backpack.id, "Starting proficient weapon");
        inventory.stacks.push(weaponStack);
      }
      if (rules.missileMode === "projectile" && !weaponStack.initialAmmoGranted) {
        weaponStack.initialAmmoGranted = true;
        inventory.stacks.push(ammoStack(character, backpack.id, weaponStack.name));
      }
    }
    character.startingWeaponsGranted = true;
  }
  return { character, inventory: normalizeAmmoStacks(inventory) };
}
