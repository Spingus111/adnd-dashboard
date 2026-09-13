import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { siteCatalog } from "../app/catalog-data.ts";
import { emptyCampaign } from "../app/types.ts";
import { armorCategoryToAscendingAc, ascendingAcToArmorCategory, getHandsRequired, phbShoppingWeapons, weaponCanMakeMissileAttack, weaponHandednessHint, weaponIsThrown, weaponRulesById } from "../app/weapon-rules.ts";
import { naturalArmorProfiles, normalizeMonsterArmorProfile, wornArmorProfile, wornArmorProfiles } from "../app/monster-armor.ts";
import {
  attackInstrumentLabel,
  compareEstablishedMeleeSpeed,
  compareInitialChargeReach,
  engagedOpponentIds,
  establishEngagement,
  getAttackSpeedFactor,
  getSpeedFactorAttackCount,
  getWeaponDamageForTarget,
  getWeaponVsArmorModifier,
  isDaggerLengthWeapon,
  normalizeEngagements,
  physicalArmorCategory,
  removeEngagement,
  weaponReachFeet,
  wereEngagedAtStartOfRound,
} from "../app/weapon-combat-rules.ts";

const participant = (patch = {}) => ({
  id: "participant", kind: "enemy", markerNumber: 1, name: "Participant", hitDice: "2", attackBonus: 0,
  armorClass: 14, currentHp: 10, maxHp: 10, nonIntelligent: false, armoredHead: true, joinedRound: 1,
  side: "opposition", action: "melee", actionDetail: "", castingTime: 1, holdSegment: 6, specializedRof: 2,
  segmentModifier: 0, initiativeRoll: 3, subInitiativeRoll: 4, scheduledSegment: 3, declarationRound: 1,
  completedEvents: [], statusNote: "", ready: true, targetId: null, targetIds: [], areaOfEffect: false,
  preparedSpellSlotId: null, damageExpression: "1d8", onslaughtAttacks: [], equippedWeaponId: null,
  pendingWeaponId: null, resolutions: {}, armorMode: "natural", attackMode: "natural", naturalSpeed: "normal",
  weaponRulesId: null, large: false, ...patch,
});

test("combat result labels identify manufactured, natural, and unarmed attacks", () => {
  const hero = participant({ kind: "character", characterId: "hero" });
  assert.equal(attackInstrumentLabel(hero, { id: "spear", name: "Spear", attackBonus: 0, damage: "1d6", notes: "", category: "melee", specialized: false, weaponRulesId: "spear" }), "Spear");
  assert.equal(attackInstrumentLabel(hero, { id: "unarmed", name: "Unarmed", attackBonus: 0, damage: "1d2", notes: "", category: "melee", specialized: false }), "an unarmed strike");
  assert.equal(attackInstrumentLabel(participant({ attackMode: "natural" })), "a natural attack");
  assert.equal(attackInstrumentLabel(participant({ attackMode: "weapon", weaponRulesId: "spear" })), "Spear");
});

test("the canonical PHB catalogue carries exact speed, damage, reach, and armour records", () => {
  const dagger = weaponRulesById("dagger");
  const sword = weaponRulesById("long-sword");
  const pike = weaponRulesById("awl-pike");
  assert.deepEqual([dagger?.damageSM, dagger?.damageL, dagger?.speedFactor], ["1d4", "1d3", 2]);
  assert.deepEqual([sword?.length, sword?.spaceRequired, sword?.armorAdjustments[2], sword?.armorAdjustments[10]], ["c. 3½ ft", "3 ft", -2, 2]);
  assert.equal(pike?.speedFactor, 13);
});

test("canonical OSRIC strength thresholds determine melee weapon handedness", () => {
  const strength = (score) => ({ stats: [String(score)] });
  const cases = [
    ["broad-sword", 12], ["footmans-mace", 13], ["footmans-flail", 14],
    ["footmans-pick", 14], ["trident", 14], ["battle-axe", 15],
    ["bastard-sword", 15], ["lucern-hammer", 15], ["morning-star", 16],
  ];
  for (const [id, threshold] of cases) {
    const rules = weaponRulesById(id);
    assert.equal(rules?.normalHands, 2, id);
    assert.equal(rules?.oneHandedAtStrength, threshold, id);
    assert.equal(getHandsRequired(rules, strength(threshold - 1)), 2, `${id} below threshold`);
    assert.equal(getHandsRequired(rules, strength(threshold)), 1, `${id} at threshold`);
  }
  assert.equal(getHandsRequired(weaponRulesById("spear"), strength(3)), 1);
  assert.equal(weaponRulesById("spear")?.allowsOptionalTwoHanded, true);
  for (const id of ["two-handed-sword", "halberd", "quarterstaff", "glaive"]) {
    assert.equal(getHandsRequired(weaponRulesById(id), strength(18)), 2, id);
  }
});

