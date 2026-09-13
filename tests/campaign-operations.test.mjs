import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyCampaignOperations, diffCampaignOperations, promoteAtomicCampaignOperations, replaceGeneratedOperations } from "../app/campaign-operations.ts";

test("character edits become field operations addressed by stable id", () => {
  const base = { characters: [{ id: "a", name: "Aldric", stats: [10, 10] }, { id: "b", name: "Borin", stats: [12, 12] }] };
  const local = structuredClone(base);
  local.characters[0].stats[0] = 16;
  const operations = diffCampaignOperations(base, local);
  assert.deepEqual(operations, [{ type: "set", path: ["characters", { id: "a" }, "stats", 0], value: 16 }]);
});

test("independent stale character operations apply to the latest server state", () => {
  const base = { characters: [{ id: "a", name: "Aldric", strength: 10 }, { id: "b", name: "Borin", strength: 10 }] };
  const playerA = structuredClone(base);
  const playerB = structuredClone(base);
  playerA.characters[0].strength = 16;
  playerB.characters[1].name = "Borin Ironhand";
  const afterA = applyCampaignOperations(base, diffCampaignOperations(base, playerA));
  const afterBoth = applyCampaignOperations(afterA, diffCampaignOperations(base, playerB));
  assert.equal(afterBoth.characters[0].strength, 16);
  assert.equal(afterBoth.characters[1].name, "Borin Ironhand");
});

test("folder creation and character assignment merge as narrow multiplayer operations", () => {
  const base = { characterFolders: [], characters: [{ id: "a", name: "Aldric", folderId: null }] };
  const folderEdit = structuredClone(base);
  folderEdit.characterFolders.push({ id: "veterans", campaignId: "default", name: "Veterans", color: "#663399" });
  const assignment = structuredClone(base);
  assignment.characters[0].folderId = "veterans";
  const folderOperations = diffCampaignOperations(base, folderEdit);
  const assignmentOperations = diffCampaignOperations(base, assignment);
  assert.deepEqual(folderOperations, [
    { type: "set", path: ["characterFolders", { id: "veterans" }], value: folderEdit.characterFolders[0] },
    { type: "reorder", path: ["characterFolders"], ids: ["veterans"] },
  ]);
  assert.deepEqual(assignmentOperations, [{ type: "set", path: ["characters", { id: "a" }, "folderId"], value: "veterans" }]);
  const merged = applyCampaignOperations(applyCampaignOperations(base, folderOperations), assignmentOperations);
  assert.equal(merged.characterFolders[0].name, "Veterans");
  assert.equal(merged.characters[0].folderId, "veterans");
});

test("simultaneous damage uses additive operations and retry-safe replacement", () => {
  const state = { segmentedInitiative: { participants: [{ id: "orc", currentHp: 10 }] } };
  const hpPath = ["segmentedInitiative", "participants", { id: "orc" }, "currentHp"];
  const generated = [{ type: "set", path: hpPath, value: 6 }];
  const explicit = [{ type: "increment", path: hpPath, amount: -4, minimum: -10 }];
  assert.deepEqual(replaceGeneratedOperations(generated, explicit), explicit);
  const twice = applyCampaignOperations(applyCampaignOperations(state, explicit), explicit);
  assert.equal(twice.segmentedInitiative.participants[0].currentHp, 2);
});

