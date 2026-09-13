import assert from "node:assert/strict";
import test from "node:test";
import { validateCampaignAdministration, validateInventoryMutation } from "../app/campaign-permissions.ts";
import { emptyCampaign } from "../app/types.ts";
import { createStableNpc, stableNpcToParticipant } from "../app/npc-stable.ts";

const identity = (role) => ({ role, dockedCharacterIds: [], sourceParticipantId: null, override: false });

test("only GM and Solo can switch or manage campaigns", () => {
  const previous = structuredClone(emptyCampaign);
  const switched = structuredClone(previous);
  switched.characterCampaigns.push({ id: "second", name: "Second campaign" });
  switched.activeCharacterCampaignId = "second";
  assert.match(validateCampaignAdministration(previous, switched, identity("party-member")), /Only the GM or Solo/);
  assert.match(validateCampaignAdministration(previous, switched, null), /Only the GM or Solo/);
  assert.equal(validateCampaignAdministration(previous, switched, identity("gm")), null);
  assert.equal(validateCampaignAdministration(previous, switched, identity("solo")), null);
});

test("folder definitions are shared GM setup while character assignment remains a character edit", () => {
  const previous = structuredClone(emptyCampaign);
  const configured = structuredClone(previous);
  configured.characterFolders.push({ id: "veterans", campaignId: "default", name: "Veterans", color: "#663399" });
  assert.match(validateCampaignAdministration(previous, configured, identity("party-member")), /Only the GM or Solo/);
  assert.equal(validateCampaignAdministration(previous, configured, identity("gm")), null);

  const assigned = structuredClone(configured);
  assigned.characters = [{ id: "pc", campaignId: "default", folderId: "veterans", name: "Aldric" }];
  assert.equal(validateCampaignAdministration(configured, assigned, identity("party-member")), null);
});

test("ordinary character edits do not require campaign authority", () => {
  const previous = structuredClone(emptyCampaign);
  const edited = structuredClone(previous);
  edited.characters = [{ id: "pc", name: "Aldric" }];
  assert.equal(validateCampaignAdministration(previous, edited, identity("party-member")), null);
});

test("Stable setup is GM-only while allied NPC combat HP remains player-controllable", () => {
  const previous = structuredClone(emptyCampaign);
  const npc = createStableNpc("default", "mule", null, 1);
  const created = structuredClone(previous);
  created.stableNpcs = [npc];
  assert.match(validateCampaignAdministration(previous, created, identity("party-member")), /NPC Stable/);
  assert.equal(validateCampaignAdministration(previous, created, identity("gm")), null);

  const inCombat = structuredClone(created);
  inCombat.segmentedInitiative.participants = [stableNpcToParticipant(npc, 1)];
  const damaged = structuredClone(inCombat);
  damaged.stableNpcs[0].currentHp -= 1;
  assert.equal(validateCampaignAdministration(inCombat, damaged, { ...identity("party-member"), sourceParticipantId: npc.id }), null);
  damaged.stableNpcs[0].name = "Unauthorized rename";
  assert.match(validateCampaignAdministration(inCombat, damaged, { ...identity("party-member"), sourceParticipantId: npc.id }), /NPC Stable/);
});

test("players may resolve an allied expedition NPC backup-weapon switch", () => {
  const previous = structuredClone(emptyCampaign);
  const npc = createStableNpc("default", "heavy-foot", null, 1);
  previous.stableNpcs = [npc];
  previous.segmentedInitiative.participants = [stableNpcToParticipant(npc, 1)];
  const switched = structuredClone(previous);
  switched.stableNpcs[0].activeWeaponRulesId = "short-sword";
  switched.stableNpcs[0].attackMode = "weapon";
  switched.stableNpcs[0].damageExpression = "1d6";
  switched.segmentedInitiative.participants[0].weaponRulesId = "short-sword";
  switched.segmentedInitiative.participants[0].attackMode = "weapon";
  switched.segmentedInitiative.participants[0].damageExpression = "1d6";
  assert.equal(validateCampaignAdministration(previous, switched, { ...identity("party-member"), sourceParticipantId: npc.id }), null);
});

