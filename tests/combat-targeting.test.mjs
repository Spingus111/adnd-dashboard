import assert from "node:assert/strict";
import test from "node:test";

import { participantIsConscious, pruneInvalidCombatTargets } from "../app/combat-targeting.ts";

const participant = (id, currentHp, patch = {}) => ({ id, currentHp, action: "melee", statusNote: "", targetId: null, targetIds: [], ...patch });

test("zero-HP, dying, unconscious, and dead combatants are not valid targets", () => {
  assert.equal(participantIsConscious(participant("up", 1)), true);
  assert.equal(participantIsConscious(participant("zero", 0)), false);
  assert.equal(participantIsConscious(participant("down", 4, { action: "unconscious" })), false);
  assert.equal(participantIsConscious(participant("dead", 4, { statusNote: "EXSANGUINATED" })), false);
});

test("targets reset as soon as the prior target drops", () => {
  const result = pruneInvalidCombatTargets([
    participant("attacker", 8, { targetId: "down", targetIds: ["down", "up"] }),
    participant("down", 0),
    participant("up", 4),
  ]);
  assert.equal(result[0].targetId, null);
  assert.deepEqual(result[0].targetIds, ["up"]);
});
