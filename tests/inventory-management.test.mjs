import assert from "node:assert/strict";
import test from "node:test";

import { siteCatalog } from "../app/catalog-data.ts";
import { equipmentDefaultForName, equipmentDisplayName } from "../app/equipment-defaults.ts";
import { addStarterKit } from "../app/starter-kit.ts";
import {
  UNITS_PER_POCKET,
  UNITS_PER_STONE,
  activeCharacterOwnerIds,
  autoAssign,
  capacityUnitsFromOSRICPounds,
  combineInventoryStacks,
  completeInventoryPurchase,
  containerIsHidden,
  discardInventoryContainer,
  discardInventoryOwner,
  discardInventoryStack,
  dumpContainerContentsToGround,
  formatStoneUnits,
  getBackpackCapacityUnits,
  getContainerUsedUnits,
  getOwnerUsedUnits,
  getQuickAccessCapacityUnits,
  handLoadoutIssue,
  moveContainer,
  moveStack,
  moveStackToGround,
  moveStackToHand,
  moveStackToWorn,
  placeStackInNonQuickInventory,
  carrierBagsForOwner,
  normalizeInventoryManagement,
  initiateInventorySale,
  restoreInventoryDiscard,
  spreadEvenly,
  spendInventoryCoinsSmallestFirst,
  stackRequiresBothHands,
  smartStack,
  syncPhysicalEquipment,
  throwOneStackToGround,
  setContainerHidden,
  setLocationHidden,
  sortAndRebalanceInventory,
  stoneToUnits,
  visibleInventoryOwners,
} from "../app/inventory-management.ts";

const layout = { layoutPositions: {} };

test("new characters receive a strength-sensitive starter kit in their backpack", () => {
  const regular = { id: "starter", campaignId: "default", name: "Starter", stats: ["10", "10", "10", "10", "10", "10"] };
  const normal = addStarterKit({ owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] }, [regular], regular, () => 0.1);
  const backpack = normal.containers.find((entry) => entry.containerType === "character-backpack" && entry.originCharacterId === regular.id);
  assert.ok(backpack);
  assert.deepEqual(normal.stacks.map((entry) => [entry.name, entry.quantity, entry.containerId === backpack?.id]), [
    ["Torch", 8, true], ["Standard rations (1 day)", 4, true], ["Waterskin", 1, true], ["Dagger", 1, true], ["Hemp rope (50 ft.)", 1, true],
  ]);
  assert.equal(normal.stacks.find((entry) => entry.name === "Dagger")?.equipment?.kind, "weapon");

  const low = { ...regular, id: "low", name: "Low", stats: ["5", "10", "10", "10", "10", "10"] };
  const reduced = addStarterKit({ owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] }, [low], low, () => 0.9);
  assert.deepEqual(reduced.stacks.map((entry) => [entry.name, entry.quantity]), [
    ["Torch", 4], ["Standard rations (1 day)", 2], ["Waterskin", 1], ["Dagger", 1],
  ]);
});

test("added carrier bags match carrying capacity and remain movable ordinary containers", () => {
  const npc = { id: "hireling", campaignId: "default", name: "Brom", type: "npc", capacityUnits: 2400 };
  const bags = carrierBagsForOwner(npc);
  assert.deepEqual({ name: bags.name, capacityUnits: bags.capacityUnits, holderType: bags.holderType, holderId: bags.holderId, containerType: bags.containerType, intrinsic: bags.intrinsic, movable: bags.movable }, {
    name: "Brom's Bags", capacityUnits: 2400, holderType: "owner", holderId: "hireling", containerType: "container", intrinsic: false, movable: true,
  });
  const animal = carrierBagsForOwner({ id: "mule", campaignId: "default", name: "Mule", type: "animal", capacityUnits: 8000 });
  const vehicle = carrierBagsForOwner({ id: "cart", campaignId: "default", name: "Cart", type: "vehicle", capacityUnits: 16000 });
  assert.deepEqual([animal.name, animal.capacityUnits, vehicle.name, vehicle.capacityUnits], ["Mule's Bags", 8000, "Cart's Bags", 16000]);
});

