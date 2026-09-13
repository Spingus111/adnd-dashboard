import assert from "node:assert/strict";
import test from "node:test";
import { mergeCampaignStates } from "../app/campaign-merge.ts";

function campaign() {
  return {
    round: 2,
    phase: "declaration",
    characters: [
      { id: "a", name: "Aldric", player: "Anne", stats: [10, 10, 10, 10, 10, 10] },
      { id: "b", name: "Borin", player: "Ben", stats: [11, 11, 11, 11, 11, 11] },
    ],
    inventory: [
      { id: "sword", name: "Long sword", quantity: 1 },
      { id: "rope", name: "Rope", quantity: 1 },
    ],
    participants: [
      { id: "pc-a", action: "skip", ready: false },
      { id: "pc-b", action: "skip", ready: false },
    ],
  };
}

test("concurrent edits to different characters merge without replacing either sheet", () => {
  const base = campaign();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.characters[0].name = "Sir Aldric";
  remote.characters[1].player = "Beth";
  const merged = mergeCampaignStates(base, local, remote);
  assert.equal(merged.characters[0].name, "Sir Aldric");
  assert.equal(merged.characters[1].player, "Beth");
});

test("character field edits merge by stat position and same-field conflicts use the submitter", () => {
  const base = campaign();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.characters[0].stats[0] = 17;
  remote.characters[0].stats[1] = 15;
  remote.characters[0].name = "Remote name";
  local.characters[0].name = "Local name";
  const merged = mergeCampaignStates(base, local, remote);
  assert.deepEqual(merged.characters[0].stats, [17, 15, 10, 10, 10, 10]);
  assert.equal(merged.characters[0].name, "Local name");
});

test("combat declarations and GM progression merge from the same campaign version", () => {
  const base = campaign();
  const player = structuredClone(base);
  const gm = structuredClone(base);
  player.participants[0].action = "melee";
  player.participants[0].ready = true;
  gm.round = 3;
  gm.phase = "initiative";
  const merged = mergeCampaignStates(base, player, gm);
  assert.equal(merged.round, 3);
  assert.equal(merged.phase, "initiative");
  assert.equal(merged.participants[0].action, "melee");
  assert.equal(merged.participants[0].ready, true);
});

test("inventory records merge by id and preserve concurrent additions", () => {
  const base = campaign();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.inventory[0].quantity = 2;
  local.inventory.push({ id: "torch", name: "Torch", quantity: 6 });
  remote.inventory[1].quantity = 3;
  remote.inventory.push({ id: "oil", name: "Oil", quantity: 2 });
  const merged = mergeCampaignStates(base, local, remote);
  assert.equal(merged.inventory.find((entry) => entry.id === "sword").quantity, 2);
  assert.equal(merged.inventory.find((entry) => entry.id === "rope").quantity, 3);
  assert.equal(merged.inventory.find((entry) => entry.id === "torch").quantity, 6);
  assert.equal(merged.inventory.find((entry) => entry.id === "oil").quantity, 2);
});

test("remote deletion wins when local record is unchanged", () => {
  const base = campaign();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  remote.inventory = remote.inventory.filter((entry) => entry.id !== "rope");
  const merged = mergeCampaignStates(base, local, remote);
  assert.equal(merged.inventory.some((entry) => entry.id === "rope"), false);
});

test("independent character selections merge instead of dropping one player's choice", () => {
  const base = { missionCharacterIds: [] };
  const local = { missionCharacterIds: ["a"] };
  const remote = { missionCharacterIds: ["b"] };
  assert.deepEqual(mergeCampaignStates(base, local, remote).missionCharacterIds, ["a", "b"]);
});

test("a rejected stale request is removed without erasing edits made while it was in flight", () => {
  const submitted = {
    activeCharacterCampaignId: "denied-campaign",
    characters: [{ id: "a", name: "Aldric", notes: "" }, { id: "b", name: "Borin", notes: "" }],
  };
  const current = structuredClone(submitted);
  current.characters[0].notes = "Late local note";
  const authoritative = {
    activeCharacterCampaignId: "default",
    characters: [{ id: "a", name: "Aldric", notes: "" }, { id: "b", name: "Borin Ironhand", notes: "" }],
  };

  const reconciled = mergeCampaignStates(submitted, current, authoritative);
  assert.equal(reconciled.activeCharacterCampaignId, "default", "the rejected change is removed");
  assert.equal(reconciled.characters[0].notes, "Late local note", "later local input survives");
  assert.equal(reconciled.characters[1].name, "Borin Ironhand", "concurrent remote input survives");
});
