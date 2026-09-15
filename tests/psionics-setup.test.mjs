import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { bestPsionicDefense, defenselessPsionicResult, normalizePsionics, normalPsionicLoss, psionicAttackModes, psionicBlastEffect, psionicBlastSaveTarget, psionicDefenseModes, restorePsionicPoints } from "../app/psionics.ts";
import { createStableNpc, normalizeStableNpc, stableNpcToParticipant } from "../app/npc-stable.ts";

test("psionic setup clamps point pools, removes invalid modes, and gives psions Mind Blank", () => {
  const setup = normalizePsionics({
    enabled: true,
    currentAttackPoints: 120,
    maxAttackPoints: 75,
    currentDefensePoints: -1,
    maxDefensePoints: 35,
    attackModes: ["Mind Thrust", "not a mode", "Mind Thrust"],
    defenseModes: ["Tower of Iron Will", "not a mode"],
  });
  assert.equal(setup.currentAttackPoints, 75);
  assert.equal(setup.maxAttackPoints, 75);
  assert.equal(setup.currentDefensePoints, 0);
  assert.equal(setup.maxDefensePoints, 35);
  assert.deepEqual(setup.attackModes, ["Mind Thrust"]);
  assert.deepEqual(setup.defenseModes, ["Mind Blank", "Tower of Iron Will"]);
  assert.equal(psionicAttackModes.length, 5);
  assert.equal(psionicDefenseModes.length, 5);
});

test("new and restored expedition NPCs carry psionics into combat participants", () => {
  const npc = createStableNpc("default", "heavy-foot", null, 1);
  assert.equal(npc.psionics?.enabled, false);
  const restored = normalizeStableNpc({ ...npc, psionics: { enabled: true, currentAttackPoints: 40, maxAttackPoints: 40, currentDefensePoints: 20, maxDefensePoints: 20, attackModes: ["Ego Whip"], defenseModes: [] } });
  const participant = stableNpcToParticipant(restored, 1);
  assert.equal(participant.psionics?.enabled, true);
  assert.equal(participant.psionics?.currentAttackPoints, 40);
  assert.deepEqual(participant.psionics?.defenseModes, ["Mind Blank"]);
});

test("psionic matrices, blast effects, and recovery remain data-driven", () => {
  assert.deepEqual(normalPsionicLoss(76, "Mind Thrust", "Thought Shield"), { loss: 13, instantDeathPercent: 0 });
  assert.equal(defenselessPsionicResult(101, 45, "Psionic Blast"), "K");
  assert.equal(psionicBlastSaveTarget(18, "medium"), 11);
  assert.equal(psionicBlastEffect(14, 95), "Confused");
  const restored = restorePsionicPoints(normalizePsionics({ enabled: true, maxAttackPoints: 50, currentAttackPoints: 35, maxDefensePoints: 50, currentDefensePoints: 25, attackModes: ["Mind Thrust"], defenseModes: ["Mind Blank"] }), 12);
  assert.equal(restored.currentAttackPoints, 50);
  assert.equal(restored.currentDefensePoints, 34);
  assert.equal(bestPsionicDefense(restored, 90, "Mind Thrust"), "Mind Blank");
});

test("both enemy setup surfaces expose the psionic combat configuration", () => {
  for (const path of ["app/npc-stable-panel.tsx", "app/segmented-initiative-panel.tsx"]) {
    const source = fs.readFileSync(path, "utf8");
    assert.match(source, /<b>PSIONICS<\/b>/);
    assert.match(source, /Attack maximum/);
    assert.match(source, /Defense maximum/);
    assert.match(source, /Mind Blank is automatic/);
  }
});