function inventoryCampaign() {
  const campaign = structuredClone(emptyCampaign);
  campaign.inventoryManagement.owners = [
    { id: "owner-a", campaignId: "default", name: "Aldric", type: "character", capacityUnits: 4000, characterId: "pc-a" },
    { id: "owner-b", campaignId: "default", name: "Bryn", type: "character", capacityUnits: 4000, characterId: "pc-b" },
  ];
  campaign.inventoryManagement.containers = [
    { id: "pack-a", campaignId: "default", name: "Aldric pack", capacityUnits: 4000, tareWeightUnits: 0, holderType: "owner", holderId: "owner-a", containerType: "character-backpack", intrinsic: false, movable: true },
    { id: "pack-b", campaignId: "default", name: "Bryn pack", capacityUnits: 4000, tareWeightUnits: 0, holderType: "owner", holderId: "owner-b", containerType: "character-backpack", intrinsic: false, movable: true },
  ];
  campaign.inventoryManagement.stacks = [
    { id: "torch-a", campaignId: "default", name: "Torch", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "pack-a" },
    { id: "torch-b", campaignId: "default", name: "Torch", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "pack-b" },
  ];
  return campaign;
}

test("players can edit their docked character inventory and Ground, but not another character", () => {
  const previous = inventoryCampaign();
  const controlled = structuredClone(previous);
  controlled.inventoryManagement.stacks[0].containerId = null;
  controlled.inventoryManagement.stacks[0].placement = "ground";
  const player = { ...identity("party-member"), dockedCharacterIds: ["pc-a"] };
  assert.equal(validateInventoryMutation(previous, controlled, player), null);

  const other = structuredClone(previous);
  other.inventoryManagement.stacks[1].containerId = null;
  other.inventoryManagement.stacks[1].placement = "ground";
  assert.match(validateInventoryMutation(previous, other, player), /character you control/i);
  assert.equal(validateInventoryMutation(previous, other, identity("gm")), null);
});

test("players can buy a catalog stack into their own pack but cannot edit shared inventory setup", () => {
  const previous = inventoryCampaign();
  const purchase = structuredClone(previous);
  purchase.inventoryManagement.stacks.push({ id: "rope", campaignId: "default", catalogItemId: "rope", name: "Hemp rope", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", gpValue: 1, containerId: "pack-a" });
  const player = { ...identity("party-member"), dockedCharacterIds: ["pc-a"] };
  assert.equal(validateInventoryMutation(previous, purchase, player), null);

  const setup = structuredClone(previous);
  setup.inventoryManagement.owners[0].capacityUnits = 99999;
  assert.match(validateInventoryMutation(previous, setup, player), /Only the GM/);
});

test("players can create a character with its generated starter inventory", () => {
  const previous = structuredClone(emptyCampaign);
  const created = structuredClone(previous);
  created.characters.push({ id: "new-pc", name: "New adventurer", campaignId: "default" });
  created.inventoryManagement.owners.push({ id: "new-owner", campaignId: "default", name: "New adventurer", type: "character", capacityUnits: 4000, characterId: "new-pc" });
  created.inventoryManagement.containers.push(
    { id: "new-quick", campaignId: "default", name: "Quick Access", capacityUnits: 1000, tareWeightUnits: 0, holderType: "owner", holderId: "new-owner", containerType: "quick-access", intrinsic: true, movable: false, originCharacterId: "new-pc" },
    { id: "new-pack", campaignId: "default", name: "New adventurer's Backpack", capacityUnits: 4000, tareWeightUnits: 0, holderType: "owner", holderId: "new-owner", containerType: "character-backpack", intrinsic: false, movable: true, originCharacterId: "new-pc" },
  );
  created.inventoryManagement.stacks.push({ id: "new-torch", campaignId: "default", name: "Torch", quantity: 4, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "new-pack" });
  assert.equal(validateInventoryMutation(previous, created, identity("party-member")), null);
});

test("players can receive one-time generation grants before docking the new character", () => {
  const previous = inventoryCampaign();
  previous.characters = [{ id: "pc-a", name: "Aldric", campaignId: "default", startingInventoryGranted: false }];
  const generated = structuredClone(previous);
  generated.characters[0].startingInventoryGranted = true;
  generated.inventoryManagement.stacks.push({ id: "starting-gp", campaignId: "default", name: "Gold Coins", quantity: 90, unitEncumbranceUnits: 1, encumbranceClass: "coin", itemKind: "treasure", containerId: "pack-a" });
  assert.equal(validateInventoryMutation(previous, generated, identity("party-member")), null);
});
