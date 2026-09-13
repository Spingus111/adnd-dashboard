import assert from "node:assert/strict";
import test from "node:test";

import { getLegalWeaponProficiencies, getWeaponTrainingState, reconcileOsricAutomation, specializedMissileRate, trainingSlotsUsed } from "../app/osric-advancement.ts";
import { weaponRulesById } from "../app/weapon-rules.ts";

function character(className, training = []) {
  return {
    id:"slinger", campaignId:"default", name:"Slinger", player:"", race:"Human", className, level:1,
    classLevels:{ [className]:1 }, movementRate:120, toHit:0, armorClass:10, currentHp:6, maxHp:6, hitDice:"1d6",
    currentXp:0, totalXp:0, age:"20", height:"", weight:"", tileColor:"#fff", emoji:"◆", stats:["10","10","10","10","10","10"], gold:0,
    saves:{ death:20,wands:20,polymorph:20,breath:20,spells:20 }, notes:"", diceMacros:[{name:"",expression:""},{name:"",expression:""},{name:"",expression:""}],
    weapons:[], equippedWeaponId:null, handState:"unarmed", inventoryLines:[], weaponProficiencies:"", weaponSpecializations:"", weaponTraining:training, spellbook:[], spellSlots:[],
  };
}

test("legacy bullet and stone sling ids resolve to the one canonical Sling", () => {
  const bullet = weaponRulesById("sling-bullet");
  const stone = weaponRulesById("sling-stone");
  assert.equal(bullet?.damageSM, "1d4+1");
  assert.equal(stone?.damageSM, "1d4+1");
  assert.equal(bullet?.proficiencyId, "sling");
  assert.equal(stone?.proficiencyId, "sling");
  assert.equal(bullet?.id, "sling");
  assert.equal(stone?.id, "sling");
  assert.equal(weaponRulesById("sling")?.name, "Sling");
});

test("legal weapon configuration presents one Sling choice", () => {
  for (const className of ["Druid", "Thief", "Fighter"]) {
    const slings = getLegalWeaponProficiencies(character(className)).filter((entry) => entry.proficiencyId === "sling");
    assert.deepEqual(slings.map((entry) => [entry.id, entry.name]), [["sling", "Sling"]]);
  }
});

test("legacy sling training merges without losing proficiency or specialization", () => {
  const migrated = reconcileOsricAutomation(character("Fighter", [
    { weaponRulesId:"sling-bullet", proficient:true, specialized:false },
    { weaponRulesId:"sling-stone", proficient:true, specialized:true },
  ]));
  assert.deepEqual(migrated.weaponTraining, [{ weaponRulesId:"sling", proficient:true, specialized:true, specializationOverride:false }]);
  assert.equal(trainingSlotsUsed(migrated.weaponTraining), 3);
  for (const id of ["sling-bullet", "sling-stone"]) {
    assert.deepEqual(getWeaponTrainingState(migrated, { name:weaponRulesById(id).name, weaponRulesId:id }), { weaponRulesId:"sling", proficient:true, specialized:true });
  }
});

test("Sling specialization adds no invented missile rate progression", () => {
  assert.equal(specializedMissileRate(weaponRulesById("sling-bullet"), 20, 1), 1);
  assert.equal(specializedMissileRate(weaponRulesById("sling-stone"), 20, 2), 1);
});
