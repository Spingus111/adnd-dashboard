import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { bestPsionicDefense, bestPsionicDefenseForAttacks, defenselessPsionicOutcome, defenselessPsionicResult, normalizePsionics, normalPsionicLoss, psionicAttackModes, psionicBlastEffect, psionicBlastSaveTarget, psionicDefenseModes, psionicMatrixTotal, restorePsionicPoints } from "../app/psionics.ts";
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

test("RAW combat helpers distinguish death chances, range bands, and favorable defenses", () => {
  const fullDefense = normalizePsionics({ enabled: true, maxAttackPoints: 100, currentAttackPoints: 100, maxDefensePoints: 100, currentDefensePoints: 100, attackModes: ["Psychic Crush"], defenseModes: psionicDefenseModes });
  assert.equal(bestPsionicDefense(fullDefense, 90, "Psychic Crush"), "Tower of Iron Will");
  assert.equal(bestPsionicDefenseForAttacks(fullDefense, [{ attackerTotal: 90, attack: "Psychic Crush" }]), "Tower of Iron Will");
  assert.equal(psionicMatrixTotal(126, "long"), 101);
  assert.deepEqual(defenselessPsionicOutcome(76, 45, "Psychic Crush"), { loss: null, instantDeathPercent: 84, code: null });
  assert.deepEqual(defenselessPsionicOutcome(76, 45, "Ego Whip"), { loss: null, instantDeathPercent: 0, code: "P" });
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

test("psionic combat UI exposes rules help and resolves both sides simultaneously", () => {
  const combat = fs.readFileSync("app/segmented-initiative-panel.tsx", "utf8");
  const creation = fs.readFileSync("app/character-sheet-panel.tsx", "utf8");
  assert.match(combat, /resolvePsionicSegment/);
  assert.match(combat, /All party and enemy psionic attacks in this segment resolve from the same starting pools/);
  assert.match(combat, /hasPsionicCombatant && <details className="psionic-combat-log"/);
  assert.match(combat, /Through segment/);
  assert.match(combat, /PsionicAttackModeTooltip/);
  assert.match(creation, /PsionicDisciplineTooltip/);
  assert.match(creation, /PsionicTermInfoButton term="potential"/);
});

test("psionic recovery, editable pools, interactive help, and combat reporting stay integrated", () => {
  const creation = fs.readFileSync("app/character-sheet-panel.tsx", "utf8");
  const combat = fs.readFileSync("app/segmented-initiative-panel.tsx", "utf8");
  const tooltip = fs.readFileSync("app/weapon-rules-tooltip.tsx", "utf8");
  const chat = fs.readFileSync("app/chat-drawer.tsx", "utf8");
  const chatApi = fs.readFileSync("app/api/chat/route.ts", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");

  assert.match(creation, /restAndRecoverPsionics/);
  assert.match(creation, />Rest and prepare<\/button>/);
  assert.match(creation, /maximum=\{psionics\.maxAttackPoints\}[^\n]*current Attack Points/);
  assert.match(creation, /maximum=\{psionics\.maxDefensePoints\}[^\n]*current Defense Points/);
  assert.match(creation, /open=\{setupOpen\} onToggle=/);
  assert.match(creation, /set\(\{ determination: "established" \}\); setSetupOpen\(false\)/);
  assert.match(tooltip, /onMouseEnter=\{show\}/);
  assert.match(tooltip, /onMouseLeave=\{hideSoon\}/);
  assert.match(css, /\.declaration-controls > \.psionic-combat-declaration \+ \.participant-condition-picker/);
  assert.match(combat, /Clear psionic log/);
  assert.match(combat, /sendChatAction\(\{[\s\S]*tone: hostile \? "psionic-hostile" : "psionic"/);
  assert.match(chat, /psionic-hostile/);
  assert.match(chatApi, /requestedTone === "psionic-hostile"/);
});
