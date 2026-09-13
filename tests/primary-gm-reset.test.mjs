import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const chatApi = await readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
const campaignApi = await readFile(new URL("../app/api/campaign/route.ts", import.meta.url), "utf8");

test("primary GM is a brief role-reset event rather than persistent authority", () => {
  assert.match(chatApi, /ACTIVE_ROLE_RESET_MS = 15_000/);
  assert.match(chatApi, /roleReset:/);
  assert.match(chatApi, /const requesterIsGm = Boolean\(payload\.authorIsGm\)/);
  assert.match(chatApi, /const authorIsGm = Boolean\(payload\.authorIsGm\)/);
  assert.doesNotMatch(chatApi, /viewerIsPrimaryGm/);
  assert.doesNotMatch(campaignApi, /chatAuthority|partyChatRoleWithPrimaryGm/);
  assert.match(campaignApi, /const combatActor = payload\.combatActor \?\? null/);
});
