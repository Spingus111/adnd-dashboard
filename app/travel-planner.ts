import type { TravelEncounterArea, TravelPlannerState, TravelTerrain } from "./types.ts";
import { rollSecureDie } from "./random.ts";

export const HEX_MILES = 6;
export const ACTIVE_HOURS_PER_DAY = 8;
export const FLUX_HOURS_PER_DAY = 1;
export const STANDARD_TRAVEL_START_HOUR = 8;
export const STANDARD_TRAVEL_END_HOUR = 16;
export const NAVIGATION_DIFFICULTY_TIME_MULTIPLIER = 0.5;
export const RESERVE_RATE = 0.30;
export const FORAGE_TRAVEL_TIME_PENALTY = 0.03;
export const GRAZE_TRAVEL_TIME_PENALTY = 0.02;
export const MASSIVE_CREATURE_BEASTS = 4;
export const POCKETS_PER_SACK = 4;
export const SACKS_PER_PACK = 10;
export const POCKETS_PER_PACK = POCKETS_PER_SACK * SACKS_PER_PACK;
export const INVENTORY_UNITS_PER_POCKET = 100;

export const PACK_CARRIER_CAPACITIES = {
  averageMan: 1,
  mule: 2,
  ox: 3,
  cart: 2,
  wagon: 8,
  wagonHorses: 2,
} as const;

type DmgTerrain = "Plain" | "Scrub" | "Forest" | "Desert" | "Hills" | "Mountains" | "Marsh";
export type EncounterPeriod = "Morning" | "Noon" | "Evening" | "Night" | "Midnight" | "Pre-Dawn";

export type TerrainRule = {
  id: TravelTerrain;
  label: string;
  shortLabel: string;
  speed: number;
  foodOffset: number;
  feedOffset: number;
  waterOffset: number;
  dmgTerrain: DmgTerrain;
  navigationChance: number;
  navigationDeviationMiles: number;
};

export const TERRAIN_RULES: Record<TravelTerrain, TerrainRule> = {
  road: { id: "road", label: "Road", shortLabel: "Road", speed: 1.5, foodOffset: 0, feedOffset: 0, waterOffset: 0, dmgTerrain: "Plain", navigationChance: 0, navigationDeviationMiles: 0 },
  farmland: { id: "farmland", label: "Farmland / Settled", shortLabel: "Farmland", speed: 1, foodOffset: .25, feedOffset: .5, waterOffset: 1, dmgTerrain: "Plain", navigationChance: .1, navigationDeviationMiles: 3 },
  clear: { id: "clear", label: "Clear / Grassland", shortLabel: "Clear", speed: 1, foodOffset: .1, feedOffset: 1, waterOffset: .5, dmgTerrain: "Plain", navigationChance: .1, navigationDeviationMiles: 3 },
  scrub: { id: "scrub", label: "Scrub", shortLabel: "Scrub", speed: .8, foodOffset: .1, feedOffset: .5, waterOffset: .25, dmgTerrain: "Scrub", navigationChance: .3, navigationDeviationMiles: 3 },
  "light-woods": { id: "light-woods", label: "Light Woods", shortLabel: "Lt. woods", speed: .8, foodOffset: .25, feedOffset: .75, waterOffset: .75, dmgTerrain: "Forest", navigationChance: .7, navigationDeviationMiles: 6 },
  forest: { id: "forest", label: "Forest", shortLabel: "Forest", speed: .67, foodOffset: .5, feedOffset: .75, waterOffset: 1, dmgTerrain: "Forest", navigationChance: .7, navigationDeviationMiles: 6 },
  hills: { id: "hills", label: "Hills", shortLabel: "Hills", speed: .67, foodOffset: .25, feedOffset: .5, waterOffset: .5, dmgTerrain: "Hills", navigationChance: .2, navigationDeviationMiles: 3 },
  mountains: { id: "mountains", label: "Mountains", shortLabel: "Mtns.", speed: .5, foodOffset: .1, feedOffset: .25, waterOffset: .75, dmgTerrain: "Mountains", navigationChance: .5, navigationDeviationMiles: 9 },
  swamp: { id: "swamp", label: "Swamp", shortLabel: "Swamp", speed: .5, foodOffset: .5, feedOffset: .75, waterOffset: 1, dmgTerrain: "Marsh", navigationChance: .6, navigationDeviationMiles: 6 },
  jungle: { id: "jungle", label: "Jungle", shortLabel: "Jungle", speed: .5, foodOffset: .75, feedOffset: 1, waterOffset: 1, dmgTerrain: "Forest", navigationChance: .7, navigationDeviationMiles: 6 },
  desert: { id: "desert", label: "Desert", shortLabel: "Desert", speed: .67, foodOffset: 0, feedOffset: 0, waterOffset: 0, dmgTerrain: "Desert", navigationChance: .4, navigationDeviationMiles: 3 },
  barren: { id: "barren", label: "Barren", shortLabel: "Barren", speed: .67, foodOffset: 0, feedOffset: .1, waterOffset: .1, dmgTerrain: "Desert", navigationChance: .4, navigationDeviationMiles: 3 },
};