test("magical variants inherit handedness through their canonical base id", () => {
  const magicBastardSword = { name: "Bastard Sword +2", weaponRulesId: "bastard-sword", twoHanded: true };
  assert.equal(getHandsRequired(magicBastardSword, { stats: ["14"] }), 2);
  assert.equal(getHandsRequired(magicBastardSword, { stats: ["15"] }), 1);
  assert.equal(weaponHandednessHint(magicBastardSword, { stats: ["15"] }), "1H — STR 15+ requirement met");
});

test("dagger-length house rule converts inch lengths and accepts only short melee weapons", () => {
  assert.equal(weaponReachFeet(weaponRulesById("dagger")), 1.25);
  assert.equal(isDaggerLengthWeapon(weaponRulesById("dagger")), true);
  assert.equal(isDaggerLengthWeapon(weaponRulesById("hand-axe")), true);
  assert.equal(isDaggerLengthWeapon(weaponRulesById("long-sword")), false);
  assert.equal(isDaggerLengthWeapon(weaponRulesById("short-bow")), false);
});

test("weapon armour categories use the dashboard ascending AC labels", () => {
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8, 9, 10].map((category) => armorCategoryToAscendingAc(category)), [19, 18, 17, 16, 15, 14, 13, 12, 11]);
  assert.equal(ascendingAcToArmorCategory(19), 2);
  assert.equal(ascendingAcToArmorCategory(18), 3);
  assert.equal(ascendingAcToArmorCategory(14), 7);
});

test("PHB melee weapons that can be hurled also qualify for missile declarations", () => {
  for (const id of ["hand-axe", "club", "dagger", "hammer", "spear"]) {
    const rules = weaponRulesById(id);
    assert.equal(rules?.weaponType, "melee");
    assert.equal(weaponCanMakeMissileAttack({ category: "melee", weaponRulesId: id }), true);
    assert.equal(weaponIsThrown({ weaponRulesId: id }), true);
    assert.ok(rules?.missileRanges);
  }
  assert.equal(weaponIsThrown({ weaponRulesId: "javelin" }), true);
  assert.equal(weaponIsThrown({ weaponRulesId: "long-bow" }), false);
});

test("Shopping exposes only Players Handbook weapons and keeps canonical rule ids", () => {
  const listed = siteCatalog.filter((item) => item.category === "Weapons");
  assert.equal(listed.length, phbShoppingWeapons.length);
  assert.equal(listed.every((item) => weaponRulesById(item.weaponRulesId)?.shopping), true);
  assert.equal(listed.some((item) => item.name === "Blowgun" || item.name === "Great axe"), false);
  assert.equal(listed.some((item) => item.name === "Bec de corbin"), true);
});

test("natural armour bypasses weapon adjustment and worn monster armour uses entered AAC", () => {
  const sword = weaponRulesById("long-sword");
  const natural = participant({ armorClass: 18, armorMode: "natural" });
  const worn = participant({ armorClass: 18, armorMode: "worn" });
  assert.equal(getWeaponVsArmorModifier(sword, natural, emptyCampaign), 0);
  assert.equal(getWeaponVsArmorModifier(sword, worn, emptyCampaign), -1);
});

test("monster body profiles apply physical armour matchups without replacing displayed AC", () => {
  const sword = weaponRulesById("long-sword");
  assert.equal(getWeaponVsArmorModifier(sword, participant({ armorMode: "natural", armorProfile: "flesh", armorClass: 18 }), emptyCampaign), 0);
  assert.equal(getWeaponVsArmorModifier(sword, participant({ armorMode: "natural", armorProfile: "hide", armorClass: 18 }), emptyCampaign), sword?.armorAdjustments[9]);
  assert.equal(getWeaponVsArmorModifier(sword, participant({ armorMode: "natural", armorProfile: "scales", armorClass: 20 }), emptyCampaign), sword?.armorAdjustments[7]);
  assert.equal(getWeaponVsArmorModifier(sword, participant({ armorMode: "natural", armorProfile: "scales", armorClass: 8 }), emptyCampaign), sword?.armorAdjustments[7]);
  assert.equal(getWeaponVsArmorModifier(sword, participant({ armorMode: "natural", armorProfile: "plates", armorClass: 22 }), emptyCampaign), sword?.armorAdjustments[4]);
});

