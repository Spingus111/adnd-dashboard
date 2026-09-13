import test from "node:test";
import assert from "node:assert/strict";

import {
  combatDeclarationIsHidden,
  partyChatRoleCanGenerateCharacters,
  partyChatRoleFromPreferences,
  partyChatRoleHasGmPermissions,
  partyChatRoleForOneTimeGmReset,
} from "../app/party-chat-role.ts";

test("migrates old GM preferences and preserves explicit roles", () => {
  assert.equal(partyChatRoleFromPreferences({ gmRole: true }), "gm");
  assert.equal(partyChatRoleFromPreferences({ gmRole: false }), "party-member");
  assert.equal(partyChatRoleFromPreferences({ role: "solo", gmRole: false }), "solo");
  assert.equal(partyChatRoleFromPreferences({}), null);
});

test("grants referee permissions to GM and Solo only", () => {
  assert.equal(partyChatRoleHasGmPermissions("party-member"), false);
  assert.equal(partyChatRoleHasGmPermissions("gm"), true);
  assert.equal(partyChatRoleHasGmPermissions("solo"), true);
  assert.equal(partyChatRoleHasGmPermissions(null), false);
});

test("a one-time GM reset promotes its browser and demotes every other browser once", () => {
  assert.equal(partyChatRoleForOneTimeGmReset("primary", "primary"), "gm");
  assert.equal(partyChatRoleForOneTimeGmReset("other", "primary"), "party-member");
  assert.equal(partyChatRoleForOneTimeGmReset("other", null), "party-member");
});

test("allows every selected play role to generate characters", () => {
  assert.equal(partyChatRoleCanGenerateCharacters("party-member"), true);
  assert.equal(partyChatRoleCanGenerateCharacters("gm"), true);
  assert.equal(partyChatRoleCanGenerateCharacters("solo"), true);
  assert.equal(partyChatRoleCanGenerateCharacters(null), false);
});

test("hides declarations according to chat role during declaration", () => {
  const base = { phase: "declaration", showAllDeclarations: false, controlHeld: false };
  assert.equal(combatDeclarationIsHidden({ ...base, role: "party-member", participantKind: "enemy" }), true);
  assert.equal(combatDeclarationIsHidden({ ...base, role: "party-member", participantKind: "character" }), false);
  assert.equal(combatDeclarationIsHidden({ ...base, role: "gm", participantKind: "character" }), true);
  assert.equal(combatDeclarationIsHidden({ ...base, role: "gm", participantKind: "character", controlHeld: true }), false);
  assert.equal(combatDeclarationIsHidden({ ...base, role: "gm", participantKind: "enemy" }), false);
  assert.equal(combatDeclarationIsHidden({ ...base, role: "solo", participantKind: "enemy" }), false);
  assert.equal(combatDeclarationIsHidden({ ...base, role: null, participantKind: "enemy" }), true);
});

test("show-all and active combat remove declaration hiding", () => {
  assert.equal(combatDeclarationIsHidden({ phase: "declaration", showAllDeclarations: true, role: "party-member", controlHeld: false, participantKind: "enemy" }), false);
  assert.equal(combatDeclarationIsHidden({ phase: "active", showAllDeclarations: false, role: "party-member", controlHeld: false, participantKind: "enemy" }), false);
});