export const TRAVEL_TERRAINS = Object.values(TERRAIN_RULES);

const DMG_CHECKS: Record<DmgTerrain, Set<EncounterPeriod>> = {
  Plain: new Set(["Morning", "Evening", "Midnight"]),
  Scrub: new Set(["Morning", "Evening", "Night", "Pre-Dawn"]),
  Forest: new Set(["Morning", "Noon", "Evening", "Night", "Midnight", "Pre-Dawn"]),
  Desert: new Set(["Morning", "Night", "Pre-Dawn"]),
  Hills: new Set(["Noon", "Night", "Pre-Dawn"]),
  Mountains: new Set(["Morning", "Night"]),
  Marsh: new Set(["Morning", "Noon", "Evening", "Night", "Midnight", "Pre-Dawn"]),
};

export const ENCOUNTER_DIE: Record<TravelEncounterArea, number> = {
  settled: 20,
  patrolled: 12,
  wilderness: 10,
};

export const PROVISION_PACK_DEFINITION = {
  catalogId: "catalog-travel-provision-pack",
  name: "Provision Pack",
} as const;

// Preserve the original price per Pocket while purchasing whole 4-Pocket Sacks.
export const PROVISION_SACK_PRICES = {
  rations: 4 * POCKETS_PER_SACK / 10,
  water: 0,
  feed: .25 * POCKETS_PER_SACK / 10,
} as const;

export type TravelSegment = {
  index: number;
  terrain: TravelTerrain;
  hexes: number;
  normalTravelDays: number;
  navigationDifficultyDays: number;
  effectiveNavigationChance: number;
  travelDays: number;
  activeHours: number;
  startActiveHour: number;
  endActiveHour: number;
};

export type TravelDaySlice = {
  terrain: TravelTerrain;
  startHour: number;
  endHour: number;
  hexes: number;
};

export type ScheduledEncounter = {
  id: string;
  dayIndex: number;
  period: EncounterPeriod;
  terrain: TravelTerrain;
  dmgTerrain: DmgTerrain;
  offsetHours: number;
  timestamp: Date;
};

export type ScheduledProvisionPack = {
  id: string;
  packNumber: number;
  dayIndex: number;
  offsetHours: number;
  timestamp: Date;
  terrain: TravelTerrain;
};

export type TravelDay = {
  index: number;
  start: Date;
  end: Date;
  activeHours: number;
  fluxHours: number;
  finalDay: boolean;
  slices: TravelDaySlice[];
  checks: ScheduledEncounter[];
  provisionMarkers: ScheduledProvisionPack[];
};

export type ProvisionLine = {
  baselineRaw: number;
  terrainOffsetRaw: number;
  reserveRaw: number;
  finalRaw: number;
  pockets: number;
  sacks: number;
  costGp: number;
};

export type ProvisionPackSummary = {
  sacks: number;
  packs: number;
  weightInventoryUnits: number;
  costGp: number;
  reserveRaw: number;
  roundingCreditRaw: number;
  effectiveReserveRaw: number;
};

