"use client";

import { useMemo, useState } from "react";
import { formatStoneUnits, normalizeInventoryManagement } from "./inventory-management.ts";
import { formatGpAsPrice } from "./currency.ts";
import {
  calculateTravelPlan,
  encounterRoll,
  ENCOUNTER_DIE,
  HEX_MILES,
  PACK_CARRIER_CAPACITIES,
  PROVISION_PACK_DEFINITION,
  TERRAIN_RULES,
  TRAVEL_TERRAINS,
  normalizeRouteTerrains,
  normalizeTravelStartTime,
  navigationChanceAfterSkill,
  type ProvisionLine,
  type ScheduledEncounter,
  type TravelDay,
} from "./travel-planner.ts";
import { defaultTravelPlanner } from "./types.ts";
import type { CampaignState, TravelPlannerState, TravelTerrain } from "./types.ts";
import { sharedId } from "./shared-id";

type Props = { campaign: CampaignState; setCampaign: React.Dispatch<React.SetStateAction<CampaignState>> };

function id() {
  return sharedId();
}

function nonnegative(value: string, integer = false) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, integer ? Math.trunc(number) : number);
}

function roundToHalf(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.round((safe + Number.EPSILON) * 2) / 2;
}

function displayNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatMoney(valueGp: number) { return formatGpAsPrice(valueGp, "Free"); }

function formatDayPeriod(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 8 && hour < 11) return "Morning";
  if (hour >= 11 && hour < 14) return "Noon";
  if (hour >= 14 && hour < 18) return "Evening";
  if (hour >= 18 && hour < 22) return "Night";
  if (hour >= 22 || hour < 2) return "Midnight";
  return "Dawn";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
}

function formatDateTime(date: Date | null) {
  return date ? `${formatDate(date)} • ${formatDayPeriod(date)}` : "—";
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0 hr";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  return [days ? `${days} day${days === 1 ? "" : "s"}` : "", hours ? `${hours} hr` : "", remainder ? `${remainder} min` : ""].filter(Boolean).join(" ");
}

function carrierCount(packs: number, capacity: number, singular: string, plural: string) {
  const count = packs > 0 ? Math.ceil(packs / capacity) : 0;
  return `${count} ${count === 1 ? singular : plural}`;
}

function rawPockets(value: number) {
  return displayNumber(value, 2);
}

function resultState(check: ScheduledEncounter, rolls: Record<string, number>) {
  const roll = rolls[check.id];
  return roll == null ? "unrolled" : roll === 1 ? "encounter" : "clear";
}

function markerLabel(period: ScheduledEncounter["period"]) {
  return period === "Pre-Dawn" ? "Dawn" : period;
}

function ProvisionResult({ label, line }: { label: string; line: ProvisionLine }) {
  return <div className="travel-result-line"><span>{label}</span><strong>{line.sacks} Sack{line.sacks === 1 ? "" : "s"}</strong><small>{line.pockets} Pockets • {formatMoney(line.costGp)}</small></div>;
}

