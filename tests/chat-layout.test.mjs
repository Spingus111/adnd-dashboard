import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Party Chat consolidates identity and utility controls into edge rows", async () => {
  const source = await readFile(new URL("../app/chat-drawer.tsx", import.meta.url), "utf8");
  const header = source.slice(source.indexOf('<header className="chat-header">'), source.indexOf('<div className="chat-sheet-scroll">'));
  const bottom = source.slice(source.indexOf('<div className="chat-bottom-tools">'), source.indexOf("{status &&"));

  assert.match(header, /<h2>Party Chat<\/h2>/);
  assert.match(header, /className="chat-dock-controls"/);
  assert.match(header, /<summary>Identity /);
  assert.match(header, /"Set me as primary GM"/);
  assert.match(header, /One-time reset:/);
  assert.doesNotMatch(header, /name="chat-role"[^>]*disabled=/);
  assert.match(source, /roleResetId && roleResetId !== appliedRoleResetId\.current/);
  assert.match(header, />Clear<\/button>/);
  assert.match(header, /aria-label="Close party chat"/);

  assert.match(bottom, /title=\{hiddenRoll \? "Hidden roll on" : "Hidden roll off"\}/);
  assert.match(bottom, />👁️<\/button>/);
  assert.match(bottom, /className=\{`chat-tool-menu whisper-tool/);
  assert.match(bottom, /title="Whisper"[^>]*>🤫<\/summary>/);
  assert.match(bottom, /className="chat-tool-menu dice-syntax-help"/);
  assert.match(bottom, /title="Dice expression help"[^>]*>🎲<\/summary>/);
  assert.match(bottom, /className={`raise-hand-button/);
  assert.match(source, /className="raised-hands-overlay"/);
  assert.match(source, /color: options\?\.actor\?\.tileColor \?\? identity\.color/);
  assert.doesNotMatch(source, /player-color-tag/);
});

test("chat messages carry their character color on the outside left edge", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.chat-message:not\(\.hostile\) \{ border-left: 4px solid var\(--chat-accent\)/);
});

test("one docked character expands fully while multiple characters retain scrolling", async () => {
  const source = await readFile(new URL("../app/chat-drawer.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /dockedCharacters\.length === 1 \? "single-docked" : "multiple-docked"/);
  assert.match(source, /const collapsed = dockedCharacters\.length > 1/);
  assert.match(css, /\.chat-quick-rolls\.single-docked[\s\S]*?max-height: none;[\s\S]*?overflow: visible;/);
  assert.match(css, /\.chat-quick-rolls\.multiple-docked \{ overflow-y: auto; \}/);
});