export type TravelPlan = {
  segments: TravelSegment[];
  totalHexes: number;
  travelDays: number;
  navigationDifficultyDays: number;
  activeHours: number;
  fluxHoursUsed: number;
  departure: Date | null;
  arrival: Date | null;
  elapsedMinutes: number;
  campPeriods: number;
  days: TravelDay[];
  checks: ScheduledEncounter[];
  provisionMarkers: ScheduledProvisionPack[];
  encounterSignature: string;
  provisions: {
    rations: ProvisionLine;
    water: ProvisionLine;
    feed: ProvisionLine;
  };
  provisionPack: ProvisionPackSummary;
};

type TravelScheduleDay = {
  start: Date;
  activeHours: number;
  fluxHours: number;
};

function nonnegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

/** Navigation skill removes the same number of percentage points from a terrain's lost chance. */
export function navigationChanceAfterSkill(terrainChance: number, skillPercent: number) {
  const skillChance = Math.min(100, nonnegative(skillPercent)) / 100;
  return Math.max(0, nonnegative(terrainChance) - skillChance);
}

/**
 * A short final day may be spread across prior 8-hour travel days, up to one
 * extra hour on each. This changes the clock and camp count, not route cost.
 */
function scheduleTravelDaySlots(totalActiveHours: number, firstNormalHours = ACTIVE_HOURS_PER_DAY, firstMaximumHours = ACTIVE_HOURS_PER_DAY + FLUX_HOURS_PER_DAY) {
  const safeHours = nonnegative(totalActiveHours);
  if (safeHours <= 0) return [] as number[];
  const firstNormal = Math.max(0, Math.min(ACTIVE_HOURS_PER_DAY, firstNormalHours));
  const firstMaximum = Math.max(firstNormal, Math.min(ACTIVE_HOURS_PER_DAY + FLUX_HOURS_PER_DAY, firstMaximumHours));
  let dayCount = 1;
  while (safeHours > firstMaximum + (dayCount - 1) * (ACTIVE_HOURS_PER_DAY + FLUX_HOURS_PER_DAY) + 1e-9) dayCount += 1;
  const normalHours = [firstNormal, ...Array.from({ length: dayCount - 1 }, () => ACTIVE_HOURS_PER_DAY)];
  const maximumHours = [firstMaximum, ...Array.from({ length: dayCount - 1 }, () => ACTIVE_HOURS_PER_DAY + FLUX_HOURS_PER_DAY)];
  const normalCapacity = normalHours.reduce((sum, hours) => sum + hours, 0);
  if (safeHours <= normalCapacity + 1e-9) {
    let remaining = safeHours;
    return normalHours.map((hours) => {
      const used = Math.min(hours, remaining);
      remaining -= used;
      return used;
    });
  }
  let extra = safeHours - normalCapacity;
  return normalHours.map((hours, index) => {
    const remainingDays = dayCount - index;
    const added = Math.min(maximumHours[index] - hours, extra / remainingDays);
    extra -= added;
    return hours + added;
  });
}

export function scheduleTravelDayHours(totalActiveHours: number) {
  return scheduleTravelDaySlots(totalActiveHours).filter((hours) => hours > 1e-9);
}

/** Nearest whole Pocket; exact halves round down in the players' favor. */
export function roundPocketRequirement(value: number) {
  const safe = nonnegative(value);
  return Math.max(0, Math.floor(safe + .5 - Number.EPSILON * Math.max(1, safe)));
}

/** Whole Sacks required for a Pocket quantity. */
export function sacksForPockets(pockets: number) {
  const safe = Math.max(0, Math.trunc(nonnegative(pockets)));
  return safe <= 0 ? 0 : Math.ceil(safe / POCKETS_PER_SACK);
}

/** Nearest 10-Sack Pack; an exact five-Sack tie rounds down. */
export function packsForSacks(sacks: number) {
  const safe = Math.max(0, Math.trunc(nonnegative(sacks)));
  return safe <= 0 ? 0 : Math.max(1, Math.floor((safe + 4) / SACKS_PER_PACK));
}

