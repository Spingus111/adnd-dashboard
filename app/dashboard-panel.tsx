"use client";

import { useRef, useState } from "react";
import type {
  CampaignState,
  DashboardState,
  EncounterCheck,
  LightSource,
} from "./types";
import { characterTileStyle } from "./tile-color";
import { sendChatAction } from "./chat-events";
import HpBar from "./hp-bar";
import HpMathInput from "./hp-math-input";
import { availableCharacterWeapons } from "./character-weapons";
import { baseMarchCapacity, visibleMarchCapacity } from "./marching-order";
import { saveIcons } from "./save-icons";
import CharacterNameLink from "./character-navigation";
import MarkdownNotes from "./markdown-notes";
import { handStateForWeapon, handStateHasLight, handStateOptions, weaponForHandState } from "./hand-states";
import { effectiveArmorMovementRate, encumbranceSummary, partyEncumbranceSurpriseModifier } from "./movement";
import { characterCoinGp, formatStoneUnits, getOwnerCapacityUnits, getOwnerUsedUnits } from "./inventory-management";
import { preparedSpells } from "./spellcasting";
import { derivedAbilityItems } from "./osric-stats";
import { formatGpAsPrice } from "./currency";
import { rollSecureDie, secureRandomIndex } from "./random";
import ResponsiveDisclosure from "./responsive-disclosure";
import { sharedId } from "./shared-id";
import { getWeaponTrainingState } from "./osric-advancement";

type MarchEntity =
  | { kind: "character"; id: string; name: string; currentHp: number; maxHp: number; armorClass: number; movementRate: number; character: CampaignState["characters"][number] }
  | { kind: "npc"; id: string; name: string; currentHp: number; maxHp: number; armorClass: number; movementRate: number; token: string };

function marchEntity(campaign: CampaignState, entityId: string): MarchEntity | undefined {
  const character = campaign.characters.find((entry) => entry.id === entityId && entry.campaignId === campaign.activeCharacterCampaignId);
  if (character && campaign.missionCharacterIds.includes(entityId)) return { kind: "character", id: character.id, name: character.name, currentHp: character.currentHp, maxHp: character.maxHp, armorClass: character.armorClass, movementRate: character.movementRate, character };
  const npc = campaign.stableNpcs.find((entry) => entry.id === entityId && entry.campaignId === campaign.activeCharacterCampaignId);
  if (npc && campaign.expeditionNpcIds.includes(entityId)) return { kind: "npc", id: npc.id, name: npc.name, currentHp: npc.currentHp, maxHp: npc.maxHp, armorClass: npc.armorClass, movementRate: npc.movementRate, token: npc.token };
  return undefined;
}

function activeExpeditionEntity(campaign: CampaignState, entityId: string) {
  return campaign.missionCharacterIds.includes(entityId) && campaign.characters.some((entry) => entry.id === entityId && entry.campaignId === campaign.activeCharacterCampaignId)
    || campaign.expeditionNpcIds.includes(entityId) && campaign.stableNpcs.some((entry) => entry.id === entityId && entry.campaignId === campaign.activeCharacterCampaignId);
}

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
};

function id() {
  return sharedId();
}

function physicalHandSummary(campaign: CampaignState, characterId: string) {
  const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
  const quick = owner ? campaign.inventoryManagement.containers.find((entry) => entry.containerType === "quick-access" && entry.holderType === "owner" && entry.holderId === owner.id) : undefined;
  if (!quick) return null;
  const held = (slot: "main" | "offhand") => campaign.inventoryManagement.stacks.find((entry) => entry.containerId === quick.id && entry.handSlot === slot)?.name ?? "Empty";
  return `Hand 1: ${held("main")} · Hand 2: ${held("offhand")}`;
}

function characterEncumbrance(campaign: CampaignState, character: CampaignState["characters"][number]) {
  const owner = campaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
  const movementRate = effectiveArmorMovementRate(campaign, character);
  if (!owner) return encumbranceSummary(movementRate, 0, Number.MAX_SAFE_INTEGER, true);
  const worn = campaign.inventoryManagement.containers.find((entry) => entry.containerType === "worn" && entry.holderType === "owner" && entry.holderId === owner.id);
  const bestArmor = worn ? Math.max(10, ...campaign.inventoryManagement.stacks.filter((entry) => entry.containerId === worn.id && entry.equipment?.kind === "armor").map((entry) => Number(entry.equipment?.ascendingAc) || 10)) : 10;
  return encumbranceSummary(movementRate, getOwnerUsedUnits(campaign.inventoryManagement, owner.id), getOwnerCapacityUnits(owner, campaign.characters), bestArmor < 15);
}

function partyEffectiveSurpriseChance(campaign: CampaignState, characters: CampaignState["characters"][number][]) {
  const modifier = partyEncumbranceSurpriseModifier(characters.map((character) => characterEncumbrance(campaign, character)));
  return Math.max(1, Math.min(6, campaign.dashboard.partySurpriseChance - modifier));
}

const statLabels = [
  { icon: "💪", label: "STR" },
  { icon: "🎯", label: "DEX" },
  { icon: "❤️", label: "CON" },
  { icon: "🧠", label: "INT" },
  { icon: "🦉", label: "WIS" },
  { icon: "🎭", label: "CHA" },
];

function formatMinutes(total: number) {
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
    .filter(Boolean)
    .join(" ") || "0m";
}

