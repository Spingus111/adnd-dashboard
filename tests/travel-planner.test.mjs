import assert from "node:assert/strict";
import test from "node:test";

import { defaultTravelPlanner } from "../app/types.ts";
import { calculateTravelPlan, navigationChanceAfterSkill, NAVIGATION_DIFFICULTY_TIME_MULTIPLIER, normalizeTravelStartTime, packsForSacks, PACK_CARRIER_CAPACITIES, PROVISION_SACK_PRICES, roundPocketRequirement, sacksForPockets, scheduleTravelDayHours, TERRAIN_RULES } from "../app/travel-planner.ts";

test("Pockets become 4-Pocket Sacks and combined Sacks become 10-Sack Packs", () => {
  assert.equal(roundPocketRequirement(4.49), 4);
  assert.equal(roundPocketRequirement(4.5), 4);
  assert.equal(roundPocketRequirement(4.51), 5);
  assert.equal(sacksForPockets(0), 0);
  assert.equal(sacksForPockets(1), 1);
  assert.equal(sacksForPockets(4), 1);
  assert.equal(sacksForPockets(5), 2);
  assert.equal(packsForSacks(0), 0);
  assert.equal(packsForSacks(4 + 3 + 1), 1);
  assert.equal(packsForSacks(15), 1);
  assert.equal(packsForSacks(16), 2);
  assert.equal(packsForSacks(25), 2);
  assert.equal(packsForSacks(26), 3);
});

test("Sack prices preserve the prior per-Pocket provision prices", () => {
  assert.equal(PROVISION_SACK_PRICES.rations, 1.6);
  assert.equal(PROVISION_SACK_PRICES.feed, .1);
  assert.equal(PROVISION_SACK_PRICES.water, 0);
});

test("Pack carrying comparisons use the expedition capacities", () => {
  assert.deepEqual(PACK_CARRIER_CAPACITIES, {
    averageMan: 1,
    mule: 2,
    ox: 3,
    cart: 2,
    wagon: 8,
    wagonHorses: 2,
  });
});

test("one terrain-time model drives travel, provisions, weight, and arrival", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 5,
    speedHexesPerDay: 4,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["clear", "clear", "forest", "forest", "mountains"],
    navigationSkill: 100,
    humanoids: 4,
    packBeasts: 2,
  };
  const plan = calculateTravelPlan(planner);
  const expectedDays = (.5 + 2 / (4 * .67) + .5) * 1.05;
  assert.ok(Math.abs(plan.travelDays - expectedDays) < 1e-9);
  assert.equal(plan.segments.length, 5);
  assert.equal(plan.days.length, 2);
  assert.equal(plan.campPeriods, 1);
  assert.ok(plan.arrival);
  assert.equal(plan.elapsedMinutes, Math.round((expectedDays * 8 + 16) * 60));
  assert.equal(plan.provisionPack.sacks, plan.provisions.rations.sacks + plan.provisions.water.sacks + plan.provisions.feed.sacks);
  assert.equal(plan.provisionPack.weightInventoryUnits, plan.provisionPack.packs * 4000);
});

test("reserve is based on baseline before terrain offsets", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 1,
    speedHexesPerDay: 1 / .67,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["forest"],
    navigationSkill: 100,
    humanoids: 10,
    forage: true,
    naturalWater: true,
  };
  const plan = calculateTravelPlan(planner);
  assert.equal(plan.provisions.rations.baselineRaw, 10.5);
  assert.equal(plan.provisions.rations.terrainOffsetRaw, 5.25);
  assert.equal(plan.provisions.rations.reserveRaw, 3.15);
  assert.equal(plan.provisions.rations.pockets, 8);
  assert.equal(plan.provisions.water.baselineRaw, 21);
  assert.equal(plan.provisions.water.terrainOffsetRaw, 21);
  assert.equal(plan.provisions.water.reserveRaw, 6.3);
  assert.equal(plan.provisions.water.pockets, 6);
  assert.ok(plan.provisionPack.roundingCreditRaw > 0);
  assert.equal(plan.provisionPack.effectiveReserveRaw, Math.max(0, plan.provisionPack.reserveRaw - plan.provisionPack.roundingCreditRaw));
});