test("remote polling reconciles while local input is dirty instead of pausing", () => {
  const toolkit = readFileSync(new URL("../app/toolkit.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(toolkit, /JSON\.stringify\(campaignRef\.current\) !== lastSavedRef\.current\) return/);
  assert.match(toolkit, /authoritativeState = normalizeRemoteCampaignState\(result\.state\)/);
  assert.match(toolkit, /mergeCampaignStates\(priorServerState, currentState, authoritativeState\)/);
  assert.match(toolkit, /pendingCampaignSaveRef/);
  assert.match(toolkit, /mutationId: sharedId\(\)/);
});

test("inventory quantity changes become atomic deltas", () => {
  const base = { inventoryManagement: { stacks: [{ id: "torch", quantity: 8 }] } };
  const next = { inventoryManagement: { stacks: [{ id: "torch", quantity: 6 }] } };
  const operations = promoteAtomicCampaignOperations(diffCampaignOperations(base, next), base);
  assert.deepEqual(operations, [{ type: "increment", path: ["inventoryManagement", "stacks", { id: "torch" }, "quantity"], amount: -2, minimum: 0 }]);
  const remotelyChanged = { inventoryManagement: { stacks: [{ id: "torch", quantity: 10 }] } };
  assert.equal(applyCampaignOperations(remotelyChanged, operations).inventoryManagement.stacks[0].quantity, 8);
});

test("simultaneous item moves on different character sheets remain independent field patches", () => {
  const base = { inventoryManagement: { stacks: [
    { id: "rope", containerId: "aldric-pack", quantity: 1 },
    { id: "torch", containerId: "borin-pack", quantity: 6 },
  ] } };
  const aldric = structuredClone(base);
  const borin = structuredClone(base);
  aldric.inventoryManagement.stacks[0].containerId = "aldric-pouch";
  borin.inventoryManagement.stacks[1].containerId = "borin-pouch";
  const aldricOperations = diffCampaignOperations(base, aldric);
  const borinOperations = diffCampaignOperations(base, borin);
  assert.deepEqual(aldricOperations, [{ type: "set", path: ["inventoryManagement", "stacks", { id: "rope" }, "containerId"], value: "aldric-pouch" }]);
  assert.deepEqual(borinOperations, [{ type: "set", path: ["inventoryManagement", "stacks", { id: "torch" }, "containerId"], value: "borin-pouch" }]);
  const combined = applyCampaignOperations(applyCampaignOperations(base, aldricOperations), borinOperations);
  assert.equal(combined.inventoryManagement.stacks.find((stack) => stack.id === "rope").containerId, "aldric-pouch");
  assert.equal(combined.inventoryManagement.stacks.find((stack) => stack.id === "torch").containerId, "borin-pouch");
});

test("cross-tab operation batches converge under many different arrival orders", () => {
  const base = {
    characters: [{ id: "a", notes: "", currentHp: 10 }, { id: "b", notes: "", currentHp: 8 }],
    inventoryManagement: { stacks: [{ id: "ammo", quantity: 10 }, { id: "torch", quantity: 4 }] },
    segmentedInitiative: { participants: [{ id: "a-combat", currentHp: 10 }, { id: "orc", currentHp: 12 }] },
    dashboard: { watch: 1, weather: "clear" },
  };
  const batches = [
    [{ type: "set", path: ["characters", { id: "a" }, "notes"], value: "Front rank" }],
    [{ type: "set", path: ["characters", { id: "b" }, "notes"], value: "Rear rank" }],
    [{ type: "increment", path: ["inventoryManagement", "stacks", { id: "ammo" }, "quantity"], amount: -1, minimum: 0 }],
    [{ type: "increment", path: ["inventoryManagement", "stacks", { id: "torch" }, "quantity"], amount: -2, minimum: 0 }],
    [{ type: "increment", path: ["segmentedInitiative", "participants", { id: "orc" }, "currentHp"], amount: -3, minimum: -10 }],
    [{ type: "set", path: ["dashboard", "weather"], value: "rain" }],
  ];

  for (let run = 0; run < 120; run += 1) {
    const order = batches.map((_, index) => index).sort((left, right) => ((left * 17 + run * 31) % 23) - ((right * 17 + run * 31) % 23));
    const result = order.reduce((state, index) => applyCampaignOperations(state, batches[index]), structuredClone(base));
    assert.equal(result.characters[0].notes, "Front rank");
    assert.equal(result.characters[1].notes, "Rear rank");
    assert.equal(result.inventoryManagement.stacks[0].quantity, 9);
    assert.equal(result.inventoryManagement.stacks[1].quantity, 2);
    assert.equal(result.segmentedInitiative.participants[1].currentHp, 9);
    assert.equal(result.dashboard.weather, "rain");
  }
});

test("explicit parent operations suppress stale generated child operations", () => {
  const generated = [{ type: "set", path: ["characters", { id: "a" }, "notes"], value: "stale" }];
  const explicit = [{ type: "delete", path: ["characters", { id: "a" }] }];
  assert.deepEqual(replaceGeneratedOperations(generated, explicit), explicit);
});

test("the live sync loop backs off on collisions and retains a broad retry ledger", () => {
  const toolkit = readFileSync(new URL("../app/toolkit.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/campaign/route.ts", import.meta.url), "utf8");
  assert.match(toolkit, /response\.status === 409[\s\S]*const backoff =[\s\S]*window\.setTimeout\(resolve, backoff\)/);
  assert.match(toolkit, /response\.status === 403[\s\S]*mergeCampaignStates\(pending\.submittedState, currentState, authoritativeState\)/);
  assert.match(route, /const MUTATION_LEDGER_LIMIT = 500/);
  assert.match(route, /const MAX_WRITE_ATTEMPTS = 8/);
  assert.match(route, /"cache-control": "no-store"/);
});
