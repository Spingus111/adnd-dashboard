import assert from "node:assert/strict";
import test from "node:test";

import {
  allCharacterNames,
  femaleNames,
  maleNames,
  nameCommand,
  randomCharacterColor,
  randomCharacterName,
} from "../app/character-names.ts";

test("the supplied name lists remain exact and complete", () => {
  assert.equal(maleNames.length, 255);
  assert.equal(femaleNames.length, 219);
  assert.equal(allCharacterNames.length, 474);
  assert.deepEqual(maleNames.slice(0, 3), ["Holger", "Hugi", "Alfric"]);
  assert.deepEqual(maleNames.slice(-5), ["Lars", "Dontatsu", "Remington", "Fixit", "Ham"]);
  assert.deepEqual(femaleNames.slice(0, 3), ["Alianora", "Dejah Thoris", "Sola"]);
  assert.deepEqual(femaleNames.slice(-4), ["Anderson", "Kenzie", "Frogos", "Alma"]);
  assert.ok(femaleNames.includes("Ka’thleen"));
  assert.ok(maleNames.includes("Sephiroth Ledoodoo"));
});

test("chat name commands select the requested list", () => {
  assert.deepEqual(nameCommand(" /namem ", () => 0), { pool: "male", label: "Male name", name: "Holger" });
  assert.deepEqual(nameCommand("/namef", () => 0), { pool: "female", label: "Female name", name: "Alianora" });
  assert.deepEqual(nameCommand("/name", () => 0), { pool: "any", label: "Random name", name: "Holger" });
  assert.equal(nameCommand("/name extra", () => 0), null);
  assert.equal(randomCharacterName("any", () => .999999), "Alma");
});

test("generated character colors are valid palette colors", () => {
  assert.match(randomCharacterColor(() => 0), /^#[0-9a-f]{6}$/i);
  assert.notEqual(randomCharacterColor(() => 0), randomCharacterColor(() => .999999));
});