test("foraging and grazing add five percent total time, while no reserve removes reserve units", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 1,
    speedHexesPerDay: 1,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["road"],
    humanoids: 10,
    packBeasts: 1,
    forage: true,
    graze: true,
    naturalWater: false,
    noReserve: true,
  };
  const plan = calculateTravelPlan(planner);
  assert.ok(Math.abs(plan.travelDays - .7) < 1e-9);
  assert.equal(plan.provisions.rations.reserveRaw, 0);
  assert.equal(plan.provisions.water.reserveRaw, 0);
  assert.equal(plan.provisions.feed.reserveRaw, 0);
  assert.equal(plan.provisionPack.roundingCreditRaw, 0);
  assert.equal(plan.provisionPack.effectiveReserveRaw, 0);
});

test("partial final days stop checks and timeline at arrival", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 1,
    speedHexesPerDay: 4,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["clear"],
    navigationSkill: 100,
    humanoids: 1,
  };
  const plan = calculateTravelPlan(planner);
  assert.equal(plan.activeHours, 2.1);
  assert.equal(plan.days.length, 1);
  assert.equal(plan.days[0].checks.length, 1);
  assert.equal(plan.days[0].checks[0].period, "Morning");
  assert.equal(plan.campPeriods, 0);
  assert.equal(plan.elapsedMinutes, 126);
});

test("one hour of daily flux absorbs short final days without reducing provisions", () => {
  assert.deepEqual(scheduleTravelDayHours(8 + 41 / 60), [8 + 41 / 60]);
  assert.deepEqual(scheduleTravelDayHours(16 + 41 / 60), [8 + 41 / 120, 8 + 41 / 120]);
  assert.deepEqual(scheduleTravelDayHours(17), [8.5, 8.5]);
  assert.deepEqual(scheduleTravelDayHours(18), [9, 9]);
  assert.deepEqual(scheduleTravelDayHours(18.1), [8, 8, 2.1000000000000014]);

  const plan = calculateTravelPlan({
    ...defaultTravelPlanner(),
    distanceHexes: 3.1875,
    speedHexesPerDay: 1,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["road", "road", "road", "road"],
    navigationSkill: 100,
    humanoids: 1,
    forage: false,
    graze: false,
    naturalWater: false,
  });
  assert.equal(plan.travelDays, 2.125);
  assert.equal(plan.provisions.rations.baselineRaw, 2.125, "flux must not erase provision consumption");
  assert.deepEqual(plan.days.map((day) => day.activeHours), [8.5, 8.5]);
  assert.equal(plan.fluxHoursUsed, 1);
  assert.equal(plan.campPeriods, 1);
  assert.equal(plan.elapsedMinutes, 1950);
});

test("a late first departure shortens day one and later travel resumes in the morning", () => {
  assert.equal(normalizeTravelStartTime("06:30"), "08:00");
  assert.equal(normalizeTravelStartTime("08:00"), "08:00");
  assert.equal(normalizeTravelStartTime("14:00"), "14:00");
  const plan = calculateTravelPlan({
    ...defaultTravelPlanner(),
    distanceHexes: 3.1875,
    speedHexesPerDay: 1,
    startDate: "2026-08-18",
    startTime: "14:00",
    routeTerrains: ["road", "road", "road", "road"],
    navigationSkill: 100,
    humanoids: 1,
    forage: false,
    graze: false,
    naturalWater: false,
  });
  assert.equal(plan.activeHours, 17);
  assert.deepEqual(plan.days.map((day) => day.activeHours), [2, 8, 7]);
  assert.equal(plan.days[0].start.getHours(), 14);
  assert.equal(plan.days[1].start.getHours(), 8);
  assert.equal(plan.days[2].start.getHours(), 8);
  assert.equal(plan.campPeriods, 2);
  assert.equal(plan.provisions.rations.baselineRaw, 2.125);

  const early = calculateTravelPlan({ ...defaultTravelPlanner(), distanceHexes: 1, speedHexesPerDay: 1, startDate: "2026-08-18", startTime: "06:00", routeTerrains: ["road"] });
  assert.equal(early.departure?.getHours(), 8);
});

test("timeline marks only Provision Packs actually consumed during the planned journey", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 6,
    speedHexesPerDay: 1,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: Array(6).fill("road"),
    humanoids: 10,
    forage: false,
    graze: false,
    naturalWater: false,
  };
  const plan = calculateTravelPlan(planner);
  assert.equal(plan.provisionPack.packs, 4);
  assert.deepEqual(plan.provisionMarkers.map(({ packNumber, dayIndex }) => [packNumber, dayIndex]), [[1, 1], [2, 2], [3, 3]]);
  assert.ok(Math.abs(plan.provisionMarkers[0].offsetHours - 8 / 3) < 1e-9);
  assert.equal(plan.days[1].provisionMarkers[0].id, "provision-pack-1");
  assert.ok(Math.abs(plan.provisionMarkers[2].offsetHours - 8) < 1e-9);

  const lightPlan = calculateTravelPlan({ ...planner, humanoids: 1 });
  assert.equal(lightPlan.provisionPack.packs, 1);
  assert.equal(lightPlan.provisionMarkers.length, 0, "unused reserve capacity should not be shown as consumed");
});