function TimelineDay({ day, die, rolls, selectedCheckId, onSelect }: { day: TravelDay; die: number; rolls: Record<string, number>; selectedCheckId: string | null; onSelect: (id: string) => void }) {
  const timelineHours = day.finalDay ? Math.max(day.activeHours, 1) : Math.max(day.activeHours, (day.end.getTime() - day.start.getTime()) / 3600000);
  // A full day gives active travel visual priority while preserving all camp checks.
  const travelWidth = day.finalDay ? 100 : 62;
  const timePosition = (hour: number) => {
    if (day.finalDay) return Math.min(100, hour / timelineHours * 100);
    if (hour <= day.activeHours) return Math.min(travelWidth, hour / Math.max(day.activeHours, 1) * travelWidth);
    return travelWidth + Math.min(100 - travelWidth, (hour - day.activeHours) / Math.max(timelineHours - day.activeHours, 1) * (100 - travelWidth));
  };
  const distanceHexes = day.slices.reduce((sum, slice) => sum + slice.hexes, 0);
  const firstTerrain = day.slices[0]?.terrain;
  const lastTerrain = day.slices[day.slices.length - 1]?.terrain;
  const selected = day.checks.find((check) => check.id === selectedCheckId);
  const encounters = day.checks.filter((check) => rolls[check.id] === 1).length;
  return <article className="travel-day">
    <header>
      <span><b>Day {day.index + 1} · {formatDate(day.start)}</b><small>{formatDayPeriod(day.start)} → {formatDayPeriod(day.end)}</small></span>
      <small>{displayNumber(distanceHexes * HEX_MILES, 1)} mi • {displayNumber(distanceHexes, 2)} hex{distanceHexes === 1 ? "" : "es"} • {firstTerrain ? TERRAIN_RULES[firstTerrain].shortLabel : "—"}{lastTerrain && lastTerrain !== firstTerrain ? ` → ${TERRAIN_RULES[lastTerrain].shortLabel}` : ""}</small>
      <small>{day.finalDay ? `Arrive ${formatDayPeriod(day.end)}` : `Camp ${formatDayPeriod(new Date(day.start.getTime() + day.activeHours * 3600000))}`} • {day.checks.length} check{day.checks.length === 1 ? "" : "s"}{encounters ? ` • ${encounters} encounter${encounters === 1 ? "" : "s"}` : ""}</small>
    </header>
    <div className="travel-timeline-scroll">
      <div className="travel-time-strip">
        <div className="travel-time-zone" style={{ width: `${travelWidth}%` }}><span>Travel</span></div>
        {!day.finalDay && <div className="travel-camp-zone" style={{ left: `${travelWidth}%`, width: `${100 - travelWidth}%` }}><span>Camp / Rest</span></div>}
        {day.slices.map((slice, index) => <div className={`travel-terrain-slice terrain-${slice.terrain}`} key={`${slice.terrain}-${index}`} style={{ left: `${timePosition(slice.startHour)}%`, width: `${Math.max(0, timePosition(slice.endHour) - timePosition(slice.startHour))}%` }}><small>{TERRAIN_RULES[slice.terrain].shortLabel}</small></div>)}
        {day.checks.map((check) => {
          const state = resultState(check, rolls);
          return <button key={check.id} type="button" className={`travel-check-marker ${state}${selectedCheckId === check.id ? " selected" : ""}`} style={{ left: `${Math.min(98, timePosition(check.offsetHours))}%` }} aria-label={`${markerLabel(check.period)} encounter check`} onClick={() => onSelect(check.id)}><span>{markerLabel(check.period)}</span></button>;
        })}
        {day.provisionMarkers.map((marker) => <span key={marker.id} className="travel-provision-marker" style={{ left: `${Math.min(98, timePosition(marker.offsetHours))}%` }} title={`Provision Pack ${marker.packNumber} consumed • ${formatDayPeriod(marker.timestamp)} • ${TERRAIN_RULES[marker.terrain].label}`} aria-label={`Provision Pack ${marker.packNumber} consumed in the ${formatDayPeriod(marker.timestamp)}`}>PRO {marker.packNumber}</span>)}
      </div>
    </div>
    {selected && <div className={`travel-check-detail ${resultState(selected, rolls)}`}><b>{selected.period === "Pre-Dawn" ? "Dawn" : selected.period}</b><span>{formatDayPeriod(selected.timestamp)} • {TERRAIN_RULES[selected.terrain].label} • {selected.dmgTerrain}</span><span>{rolls[selected.id] == null ? `d${die} • Unrolled` : `d${die} → ${rolls[selected.id]} • ${rolls[selected.id] === 1 ? "Encounter" : "No encounter"}`}</span></div>}
  </article>;
}