export function normalizeRouteTerrains(distanceHexes: number, route: TravelTerrain[]) {
  const count = Math.ceil(nonnegative(distanceHexes));
  return Array.from({ length: count }, (_, index) => TERRAIN_RULES[route[index]] ? route[index] : "clear");
}

export function parseJourneyStart(dateText: string, timeText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) return null;
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date;
}

export function normalizeTravelStartTime(timeText: string) {
  if (!/^\d{2}:\d{2}$/.test(timeText)) return timeText;
  return timeText < "08:00" ? "08:00" : timeText;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function standardMorning(date: Date, dayOffset: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset, STANDARD_TRAVEL_START_HOUR, 0, 0, 0);
}

function buildTravelSchedule(totalActiveHours: number, departure: Date | null) {
  if (!departure || totalActiveHours <= 0) return [] as TravelScheduleDay[];
  const departureHour = departure.getHours() + departure.getMinutes() / 60;
  const firstNormalHours = Math.max(0, Math.min(ACTIVE_HOURS_PER_DAY, STANDARD_TRAVEL_END_HOUR - departureHour));
  const firstMaximumHours = Math.max(0, Math.min(ACTIVE_HOURS_PER_DAY + FLUX_HOURS_PER_DAY, STANDARD_TRAVEL_END_HOUR + FLUX_HOURS_PER_DAY - departureHour));
  const slots = scheduleTravelDaySlots(totalActiveHours, firstNormalHours, firstMaximumHours);
  return slots.flatMap((activeHours, slotIndex): TravelScheduleDay[] => {
    if (activeHours <= 1e-9) return [];
    const normalHours = slotIndex === 0 ? firstNormalHours : ACTIVE_HOURS_PER_DAY;
    return [{
      start: slotIndex === 0 ? departure : standardMorning(departure, slotIndex),
      activeHours,
      fluxHours: Math.max(0, activeHours - normalHours),
    }];
  });
}

function terrainAtActiveHour(segments: TravelSegment[], activeHour: number) {
  if (!segments.length) return "clear" as TravelTerrain;
  const safeHour = Math.max(0, Math.min(activeHour, segments[segments.length - 1].endActiveHour - 1e-8));
  return segments.find((segment) => safeHour >= segment.startActiveHour && safeHour < segment.endActiveHour)?.terrain ?? segments[segments.length - 1].terrain;
}

function itinerarySignature(state: TravelPlannerState, routeTerrains: TravelTerrain[]) {
  return JSON.stringify({
    distanceHexes: nonnegative(state.distanceHexes),
    speedHexesPerDay: nonnegative(state.speedHexesPerDay),
    startDate: state.startDate,
    startTime: normalizeTravelStartTime(state.startTime),
    routeTerrains,
    returnTrip: Boolean(state.returnTrip),
    forage: Boolean(state.forage),
    graze: Boolean(state.graze),
    navigationSkill: Math.min(100, nonnegative(state.navigationSkill)),
    encounterArea: state.encounterArea,
    scheduleVersion: "fixed-morning-restart-v3",
  });
}

function makeProvisionLine(baselineRaw: number, terrainOffsetRaw: number, pricePerSackGp: number, noReserve = false): ProvisionLine {
  const reserveRaw = noReserve ? 0 : baselineRaw * RESERVE_RATE;
  const finalRaw = Math.max(0, baselineRaw - terrainOffsetRaw + reserveRaw);
  const pockets = roundPocketRequirement(finalRaw);
  const sacks = sacksForPockets(pockets);
  return {
    baselineRaw,
    terrainOffsetRaw,
    reserveRaw,
    finalRaw,
    pockets,
    sacks,
    costGp: sacks * pricePerSackGp,
  };
}

function locateScheduledActiveHour(schedule: TravelScheduleDay[], activeHour: number) {
  let activeBeforeDay = 0;
  for (let dayIndex = 0; dayIndex < schedule.length; dayIndex += 1) {
    const dayEnd = activeBeforeDay + schedule[dayIndex].activeHours;
    if (activeHour <= dayEnd + 1e-9) {
      return { dayIndex, offsetHours: Math.max(0, Math.min(schedule[dayIndex].activeHours, activeHour - activeBeforeDay)) };
    }
    activeBeforeDay = dayEnd;
  }
  const dayIndex = Math.max(0, schedule.length - 1);
  return { dayIndex, offsetHours: schedule[dayIndex]?.activeHours ?? 0 };
}

