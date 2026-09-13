import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { canControlCombatant, canControlCombatProgression } from "../app/combat-permissions.ts";
import { validateCombatMutation } from "../app/combat-state-validation.ts";
import { emptyCampaign } from "../app/types.ts";

const participant = (id, kind, side, characterId = null) => ({
  id,
  kind,
  side,
  characterId,
  name: id,
  action: "",
  currentHp: 5,
  maxHp: 5,
});

const identity = (role, dockedCharacterIds = []) => ({ role, dockedCharacterIds });

test("combat progression belongs only to GM and Solo roles", () => {
  assert.equal(canControlCombatProgression(identity("gm")), true);
  assert.equal(canControlCombatProgression(identity("solo")), true);
  assert.equal(canControlCombatProgression(identity("party-member")), false);
  assert.equal(canControlCombatProgression(identity("party-member"), true), false, "Ctrl never grants global combat authority");
});

test("combat uses one anchored authoritative progression control", () => {
  const source = readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /className="combat-phase-anchor"/);
  assert.match(source, /onClick=\{advanceCombatProgression\}/);
  assert.match(source, /\["Declare", "Initiative", "Resolve", "Complete"\]/);
  assert.ok(source.lastIndexOf("{phaseAdvanceControl()}") > source.indexOf('className="combat-timeline-scroll"'), "the progression control follows the segment tracker");
  assert.doesNotMatch(source, /className="advance-initiative-button"/);
  assert.doesNotMatch(source, /className="next-round-button"/);
});

test("combat defaults and referee settings follow viewer ownership", () => {
  const source = readFileSync(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /setExpandedCombatantIds\(selectedIds\)/, "only selected PCs begin expanded");
  assert.match(source, /Hidden for propriety, CTRL to show/);
  assert.match(source, /className="panel combat-referee-settings"/);
  assert.match(source, /<strong>Individual initiative<\/strong>/);
  assert.match(source, /<strong>HD is damage<\/strong>/);
  assert.match(source, /<strong>All declarations viewable<\/strong>/);
  assert.match(source, /<fieldset disabled=\{!hasProgressionAuthority\}/, "players cannot change referee settings");
});