export default function TravelPanel({ campaign, setCampaign }: Props) {
  const activeCampaignId = campaign.activeCharacterCampaignId;
  const stored = campaign.travelByCampaign?.[activeCampaignId];
  const planner = useMemo<TravelPlannerState>(() => {
    const merged = { ...defaultTravelPlanner(), ...(stored ?? {}) };
    return { ...merged, startTime: normalizeTravelStartTime(merged.startTime), routeTerrains: normalizeRouteTerrains(merged.distanceHexes, merged.routeTerrains ?? []) };
  }, [stored]);
  const plan = useMemo(() => calculateTravelPlan(planner), [planner]);
  const [applyTerrain, setApplyTerrain] = useState<TravelTerrain>("clear");
  const [notice, setNotice] = useState("");
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);
  const rolls = planner.encounterSignature === plan.encounterSignature ? planner.encounterRolls : {};
  const totalPacks = plan.provisionPack.packs;
  const totalWeight = plan.provisionPack.weightInventoryUnits;
  const totalCost = plan.provisionPack.costGp;
  const provisionLoadReadout = [
    carrierCount(totalPacks, PACK_CARRIER_CAPACITIES.averageMan, "average man", "average men"),
    carrierCount(totalPacks, PACK_CARRIER_CAPACITIES.mule, "mule", "mules"),
    carrierCount(totalPacks, PACK_CARRIER_CAPACITIES.ox, "ox", "oxen"),
    carrierCount(totalPacks, PACK_CARRIER_CAPACITIES.cart, "push cart", "push carts"),
    carrierCount(totalPacks, PACK_CARRIER_CAPACITIES.wagon, "wagon", "wagons"),
  ].join(" · ");
  const rolledCount = plan.checks.filter((check) => rolls[check.id] != null).length;
  const encounterCount = plan.checks.filter((check) => rolls[check.id] === 1).length;
  const navigationChanceReadout = Array.from(new Set(planner.routeTerrains)).map((terrain) => {
    const baseChance = TERRAIN_RULES[terrain].navigationChance;
    const effectiveChance = navigationChanceAfterSkill(baseChance, planner.navigationSkill);
    return `${TERRAIN_RULES[terrain].shortLabel} ${displayNumber(baseChance * 100, 0)}% → ${displayNumber(effectiveChance * 100, 0)}%`;
  }).join(" · ") || "—";

  function updatePlanner(patch: Partial<TravelPlannerState>, invalidateEncounters = false) {
    setCampaign((current) => {
      const base = { ...defaultTravelPlanner(), ...(current.travelByCampaign?.[current.activeCharacterCampaignId] ?? {}) };
      const next = { ...base, ...patch };
      if (invalidateEncounters) {
        next.encounterRolls = {};
        next.encounterSignature = "";
      }
      return { ...current, travelByCampaign: { ...(current.travelByCampaign ?? {}), [current.activeCharacterCampaignId]: next } };
    });
    if (invalidateEncounters) setSelectedCheckId(null);
    setNotice("");
  }

  function updateDistance(hexes: number) {
    const distanceHexes = roundToHalf(hexes);
    updatePlanner({ distanceHexes, routeTerrains: normalizeRouteTerrains(distanceHexes, planner.routeTerrains) }, true);
  }

  function rollEncounters() {
    const encounterRolls = Object.fromEntries(plan.checks.map((check) => [check.id, encounterRoll(planner.encounterArea)]));
    updatePlanner({ encounterRolls, encounterSignature: plan.encounterSignature });
    setNotice(`${plan.checks.length} encounter check${plan.checks.length === 1 ? "" : "s"} rolled.`);
  }

  function addPacksToShoppingList() {
    if (!totalPacks) return setNotice("No Packs are required for this journey.");
    setCampaign((current) => {
      const inventory = normalizeInventoryManagement(current.inventoryManagement, current.characters, current.activeCharacterCampaignId);
      const shoppingCart = inventory.shoppingCart.map((line) => ({ ...line }));
      const existing = shoppingCart.find((line) => line.campaignId === current.activeCharacterCampaignId && line.catalogId === PROVISION_PACK_DEFINITION.catalogId);
      if (existing) {
        const combinedQuantity = existing.quantity + totalPacks;
        existing.priceGp = (existing.priceGp * existing.quantity + totalCost) / combinedQuantity;
        existing.quantity = combinedQuantity;
      } else {
        shoppingCart.push({ id: id(), campaignId: current.activeCharacterCampaignId, catalogId: PROVISION_PACK_DEFINITION.catalogId, name: PROVISION_PACK_DEFINITION.name, category: "Travel Provisions", priceGp: totalCost / totalPacks, quantity: totalPacks });
      }
      return { ...current, inventoryManagement: { ...inventory, shoppingCart } };
    });
    setNotice(`${totalPacks} Pack${totalPacks === 1 ? "" : "s"} added to the Shopping bill.`);
  }

  const travelerFields: Array<[keyof Pick<TravelPlannerState, "humanoids" | "smallAnimals" | "packBeasts" | "camels" | "massiveCreatures">, string]> = [
    ["humanoids", "Humanoids"], ["smallAnimals", "Small animals"], ["packBeasts", "Pack beasts"], ["camels", "Camels"], ["massiveCreatures", "Massive creatures"],
  ];

  return <section className="section-stack travel-panel">
    {notice && <div className="notice" role="status">{notice}</div>}

    <section className="panel travel-journey-inputs">
      <div className="travel-section-heading"><h2>Journey</h2><div className="travel-heading-actions"><small>1 hex = 6 miles • one travel day = 8 active hours</small><button type="button" className={planner.returnTrip ? "active" : ""} aria-pressed={planner.returnTrip} disabled={!planner.distanceHexes} onClick={() => updatePlanner({ returnTrip: !planner.returnTrip }, true)}>{planner.returnTrip ? "Return trip included" : "Plan return trip"}</button></div></div>
      <div className="travel-journey-grid">
        <fieldset><legend>Distance</legend><label>Hexes<input type="number" min="0" step="1" value={roundToHalf(planner.distanceHexes)} onChange={(event) => updateDistance(nonnegative(event.target.value))} /></label><label>Miles<input type="number" min="0" step="1" value={roundToHalf(planner.distanceHexes * HEX_MILES)} onChange={(event) => updateDistance(nonnegative(event.target.value) / HEX_MILES)} /></label></fieldset>
        <fieldset><legend>Party speed</legend><label>Hexes / day<input type="number" min="0" step="1" value={roundToHalf(planner.speedHexesPerDay)} onChange={(event) => updatePlanner({ speedHexesPerDay: roundToHalf(nonnegative(event.target.value)) }, true)} /></label><label>Miles / day<input type="number" min="0" step="1" value={roundToHalf(planner.speedHexesPerDay * HEX_MILES)} onChange={(event) => updatePlanner({ speedHexesPerDay: roundToHalf(nonnegative(event.target.value) / HEX_MILES) }, true)} /></label></fieldset>
        <fieldset><legend>Departure</legend><label>Start date<input type="date" value={planner.startDate} onChange={(event) => updatePlanner({ startDate: event.target.value }, true)} /></label><label>Start time<input type="time" min="08:00" value={planner.startTime} onChange={(event) => updatePlanner({ startTime: normalizeTravelStartTime(event.target.value) }, true)} /></label></fieldset>
      </div>
      {planner.distanceHexes > 0 && planner.speedHexesPerDay <= 0 && <p className="travel-validation" role="status">Enter a movement speed greater than zero.</p>}
      {planner.distanceHexes > 0 && planner.speedHexesPerDay > 0 && !plan.departure && <p className="travel-validation" role="status">Enter a valid start date and time.</p>}
    </section>

    <section className="panel travel-route-panel">
      <div className="travel-section-heading"><h2>Route terrain</h2><div className="travel-apply-all"><select aria-label="Terrain to apply to all route hexes" value={applyTerrain} onChange={(event) => setApplyTerrain(event.target.value as TravelTerrain)}>{TRAVEL_TERRAINS.map((terrain) => <option key={terrain.id} value={terrain.id}>{terrain.label}</option>)}</select><button type="button" disabled={!planner.routeTerrains.length} onClick={() => updatePlanner({ routeTerrains: planner.routeTerrains.map(() => applyTerrain) }, true)}>Apply to all</button><button type="button" disabled={planner.routeTerrains.length < 2} onClick={() => updatePlanner({ routeTerrains: [...planner.routeTerrains].reverse() }, true)}>Reverse order</button></div></div>
      {planner.routeTerrains.length === 0 ? <p className="compact-empty">Enter a distance to build the route.</p> : <div className="travel-route-grid">{planner.routeTerrains.map((terrain, index) => {
        const segmentHexes = Math.min(1, Math.max(0, planner.distanceHexes - index));
        return <label key={index}><span>{index + 1}{segmentHexes < 1 ? ` • ${displayNumber(segmentHexes, 2)} hex` : ""}</span><select value={terrain} onChange={(event) => { const routeTerrains = [...planner.routeTerrains]; routeTerrains[index] = event.target.value as TravelTerrain; updatePlanner({ routeTerrains }, true); }}>{TRAVEL_TERRAINS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>;
      })}</div>}
    </section>

    <section className="panel travel-logistics-panel">
      <div className="travel-section-heading"><h2>Travelers &amp; assumptions</h2></div>
      <div className="travel-traveler-grid">{travelerFields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" step="1" value={planner[key]} onChange={(event) => updatePlanner({ [key]: nonnegative(event.target.value, true) })} /></label>)}</div>
      <div className="travel-assumptions">
        <label><input type="checkbox" checked={planner.forage} onChange={(event) => updatePlanner({ forage: event.target.checked }, true)} />Forage <small>+3% time</small></label>
        <label><input type="checkbox" checked={planner.graze} onChange={(event) => updatePlanner({ graze: event.target.checked }, true)} />Graze <small>+2% time</small></label>
        <label><input type="checkbox" checked={planner.naturalWater} onChange={(event) => updatePlanner({ naturalWater: event.target.checked })} />Natural water</label>
        <label className="travel-no-reserve"><input type="checkbox" checked={planner.noReserve} onChange={(event) => updatePlanner({ noReserve: event.target.checked })} />No reserve</label>
        <label className="travel-navigation-skill">Navigation skill<input aria-label="Navigation skill percentage" type="number" min="0" max="100" step="1" value={planner.navigationSkill} onChange={(event) => updatePlanner({ navigationSkill: Math.min(100, nonnegative(event.target.value, true)) }, true)} /><small>%</small></label>
        <label>Encounter area<select value={planner.encounterArea} onChange={(event) => updatePlanner({ encounterArea: event.target.value as TravelPlannerState["encounterArea"] }, true)}><option value="settled">Settled · 1 in 20</option><option value="patrolled">Patrolled · 1 in 12</option><option value="wilderness">Wilderness · 1 in 10</option></select></label>
      </div>
    </section>

    <section className="panel travel-results-panel">
      <div className="travel-journey-summary">
        <span><small>Journey</small><b>{displayNumber(plan.totalHexes * HEX_MILES, 1)} miles • {displayNumber(plan.totalHexes, 2)} hex{plan.totalHexes === 1 ? "" : "es"}{planner.returnTrip ? " • round trip" : ""}</b></span>
        <span><small>Travel time</small><b>{plan.travelDays ? `${displayNumber(plan.travelDays, 2)} travel days` : "0 travel days"}</b><em>{formatDuration(plan.elapsedMinutes)} • navigation difficulty time {formatDuration(Math.round(plan.navigationDifficultyDays * 8 * 60))}</em></span>
        <span><small>Depart</small><b>{formatDateTime(plan.departure)}</b></span>
        <span><small>Arrive</small><b>{formatDateTime(plan.arrival)}</b></span>
        <span><small>Encounters</small><b>{rolledCount ? `${encounterCount} encounters • ${plan.checks.length} checks` : `${plan.checks.length} encounter checks`}</b></span>
      </div>
      <div className="travel-pack-results">
        <ProvisionResult label="Rations" line={plan.provisions.rations} />
        <ProvisionResult label="Water" line={plan.provisions.water} />
        <ProvisionResult label="Feed" line={plan.provisions.feed} />
        <div className="travel-result-line total"><span>Combined provisions</span><strong>{totalPacks} Pack{totalPacks === 1 ? "" : "s"}</strong><small>{plan.provisionPack.sacks} Sacks • {formatStoneUnits(totalWeight)} • {formatMoney(totalCost)}</small></div>
      </div>
      <div className="travel-result-actions"><small className="travel-provision-load">Load: {provisionLoadReadout}</small><button type="button" className="primary-button" disabled={!totalPacks} onClick={addPacksToShoppingList}>Add Packs to Shopping List</button></div>
      <details className="travel-details"><summary>Details</summary><div className="travel-details-grid">
        {(["rations", "water", "feed"] as const).map((key) => { const line = plan.provisions[key]; return <div key={key}><b>{key === "rations" ? "Food" : key[0].toUpperCase() + key.slice(1)}</b><span>Baseline <strong>{rawPockets(line.baselineRaw)} Pockets</strong></span><span>Terrain <strong>−{rawPockets(line.terrainOffsetRaw)}</strong></span><span>Reserve <strong>+{rawPockets(line.reserveRaw)}</strong></span><span>Final <strong>{line.pockets} Pockets</strong></span><span>Sack conversion <strong>{line.sacks}</strong></span></div>; })}
        <div><b>Pack conversion</b><span>Combined <strong>{plan.provisionPack.sacks} Sacks</strong></span><span>Pack scale <strong>10 Sacks</strong></span><span>Final <strong>{totalPacks} Pack{totalPacks === 1 ? "" : "s"}</strong></span><span>Reserve target <strong>{rawPockets(plan.provisionPack.reserveRaw)} Pockets</strong></span><span>Rounding credit <strong>−{rawPockets(plan.provisionPack.roundingCreditRaw)}</strong></span><span>Reserve after credit <strong>{rawPockets(plan.provisionPack.effectiveReserveRaw)}</strong></span></div>
        <div><b>Journey</b><span>Active travel <strong>{displayNumber(plan.activeHours, 2)} hr</strong></span><span>Flux used <strong>{displayNumber(plan.fluxHoursUsed, 2)} hr · 1 hr/day maximum</strong></span><span>Navigation difficulty time <strong>{formatDuration(Math.round(plan.navigationDifficultyDays * 8 * 60))}</strong></span><span>Navigation time scale <strong>50% of expected deviation</strong></span><span>Navigation skill <strong>{planner.navigationSkill}%</strong></span><span>Terrain chances after skill <strong>{navigationChanceReadout}</strong></span><span>Total elapsed <strong>{formatDuration(plan.elapsedMinutes)}</strong></span><span>Camp/rest periods <strong>{plan.campPeriods}</strong></span><span>Encounter checks <strong>{plan.checks.length}</strong></span><span>Small animals <strong>{planner.smallAnimals} in reserve</strong></span></div>
      </div></details>
    </section>

    <section className="panel travel-timeline-panel">
      <div className="travel-section-heading"><h2>Journey timeline</h2><div className="travel-encounter-actions"><button type="button" disabled={!plan.checks.length} onClick={rollEncounters}>Roll Encounters</button>{rolledCount > 0 && <button type="button" className="text-button" onClick={rollEncounters}>Reroll</button>}</div></div>
      {!plan.days.length ? <p className="compact-empty">Complete the distance, speed, and departure fields to create the itinerary.</p> : <div className="travel-days">{plan.days.map((day) => <TimelineDay key={day.index} day={day} die={ENCOUNTER_DIE[planner.encounterArea]} rolls={rolls} selectedCheckId={selectedCheckId} onSelect={(checkId) => setSelectedCheckId((current) => current === checkId ? null : checkId)} />)}</div>}
    </section>
  </section>;
}
