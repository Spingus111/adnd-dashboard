import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { normalizePsionics, psionicAttackModes, psionicDefenseModes } from "../app/psionics.ts";
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
  assert.deepEqual(setup, {
    enabled: true,
    currentAttackPoints: 75,
    maxAttackPoints: 75,
    currentDefensePoints: 0,
    maxDefensePoints: 35,
    attackModes: ["Mind Thrust"],
    defenseModes: ["Mind Blank", "Tower of Iron Will"],
  });
  assert.equal(psionicAttackModes.length, 5);
  assert.equal(psionicDefenseModes.length, 5);
});

test("new and restored expedition NPCs carry psionics into combat participants", () => {
  const npc = createStableNpc("default", "heavy-foot", null, 1);
  assert.equal(npc.psionics?.enabled, false);
  const restored = normalizeStableNpc({ ...npc, psionics: { enabled: true, currentAttackPoints: 40, maxAttackPoints: 40, currentDefensePoints: 20, maxDefensePoints: 20, attackModes: ["Ego Whip"], defenseModes: [] } });
  const participant = stableNpcToParticipant(restored, 1);
  assert.deepEqual(participant.psionics, { enabled: true, currentAttackPoints: 40, maxAttackPoints: 40, currentDefensePoints: 20, maxDefensePoints: 20, attackModes: ["Ego Whip"], defenseModes: ["Mind Blank"] });
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