test("selected character inventories open while other character inventories default closed", () => {
  const source = readFileSync(new URL("../app/inventory-management-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /viewerDockedCharacterIds\.includes\(owner\.characterId\)/);
  assert.match(source, /chosen \? \[`worn:\$\{owner\.id\}`\] : \[`owner:\$\{owner\.id\}`, `worn:\$\{owner\.id\}`\]/);
  assert.match(source, /defaultTextCollapsed/);
});

test("overfull health bars use their blue state", () => {
  const component = readFileSync(new URL("../app/hp-bar.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(component, /current > displayMaximum \? "overfull"/);
  assert.match(component, /monster-hp-bar \$\{overfull \? "overfull"/);
  assert.match(css, /\.hp-bar\.overfull \.hp-bar-fill \{ background: var\(--info\); \}/);
  assert.match(css, /\.monster-hp-bar\.overfull i\.filled/);
});

test("combatant control separates role, PC ownership, and NPC allegiance", () => {
  const ownPc = participant("pc-own", "character", "party", "char-own");
  const otherPc = participant("pc-other", "character", "party", "char-other");
  const ally = participant("ally", "npc", "party");
  const neutral = participant("neutral", "npc", "opposition");
  const monster = participant("monster", "enemy", "opposition");

  const player = identity("party-member", ["char-own"]);
  assert.equal(canControlCombatant(player, ownPc), true);
  assert.equal(canControlCombatant(player, otherPc), false);
  assert.equal(canControlCombatant(player, ally), true);
  assert.equal(canControlCombatant(player, neutral), false);
  assert.equal(canControlCombatant(player, monster), false);
  assert.equal(canControlCombatant(player, monster, true), true);

  const gm = identity("gm");
  assert.equal(canControlCombatant(gm, monster), true);
  assert.equal(canControlCombatant(gm, neutral), true);
  assert.equal(canControlCombatant(gm, ally), true);
  assert.equal(canControlCombatant(gm, ownPc), true);

  assert.equal(canControlCombatant(identity("solo"), ownPc), true);
  assert.equal(canControlCombatant(identity("solo"), monster), true);
});

test("shared-state validation rejects player progression and unauthorized mutations", () => {
  const ownPc = participant("pc-own", "character", "party", "char-own");
  const monster = participant("monster", "enemy", "opposition");
  const previous = structuredClone(emptyCampaign);
  previous.segmentedInitiative.participants = [ownPc, monster];

  const progressed = structuredClone(previous);
  progressed.segmentedInitiative.currentSegment = 4;
  progressed.segmentedInitiative.phase = "active";
  assert.match(validateCombatMutation(previous, progressed, {
    ...identity("party-member", ["char-own"]), sourceParticipantId: null, override: false,
  }), /Only the GM or Solo/);

  const changedMonster = structuredClone(previous);
  changedMonster.segmentedInitiative.participants[1].action = "melee";
  assert.match(validateCombatMutation(previous, changedMonster, {
    ...identity("party-member", ["char-own"]), sourceParticipantId: null, override: false,
  }), /does not control/);
});

test("shared-state validation accepts owned actions, allied NPCs, damage targets, and Ctrl overrides", () => {
  const ownPc = participant("pc-own", "character", "party", "char-own");
  const ally = participant("ally", "npc", "party");
  const monster = participant("monster", "enemy", "opposition");
  const previous = structuredClone(emptyCampaign);
  previous.segmentedInitiative.participants = [ownPc, ally, monster];
  const playerContext = { ...identity("party-member", ["char-own"]), sourceParticipantId: "pc-own", override: false };

  const ownAction = structuredClone(previous);
  ownAction.segmentedInitiative.participants[0].action = "melee";
  assert.equal(validateCombatMutation(previous, ownAction, playerContext), null);

  const allyAction = structuredClone(previous);
  allyAction.segmentedInitiative.participants[1].action = "move";
  assert.equal(validateCombatMutation(previous, allyAction, { ...playerContext, sourceParticipantId: "ally" }), null);

  const appliedDamage = structuredClone(previous);
  appliedDamage.segmentedInitiative.participants[2].currentHp = 2;
  assert.equal(validateCombatMutation(previous, appliedDamage, playerContext), null, "an owned attacker may mutate its target");

  const disguisedEnemyDeclaration = structuredClone(previous);
  disguisedEnemyDeclaration.segmentedInitiative.participants[2].action = "melee";
  assert.match(validateCombatMutation(previous, disguisedEnemyDeclaration, playerContext), /does not control/, "an owned source cannot rewrite an enemy declaration");

  const overrideMonster = structuredClone(previous);
  overrideMonster.segmentedInitiative.participants[2].action = "skip";
  assert.equal(validateCombatMutation(previous, overrideMonster, { ...playerContext, sourceParticipantId: "monster", override: true }), null);
});

test("campaign saves authorize only submitted operations and never post the campaign snapshot", () => {
  const route = readFileSync(new URL("../app/api/campaign/route.ts", import.meta.url), "utf8");
  const toolkit = readFileSync(new URL("../app/toolkit.tsx", import.meta.url), "utf8");
  assert.match(route, /const nextState = applyCampaignOperations\(previousState, operations\)/);
  assert.ok(
    route.indexOf("applyCampaignOperations(previousState, operations)") < route.indexOf("validateCombatMutation(previousState, nextState"),
    "permission validation must inspect only the submitted operations",
  );
  assert.match(toolkit, /body: JSON\.stringify\(\{ operations: pending\.operations, mutationId: pending\.mutationId/);
  assert.doesNotMatch(toolkit, /body: JSON\.stringify\(\{ state: submittedState/);
  assert.match(toolkit, /response\.status === 403[\s\S]*setLoadError\(""\)/);
  assert.doesNotMatch(toolkit, /setLoadError\(result\.error \|\| "That combat action is not permitted/);
});