test("worn monster armour presets alternate armour and shield from weakest to strongest", () => {
  assert.deepEqual(wornArmorProfiles.slice(0, 4).map((profile) => [profile.id, profile.ascendingAc]), [
    ["padded", 12], ["padded-shield", 13], ["leather", 12], ["leather-shield", 13],
  ]);
  assert.equal(wornArmorProfile("plate-shield")?.ascendingAc, 18);
  assert.equal(wornArmorProfile("full-plate-shield")?.armorCategory, 2);
  assert.deepEqual(naturalArmorProfiles.map((profile) => profile.id), ["flesh", "hide", "scales", "plates"]);
  assert.equal(normalizeMonsterArmorProfile("worn", undefined, 17), "plate");
});

test("PC armour matchup uses physical armour and shield rather than effective AC", () => {
  const character = { id: "hero", campaignId: "default", name: "Hero", armorClass: 23 };
  const campaign = {
    ...emptyCampaign,
    characters: [character],
    inventoryManagement: {
      ...emptyCampaign.inventoryManagement,
      owners: [{ id: "owner", campaignId: "default", name: "Hero", type: "character", capacityUnits: 1000, characterId: "hero" }],
      containers: [{ id: "worn", campaignId: "default", name: "Worn", capacityUnits: 0, tareWeightUnits: 0, holderType: "owner", holderId: "owner", containerType: "worn", intrinsic: true, movable: false }],
      stacks: [
        { id: "plate", campaignId: "default", name: "Plate armor", quantity: 1, unitEncumbranceUnits: 800, encumbranceClass: "sack", itemKind: "normal", containerId: "worn", equipment: { kind: "armor", ascendingAc: 17 } },
        { id: "shield", campaignId: "default", name: "Shield", quantity: 1, unitEncumbranceUnits: 100, encumbranceClass: "pocket", itemKind: "normal", containerId: "worn", equipment: { kind: "shield", shieldBonus: 1 } },
      ],
    },
  };
  const target = participant({ id: "hero-combatant", kind: "character", characterId: "hero", armorClass: null });
  assert.equal(physicalArmorCategory(campaign, target), 3);
  assert.equal(getWeaponVsArmorModifier(weaponRulesById("long-sword"), target, campaign), -1);
});

test("engagement is bidirectional, persistent, and only established on later rounds", () => {
  const roundOne = establishEngagement([], "fighter", "ogre", 1);
  assert.equal(wereEngagedAtStartOfRound(roundOne, "fighter", "ogre", 1), false);
  assert.equal(wereEngagedAtStartOfRound(roundOne, "ogre", "fighter", 2), true);
  assert.equal(normalizeEngagements([...roundOne, { attackerId: "ogre", defenderId: "fighter", createdRound: 2 }]).length, 1);
  assert.equal(removeEngagement(roundOne, "ogre").length, 0);
});

test("engagements remain many-to-many when several combatants share opponents", () => {
  let engagements = establishEngagement([], "fighter-a", "ogre", 1);
  engagements = establishEngagement(engagements, "fighter-b", "ogre", 1);
  engagements = establishEngagement(engagements, "fighter-a", "troll", 1);
  assert.deepEqual(new Set(engagedOpponentIds(engagements, "fighter-a")), new Set(["ogre", "troll"]));
  assert.deepEqual(new Set(engagedOpponentIds(engagements, "ogre")), new Set(["fighter-a", "fighter-b"]));
  assert.equal(engagements.length, 3);
});

test("weapon speed grants only the PHB threshold count on an established final melee attack", () => {
  const count = (attackerSpeedFactor, targetSpeedFactor, finalMeleeAttack = true, engagedAtRoundStart = true) => getSpeedFactorAttackCount({ melee: true, engagedAtRoundStart, finalMeleeAttack, attackerSpeedFactor, targetSpeedFactor });
  assert.equal(count(2, 11), 2);
  assert.equal(count(2, 6), 2);
  assert.equal(count(2, 13), 3);
  assert.equal(count(11, 2), 1);
  assert.equal(count(2, 13, false), 1);
  assert.equal(count(2, 13, true, false), 1);
});