test("navigation difficulty uses AD&D terrain chances and expected directional deviation", () => {
  assert.equal(NAVIGATION_DIFFICULTY_TIME_MULTIPLIER, .5);
  assert.deepEqual(Object.fromEntries(Object.entries(TERRAIN_RULES).map(([terrain, rule]) => [terrain, [rule.navigationChance, rule.navigationDeviationMiles]])), {
    road: [0, 0], farmland: [.1, 3], clear: [.1, 3], scrub: [.3, 3],
    "light-woods": [.7, 6], forest: [.7, 6], hills: [.2, 3], mountains: [.5, 9],
    swamp: [.6, 6], jungle: [.7, 6], desert: [.4, 3], barren: [.4, 3],
  });

  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 1,
    speedHexesPerDay: 4,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["clear"],
    humanoids: 1,
    forage: false,
    graze: false,
  };
  const unskilled = calculateTravelPlan(planner);
  const skilled = calculateTravelPlan({ ...planner, navigationSkill: 10 });

  assert.ok(Math.abs(unskilled.segments[0].normalTravelDays - .25) < 1e-9);
  assert.ok(Math.abs(unskilled.navigationDifficultyDays - .00625) < 1e-9);
  assert.ok(Math.abs(unskilled.travelDays - .25625) < 1e-9);
  assert.equal(unskilled.provisions.rations.baselineRaw, unskilled.travelDays);
  assert.equal(skilled.segments[0].normalTravelDays, unskilled.segments[0].normalTravelDays);
  assert.equal(skilled.navigationDifficultyDays, 0);
  assert.equal(skilled.travelDays, .25);

  assert.equal(navigationChanceAfterSkill(.2, 0), .2);
  assert.equal(navigationChanceAfterSkill(.2, 10), .1);
  assert.equal(navigationChanceAfterSkill(.2, 20), 0);
  assert.equal(navigationChanceAfterSkill(.2, 40), 0);

  const unskilledHills = calculateTravelPlan({ ...planner, routeTerrains: ["hills"], navigationSkill: 0 });
  const halfSkilledHills = calculateTravelPlan({ ...planner, routeTerrains: ["hills"], navigationSkill: 10 });
  const fullySkilledHills = calculateTravelPlan({ ...planner, routeTerrains: ["hills"], navigationSkill: 20 });
  assert.ok(Math.abs(halfSkilledHills.navigationDifficultyDays - unskilledHills.navigationDifficultyDays / 2) < 1e-9);
  assert.equal(fullySkilledHills.navigationDifficultyDays, 0);
});

test("return trips reverse the route and double canonical travel requirements", () => {
  const planner = {
    ...defaultTravelPlanner(),
    distanceHexes: 2.5,
    speedHexesPerDay: 4,
    startDate: "2026-08-18",
    startTime: "08:00",
    routeTerrains: ["road", "forest", "mountains"],
    humanoids: 4,
    packBeasts: 1,
  };
  const outbound = calculateTravelPlan(planner);
  const roundTrip = calculateTravelPlan({ ...planner, returnTrip: true });

  assert.deepEqual(roundTrip.segments.map(({ terrain, hexes }) => [terrain, hexes]), [
    ["road", 1], ["forest", 1], ["mountains", .5],
    ["mountains", .5], ["forest", 1], ["road", 1],
  ]);
  assert.equal(roundTrip.totalHexes, 5);
  assert.ok(Math.abs(roundTrip.travelDays - outbound.travelDays * 2) < 1e-9);
  for (const category of ["rations", "water", "feed"]) {
    assert.ok(Math.abs(roundTrip.provisions[category].baselineRaw - outbound.provisions[category].baselineRaw * 2) < 1e-9);
    assert.ok(Math.abs(roundTrip.provisions[category].terrainOffsetRaw - outbound.provisions[category].terrainOffsetRaw * 2) < 1e-9);
    assert.ok(Math.abs(roundTrip.provisions[category].reserveRaw - outbound.provisions[category].reserveRaw * 2) < 1e-9);
  }
});