function buildProvisionMarkers(segments: TravelSegment[], segmentConsumptionRaw: number[], departure: Date | null, packCount: number, schedule: TravelScheduleDay[]) {
  if (!departure || packCount <= 0) return [] as ScheduledProvisionPack[];
  const markers: ScheduledProvisionPack[] = [];
  let consumedBeforeSegment = 0;
  let packNumber = 1;

  for (let index = 0; index < segments.length && packNumber <= packCount; index += 1) {
    const segment = segments[index];
    const segmentConsumption = Math.max(0, segmentConsumptionRaw[index] ?? 0);
    const consumedAfterSegment = consumedBeforeSegment + segmentConsumption;
    while (packNumber <= packCount && packNumber * POCKETS_PER_PACK <= consumedAfterSegment + 1e-9) {
      const threshold = packNumber * POCKETS_PER_PACK;
      const progress = segmentConsumption > 0 ? Math.max(0, Math.min(1, (threshold - consumedBeforeSegment) / segmentConsumption)) : 0;
      const activeHour = segment.startActiveHour + segment.activeHours * progress;
      const { dayIndex, offsetHours } = locateScheduledActiveHour(schedule, activeHour);
      markers.push({
        id: `provision-pack-${packNumber}`,
        packNumber,
        dayIndex,
        offsetHours,
        timestamp: addHours(schedule[dayIndex].start, offsetHours),
        terrain: segment.terrain,
      });
      packNumber += 1;
    }
    consumedBeforeSegment = consumedAfterSegment;
  }
  return markers;
}