function formatCampaignTime(startTime: string, elapsedMinutes: number) {
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "Set starting time";
  const total = Number(match[1]) * 60 + Number(match[2]) + elapsedMinutes;
  const day = Math.floor(total / 1440) + 1;
  const hour = Math.floor((total % 1440) / 60);
  const minute = total % 60;
  return `Day ${day} · ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function money(value: number) {
  return formatGpAsPrice(value);
}

function rollDie(size: number) {
  return rollSecureDie(size);
}

function rollDice(count: number, size: number) {
  return Array.from({ length: count }, () => rollDie(size));
}

function reactionFor(total: number) {
  if (total <= 5) return "Very hostile";
  if (total <= 25) return "Hostile";
  if (total <= 45) return "Unfavorable";
  if (total <= 55) return "Neutral";
  if (total <= 75) return "Favorable";
  if (total <= 95) return "Friendly";
  return "Very friendly";
}

function numericModifier(value: string | number | undefined) {
  const parsed = Number(String(value ?? "0").replaceAll("−", "-").replace(/[^0-9+.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEncounterCheck(
  campaign: CampaignState,
  dashboard: DashboardState,
  crawlNumber: number,
  checkRoll: number | null,
  forced = false,
  partySurpriseChance = dashboard.partySurpriseChance,
): EncounterCheck {
  const mode = dashboard.crawlStepMinutes === 10 ? "dungeon" : "open";
  const tableDieSize = Math.max(2, dashboard.encounterTableDieSize);
  const frontIds = dashboard.marchColumns === 1
    ? dashboard.marchingOrderIds.slice(0, 1)
    : dashboard.marchingOrderSlots.slice(0, dashboard.marchColumns).filter((entry): entry is string => Boolean(entry));
  const frontCharacters = frontIds.map((characterId) => campaign.characters.find((character) => character.id === characterId)).filter((character): character is CampaignState["characters"][number] => Boolean(character));
  const frontCharacter = frontCharacters.length ? frontCharacters[secureRandomIndex(frontCharacters.length)] : undefined;
  const reactionModifier = frontCharacter ? numericModifier(derivedAbilityItems(5, frontCharacter.stats[5]).find((item) => item.key === "reaction")?.value) : 0;
  const reactionRoll = rollDie(100);
  const reactionTotal = Math.max(1, Math.min(100, reactionRoll + reactionModifier));
  const foesSurpriseChance = Math.max(1, Math.min(6, dashboard.foesSurpriseChance));
  partySurpriseChance = Math.max(1, Math.min(6, partySurpriseChance));
  const foesSurpriseRoll = rollDie(6);
  const partySurpriseRoll = rollDie(6);
  const distanceSurprised = foesSurpriseRoll <= foesSurpriseChance
    || partySurpriseRoll <= partySurpriseChance;
  const distanceDieSize = distanceSurprised ? 3 : 4;
  const distanceModifier = distanceSurprised ? 0 : 4;
  const distanceRolls = [rollDie(distanceDieSize)];
  const distance = (distanceRolls[0] + distanceModifier) * 10;
  return {
    id: id(),
    crawlNumber,
    dieSize: Math.max(2, dashboard.encounterDieSize),
    roll: checkRoll,
    encounter: true,
    forced,
    mode,
    tableDieSize,
    tableRoll: rollDie(tableDieSize),
    reactionRolls: [reactionRoll, reactionModifier],
    reactionTotal,
    reaction: reactionFor(reactionTotal),
    distanceRolls,
    distanceDieSize,
    distanceModifier,
    distanceSurprised,
    distance,
    distanceUnit: mode === "dungeon" ? "feet" : "yards",
    foesSurpriseRoll,
    partySurpriseRoll,
    foesSurpriseChance,
    partySurpriseChance,
  };
}

function buildScheduledCheck(campaign: CampaignState, dashboard: DashboardState, crawlNumber: number, rest = false, partySurpriseChance = dashboard.partySurpriseChance): EncounterCheck {
  const every = Math.max(1, dashboard.encounterEvery);
  const dieSize = Math.max(2, dashboard.encounterDieSize);
  const encounterDue = crawlNumber % every === 0;
  const roll = encounterDue ? rollDie(dieSize) : null;
  if (roll === 1) return { ...buildEncounterCheck(campaign, dashboard, crawlNumber, roll, false, partySurpriseChance), rest };
  return {
    id: id(),
    crawlNumber,
    dieSize,
    roll,
    encounter: false,
    rest,
    mode: dashboard.crawlStepMinutes === 10 ? "dungeon" : "open",
  };
}

export default function DashboardPanel({ campaign, setCampaign }: Props) {
  const dashboard = campaign.dashboard;
  const [encounterEveryDraft, setEncounterEveryDraft] = useState<string | null>(null);
  const [encounterDieDraft, setEncounterDieDraft] = useState<string | null>(null);
  const [tableDieDraft, setTableDieDraft] = useState<string | null>(null);
  const [partySurpriseDraft, setPartySurpriseDraft] = useState<string | null>(null);
  const [foesSurpriseDraft, setFoesSurpriseDraft] = useState<string | null>(null);
  const [draggedMarchCharacterId, setDraggedMarchCharacterId] = useState<string | null>(null);
  const [selectedSpellSlots, setSelectedSpellSlots] = useState<Record<string, string>>({});
  const pointerDragRef = useRef<{ characterId: string; pointerId: number } | null>(null);
  const restDue = dashboard.turnsSinceRest >= 12 || dashboard.encounterRestRequired;
  const missionCharacters = campaign.characters.filter((character) =>
    character.campaignId === campaign.activeCharacterCampaignId && campaign.missionCharacterIds.includes(character.id),
  );
  const expeditionNpcs = campaign.stableNpcs.filter((npc) => npc.campaignId === campaign.activeCharacterCampaignId && campaign.expeditionNpcIds.includes(npc.id));
  const marchingEntities = dashboard.marchingOrderIds.map((entityId) => marchEntity(campaign, entityId)).filter((entry): entry is MarchEntity => Boolean(entry));
  const marchingCharacters = marchingEntities.flatMap((entity) => entity.kind === "character" ? [entity.character] : []);
  const marchingSlotCount = visibleMarchCapacity(dashboard);
  const scoutingEntity = dashboard.scoutingCharacterId ? marchEntity(campaign, dashboard.scoutingCharacterId) : undefined;
  const marchingEncumbrance = marchingCharacters.map((character) => characterEncumbrance(campaign, character));
  const partyMarchRate = marchingEntities.length ? Math.min(...marchingEntities.map((entity) => entity.kind === "character" ? characterEncumbrance(campaign, entity.character).rate : entity.movementRate)) : 0;
  const partySurpriseChance = partyEffectiveSurpriseChance(campaign, marchingCharacters);

  function updateCharacter(characterId: string, patch: Partial<CampaignState["characters"][number]>) {
    setCampaign((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.id === characterId ? { ...character, ...patch } : character,
      ),
    }));
  }

  function castCrawlSpell(characterId: string) {
    const slotId = selectedSpellSlots[characterId];
    const character = campaign.characters.find((entry) => entry.id === characterId);
    const slot = character?.spellSlots.find((entry) => entry.id === slotId && !entry.expended);
    const prepared = character ? preparedSpells(character).find((entry) => entry.slotId === slotId) : undefined;
    if (!character || !slot || !prepared) return;
    updateCharacter(characterId, { spellSlots: character.spellSlots.map((entry) => entry.id === slot.id ? { ...entry, expended: true } : entry) });
    setSelectedSpellSlots((current) => ({ ...current, [characterId]: "" }));
    sendChatAction({ kind: "combat-result", content: `✨ ${character.emoji}${character.name} casts ${prepared.name} (L${slot.level}).` });
  }

  function setCrawlEquipment(characterId: string, patch: { equippedWeaponId?: string | null; handState?: CampaignState["characters"][number]["handState"] }) {
    setCampaign((current) => {
      const character = current.characters.find((entry) => entry.id === characterId);
      if (!character) return current;
      const nextHandState = patch.handState ?? (patch.equippedWeaponId ? handStateForWeapon(character, patch.equippedWeaponId) : character.handState);
      const nextWeaponId = patch.handState ? weaponForHandState(character, patch.handState) : patch.equippedWeaponId ?? character.equippedWeaponId ?? "unarmed";
      const lightCarrierIds = handStateHasLight(nextHandState)
        ? Array.from(new Set([...current.dashboard.lightCarrierIds, characterId]))
        : current.dashboard.lightCarrierIds.filter((entry) => entry !== characterId);
      return {
        ...current,
        characters: current.characters.map((entry) => entry.id === characterId ? { ...entry, handState: nextHandState, equippedWeaponId: nextWeaponId } : entry),
        dashboard: { ...current.dashboard, lightCarrierIds },
        segmentedInitiative: {
          ...current.segmentedInitiative,
          participants: current.segmentedInitiative.participants.map((participant) => participant.characterId === characterId ? { ...participant, equippedWeaponId: nextWeaponId, pendingWeaponId: null } : participant),
        },
      };
    });
  }

  function updateDashboard(patch: Partial<DashboardState>) {
    setCampaign((current) => ({
      ...current,
      dashboard: { ...current.dashboard, ...patch },
    }));
  }

  function reorderRoster(characterId: string, destinationId: string) {
    if (!characterId || characterId === destinationId) return;
    setCampaign((current) => {
      const characters = [...current.characters];
      const sourceIndex = characters.findIndex((character) => character.id === characterId);
      const destinationIndex = characters.findIndex((character) => character.id === destinationId);
      if (sourceIndex < 0 || destinationIndex < 0) return current;
      const [character] = characters.splice(sourceIndex, 1);
      characters.splice(destinationIndex, 0, character);
      return { ...current, characters };
    });
  }

  function setMarchColumns(marchColumns: 1 | 2 | 5) {
    setCampaign((current) => {
      const activeIds = current.dashboard.marchingOrderIds.filter((entityId) => activeExpeditionEntity(current, entityId));
      const existingSlots = current.dashboard.marchingOrderSlots;
      const slottedIds = existingSlots.filter((entry): entry is string => Boolean(entry) && activeExpeditionEntity(current, entry));
      const knownIds = Array.from(new Set([...activeIds, ...slottedIds])).filter((entry) => entry !== current.dashboard.scoutingCharacterId);
      let slots = Array.from({ length: Math.max(25, existingSlots.length) }, () => null as string | null);
      if (marchColumns !== 1) {
        const capacity = Math.max(baseMarchCapacity(marchColumns), Math.ceil(knownIds.length / marchColumns) * marchColumns);
        if (slots.length < capacity) slots = [...slots, ...Array.from({ length: capacity - slots.length }, () => null)];
        knownIds.forEach((entry, index) => { slots[index] = entry; });
      }
      const marchingOrderIds = marchColumns === 1
        ? knownIds
        : slots.filter((entry): entry is string => Boolean(entry));
      return {
        ...current,
        dashboard: { ...current.dashboard, marchColumns, marchingOrderIds, marchingOrderSlots: slots },
      };
    });
  }

  function putInMarch(characterId: string, destinationIndex?: number) {
    setCampaign((current) => {
      const isCharacter = current.characters.some((character) => character.id === characterId);
      const isStableNpc = current.stableNpcs.some((npc) => npc.id === characterId);
      if (!isCharacter && !isStableNpc) return current;
      if (current.dashboard.marchColumns !== 1) {
        const columns = current.dashboard.marchColumns;
        let capacity = visibleMarchCapacity(current.dashboard);
        let slots = Array.from({ length: Math.max(25, current.dashboard.marchingOrderSlots.length) }, (_, index) => current.dashboard.marchingOrderSlots[index] ?? null);
        if (slots.length < capacity) slots = [...slots, ...Array.from({ length: capacity - slots.length }, () => null)];
        if (!slots.slice(0, capacity).includes(characterId)) {
          let emptyIndex = slots.slice(0, capacity).indexOf(null);
          if (emptyIndex < 0) {
            emptyIndex = capacity;
            capacity += columns;
            if (slots.length < capacity) slots = [...slots, ...Array.from({ length: capacity - slots.length }, () => null)];
          }
          slots[emptyIndex] = characterId;
        }
        return {
          ...current,
          missionCharacterIds: isCharacter ? Array.from(new Set([...current.missionCharacterIds, characterId])) : current.missionCharacterIds,
          expeditionNpcIds: isStableNpc ? Array.from(new Set([...current.expeditionNpcIds, characterId])) : current.expeditionNpcIds,
          dashboard: {
            ...current.dashboard,
            marchingOrderSlots: slots,
            marchingOrderIds: slots.filter((entry): entry is string => Boolean(entry)),
            scoutingCharacterId: current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId,
          },
        };
      }
      const withoutCharacter = current.dashboard.marchingOrderIds.filter((entry) => entry !== characterId);
      const index = destinationIndex === undefined
        ? withoutCharacter.length
        : Math.max(0, Math.min(destinationIndex, withoutCharacter.length));
      withoutCharacter.splice(index, 0, characterId);
      return {
        ...current,
        missionCharacterIds: isCharacter ? Array.from(new Set([...current.missionCharacterIds, characterId])) : current.missionCharacterIds,
        expeditionNpcIds: isStableNpc ? Array.from(new Set([...current.expeditionNpcIds, characterId])) : current.expeditionNpcIds,
        dashboard: { ...current.dashboard, marchingOrderIds: withoutCharacter, scoutingCharacterId: current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId },
      };
    });
  }

  function putInSlot(characterId: string, destinationIndex: number) {
    setCampaign((current) => {
      const isCharacter = current.characters.some((character) => character.id === characterId);
      const isStableNpc = current.stableNpcs.some((npc) => npc.id === characterId);
      if (!isCharacter && !isStableNpc) return current;
      const capacity = visibleMarchCapacity(current.dashboard);
      if (destinationIndex < 0 || destinationIndex >= capacity) return current;
      const slots = Array.from({ length: Math.max(25, current.dashboard.marchingOrderSlots.length, capacity) }, (_, index) => current.dashboard.marchingOrderSlots[index] ?? null);
      const sourceIndex = slots.indexOf(characterId);
      const displacedId = slots[destinationIndex];
      if (sourceIndex >= 0) {
        slots[sourceIndex] = displacedId;
      } else if (displacedId) {
        const emptyIndex = slots.slice(0, capacity).findIndex((entry, index) => entry === null && index !== destinationIndex);
        if (emptyIndex < 0) return current;
        slots[emptyIndex] = displacedId;
      }
      slots[destinationIndex] = characterId;
      return {
        ...current,
        missionCharacterIds: isCharacter ? Array.from(new Set([...current.missionCharacterIds, characterId])) : current.missionCharacterIds,
        expeditionNpcIds: isStableNpc ? Array.from(new Set([...current.expeditionNpcIds, characterId])) : current.expeditionNpcIds,
        dashboard: {
          ...current.dashboard,
          marchingOrderSlots: slots,
          marchingOrderIds: slots.filter((entry): entry is string => Boolean(entry)),
          scoutingCharacterId: current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId,
        },
      };
    });
  }

  function startMarchDrag(event: React.DragEvent<HTMLElement>, characterId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", characterId);
    event.dataTransfer.setData("text/character-id", characterId);
    setDraggedMarchCharacterId(characterId);
  }

  function droppedCharacterId(event: React.DragEvent<HTMLElement>) {
    return event.dataTransfer.getData("text/character-id")
      || event.dataTransfer.getData("text/plain")
      || draggedMarchCharacterId
      || "";
  }

  function beginTouchMarch(event: React.PointerEvent<HTMLButtonElement>, characterId: string) {
    event.preventDefault();
    event.stopPropagation();
    pointerDragRef.current = { characterId, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedMarchCharacterId(characterId);
  }

  function finishTouchMarch(event: React.PointerEvent<HTMLButtonElement>) {
    const active = pointerDragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const scoutTarget = element?.closest<HTMLElement>("[data-scout-slot]");
    const target = element?.closest<HTMLElement>("[data-march-slot]");
    const destinationIndex = target ? Number(target.dataset.marchSlot) : Number.NaN;
    if (scoutTarget) setScoutingCharacter(active.characterId);
    else if (Number.isInteger(destinationIndex)) putInSlot(active.characterId, destinationIndex);
    pointerDragRef.current = null;
    setDraggedMarchCharacterId(null);
  }

  function cancelTouchMarch() {
    pointerDragRef.current = null;
    setDraggedMarchCharacterId(null);
  }

  function setScoutingCharacter(characterId: string | null) {
    setCampaign((current) => ({
      ...current,
      dashboard: {
        ...current.dashboard,
        scoutingCharacterId: characterId,
        marchingOrderIds: characterId ? current.dashboard.marchingOrderIds.filter((entry) => entry !== characterId) : current.dashboard.marchingOrderIds,
        marchingOrderSlots: characterId ? current.dashboard.marchingOrderSlots.map((entry) => entry === characterId ? null : entry) : current.dashboard.marchingOrderSlots,
      },
    }));
  }

  function moveCharacter(characterId: string, offset: number) {
    const index = dashboard.marchingOrderIds.indexOf(characterId);
    putInMarch(characterId, index + offset);
  }

  function toggleLightCarrier(characterId: string) {
    const isCarrying = dashboard.lightCarrierIds.includes(characterId);
    updateDashboard({
      lightCarrierIds: isCarrying
        ? dashboard.lightCarrierIds.filter((id) => id !== characterId)
        : Array.from(new Set([...dashboard.lightCarrierIds, characterId])),
    });
  }

  function crawl() {
    setCampaign((current) => {
      if (current.dashboard.encounterActive) {
        return {
          ...current,
          dashboard: {
            ...current.dashboard,
            encounterActive: false,
            encounterRestRequired: true,
          },
        };
      }

      const resting = current.dashboard.turnsSinceRest >= 12 || current.dashboard.encounterRestRequired;
      const nextCrawl = current.dashboard.crawlCount + 1;
      const isTurn = current.dashboard.crawlStepMinutes === 10;
      const nextTurnsSinceRest = resting ? 0 : current.dashboard.turnsSinceRest + (isTurn ? 1 : 0);
      const dark = Math.max(...current.dashboard.lights.map((light) => light.remainingMinutes), 0) < current.dashboard.crawlStepMinutes;
      const currentMarchers = current.dashboard.marchingOrderIds.map((characterId) => current.characters.find((character) => character.id === characterId)).filter((character): character is CampaignState["characters"][number] => Boolean(character && current.missionCharacterIds.includes(character.id)));
      const scheduledCheck = buildScheduledCheck(current, current.dashboard, nextCrawl, resting, partyEffectiveSurpriseChance(current, currentMarchers));
      const encounterActive = scheduledCheck.encounter;
      const encounterCheck = {
        ...scheduledCheck,
        restDue: !scheduledCheck.encounter && !resting && isTurn && nextTurnsSinceRest >= 12,
        dark,
      };
      return {
        ...current,
        dashboard: {
          ...current.dashboard,
          crawlCount: nextCrawl,
          elapsedMinutes: current.dashboard.elapsedMinutes + current.dashboard.crawlStepMinutes,
          turnsSinceRest: nextTurnsSinceRest,
          watchesSinceRest: resting ? 0 : current.dashboard.watchesSinceRest + (isTurn ? 0 : 1),
          encounterRestRequired: false,
          encounterActive,
          encounterHistory: [encounterCheck, ...current.dashboard.encounterHistory].slice(0, 40),
          lights: current.dashboard.lights.map((light) => ({
            ...light,
            remainingMinutes: Math.max(0, light.remainingMinutes - current.dashboard.crawlStepMinutes),
          })),
        },
      };
    });
  }

  function triggerEncounter() {
    setCampaign((current) => {
      const dark = Math.max(...current.dashboard.lights.map((light) => light.remainingMinutes), 0) <= 0;
      const currentMarchers = current.dashboard.marchingOrderIds
        .map((characterId) => current.characters.find((character) => character.id === characterId))
        .filter((character) => Boolean(character && current.missionCharacterIds.includes(character.id))) as CampaignState["characters"];
      const surpriseChance = partyEffectiveSurpriseChance(current, currentMarchers);
      return {
        ...current,
        dashboard: {
          ...current.dashboard,
          encounterRestRequired: false,
          encounterActive: true,
          encounterHistory: [
            { ...buildEncounterCheck(current, current.dashboard, current.dashboard.crawlCount, null, true, surpriseChance), restDue: false, dark },
            ...current.dashboard.encounterHistory,
          ].slice(0, 40),
        },
      };
    });
  }

  function resetCrawlCount() {
    updateDashboard({
      crawlCount: 0,
      elapsedMinutes: 0,
      crawlStartTime: "",
      turnsSinceRest: 0,
      watchesSinceRest: 0,
      encounterRestRequired: false,
      encounterActive: false,
    });
  }

  function relightSource(type: LightSource["type"]) {
    const maximumMinutes = type === "torch" ? 60 : 240;
    updateDashboard({
      lights: dashboard.lights.map((light) =>
        light.type === type ? { ...light, remainingMinutes: maximumMinutes } : light,
      ),
    });
  }

  function updateLight(lightId: string, change: number | "extinguish") {
    updateDashboard({
      lights: dashboard.lights.map((light) =>
        light.id !== lightId
          ? light
          : {
              ...light,
              remainingMinutes: change === "extinguish"
                ? 0
                : Math.max(0, Math.min(light.maximumMinutes, light.remainingMinutes + change)),
            },
      ),
    });
  }

  function removeEncounterCheck(checkId: string) {
    updateDashboard({
      encounterHistory: dashboard.encounterHistory.filter((check) => check.id !== checkId),
    });
  }

  function updateEncounterDistance(checkId: string, distance: number) {
    updateDashboard({
      encounterHistory: dashboard.encounterHistory.map((check) =>
        check.id === checkId ? { ...check, distance: Math.max(0, distance) } : check,
      ),
    });
  }

  function marchEntityCard(entity: MarchEntity, index?: number, touchMove = false) {
    const title = entity.kind === "character"
      ? <CharacterNameLink characterId={entity.id}>{index === undefined ? entity.name : `${index + 1}. ${entity.name}`}</CharacterNameLink>
      : <b>{index === undefined ? entity.name : `${index + 1}. ${entity.name}`}</b>;
    return <article className={`march-character ${entity.kind === "npc" ? "march-npc" : ""} ${dashboard.lightCarrierIds.includes(entity.id) ? "torch-carrier" : ""}`} style={entity.kind === "character" ? characterTileStyle(entity.character.tileColor) : undefined} draggable onDragStart={(event) => startMarchDrag(event, entity.id)} onDragEnd={() => setDraggedMarchCharacterId(null)} onDragOver={(event) => event.preventDefault()} onDrop={index === undefined ? undefined : (event) => { event.preventDefault(); event.stopPropagation(); putInMarch(droppedCharacterId(event), index); }}>
      <div className="march-identity"><span className={entity.kind === "npc" ? "march-npc-token" : "small-tile-emoji"}>{entity.kind === "npc" ? entity.token : entity.character.emoji}</span><span>{title}<small>AC {entity.armorClass}{entity.kind === "character" ? ` · DEX ${entity.character.stats[1]}` : ` · Move ${entity.movementRate}`}</small><HpBar current={entity.currentHp} maximum={entity.maxHp} compact /></span></div>
      {touchMove && <button type="button" className="march-drag-handle" aria-label={`Drag ${entity.name} to another position`} onPointerDown={(event) => beginTouchMarch(event, entity.id)} onPointerUp={finishTouchMarch} onPointerCancel={cancelTouchMarch}>↕ Move</button>}
      <label className="inline-check"><input type="checkbox" checked={dashboard.lightCarrierIds.includes(entity.id)} onChange={() => toggleLightCarrier(entity.id)} />Carrying light</label>
      {index !== undefined && <div className="march-actions"><button disabled={index === 0} onClick={() => moveCharacter(entity.id, -1)}>↑</button><button disabled={index === marchingEntities.length - 1} onClick={() => moveCharacter(entity.id, 1)}>↓</button></div>}
    </article>;
  }

  return (
    <section className="dashboard-stack">
      <div className="dashboard-overview">
        <ResponsiveDisclosure
          storageKey="crawl-party"
          className="panel dashboard-roster-panel"
          title="Party"
          summary={`${missionCharacters.length} member${missionCharacters.length === 1 ? "" : "s"} · ${partyMarchRate} ft move`}
          mobileDefaultOpen
        >
          {missionCharacters.length === 0 ? (
            <div className="compact-empty">No characters are on the mission. Add them from Characters &amp; Stable.</div>
          ) : (
            <div className="glance-grid">
              {missionCharacters.map((character) => (
                <article className="glance-card" style={characterTileStyle(character.tileColor)} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/roster-character-id", character.id); event.dataTransfer.setData("text/plain", character.id); event.dataTransfer.setData("text/character-id", character.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorderRoster(event.dataTransfer.getData("text/roster-character-id") || event.dataTransfer.getData("text/plain"), character.id); }} key={character.id}>
                  <div className="glance-title"><div className="tile-identity"><span className="tile-emoji">{character.emoji}</span><span className="crawl-character-heading"><CharacterNameLink characterId={character.id}>{character.name}</CharacterNameLink><small className="crawl-character-meta">{character.race} · {character.className} {character.level} · {character.player || "No player"}</small></span></div><label className="dashboard-hp"><HpMathInput ariaLabel={`${character.name} current HP`} value={character.currentHp} minimum={-10} onCommit={(currentHp) => updateCharacter(character.id, { currentHp })} /><HpBar current={character.currentHp} maximum={character.maxHp} compact /></label></div>
                  <div className="combat-strip">
                    <button title="Click to post AC" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "AC", value: character.armorClass })}><i aria-hidden="true">🛡️</i><small>AC</small><b>{character.armorClass}</b></button>
                    <button title="Roll an attack and damage with the equipped weapon in Party Chat" onClick={() => sendChatAction({ kind: "equipped-attack", characterId: character.id })}><i aria-hidden="true">⚔️</i><small>Hit</small><b>{character.toHit >= 0 ? "+" : ""}{character.toHit}</b></button>
                    <button title="Click to post coin" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "Coin", value: money(characterCoinGp(campaign.inventoryManagement, character.id)) })}><i aria-hidden="true">💰</i><small>Coin</small><b>{money(characterCoinGp(campaign.inventoryManagement, character.id))}</b></button>
                    <button title="Click to post current XP" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "Current XP", value: character.currentXp.toLocaleString("en-US") })}><i aria-hidden="true">⭐</i><small>XP</small><b>{character.currentXp.toLocaleString("en-US")}</b></button>
                    <button title="Click to post XP to next level" onClick={() => sendChatAction({ kind: "character-value", characterId: character.id, label: "XP to next", value: character.totalXp.toLocaleString("en-US") })}><i aria-hidden="true">🏆</i><small>XP to next</small><b>{character.totalXp.toLocaleString("en-US")}</b></button>
                  </div>
                  <div className="mini-stats">{statLabels.map((stat, index) => <button title="Click: full roll · Shift: roll under · Ctrl: post score" onClick={(event) => sendChatAction({ kind: "ability", characterId: character.id, statIndex: index, mode: event.ctrlKey ? "value" : event.shiftKey ? "under" : "full" })} key={stat.label}><i aria-hidden="true">{stat.icon}</i><small>{stat.label}</small><b>{character.stats[index]}</b></button>)}</div>
                  <div className="mini-saves">{([ ["death", "Death", saveIcons.death], ["wands", "Aimed", saveIcons.wands], ["polymorph", "Poly", saveIcons.polymorph], ["breath", "Breath", saveIcons.breath], ["spells", "Spell", saveIcons.spells] ] as const).map(([save, label, icon]) => <button title="Click to roll save · Ctrl-click to post target" onClick={(event) => sendChatAction({ kind: "save", characterId: character.id, save, label, mode: event.ctrlKey ? "value" : "roll" })} key={save}><i aria-hidden="true">{icon}</i><small>{label}</small><b>{character.saves[save]}</b></button>)}</div>
                  <div className="dashboard-equipment-controls">{physicalHandSummary(campaign, character.id) ? <div className="dashboard-physical-hands"><span>Hands · Inventory</span><b>{physicalHandSummary(campaign, character.id)}</b></div> : <><label>Weapon<select value={character.equippedWeaponId ?? "unarmed"} onChange={(event) => setCrawlEquipment(character.id, { equippedWeaponId: event.target.value })}>{availableCharacterWeapons(character).map((weapon) => <option value={weapon.id} key={weapon.id}>{weapon.name} · {weapon.category}{getWeaponTrainingState(character, weapon).specialized ? " · specialized" : ""}</option>)}</select></label><label>Hands<select value={character.handState} onChange={(event) => setCrawlEquipment(character.id, { handState: event.target.value as CampaignState["characters"][number]["handState"] })}>{handStateOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></>}{preparedSpells(character).length > 0 && <label>Prepared spell<select aria-label={`${character.name} prepared spells`} value={selectedSpellSlots[character.id] ?? ""} onChange={(event) => setSelectedSpellSlots((current) => ({ ...current, [character.id]: event.target.value }))}><option value="">Choose spell</option>{preparedSpells(character).map((spell) => <option value={spell.slotId} key={spell.slotId}>{spell.name} · L{spell.level}</option>)}</select></label>}{preparedSpells(character).length > 0 && <button type="button" className="crawl-cast-spell" disabled={!selectedSpellSlots[character.id]} onClick={() => castCrawlSpell(character.id)}>Cast spell</button>}</div>
                  {(() => { const encumbrance = characterEncumbrance(campaign, character); return <div className={`crawl-movement encumbrance-${encumbrance.band}`}><span>Movement <b>{encumbrance.rate}/{encumbrance.maxRate} ft</b></span><span>Hexes <b>{encumbrance.hexes}</b></span><span className="crawl-carried-stones" aria-label={`Carrying ${formatStoneUnits(encumbrance.carried)} of ${formatStoneUnits(encumbrance.capacity)}`}><b>{formatStoneUnits(encumbrance.carried)} / {formatStoneUnits(encumbrance.capacity)}</b></span></div>; })()}
                  <details className="crawl-character-notes"><summary>NOTES · {character.player || character.name}</summary><MarkdownNotes label={`${character.name} notes`} value={character.notes} onChange={(notes) => updateCharacter(character.id, { notes })} /></details>
                </article>
              ))}
            </div>
          )}
        </ResponsiveDisclosure>

      </div>

      <div className="dashboard-middle">
        <ResponsiveDisclosure
          storageKey="crawl-marching-order"
          className="panel march-panel"
          title="Marching Order"
          summary={`${marchingEntities.length} placed · ${expeditionNpcs.length} expedition NPC${expeditionNpcs.length === 1 ? "" : "s"} · ${dashboard.marchColumns} column${dashboard.marchColumns === 1 ? "" : "s"}`}
        >
          <div className="panel-heading split-heading">
            <div><h2>Marching Order</h2><p>Party move <b>{partyMarchRate} ft</b> <small>(slowest member)</small> · surprise <b>{partySurpriseChance}-in-6</b></p></div>
            <label>Columns<select value={dashboard.marchColumns} onChange={(event) => setMarchColumns(Number(event.target.value) as 1 | 2 | 5)}><option value="1">1 column</option><option value="2">2 columns</option><option value="5">5 columns</option></select></label>
          </div>
          {expeditionNpcs.length > 0 && <div className="expedition-npc-pool"><strong>Current expedition</strong><div>{expeditionNpcs.map((npc) => <button type="button" draggable onDragStart={(event) => startMarchDrag(event, npc.id)} onClick={() => putInMarch(npc.id)} title={`Place ${npc.name} in marching order`} key={npc.id}><b>{npc.token}</b><span>{npc.name}</span></button>)}</div></div>}
          <div className="march-layout">
            <div className="march-order-wrap">
              <span className="march-direction">Front</span>
              {dashboard.marchColumns !== 1 ? (
                <div className={`march-order ${dashboard.marchColumns === 5 ? "five-grid" : "two-grid"}`} aria-label={`${dashboard.marchColumns} column marching grid`}>
                  {Array.from({ length: marchingSlotCount }, (_, index) => {
                    const entityId = dashboard.marchingOrderSlots[index];
                    const entity = entityId ? marchEntity(campaign, entityId) : undefined;
                    return (
                      <div className={`march-slot ${draggedMarchCharacterId ? "drag-target" : ""}`} data-march-slot={index} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); putInSlot(droppedCharacterId(event), index); setDraggedMarchCharacterId(null); }} key={index}>
                        <span className="slot-number">{index + 1}</span>
                        {entity ? marchEntityCard(entity, undefined, true) : <span className="empty-slot">Drop here</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="march-order" style={{ "--march-columns": dashboard.marchColumns } as React.CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); putInMarch(event.dataTransfer.getData("text/character-id")); }}>
                  {marchingEntities.length === 0 ? <div className="march-empty">Drop expedition members here</div> : marchingEntities.map((entity, index) => <div key={entity.id}>{marchEntityCard(entity, index)}</div>)}
                </div>
              )}
              <span className="march-direction rear">Rear</span>
              <section className={`scouting-ahead-slot ${scoutingEntity ? "occupied" : ""}`} data-scout-slot onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); setScoutingCharacter(droppedCharacterId(event) || null); setDraggedMarchCharacterId(null); }}>
                <strong>Scouting ahead</strong>
                {scoutingEntity ? <div className="scouting-character" style={scoutingEntity.kind === "character" ? characterTileStyle(scoutingEntity.character.tileColor) : undefined}><span className={scoutingEntity.kind === "npc" ? "march-npc-token" : "small-tile-emoji"}>{scoutingEntity.kind === "npc" ? scoutingEntity.token : scoutingEntity.character.emoji}</span><span>{scoutingEntity.kind === "character" ? <CharacterNameLink characterId={scoutingEntity.id}>{scoutingEntity.name}</CharacterNameLink> : <b>{scoutingEntity.name}</b>}<small>Separate from formation · AC {scoutingEntity.armorClass}</small><HpBar current={scoutingEntity.currentHp} maximum={scoutingEntity.maxHp} compact /></span><button className="action-link" type="button" onClick={() => setScoutingCharacter(null)}>Clear</button></div> : <span>Drag an expedition member onto this tile</span>}
              </section>
            </div>
          </div>
        </ResponsiveDisclosure>

        <ResponsiveDisclosure
          storageKey="crawl-dungeon-time"
          className="panel crawl-panel"
          title="Dungeon Time"
          summary={`Turn ${dashboard.crawlCount} · ${formatMinutes(dashboard.elapsedMinutes)} · ${dashboard.encounterActive ? "Encounter" : restDue ? "Rest due" : "Crawling"}`}
        >
          <header className="crawl-header">
            <div><h2>Dungeon Time</h2><p><b>{dashboard.crawlCount}</b> turns · {formatMinutes(dashboard.elapsedMinutes)} elapsed · <b>{formatCampaignTime(dashboard.crawlStartTime, dashboard.elapsedMinutes)}</b></p></div>
            <div className="crawl-heading-actions"><button className="action-link" onClick={resetCrawlCount}>Reset time</button><button className="action-link" disabled={!dashboard.encounterHistory.length} onClick={() => updateDashboard({ encounterHistory: [] })}>Clear log</button></div>
          </header>
          <div className="crawl-light-list" aria-label="Light sources">
            {dashboard.lights.map((light) => (
              <article className={`crawl-light-row ${light.remainingMinutes === 0 ? "spent" : ""}`} key={light.id}>
                <span className="crawl-light-icon" aria-hidden="true">{light.type === "torch" ? "🔥" : "🏮"}</span>
                <div className="crawl-light-meter"><span><strong>{light.type === "torch" ? "Torch" : "Lantern"}</strong><b>{formatMinutes(light.remainingMinutes)}</b></span><progress max={light.maximumMinutes} value={light.remainingMinutes}>{light.remainingMinutes}</progress></div>
                <div className="crawl-light-actions"><button onClick={() => relightSource(light.type)}>Light</button><button aria-label={`Remove ten minutes from ${light.type}`} onClick={() => updateLight(light.id, -10)}>−10</button><button aria-label={`Add ten minutes to ${light.type}`} onClick={() => updateLight(light.id, 10)}>+10</button><button className="action-link" onClick={() => updateLight(light.id, "extinguish")}>Off</button></div>
              </article>
            ))}
          </div>
          <div className="crawl-command-bar">
            <label><span>Starting time</span><input aria-label="Crawl starting time" type="time" value={dashboard.crawlStartTime} onChange={(event) => updateDashboard({ crawlStartTime: event.target.value })} /></label>
            <label><span>Advance</span><select value={dashboard.crawlStepMinutes} onChange={(event) => updateDashboard({ crawlStepMinutes: Number(event.target.value) as 10 | 240 })}><option value="10">10 minutes</option><option value="240">1 watch · 4 hours</option></select></label>
            <button className={`crawl-button ${dashboard.encounterActive ? "encounter-active" : restDue ? "rest-turn" : ""}`} onClick={crawl}><b>{dashboard.encounterActive ? "END ENCOUNTER" : restDue ? "REST" : "CRAWL"}</b><small>{dashboard.encounterActive ? "then rest" : dashboard.crawlStepMinutes === 10 ? "+10 min" : "+1 watch"}</small></button>
            <button className="encounter-button" disabled={dashboard.encounterActive} onClick={triggerEncounter}><b>ENCOUNTER</b><small>{dashboard.encounterActive ? "active" : "roll now"}</small></button>
          </div>
          <div className={`rest-status ${restDue ? "rest-due" : ""}`}><div><strong>{dashboard.encounterActive ? "Encounter in progress" : restDue ? "Rest due" : "Rest cycle"}</strong><span>{dashboard.encounterActive ? "End the encounter; the next turn rests." : restDue ? "The next Crawl-button turn is a rest." : `${dashboard.turnsSinceRest}/12 indoor turns${dashboard.encounterRestRequired ? " · encounter rest required" : ""}`}</span></div></div>
          <details className="crawl-settings-panel">
            <summary><span>Encounter settings</span><small>d{dashboard.encounterDieSize} every {dashboard.encounterEvery} · table d{dashboard.encounterTableDieSize} · surprise {dashboard.partySurpriseChance}/{dashboard.foesSurpriseChance}</small></summary>
            <div className="encounter-settings">
              <label><span>Encounter die</span><span className="crawl-number-field">d<input aria-label="Encounter die size" inputMode="numeric" value={encounterDieDraft ?? String(dashboard.encounterDieSize)} onChange={(event) => { const value = event.target.value; setEncounterDieDraft(value); if (/^\d+$/.test(value) && Number(value) >= 2) updateDashboard({ encounterDieSize: Number(value) }); }} onBlur={() => setEncounterDieDraft(null)} /></span></label>
              <label><span>Check interval</span><span className="crawl-number-field"><input aria-label="Encounter crawl interval" inputMode="numeric" value={encounterEveryDraft ?? String(dashboard.encounterEvery)} onChange={(event) => { const value = event.target.value; setEncounterEveryDraft(value); if (/^\d+$/.test(value) && Number(value) >= 1) updateDashboard({ encounterEvery: Number(value) }); }} onBlur={() => setEncounterEveryDraft(null)} />turns</span></label>
              <label><span>Encounter table</span><span className="crawl-number-field">d<input aria-label="Encounter table die size" inputMode="numeric" value={tableDieDraft ?? String(dashboard.encounterTableDieSize)} onChange={(event) => { const value = event.target.value; setTableDieDraft(value); if (/^\d+$/.test(value) && Number(value) >= 2) updateDashboard({ encounterTableDieSize: Number(value) }); }} onBlur={() => setTableDieDraft(null)} /></span></label>
              <label><span>Party surprised</span><span className="crawl-number-field"><input aria-label="Party surprise chance in six" inputMode="numeric" value={partySurpriseDraft ?? String(dashboard.partySurpriseChance)} onChange={(event) => { const value = event.target.value; setPartySurpriseDraft(value); if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 6) updateDashboard({ partySurpriseChance: Number(value) }); }} onBlur={() => setPartySurpriseDraft(null)} />in 6</span></label>
              <label><span>Foes surprised</span><span className="crawl-number-field"><input aria-label="Foes surprise chance in six" inputMode="numeric" value={foesSurpriseDraft ?? String(dashboard.foesSurpriseChance)} onChange={(event) => { const value = event.target.value; setFoesSurpriseDraft(value); if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 6) updateDashboard({ foesSurpriseChance: Number(value) }); }} onBlur={() => setFoesSurpriseDraft(null)} />in 6</span></label>
            </div>
            <p className="rule-note">Natural 1 triggers an encounter. Ten-minute turns use indoor feet; watches use outdoor yards.</p>
          </details>
          <div className="encounter-history">
            {dashboard.encounterHistory.length === 0 ? <div className="compact-empty">No crawl turns yet.</div> : dashboard.encounterHistory.map((check) => (
              <div className={[check.encounter ? "encounter-hit" : check.roll === null && !check.forced ? "encounter-skipped" : "", check.rest ? "rest-entry" : "", check.restDue ? "rest-due-entry" : "", check.dark ? "dark-entry" : ""].filter(Boolean).join(" ")} key={check.id}>
                <div className="encounter-summary"><span><strong>{check.forced ? "Forced encounter" : `${check.rest ? "Rest · " : ""}Turn ${check.crawlNumber}`}</strong><small>{check.forced ? "Manual roll" : check.roll === null ? "No roll due" : `d${check.dieSize}: ${check.roll}`}</small></span><b>{check.encounter ? "ENCOUNTER" : check.roll === null ? check.rest ? "Rested" : "Quiet" : "Clear"}</b><button className="action-link" aria-label={`Remove encounter check from crawl ${check.crawlNumber}`} onClick={() => removeEncounterCheck(check.id)}>Remove</button></div>
                {check.encounter && (check.tableRoll ?? check.numberRoll) !== undefined && <div className="encounter-details"><span><b>Encounter table roll</b>d{check.tableDieSize ?? check.numberDieSize}: {check.tableRoll ?? check.numberRoll}</span><span><b>Reaction</b>d100 {check.reactionRolls?.[0]}{check.reactionRolls?.[1] ? ` ${check.reactionRolls[1] > 0 ? "+" : "−"} ${Math.abs(check.reactionRolls[1])}` : ""} = {check.reactionTotal}: {check.reaction}</span><span className="distance-result"><b>Distance · {check.mode === "dungeon" ? "indoors" : "outdoors"}</b><small>{check.distanceDieSize ? `d${check.distanceDieSize}: ${check.distanceRolls?.[0]}${check.distanceModifier ? ` + ${check.distanceModifier}` : ""}, × 10${check.distanceSurprised ? " · close because of surprise" : ""}` : `${check.distanceRolls?.join(" + ")} × 10`}</small><label><input aria-label={`Encounter distance for crawl ${check.crawlNumber}`} type="number" min="0" step="10" value={check.distance ?? 0} onChange={(event) => updateEncounterDistance(check.id, Number(event.target.value) || 0)} /> {check.distanceUnit}</label></span><span><b>Foes surprise</b>d6: {check.foesSurpriseRoll} vs {check.foesSurpriseChance ?? dashboard.foesSurpriseChance}-in-6 {check.foesSurpriseRoll !== undefined && check.foesSurpriseRoll <= (check.foesSurpriseChance ?? dashboard.foesSurpriseChance) ? "— SURPRISED" : "— alert"}</span><span><b>Party surprise</b>d6: {check.partySurpriseRoll} vs {check.partySurpriseChance ?? dashboard.partySurpriseChance}-in-6 {check.partySurpriseRoll !== undefined && check.partySurpriseRoll <= (check.partySurpriseChance ?? dashboard.partySurpriseChance) ? "— SURPRISED" : "— alert"}</span></div>}
              </div>
            ))}
          </div>
          <div className="reaction-table-compact" aria-label="Reaction table"><span><b>01–05</b> Very hostile</span><span><b>06–25</b> Hostile</span><span><b>26–45</b> Unfavorable</span><span><b>46–55</b> Neutral</span><span><b>56–75</b> Favorable</span><span><b>76–95</b> Friendly</span><span><b>96–100</b> Very friendly</span></div>
        </ResponsiveDisclosure>
      </div>

    </section>
  );
}
