import assert from "node:assert/strict";
import test from "node:test";

import { chatIsNearBottom, chatMessagesEqual } from "../app/chat-scroll.ts";

const message = {
  id: "message-1",
  authorName: "Player",
  emoji: "🎲",
  color: "#667085",
  content: "1d20 = 12",
  rollDetail: "d20 = 12",
  createdAt: "2026-08-10T00:00:00Z",
};

test("unchanged chat polls preserve the existing message state", () => {
  assert.equal(chatMessagesEqual([message], [{ ...message }]), true);
  assert.equal(chatMessagesEqual([message], [{ ...message, content: "changed" }]), false);
  assert.equal(chatMessagesEqual([message], []), false);
});

test("chat only follows new messages while the reader is near the bottom", () => {
  assert.equal(chatIsNearBottom(664, 300, 1000), true);
  assert.equal(chatIsNearBottom(500, 300, 1000), false);
});