test("character backpacks enforce their own container capacity", () => {
  const character = { id: "pack", campaignId: "default", name: "Pack", stats: ["10", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement({ owners: [], locations: [], containers: [], stacks: [], layoutPositions: {}, activityLog: [], sellVisible: true, shoppingCart: [], discarded: [] }, [character]);
  const backpack = state.containers.find((entry) => entry.containerType === "character-backpack" && entry.originCharacterId === character.id);
  assert.ok(backpack);
  state.stacks.push(
    { id: "inside", campaignId: "default", catalogItemId: null, customIdentity: "inside", name: "Packed item", quantity: 26, unitEncumbranceUnits: 200, encumbranceClass: "sack", itemKind: "normal", gpValue: null, containerId: backpack.id, locationId: null, placement: null, handSlot: null, lastHolder: null, notes: "", equipment: null, trainingByCharacter: {} },
    { id: "outside", campaignId: "default", catalogItemId: null, customIdentity: "outside", name: "Too large", quantity: 1, unitEncumbranceUnits: 800, encumbranceClass: "bulky", itemKind: "normal", gpValue: null, containerId: null, locationId: null, placement: "ground", handSlot: null, lastHolder: null, notes: "", equipment: null, trainingByCharacter: {} },
  );
  const result = moveStack(state, "outside", { type: "container", id: backpack.id }, [character]);
  assert.equal(result.moved, 0);
  assert.match(result.reason, /capacity/i);
});

test("complete item moves preserve their stable record id for realtime reconciliation", () => {
  const character = { id: "hero", campaignId: "default", name: "Hero", stats: ["10", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement({ owners: [], locations: [], containers: [], stacks: [], ...layout }, [character]);
  const backpack = state.containers.find((entry) => entry.containerType === "character-backpack" && entry.originCharacterId === character.id);
  assert.ok(backpack);
  state.stacks.push({ id: "stable-rope", campaignId: "default", name: "Rope", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "ground", containerId: null, locationId: null });
  const result = moveStack(state, "stable-rope", { type: "container", id: backpack.id }, [character], undefined, true);
  assert.equal(result.moved, 1);
  assert.equal(result.state.stacks.find((stack) => stack.id === "stable-rope")?.containerId, backpack.id);
  assert.equal(result.state.stacks.length, state.stacks.length);
});

test("stone arithmetic stays exact in integer units", () => {
  assert.equal(UNITS_PER_STONE, 400);
  assert.equal(UNITS_PER_POCKET, 100);
  assert.equal(stoneToUnits(0.25), 100);
  assert.equal(stoneToUnits(0.5), 200);
  assert.equal(stoneToUnits(0.75), 300);
  assert.equal(stoneToUnits(1), 400);
  assert.equal(formatStoneUnits(900), "2¼ st");
});

test("throwing a weapon moves exactly one item from a held stack to Ground", () => {
  const state = {
    owners: [{ id: "owner", campaignId: "default", name: "Hero", type: "character", capacityUnits: 4000, characterId: "hero" }],
    locations: [],
    containers: [{ id: "quick", campaignId: "default", name: "Quick Access", capacityUnits: 4000, tareWeightUnits: 0, holderType: "owner", holderId: "owner", containerType: "quick-access", intrinsic: true, movable: false }],
    stacks: [{ id: "spears", campaignId: "default", name: "Spear", quantity: 3, unitEncumbranceUnits: 200, encumbranceClass: "sack", itemKind: "normal", containerId: "quick", locationId: null, placement: null, handSlot: "main", equipment: { kind: "weapon", weaponType: "melee", weaponRulesId: "spear", damage: "1d6" } }],
    ...layout,
  };
  const result = throwOneStackToGround(state, "spears");
  assert.equal(result.moved, 1);
  assert.equal(result.state.stacks.find((stack) => stack.id === "spears")?.quantity, 2);
  const grounded = result.state.stacks.find((stack) => stack.placement === "ground");
  assert.equal(grounded?.quantity, 1);
  assert.equal(grounded?.handSlot, null);
  assert.match(grounded?.lastHolder ?? "", /Hero/);
});

test("OSRIC pounds receive the ten percent abstraction bonus and player-favoring full-stone rounding", () => {
  assert.equal(capacityUnitsFromOSRICPounds(140), 4400);
  const hypothetical = { stats: ["18", "10", "10", "10", "10", "10"] };
  assert.equal(getBackpackCapacityUnits(hypothetical) + getQuickAccessCapacityUnits(hypothetical), 7200);
  assert.equal(getQuickAccessCapacityUnits(hypothetical), 1800);
  assert.equal(getBackpackCapacityUnits(hypothetical), 5400);
});

test("the supplied equipment list provides authoritative weights and container capacities", () => {
  const dagger = siteCatalog.find((item) => item.name === "Dagger");
  const torch = siteCatalog.find((item) => item.name === "Torch");
  const sword = siteCatalog.find((item) => item.name === "Long sword");
  const armor = siteCatalog.find((item) => item.name === "Plate armor");
  const sack = siteCatalog.find((item) => item.name === "Small sack");
  assert.equal(dagger?.encumbranceUnits, 100);
  assert.equal(torch?.encumbranceUnits, 100);
  assert.equal(sword?.encumbranceUnits, 400);
  assert.ok((armor?.encumbranceUnits ?? 0) >= 800);
  assert.equal(sack?.containerCapacityUnits, 400);
  assert.equal(siteCatalog.every((item) => Number.isFinite(item.encumbranceUnits)), true);
});

test("armor and shield display names include their effective AC values", () => {
  assert.equal(equipmentDisplayName("Leather armor"), "Leather armor (AC12)");
  assert.equal(equipmentDisplayName("Banded mail"), "Banded mail (AC16)");
  assert.equal(equipmentDisplayName("Large shield"), "Large shield (AC+1)");
  assert.equal(equipmentDisplayName("Rope"), "Rope");
});

test("character normalization creates one intrinsic Quick Access and one movable named backpack", () => {
  const character = { id: "h", campaignId: "default", name: "Hrothgar", stats: ["18", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement(null, [character], "default");
  const quick = state.containers.filter((container) => container.originCharacterId === "h" && container.containerType === "quick-access");
  const packs = state.containers.filter((container) => container.originCharacterId === "h" && container.containerType === "character-backpack");
  assert.equal(quick.length, 1);
  assert.equal(quick[0].movable, false);
  assert.equal(quick[0].name, "Hrothgar quick access");
  assert.equal(state.containers.filter((container) => container.originCharacterId === "h" && container.containerType === "worn").length, 1);
  assert.equal(packs.length, 1);
  assert.equal(packs[0].name, "Hrothgar's Backpack");
  assert.equal(packs[0].movable, true);
});

test("sheet purchases use non-Quick Access storage and leave overflow on Ground", () => {
  const character = { id: "buyer", campaignId: "default", name: "Buyer", stats: ["10", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === character.id);
  state.stacks.push({ id: "purchase", campaignId: "default", name: "Iron spikes", quantity: 999, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", placement: "ground", containerId: null, locationId: null });
  const result = placeStackInNonQuickInventory(state, "purchase", owner.id, [character]);
  assert.ok(result.assigned > 0);
  assert.ok(result.remaining > 0);
  assert.equal(result.state.stacks.some((stack) => stack.name === "Iron spikes" && stack.containerId === state.containers.find((container) => container.containerType === "quick-access")?.id), false);
  assert.equal(result.state.stacks.some((stack) => stack.name === "Iron spikes" && stack.placement === "ground"), true);
});

test("sheet payment spends carried coins from the smallest denomination first", () => {
  const character = { id: "buyer", campaignId: "default", name: "Buyer", stats: ["10", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === character.id);
  const backpack = state.containers.find((entry) => entry.containerType === "character-backpack" && entry.holderId === owner.id);
  state.stacks.push(
    { id: "cp", campaignId: "default", name: "Copper Coins", quantity: 1, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: .005, containerId: backpack.id },
    { id: "sp", campaignId: "default", name: "Silver Coins", quantity: 1, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: .05, containerId: backpack.id },
    { id: "gp", campaignId: "default", name: "Gold Coins", quantity: 1, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1, containerId: backpack.id },
  );
  const result = spendInventoryCoinsSmallestFirst(state, owner.id, .055, [character]);
  assert.equal(result.paid, true);
  assert.equal(result.changeGp, 0);
  assert.equal(result.state.stacks.some((stack) => stack.id === "cp" || stack.id === "sp"), false);
  assert.equal(result.state.stacks.find((stack) => stack.id === "gp")?.quantity, 1);
});

test("container capacity does not count as carrier load and a moved backpack keeps its contents", () => {
  const character = { id: "h", campaignId: "default", name: "Hrothgar", stats: ["18", "10", "10", "10", "10", "10"] };
  let state = normalizeInventoryManagement(null, [character], "default");
  state.owners.push({ id: "mule", campaignId: "default", name: "Mule", type: "animal", capacityUnits: 12000 });
  const pack = state.containers.find((container) => container.containerType === "character-backpack");
  state.stacks.push({ id: "sword", campaignId: "default", name: "Sword", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", containerId: pack.id, locationId: null });
  assert.equal(getContainerUsedUnits(state, pack.id), 400);
  assert.equal(getOwnerUsedUnits(state, pack.holderId), 400);
  const result = moveContainer(state, pack.id, { type: "owner", id: "mule" }, [character]);
  assert.equal(result.moved, true);
  assert.equal(result.state.containers.find((container) => container.id === pack.id)?.name, "Hrothgar's Backpack");
  assert.equal(result.state.stacks.find((stack) => stack.id === "sword")?.containerId, pack.id);
  assert.equal(getOwnerUsedUnits(result.state, "mule"), 400);
});

function assignmentState(itemName, quantity, unit = 100) {
  return {
    owners: ["a", "b", "c"].map((id) => ({ id, campaignId: "default", name: id.toUpperCase(), type: "other", capacityUnits: 4000 })),
    locations: [],
    containers: ["a", "b", "c"].map((id) => ({ id: `${id}-bag`, campaignId: "default", name: `${id} bag`, capacityUnits: 4000, tareWeightUnits: 0, holderType: "owner", holderId: id, containerType: "container", intrinsic: false, movable: true })),
    stacks: [{ id: "incoming", campaignId: "default", name: itemName, quantity, unitEncumbranceUnits: unit, encumbranceClass: "pocket", itemKind: "normal", containerId: null, locationId: null }],
    ...layout,
  };
}

test("smart assignment prefers the character who already has the identical item", () => {
  const state = assignmentState("Torch", 4);
  state.stacks.push({ ...state.stacks[0], id: "existing", quantity: 3, containerId: "a-bag" });
  const result = autoAssign(state, "incoming", ["a", "b"], []);
  assert.equal(result.remaining, 0);
  assert.equal(result.state.stacks.find((stack) => stack.containerId === "a-bag")?.quantity, 7);
});

test("spread evenly uses whole quantities and redistributes overflow", () => {
  const state = assignmentState("Potion", 10);
  const result = spreadEvenly(state, "incoming", ["a", "b", "c"], []);
  assert.equal(result.remaining, 0);
  assert.deepEqual(["a", "b", "c"].map((id) => result.state.stacks.find((stack) => stack.containerId === `${id}-bag`)?.quantity), [4, 3, 3]);
});

test("capacity overflow remains Incoming without destroying quantity", () => {
  const state = assignmentState("Potion", 9);
  state.owners = state.owners.slice(0, 1).map((owner) => ({ ...owner, capacityUnits: 500 }));
  state.containers = state.containers.slice(0, 1).map((container) => ({ ...container, capacityUnits: 500 }));
  const result = autoAssign(state, "incoming", ["a"], []);
  assert.equal(result.assigned, 5);
  assert.equal(result.remaining, 4);
  assert.equal(result.state.stacks.reduce((sum, stack) => sum + stack.quantity, 0), 9);
});

test("nested containers respect every outer capacity and never double-count carrier load", () => {
  const state = {
    owners: [{ id: "hero", campaignId: "default", name: "Hero", type: "other", capacityUnits: 800 }],
    locations: [],
    containers: [
      { id: "pack", campaignId: "default", name: "Pack", capacityUnits: 100, tareWeightUnits: 0, holderType: "owner", holderId: "hero", containerType: "container", intrinsic: false, movable: true },
      { id: "pouch", campaignId: "default", name: "Pouch", capacityUnits: 100, tareWeightUnits: 0, holderType: "container", holderId: "pack", containerType: "container", intrinsic: false, movable: true },
    ],
    stacks: [
      { id: "coins", campaignId: "default", name: "gp", quantity: 100, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", containerId: "pouch", locationId: null },
      { id: "extra", campaignId: "default", name: "Gem", quantity: 1, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", placement: "incoming", containerId: null, locationId: null },
    ],
    ...layout,
  };
  assert.equal(getContainerUsedUnits(state, "pouch"), 100);
  assert.equal(getContainerUsedUnits(state, "pack"), 100);
  assert.equal(getOwnerUsedUnits(state, "hero"), 100);
  assert.equal(moveStack(state, "extra", { type: "container", id: "pouch" }, []).moved, 0);
  const cycle = moveContainer(state, "pack", { type: "container", id: "pouch" }, []);
  assert.equal(cycle.moved, false);
});

test("normalization breaks legacy container loops before rendering inventory", () => {
  const state = normalizeInventoryManagement({
    owners: [], locations: [], stacks: [], ...layout,
    containers: [
      { id: "a", campaignId: "default", name: "A", capacityUnits: 400, tareWeightUnits: 0, holderType: "container", holderId: "b", containerType: "container", intrinsic: false, movable: true },
      { id: "b", campaignId: "default", name: "B", capacityUnits: 400, tareWeightUnits: 0, holderType: "container", holderId: "a", containerType: "container", intrinsic: false, movable: true },
    ],
  }, [], "default");
  assert.equal(state.containers.some((container) => container.holderType === "ground"), true);
  assert.equal(state.containers.every((container) => container.holderType !== "container" || container.holderId !== container.id), true);
});

test("smart stack fills the nearly-full matching nested pouch first", () => {
  const state = {
    owners: [{ id: "hero", campaignId: "default", name: "Hero", type: "other", capacityUnits: 1000 }],
    locations: [],
    containers: [
      { id: "pack", campaignId: "default", name: "Pack", capacityUnits: 400, tareWeightUnits: 0, holderType: "owner", holderId: "hero", containerType: "container", intrinsic: false, movable: true },
      { id: "pouch", campaignId: "default", name: "Coin pouch", capacityUnits: 100, tareWeightUnits: 0, holderType: "container", holderId: "pack", containerType: "container", intrinsic: false, movable: true },
    ],
    stacks: [
      { id: "five", campaignId: "default", name: "gp", quantity: 5, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", containerId: "pouch", locationId: null },
      { id: "incoming", campaignId: "default", name: "gp", quantity: 95, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", placement: "incoming", containerId: null, locationId: null },
    ],
    ...layout,
  };
  const result = smartStack(state, "incoming", ["hero"], []);
  assert.equal(result.remaining, 0);
  assert.equal(result.state.stacks.find((stack) => stack.containerId === "pouch")?.quantity, 100);
  assert.equal(getOwnerUsedUnits(result.state, "hero"), 100);
});

test("dropping and dumping preserve Ground placement and last holder", () => {
  const state = assignmentState("Torch", 2);
  state.stacks[0].containerId = "a-bag";
  const dropped = moveStackToGround(state, "incoming");
  assert.equal(dropped.moved, 2);
  const ground = dropped.state.stacks.find((stack) => stack.placement === "ground");
  assert.match(ground.lastHolder, /A · a bag/);

  dropped.state.containers.push({ id: "pouch", campaignId: "default", name: "Pouch", capacityUnits: 100, tareWeightUnits: 0, holderType: "container", holderId: "a-bag", containerType: "container", intrinsic: false, movable: true });
  const dumped = dumpContainerContentsToGround(dropped.state, "a-bag");
  assert.equal(dumped.state.containers.find((container) => container.id === "pouch")?.holderType, "ground");
});

test("Worn accepts one item at a time and its tally is free from carrier load", () => {
  const character = { id: "h", campaignId: "default", name: "Hrothgar", stats: ["18", "10", "10", "10", "10", "10"] };
  const state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === "h");
  state.stacks.push({ id: "armor", campaignId: "default", name: "Plate armor", quantity: 2, unitEncumbranceUnits: 1600, encumbranceClass: "bulky", itemKind: "normal", placement: "incoming", containerId: null, locationId: null });
  const result = moveStackToWorn(state, "armor", owner.id);
  const worn = result.state.containers.find((container) => container.containerType === "worn");
  assert.equal(result.moved, true);
  assert.equal(result.state.stacks.find((stack) => stack.containerId === worn.id)?.quantity, 1);
  assert.equal(result.state.stacks.find((stack) => stack.id === "armor")?.quantity, 1);
  assert.equal(getContainerUsedUnits(result.state, worn.id), 1600);
  assert.equal(getOwnerUsedUnits(result.state, owner.id), 0);
});

test("shields must be equipped in a hand and never grant AC from Worn", () => {
  const character = { id: "shield-bearer", campaignId: "default", name: "Shield Bearer", stats: ["10", "10", "10", "10", "10", "10"], weapons: [], armorClass: 10, baseArmorClass: 10, weaponProficiencies: "", weaponSpecializations: "" };
  const state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === character.id);
  const worn = state.containers.find((entry) => entry.containerType === "worn" && entry.holderId === owner.id);
  state.stacks.push({ id: "shield", campaignId: "default", name: "Large shield", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", containerId: worn.id, handSlot: null, equipment: { kind: "shield", shieldBonus: 1 } });
  assert.equal(moveStackToWorn(state, "shield", owner.id).moved, false);
  const synced = syncPhysicalEquipment({ characters: [character], inventoryManagement: state, segmentedInitiative: { participants: [] } });
  assert.equal(synced.characters[0].armorClass, 10);
});

test("a GM armor class override persists across physical equipment synchronization", () => {
  const character = { id: "override", campaignId: "default", name: "Override", stats: ["10", "10", "10", "10", "10", "10"], weapons: [], armorClass: 19, baseArmorClass: 10, armorClassOverride: 19, weaponProficiencies: "", weaponSpecializations: "" };
  const state = normalizeInventoryManagement(null, [character], "default");
  const synced = syncPhysicalEquipment({ characters: [character], inventoryManagement: state, segmentedInitiative: { participants: [] } });
  assert.equal(synced.characters[0].armorClass, 19);
  assert.equal(synced.characters[0].armorClassOverride, 19);
});

test("two-handed and over-two-stone items reserve both hands and reject occupied moves", () => {
  const character = { id: "h", campaignId: "default", name: "Hero", stats: ["18", "10", "10", "10", "10", "10"] };
  let state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === "h");
  state.stacks.push(
    { id: "torch", campaignId: "default", name: "Torch", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "ground" },
    { id: "greatsword", campaignId: "default", name: "Greatsword", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", placement: "ground", equipment: { kind: "weapon", twoHanded: true } },
    { id: "statue", campaignId: "default", name: "Stone statue", quantity: 1, unitEncumbranceUnits: 801, encumbranceClass: "bulky", itemKind: "treasure", placement: "ground" },
  );
  state = moveStackToHand(state, "torch", owner.id, "offhand", [character]).state;
  const blocked = moveStackToHand(state, "greatsword", owner.id, "main", [character]);
  assert.equal(blocked.moved, false);
  state = moveStackToGround(state, state.stacks.find((stack) => stack.name === "Torch").id).state;
  state = moveStackToHand(state, "greatsword", owner.id, "main", [character]).state;
  assert.equal(moveStackToHand(state, "torch", owner.id, "offhand", [character]).moved, false);
  assert.equal(stackRequiresBothHands(state.stacks.find((stack) => stack.name === "Greatsword")), true);
  assert.equal(stackRequiresBothHands(state.stacks.find((stack) => stack.name === "Stone statue")), true);
});

test("strength-qualified weapons share a hand with a shield and recalculate immediately", () => {
  const character = { id: "strong", campaignId: "default", name: "Strong", stats: ["15", "10", "10", "10", "10", "10"], weapons: [], equippedWeaponId: "unarmed", handState: "unarmed", armorClass: 10, baseArmorClass: 10, weaponProficiencies: "Bastard sword", weaponSpecializations: "Bastard sword" };
  let state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === character.id);
  const bastard = equipmentDefaultForName("Bastard sword")?.equipment;
  state.stacks.push(
    { id: "bastard", campaignId: "default", name: "Bastard Sword +2", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", placement: "ground", equipment: { ...bastard, weaponRulesId: "bastard-sword", attackBonus: 2 } },
    { id: "shield", campaignId: "default", name: "Shield", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "ground", equipment: { kind: "shield", shieldBonus: 1 } },
  );
  state = moveStackToHand(state, "bastard", owner.id, "main", [character]).state;
  const shieldMove = moveStackToHand(state, "shield", owner.id, "offhand", [character]);
  assert.equal(shieldMove.moved, true);
  state = shieldMove.state;

  const legal = syncPhysicalEquipment({ characters: [character], inventoryManagement: state, segmentedInitiative: { participants: [{ id: "p", characterId: character.id, equippedWeaponId: "unarmed" }] } });
  assert.equal(legal.characters[0].handState, "one-hand-shield");
  assert.equal(legal.characters[0].equippedWeaponId, "inventory:bastard");
  assert.equal(legal.characters[0].armorClass, 11);
  assert.equal(legal.characters[0].weapons.find((weapon) => weapon.id === "inventory:bastard")?.specialized, true);

  const weakened = { ...legal.characters[0], stats: ["14", "10", "10", "10", "10", "10"] };
  const invalid = syncPhysicalEquipment({ ...legal, characters: [weakened] });
  const main = invalid.inventoryManagement.stacks.find((stack) => stack.handSlot === "main");
  const offhand = invalid.inventoryManagement.stacks.find((stack) => stack.handSlot === "offhand");
  assert.match(handLoadoutIssue(main, offhand, weakened), /requires both hands/i);
  assert.deepEqual([main?.id, offhand?.id], ["bastard", "shield"]);
  assert.equal(invalid.characters[0].equippedWeaponId, "unarmed");
  assert.equal(invalid.characters[0].handState, "unarmed");
  assert.equal(invalid.characters[0].armorClass, 10);
  assert.equal(invalid.segmentedInitiative.participants[0].equippedWeaponId, "unarmed");
});

test("battle axe and morning star shield moves respect the exact STR threshold", () => {
  for (const [name, id, below, threshold] of [["Battle axe", "battle-axe", 14, 15], ["Morning star", "morning-star", 15, 16]]) {
    for (const [score, allowed] of [[below, false], [threshold, true]]) {
      const character = { id: `${id}-${score}`, campaignId: "default", name, stats: [String(score), "10", "10", "10", "10", "10"] };
      let state = normalizeInventoryManagement(null, [character], "default");
      const owner = state.owners.find((entry) => entry.characterId === character.id);
      const equipment = equipmentDefaultForName(name)?.equipment;
      state.stacks.push(
        { id: `${id}-weapon`, campaignId: "default", name, quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", placement: "ground", equipment: { ...equipment, weaponRulesId: id } },
        { id: `${id}-shield`, campaignId: "default", name: "Shield", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "ground", equipment: { kind: "shield", shieldBonus: 1 } },
      );
      state = moveStackToHand(state, `${id}-weapon`, owner.id, "main", [character]).state;
      assert.equal(moveStackToHand(state, `${id}-shield`, owner.id, "offhand", [character]).moved, allowed, `${name} at STR ${score}`);
    }
  }
});

test("hand-held items count at half load rounded down to a quarter stone for carrier capacity", () => {
  const state = {
    owners: [{ id: "hero", campaignId: "default", name: "Hero", type: "other", capacityUnits: 2000 }],
    locations: [],
    containers: [{ id: "quick", campaignId: "default", name: "Quick Access", capacityUnits: 2000, tareWeightUnits: 0, holderType: "owner", holderId: "hero", containerType: "quick-access", intrinsic: true, movable: false }],
    stacks: [
      { id: "mace", campaignId: "default", name: "Mace", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", containerId: "quick", handSlot: "main" },
      { id: "lantern", campaignId: "default", name: "Lantern", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "quick", handSlot: "offhand" },
    ],
    ...layout,
  };
  assert.equal(getContainerUsedUnits(state, "quick"), 500);
  assert.equal(getOwnerUsedUnits(state, "hero"), 200);
});

test("physical hands select the combat weapon and update active combatants", () => {
  const character = { id: "hero", campaignId: "default", name: "Hero", stats: ["16", "10", "10", "10", "10", "10"], weapons: [{ id: "manual", name: "Old sword", attackBonus: 0, damage: "1d8", notes: "", category: "melee", specialized: false }], equippedWeaponId: "manual", handState: "one-hand-empty", armorClass: 10, baseArmorClass: 10, weaponProficiencies: "", weaponSpecializations: "" };
  const inventory = normalizeInventoryManagement(null, [character], "default");
  const owner = inventory.owners.find((entry) => entry.characterId === "hero");
  const quick = inventory.containers.find((entry) => entry.containerType === "quick-access" && entry.holderId === owner.id);
  inventory.stacks.push(
    { id: "sword", campaignId: "default", name: "Long sword", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", containerId: quick.id, handSlot: "main", equipment: { kind: "weapon", weaponType: "melee", damage: "1d8", attackBonus: 1 }, trainingByCharacter: { hero: { proficient: true, skilled: true } } },
    { id: "shield", campaignId: "default", name: "Shield", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: quick.id, handSlot: "offhand", equipment: { kind: "shield", shieldBonus: 1 } },
  );
  const campaign = { characters: [character], inventoryManagement: inventory, segmentedInitiative: { participants: [{ id: "combat-hero", characterId: "hero", equippedWeaponId: "manual" }] } };
  const synced = syncPhysicalEquipment(campaign);
  assert.equal(synced.characters[0].equippedWeaponId, "inventory:sword");
  assert.equal(synced.characters[0].handState, "one-hand-shield");
  assert.equal(synced.characters[0].weapons.find((weapon) => weapon.id === "inventory:sword")?.specialized, true);
  assert.equal(synced.segmentedInitiative.participants[0].equippedWeaponId, "inventory:sword");
});

test("load sorting ejects the heaviest item first when an overflow cannot be repacked", () => {
  const state = {
    owners: [{ id: "hero", campaignId: "default", name: "Hero", type: "other", capacityUnits: 500 }],
    locations: [],
    containers: [{ id: "pack", campaignId: "default", name: "Pack", capacityUnits: 500, tareWeightUnits: 0, holderType: "owner", holderId: "hero", containerType: "container", intrinsic: false, movable: true }],
    stacks: [
      { id: "armor", campaignId: "default", name: "Armor", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", containerId: "pack", locationId: null },
      { id: "torches", campaignId: "default", name: "Torch", quantity: 2, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "pack", locationId: null },
    ],
    ...layout,
  };
  const result = sortAndRebalanceInventory(state, ["hero"], []);
  assert.equal(result.state.stacks.find((stack) => stack.name === "Armor")?.placement, "ground");
  assert.equal(getContainerUsedUnits(result.state, "pack"), 200);
  assert.equal(result.groundedItems, 1);
});

test("only mission characters are visible while explicit non-character carriers remain available", () => {
  const state = {
    owners: [
      { id: "a-owner", campaignId: "default", name: "A", type: "character", capacityUnits: 100, characterId: "a" },
      { id: "b-owner", campaignId: "default", name: "B", type: "character", capacityUnits: 100, characterId: "b" },
      { id: "mule", campaignId: "default", name: "Mule", type: "animal", capacityUnits: 1000 },
    ],
    locations: [], containers: [], stacks: [], ...layout,
  };
  const campaign = { activeCharacterCampaignId: "default", missionCharacterIds: ["a"], characters: [{ id: "a", campaignId: "default" }, { id: "b", campaignId: "default" }] };
  assert.deepEqual(visibleInventoryOwners(state, campaign).map((owner) => owner.id), ["a-owner", "mule"]);
});

test("normalization consolidates legacy Incoming stacks into Ground", () => {
  const state = normalizeInventoryManagement({
    owners: [], locations: [], containers: [], layoutPositions: {}, activityLog: [],
    stacks: [{ id: "old", campaignId: "default", name: "Rope", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "incoming" }],
  }, [], "default");
  assert.equal(state.stacks[0].placement, "ground");
  assert.equal(state.sellVisible, true);
  assert.deepEqual(state.discarded, []);
});

test("Sell pays ordinary goods at ten percent, treasure at full value, and taxes coins five percent", () => {
  const state = normalizeInventoryManagement({
    owners: [], locations: [], containers: [], layoutPositions: {}, activityLog: [],
    stacks: [
      { id: "gear", campaignId: "default", name: "Sword", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", gpValue: 100, placement: "sell" },
      { id: "idol", campaignId: "default", name: "Golden Idol", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "treasure", gpValue: 10, placement: "sell" },
      { id: "coin", campaignId: "default", name: "gp", quantity: 100, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1, placement: "sell" },
    ],
  }, [], "default");
  const result = initiateInventorySale(state, "default");
  assert.deepEqual({ pp: result.pp, gp: result.gp, ep: result.ep, sp: result.sp, cp: result.cp }, { pp: 0, gp: 115, ep: 0, sp: 0, cp: 0 });
  assert.equal(result.state.stacks.every((stack) => stack.placement === "counter"), true);
  assert.deepEqual(result.state.stacks.map((stack) => stack.name), ["Gold Coins"]);
});

test("Payment preserves separate piles, blocks short purchases, and returns purchases with change", () => {
  let state = normalizeInventoryManagement({
    owners: [], locations: [], containers: [], layoutPositions: {}, activityLog: [],
    stacks: [
      { id: "gp-a", campaignId: "default", name: "gp", quantity: 4, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1, placement: "ground" },
      { id: "gp-b", campaignId: "default", name: "gp", quantity: 3, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1, placement: "ground" },
    ],
  }, [], "default");
  state = moveStack(state, "gp-a", { type: "payment" }, [], 4).state;
  state = moveStack(state, "gp-b", { type: "payment" }, [], 3).state;
  assert.equal(state.stacks.filter((stack) => stack.placement === "payment").length, 2);

  const purchase = { id: "rope", campaignId: "default", name: "Rope", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", gpValue: 2, placement: "counter" };
  const blocked = completeInventoryPurchase(state, "default", [purchase], 8);
  assert.equal(blocked.purchased, false);
  assert.equal(blocked.state.stacks.filter((stack) => stack.placement === "payment").length, 2);

  const bought = completeInventoryPurchase(state, "default", [purchase], 2.35);
  assert.equal(bought.purchased, true);
  assert.equal(bought.state.stacks.some((stack) => stack.name === "Rope" && stack.placement === "counter"), true);
  assert.deepEqual(bought.state.stacks.filter((stack) => stack.lastHolder === "Shopping change").map((stack) => [stack.name, stack.quantity]), [["Gold Coins", 4], ["Silver Coins", 13]]);
  assert.equal(bought.state.stacks.some((stack) => stack.placement === "payment"), false);
});

test("normalizing inventory retains Payment and Purchases & change piles", () => {
  const state = normalizeInventoryManagement({
    owners: [], locations: [], containers: [], layoutPositions: {}, activityLog: [],
    stacks: [
      { id: "payment", campaignId: "default", name: "gp", quantity: 5, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 1, placement: "payment" },
      { id: "change", campaignId: "default", name: "sp", quantity: 4, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", gpValue: 0.1, placement: "counter" },
    ],
  }, [], "default");
  assert.deepEqual(state.stacks.map((stack) => stack.placement), ["payment", "counter"]);
  assert.deepEqual(state.stacks.map((stack) => [stack.name, stack.gpValue]), [["Gold Coins", 1], ["Silver Coins", .05]]);
});

test("partial discards preserve the remainder and same-name piles can be combined in place", () => {
  let state = normalizeInventoryManagement({
    owners: [], locations: [], containers: [], layoutPositions: {}, activityLog: [],
    stacks: [{ id: "torch", campaignId: "default", name: "Torch", quantity: 8, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", placement: "ground" }],
  }, [], "default");
  const discarded = discardInventoryStack(state, "torch", 3);
  assert.equal(discarded.state.stacks.find((stack) => stack.id === "torch")?.quantity, 5);
  assert.equal(discarded.state.discarded[0].stacks[0].quantity, 3);
  state = restoreInventoryDiscard(discarded.state, discarded.state.discarded[0].id).state;
  assert.equal(state.stacks.filter((stack) => stack.name === "Torch").length, 2);
  const combined = combineInventoryStacks(state, "torch");
  assert.equal(combined.state.stacks.filter((stack) => stack.name === "Torch").length, 1);
  assert.equal(combined.state.stacks.find((stack) => stack.name === "Torch")?.quantity, 8);
});

test("active inventory character order follows marching slots before mission fallback", () => {
  const state = {
    owners: [
      { id: "a-owner", campaignId: "default", name: "A", type: "character", capacityUnits: 100, characterId: "a" },
      { id: "b-owner", campaignId: "default", name: "B", type: "character", capacityUnits: 100, characterId: "b" },
      { id: "c-owner", campaignId: "default", name: "C", type: "character", capacityUnits: 100, characterId: "c" },
    ],
    locations: [], containers: [], stacks: [], ...layout,
  };
  const campaign = {
    activeCharacterCampaignId: "default",
    missionCharacterIds: ["a", "b", "c"],
    characters: ["a", "b", "c"].map((characterId) => ({ id: characterId, campaignId: "default" })),
    dashboard: { marchingOrderSlots: ["c", null, "a"], marchingOrderIds: ["a", "b", "c"] },
  };
  assert.deepEqual(activeCharacterOwnerIds(state, campaign), ["c-owner", "a-owner", "b-owner"]);
});

test("physical inventory discard restores stacks, containers, and non-character carriers", () => {
  let state = normalizeInventoryManagement({
    owners: [{ id: "mule", campaignId: "default", name: "Mule", type: "animal", capacityUnits: 4000 }],
    locations: [], layoutPositions: {}, activityLog: [],
    containers: [{ id: "sack", campaignId: "default", name: "Sack", capacityUnits: 400, tareWeightUnits: 0, holderType: "owner", holderId: "mule", containerType: "container", intrinsic: false, movable: true }],
    stacks: [{ id: "rope", campaignId: "default", name: "Rope", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "sack" }],
  }, [], "default");
  const discardedOwner = discardInventoryOwner(state, "mule");
  assert.equal(discardedOwner.state.owners.length, 0);
  assert.equal(discardedOwner.state.stacks.length, 0);
  const restoredOwner = restoreInventoryDiscard(discardedOwner.state, discardedOwner.state.discarded[0].id);
  assert.equal(restoredOwner.state.owners[0].name, "Mule");
  assert.equal(restoredOwner.state.stacks[0].containerId, "sack");

  state = restoredOwner.state;
  const discardedStack = discardInventoryStack(state, "rope");
  assert.equal(discardedStack.state.stacks.length, 0);
  const restoredStack = restoreInventoryDiscard(discardedStack.state, discardedStack.state.discarded[0].id);
  assert.equal(restoredStack.state.stacks[0].containerId, "sack");

  const discardedContainer = discardInventoryContainer(restoredStack.state, "sack");
  assert.equal(discardedContainer.state.containers.length, 0);
  assert.equal(discardedContainer.state.discarded[0].label, "Sack");
});

test("hidden locations and containers retain their inventory tree", () => {
  const state = {
    owners: [],
    locations: [{ id: "bank", campaignId: "default", name: "Bank", infiniteCapacity: true }],
    containers: [{ id: "vault", campaignId: "default", name: "Vault box", capacityUnits: 400, tareWeightUnits: 0, holderType: "location", holderId: "bank", containerType: "container", intrinsic: false, movable: true }],
    stacks: [{ id: "gp", campaignId: "default", name: "gp", quantity: 100, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", containerId: "vault" }],
    ...layout,
  };
  const hiddenContainer = setContainerHidden(state, "vault", true);
  assert.equal(containerIsHidden(hiddenContainer, "vault"), true);
  assert.equal(hiddenContainer.stacks[0].containerId, "vault");
  const hiddenLocation = setLocationHidden(state, "bank", true);
  assert.equal(containerIsHidden(hiddenLocation, "vault"), true);
  assert.equal(hiddenLocation.stacks[0].quantity, 100);
});

test("an item can leave a hand by dropping it on its carrier", () => {
  const character = { id: "h", campaignId: "default", name: "Hero", stats: ["18", "10", "10", "10", "10", "10"] };
  let state = normalizeInventoryManagement(null, [character], "default");
  const owner = state.owners.find((entry) => entry.characterId === "h");
  const pack = state.containers.find((entry) => entry.containerType === "character-backpack");
  state.stacks.push({ id: "sword", campaignId: "default", name: "Sword", quantity: 1, unitEncumbranceUnits: 400, encumbranceClass: "sack", itemKind: "normal", placement: "incoming" });
  state = moveStackToHand(state, "sword", owner.id, "main", [character]).state;
  const held = state.stacks.find((stack) => stack.handSlot === "main");
  const assigned = smartStack(state, held.id, [owner.id], [character]);
  assert.equal(assigned.assigned, 1);
  assert.equal(assigned.state.stacks.some((stack) => stack.containerId === pack.id && !stack.handSlot), true);
});

test("catalog equipment names inherit OSRIC quick-add statistics", () => {
  assert.equal(equipmentDefaultForName("Long sword")?.equipment.damage, "1d8");
  assert.equal(equipmentDefaultForName("Plate armor")?.equipment.ascendingAc, 17);
  assert.equal(equipmentDefaultForName("Medium shield")?.equipment.shieldBonus, 1);
});