test("natural speed categories and large-target weapon damage use their canonical values", () => {
  assert.equal(getAttackSpeedFactor(participant({ naturalSpeed: "fast" })), 2);
  assert.equal(getAttackSpeedFactor(participant({ naturalSpeed: "normal" })), 6);
  assert.equal(getAttackSpeedFactor(participant({ naturalSpeed: "slow" })), 11);
  assert.equal(getAttackSpeedFactor(participant({ attackMode: "weapon", weaponRulesId: "long-sword" })), 5);
  assert.equal(getWeaponDamageForTarget(weaponRulesById("long-sword"), participant({ large: true }), "1d8"), "1d12");
  assert.equal(getWeaponDamageForTarget(weaponRulesById("long-sword"), participant({ size: "huge", large: false }), "1d8"), "1d12");
  assert.equal(getWeaponDamageForTarget(weaponRulesById("long-sword"), participant({ size: "medium", large: true }), "1d8"), "1d8");
});

test("enemy setup exposes the complete canonical melee and missile catalogue", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /phbWeaponRules\.map\(\(rules\)/);
  assert.doesNotMatch(source, /phbWeaponRules\.filter\(\(rules\) => rules\.weaponType === "melee"\)/);
  for (const id of ["long-bow", "short-bow", "heavy-crossbow", "light-crossbow", "sling-bullet"]) assert.ok(weaponRulesById(id));
});

test("weapon speed replaces the within-segment d6 only for established mutual melee ties", () => {
  assert.equal(compareEstablishedMeleeSpeed({ sameSegment: true, mutualTargets: true, engagedAtRoundStart: true, leftSpeedFactor: 2, rightSpeedFactor: 5 }), -3);
  assert.equal(compareEstablishedMeleeSpeed({ sameSegment: true, mutualTargets: true, engagedAtRoundStart: false, leftSpeedFactor: 2, rightSpeedFactor: 5 }), 0);
  assert.equal(compareEstablishedMeleeSpeed({ sameSegment: true, mutualTargets: false, engagedAtRoundStart: true, leftSpeedFactor: 2, rightSpeedFactor: 5 }), 0);
});

test("weapon length orders only the initial mutual-charge and charge-versus-set exchanges", () => {
  const compare = (leftAction, rightAction, leftReach, rightReach, engagedAtRoundStart = false, mutualTargets = true) => compareInitialChargeReach({
    leftAction, rightAction, leftReach, rightReach, engagedAtRoundStart, mutualTargets,
  });
  assert.equal(compare("charge", "charge", 10, 4), -6);
  assert.equal(compare("charge", "set-charge", 14, 8), -6);
  assert.equal(compare("set-charge", "charge", 8, 14), 6);
  assert.equal(compare("charge", "melee", 14, 4), 0);
  assert.equal(compare("charge", "charge", 10, 4, true), 0);
  assert.equal(compare("charge", "set-charge", 10, 4, false, false), 0);
});

test("Combat limits speed multiplication to its final generated melee event", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /function isFinalMeleeEvent/);
  assert.match(source, /attacks\.at\(-1\)\?\.key === event\.key/);
  assert.match(source, /monster-onslaught-/);
  assert.match(source, /weapon-speed-/);
});

test("weapon-speed attacks use one stationary attack and damage control", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /attack-unified-button/);
  assert.match(source, /ROLL \$\{attackCount\} ATTACKS/);
  assert.match(source, /Roll double damage/);
  assert.match(source, /rollAttackGroupDamage\(participant, event, hitCount/);
  assert.doesNotMatch(source, /speed-attack-results/);
});

test("Combat blocks engaged missile use and establishes contact only at its resolution segment", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /cannot use a missile weapon while engaged/);
  assert.match(source, /function engageAtResolution/);
  assert.match(source, /participant\.action === "charge" && event\.key === "charge-attack"/);
  assert.match(source, /participant\.action === "close-hurl" && event\.key === "close-hurl-attack"/);
  assert.match(source, /engaged \? "ENGAGED" : "ENGAGE"/);
  assert.match(source, /const movementOnlyActions: SegmentedAction\[\] = \["move", "flee"\]/);
  assert.doesNotMatch(source, /const engagements = participants\.reduce/);
  assert.match(source, /throwOneStackToGround/);
});

test("enemy setup keeps armour traits together and derives damage from the selected weapon", async () => {
  const source = await readFile(new URL("../app/segmented-initiative-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /monster-armour-setup/);
  assert.match(source, /monster-traits/);
  assert.match(source, /damageExpression: rules\.damageSM/);
  assert.match(source, /Reroll current and maximum HP from Hit Dice/);
});