function buildItinerary(segments: TravelSegment[], departure: Date | null, schedule: TravelScheduleDay[], provisionMarkers: ScheduledProvisionPack[]) {
  const totalActiveHours = segments.reduce((sum, segment) => sum + segment.activeHours, 0);
  if (!departure || totalActiveHours <= 0) return { days: [] as TravelDay[], arrival: null as Date | null, elapsedMinutes: 0, campPeriods: 0 };
  const days: TravelDay[] = [];
  let activeStart = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const activeHours = schedule[index].activeHours;
    const activeEnd = activeStart + activeHours;
    const finalDay = index === schedule.length - 1;
    const start = schedule[index].start;
    const end = finalDay ? addHours(start, activeHours) : schedule[index + 1].start;
    const slices = segments.flatMap((segment): TravelDaySlice[] => {
      const overlapStart = Math.max(activeStart, segment.startActiveHour);
      const overlapEnd = Math.min(activeEnd, segment.endActiveHour);
      if (overlapEnd <= overlapStart) return [];
      const ratio = (overlapEnd - overlapStart) / segment.activeHours;
      return [{ terrain: segment.terrain, startHour: overlapStart - activeStart, endHour: overlapEnd - activeStart, hexes: segment.hexes * ratio }];
    });
    const candidates: Array<{ period: EncounterPeriod; offsetHours: number; terrain: TravelTerrain }> = [];
    const daytimePeriods: Array<[EncounterPeriod, number, number]> = [
      ["Morning", 1, 1],
      ["Noon", activeHours / 2, 4],
      ["Evening", Math.max(0, activeHours - 1), 7],
    ];
    for (const [period, offsetHours, minimumHours] of daytimePeriods) {
      if (activeHours >= minimumHours - 1e-9) candidates.push({ period, offsetHours, terrain: terrainAtActiveHour(segments, activeStart + offsetHours) });
    }
    if (!finalDay) {
      const campTerrain = terrainAtActiveHour(segments, activeEnd - 1e-8);
      const campHours = Math.max(0, (end.getTime() - start.getTime()) / 3600000 - activeHours);
      candidates.push(
        { period: "Night", offsetHours: activeHours + campHours / 6, terrain: campTerrain },
        { period: "Midnight", offsetHours: activeHours + campHours / 2, terrain: campTerrain },
        { period: "Pre-Dawn", offsetHours: activeHours + campHours * 5 / 6, terrain: campTerrain },
      );
    }
    const checks = candidates.flatMap((candidate): ScheduledEncounter[] => {
      const dmgTerrain = TERRAIN_RULES[candidate.terrain].dmgTerrain;
      if (!DMG_CHECKS[dmgTerrain].has(candidate.period)) return [];
      return [{
        id: `day-${index + 1}-${candidate.period.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        dayIndex: index,
        period: candidate.period,
        terrain: candidate.terrain,
        dmgTerrain,
        offsetHours: candidate.offsetHours,
        timestamp: addHours(start, candidate.offsetHours),
      }];
    });
    days.push({ index, start, end, activeHours, fluxHours: schedule[index].fluxHours, finalDay, slices, checks, provisionMarkers: provisionMarkers.filter((marker) => marker.dayIndex === index) });
    activeStart = activeEnd;
  }

  const arrival = days[days.length - 1].end;
  return {
    days,
    arrival,
    elapsedMinutes: Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 60000)),
    campPeriods: Math.max(0, days.length - 1),
  };
}

export function calculateTravelPlan(state: TravelPlannerState): TravelPlan {
  const distanceHexes = nonnegative(state.distanceHexes);
  const speedHexesPerDay = nonnegative(state.speedHexesPerDay);
  const routeTerrains = normalizeRouteTerrains(distanceHexes, state.routeTerrains ?? []);
  const outboundRoute = routeTerrains.map((terrain, index) => ({
    terrain,
    hexes: Math.min(1, Math.max(0, distanceHexes - index)),
  }));
  const plannedRoute = state.returnTrip
    ? [...outboundRoute, ...outboundRoute.toReversed()]
    : outboundRoute;
  const travelTimeMultiplier = 1 + (state.forage ? FORAGE_TRAVEL_TIME_PENALTY : 0) + (state.graze ? GRAZE_TRAVEL_TIME_PENALTY : 0);
  let cumulativeActiveHours = 0;
  const segments = speedHexesPerDay > 0 ? plannedRoute.map(({ terrain, hexes }, index): TravelSegment => {
    const rules = TERRAIN_RULES[terrain];
    const effectiveSpeed = speedHexesPerDay * rules.speed;
    const normalTravelDays = hexes / effectiveSpeed * travelTimeMultiplier;
    const effectiveNavigationChance = navigationChanceAfterSkill(rules.navigationChance, state.navigationSkill);
    const expectedDeviationHexes = hexes * effectiveNavigationChance * rules.navigationDeviationMiles / HEX_MILES;
    const navigationDifficultyDays = expectedDeviationHexes / effectiveSpeed * NAVIGATION_DIFFICULTY_TIME_MULTIPLIER;
    const travelDays = normalTravelDays + navigationDifficultyDays;
    const activeHours = travelDays * ACTIVE_HOURS_PER_DAY;
    const segment = { index, terrain, hexes, normalTravelDays, navigationDifficultyDays, effectiveNavigationChance, travelDays, activeHours, startActiveHour: cumulativeActiveHours, endActiveHour: cumulativeActiveHours + activeHours };
    cumulativeActiveHours += activeHours;
    return segment;
  }) : [];

  const humanoids = nonnegative(state.humanoids);
  const packBeasts = nonnegative(state.packBeasts);
  const camels = nonnegative(state.camels);
  const massiveCreatures = nonnegative(state.massiveCreatures);
  const feedPerDay = packBeasts * 2 + camels * 2 + massiveCreatures * MASSIVE_CREATURE_BEASTS * 2;
  const waterPerDay = humanoids * 2 + packBeasts * 4 + massiveCreatures * MASSIVE_CREATURE_BEASTS * 4;
  let foodBaseline = 0;
  let foodOffset = 0;
  let feedBaseline = 0;
  let feedOffset = 0;
  let waterBaseline = 0;
  let waterOffset = 0;
  const segmentConsumptionRaw: number[] = [];
  for (const segment of segments) {
    const rules = TERRAIN_RULES[segment.terrain];
    const segmentFood = humanoids * segment.travelDays;
    const segmentFeed = feedPerDay * segment.travelDays;
    const segmentWater = waterPerDay * segment.travelDays;
    foodBaseline += segmentFood;
    feedBaseline += segmentFeed;
    waterBaseline += segmentWater;
    const segmentFoodOffset = state.forage ? segmentFood * rules.foodOffset : 0;
    const segmentFeedOffset = state.graze ? segmentFeed * rules.feedOffset : 0;
    const segmentWaterOffset = state.naturalWater ? segmentWater * rules.waterOffset : 0;
    foodOffset += segmentFoodOffset;
    feedOffset += segmentFeedOffset;
    waterOffset += segmentWaterOffset;
    segmentConsumptionRaw.push(Math.max(0, segmentFood - segmentFoodOffset + segmentFeed - segmentFeedOffset + segmentWater - segmentWaterOffset));
  }

  const departure = distanceHexes > 0 && speedHexesPerDay > 0 ? parseJourneyStart(state.startDate, normalizeTravelStartTime(state.startTime)) : null;
  const travelDays = segments.reduce((sum, segment) => sum + segment.travelDays, 0);
  const navigationDifficultyDays = segments.reduce((sum, segment) => sum + segment.navigationDifficultyDays, 0);
  const provisions = {
    rations: makeProvisionLine(foodBaseline, foodOffset, PROVISION_SACK_PRICES.rations, state.noReserve),
    water: makeProvisionLine(waterBaseline, waterOffset, PROVISION_SACK_PRICES.water, state.noReserve),
    feed: makeProvisionLine(feedBaseline, feedOffset, PROVISION_SACK_PRICES.feed, state.noReserve),
  };
  const provisionLines = Object.values(provisions);
  const provisionSacks = provisionLines.reduce((sum, line) => sum + line.sacks, 0);
  const provisionPacks = packsForSacks(provisionSacks);
  const reserveRaw = provisionLines.reduce((sum, line) => sum + line.reserveRaw, 0);
  const finalRaw = provisionLines.reduce((sum, line) => sum + line.finalRaw, 0);
  // Spare capacity created only when the combined rounding goes upward counts
  // toward the expedition reserve instead of demanding still more provisions.
  const roundingCreditRaw = Math.min(reserveRaw, Math.max(0, provisionPacks * POCKETS_PER_PACK - finalRaw));
  const costGp = provisionLines.reduce((sum, line) => sum + line.costGp, 0);
  const schedule = buildTravelSchedule(cumulativeActiveHours, departure);
  const provisionMarkers = buildProvisionMarkers(segments, segmentConsumptionRaw, departure, provisionPacks, schedule);
  const itinerary = buildItinerary(segments, departure, schedule, provisionMarkers);
  return {
    segments,
    totalHexes: plannedRoute.reduce((sum, segment) => sum + segment.hexes, 0),
    travelDays,
    navigationDifficultyDays,
    activeHours: travelDays * ACTIVE_HOURS_PER_DAY,
    fluxHoursUsed: itinerary.days.reduce((sum, day) => sum + day.fluxHours, 0),
    departure,
    arrival: itinerary.arrival,
    elapsedMinutes: itinerary.elapsedMinutes,
    campPeriods: itinerary.campPeriods,
    days: itinerary.days,
    checks: itinerary.days.flatMap((day) => day.checks),
    provisionMarkers,
    encounterSignature: itinerarySignature(state, routeTerrains),
    provisions,
    provisionPack: {
      sacks: provisionSacks,
      packs: provisionPacks,
      weightInventoryUnits: provisionPacks * POCKETS_PER_PACK * INVENTORY_UNITS_PER_POCKET,
      costGp,
      reserveRaw,
      roundingCreditRaw,
      effectiveReserveRaw: Math.max(0, reserveRaw - roundingCreditRaw),
    },
  };
}

export function encounterRoll(area: TravelEncounterArea) {
  const die = ENCOUNTER_DIE[area];
  return rollSecureDie(die);
}
