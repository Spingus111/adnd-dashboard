"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CampaignState, Character, CharacterInventoryLine, CharacterWeapon } from "./types";
import { defaultTravelPlanner, emptyCampaign } from "./types";
import PartyPanel from "./party-panel";
import TravelPanel from "./travel-panel";
import ExpeditionsPanel from "./expeditions-panel";
import DashboardPanel from "./dashboard-panel";
import XpPanel from "./xp-panel";
import SegmentedInitiativePanel from "./segmented-initiative-panel";
import ChatDrawer from "./chat-drawer";
import { CHARACTER_NAVIGATE_EVENT } from "./character-navigation";
import { normalizeHandState } from "./hand-states";
import InventoryManagementPanel from "./inventory-management-panel";
import { discardInventoryOwner, normalizeInventoryManagement, syncPhysicalEquipment } from "./inventory-management";
import { addCharacterGenerationGrants, addStarterKit } from "./starter-kit";
import { COMBAT_MUTATION_EVENT, type CombatMutationContext } from "./combat-permissions";
import { PARTY_CHAT_PREFERENCES_KEY, partyChatRoleFromPreferences, type PartyChatRole } from "./party-chat-role";
import CharacterSheetPanel from "./character-sheet-panel";
import { rollStatPool } from "./osric-character-creation";
import { deriveCharacterRecord } from "./character-rules";
import { normalizeEngagements } from "./weapon-combat-rules";
import { weaponRulesForName } from "./weapon-rules";
import { mergeCampaignStates } from "./campaign-merge";
import { CAMPAIGN_OPERATION_EVENT } from "./campaign-operation-events";
import { diffCampaignOperations, promoteAtomicCampaignOperations, replaceGeneratedOperations, type CampaignOperation } from "./campaign-operations";
import { sharedId } from "./shared-id";
import { randomCharacterColor, randomCharacterName } from "./character-names";
import { secureRandomIndex } from "./random";
import { normalizeMonsterArmorProfile } from "./monster-armor";
import { normalizeStableNpc } from "./npc-stable";
import { normalizeUnarmedOverrides } from "./unarmed-combat";

type Tab = "dashboard" | "characters" | "party" | "expeditions" | "travel" | "inventory-management" | "xp" | "segmented" | "player-guide" | "gm-guide" | "phb" | "dmg";
type SaveStatus = "loading" | "saved" | "saving" | "error";


function id() {
  return sharedId();
}

type PendingCampaignSave = {
  mutationId: string;
  operations: CampaignOperation[];
  submittedState: CampaignState;
  baseState: CampaignState;
  expectedVersion: number;
  combatActor: CombatMutationContext;
  explicitOperationCount: number;
};

function blankWeapon(index: number): CharacterWeapon {
  return { id: id(), name: "", attackBonus: 0, damage: "", notes: "", category: index === 1 ? "ranged" : "melee", specialized: false };
}

function blankInventoryLine(): CharacterInventoryLine {
  return { id: id(), name: "", info: "", quantity: 1 };
}

function inventoryCapacity(strength: string) {
  return 10 + Math.max(3, Math.min(18, Number(strength) || 10));
}

function ensureInventoryLines(lines: CharacterInventoryLine[] | undefined, strength: string) {
  const result = (lines ?? []).map((line) => ({ ...line, id: line.id || id(), quantity: Math.max(0, Number(line.quantity) || 0) }));
  while (result.length < inventoryCapacity(strength)) result.push(blankInventoryLine());
  return result;
}

function newCharacter(): Character {
  const rolledStats = rollStatPool();
  const rolledStatStrings = rolledStats.totals.map(String) as Character["stats"];
  const character: Character = {
    id: id(),
    campaignId: "default",
    folderId: null,
    name: randomCharacterName(),
    player: "",
    race: "Human",
    alignment: "True Neutral",
    className: "Unassigned",
    level: 1,
    movementRate: 90,
    toHit: 0,
    armorClass: 10,
    baseArmorClass: 10,
    armorClassOverride: null,
    currentHp: 1,
    maxHp: 1,
    hitDice: "1d10",
    currentXp: 0,
    totalXp: 0,
    age: "",
    height: "",
    weight: "",
    tileColor: randomCharacterColor(),
    emoji: "🛡️",
    stats: rolledStatStrings,
    exceptionalStrength: null,
    rawStats: rolledStatStrings,
    statPool: rolledStats.totals,
    statRolls: rolledStats.dice,
    statAssignmentComplete: false,
    scoresLocked: false,
    raceLocked: false,
    startingHpRolled: false,
    gold: 0,
    saves: { death: 20, wands: 20, polymorph: 20, breath: 20, spells: 20 },
    notes: "",
    abilityNotes: "",
    diceMacros: [{ name: "", expression: "" }, { name: "", expression: "" }, { name: "", expression: "" }],
    weapons: [blankWeapon(0), blankWeapon(1), blankWeapon(2)],
    equippedWeaponId: null,
    handState: "one-hand-empty",
    inventoryLines: Array.from({ length: 20 }, blankInventoryLine),
    weaponProficiencies: "",
    weaponSpecializations: "",
    weaponTraining: [],
    weaponTrainingLocked: false,
    classLevels: {},
    spellbook: [],
    spellSlots: [],
  };
  return deriveCharacterRecord(character);
}

function decimalStat(value: string) {
  if (/^(?:[3-9]|1[0-9])$/.test(value)) return value;
  const code = value.toUpperCase().charCodeAt(0);
  return code >= 65 && code <= 73 ? String(code - 55) : "10";
}

function normalizeStableNpcCollections(state: CampaignState): CampaignState {
  if (Array.isArray(state.stableNpcs) && Array.isArray(state.discardedStableNpcs) && Array.isArray(state.expeditionNpcIds) && Array.isArray(state.characterFolders)) return state;
  return {
    ...state,
    stableNpcs: Array.isArray(state.stableNpcs) ? state.stableNpcs : [],
    discardedStableNpcs: Array.isArray(state.discardedStableNpcs) ? state.discardedStableNpcs : [],
    expeditionNpcIds: Array.isArray(state.expeditionNpcIds) ? state.expeditionNpcIds : [],
    characterFolders: Array.isArray(state.characterFolders) ? state.characterFolders : [],
  };
}

function normalizeRemoteCampaignState(raw: CampaignState): CampaignState {
  const merged = normalizeStableNpcCollections({ ...emptyCampaign, ...raw });
  const characters = Array.isArray(merged.characters) ? merged.characters : [];
  const activeCharacterCampaignId = typeof merged.activeCharacterCampaignId === "string" ? merged.activeCharacterCampaignId : "default";
  const dashboard = merged.dashboard ?? emptyCampaign.dashboard;
  const segmented = merged.segmentedInitiative ?? emptyCampaign.segmentedInitiative;
  return {
    ...merged,
    characters,
    characterFolders: Array.isArray(merged.characterFolders) ? merged.characterFolders : [],
    characterCampaigns: Array.isArray(merged.characterCampaigns) && merged.characterCampaigns.length ? merged.characterCampaigns : emptyCampaign.characterCampaigns,
    stableNpcs: Array.isArray(merged.stableNpcs) ? merged.stableNpcs.map(normalizeStableNpc) : [],
    discardedCharacters: Array.isArray(merged.discardedCharacters) ? merged.discardedCharacters : [],
    discardedStableNpcs: Array.isArray(merged.discardedStableNpcs) ? merged.discardedStableNpcs : [],
    missionCharacterIds: Array.isArray(merged.missionCharacterIds) ? merged.missionCharacterIds : [],
    expeditionNpcIds: Array.isArray(merged.expeditionNpcIds) ? merged.expeditionNpcIds : [],
    initiativeResults: Array.isArray(merged.initiativeResults) ? merged.initiativeResults : [],
    sharedInventoryByCampaign: merged.sharedInventoryByCampaign && typeof merged.sharedInventoryByCampaign === "object" ? merged.sharedInventoryByCampaign : {},
    partyFundsByCampaign: merged.partyFundsByCampaign && typeof merged.partyFundsByCampaign === "object" ? merged.partyFundsByCampaign : {},
    travelByCampaign: merged.travelByCampaign && typeof merged.travelByCampaign === "object" ? merged.travelByCampaign : {},
    inventoryManagement: normalizeInventoryManagement(merged.inventoryManagement, characters, activeCharacterCampaignId),
    xpTracker: {
      ...emptyCampaign.xpTracker,
      ...(merged.xpTracker ?? {}),
      enemies: Array.isArray(merged.xpTracker?.enemies) ? merged.xpTracker.enemies : [],
      recentEnemies: Array.isArray(merged.xpTracker?.recentEnemies) ? merged.xpTracker.recentEnemies : [],
      treasureXpAwardedItemValues: merged.xpTracker?.treasureXpAwardedItemValues ?? {},
      shareWeights: merged.xpTracker?.shareWeights ?? {},
      primeXpBonuses: merged.xpTracker?.primeXpBonuses ?? {},
    },
    dashboard: {
      ...emptyCampaign.dashboard,
      ...dashboard,
      marchingOrderIds: Array.isArray(dashboard.marchingOrderIds) ? dashboard.marchingOrderIds : [],
      marchingOrderSlots: Array.isArray(dashboard.marchingOrderSlots) ? dashboard.marchingOrderSlots : [],
      lightCarrierIds: Array.isArray(dashboard.lightCarrierIds) ? dashboard.lightCarrierIds : [],
      lights: Array.isArray(dashboard.lights) ? dashboard.lights : emptyCampaign.dashboard.lights,
      encounterHistory: Array.isArray(dashboard.encounterHistory) ? dashboard.encounterHistory : [],
    },
    segmentedInitiative: {
      ...emptyCampaign.segmentedInitiative,
      ...segmented,
      participants: Array.isArray(segmented.participants) ? segmented.participants : [],
      effects: Array.isArray(segmented.effects) ? segmented.effects : [],
      engagements: normalizeEngagements(segmented.engagements),
      grappleHolds: Array.isArray(segmented.grappleHolds) ? segmented.grappleHolds : [],
      pendingUnarmed: segmented.pendingUnarmed ?? null,
      combatTallies: segmented.combatTallies && typeof segmented.combatTallies === "object" ? segmented.combatTallies : {},
      lastCheers: Array.isArray(segmented.lastCheers) ? segmented.lastCheers : [],
    },
  };
}

export default function Toolkit() {
  const [campaign, setCampaignState] = useState<CampaignState>(emptyCampaign);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loadError, setLoadError] = useState("");
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [characterOrder, setCharacterOrder] = useState<string[]>([]);
  const [expandedCharacterIds, setExpandedCharacterIds] = useState<string[]>([]);
  const [characterViewReady, setCharacterViewReady] = useState(false);
  const versionRef = useRef(0);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef("");
  const campaignRef = useRef<CampaignState>(emptyCampaign);
  const serverCampaignRef = useRef<CampaignState>(emptyCampaign);
  const campaignSaveInFlightRef = useRef(false);
  const campaignSaveRequestedRef = useRef(false);
  const campaignRetryTimerRef = useRef<number | null>(null);
  const pendingCombatMutationRef = useRef<CombatMutationContext | null>(null);
  const pendingCampaignOperationsRef = useRef<CampaignOperation[]>([]);
  const pendingCampaignSaveRef = useRef<PendingCampaignSave | null>(null);
  const campaignPollInFlightRef = useRef(false);
  const interactionScrollRef = useRef<number | null>(null);
  const scrollRestoreTokenRef = useRef(0);

  const restorePageScroll = useCallback((top: number) => {
    const token = ++scrollRestoreTokenRef.current;
    const restore = () => {
      if (token === scrollRestoreTokenRef.current && Math.abs(window.scrollY - top) > 1) window.scrollTo(window.scrollX, top);
    };
    let framesRemaining = 4;
    const restoreAfterLayout = () => {
      restore();
      if (framesRemaining-- > 0 && token === scrollRestoreTokenRef.current) window.requestAnimationFrame(restoreAfterLayout);
    };
    // Browser focus handling can reposition the viewport after React commits.
    // Keep the user's pre-click position through that short native cycle.
    window.requestAnimationFrame(restoreAfterLayout);
    window.setTimeout(restore, 90);
  }, []);

  useEffect(() => {
    const capturePreClickScroll = () => {
      const top = window.scrollY;
      interactionScrollRef.current = top;
      window.setTimeout(() => {
        if (interactionScrollRef.current === top) interactionScrollRef.current = null;
      }, 250);
    };
    document.addEventListener("pointerdown", capturePreClickScroll, true);
    document.addEventListener("mousedown", capturePreClickScroll, true);
    return () => {
      document.removeEventListener("pointerdown", capturePreClickScroll, true);
      document.removeEventListener("mousedown", capturePreClickScroll, true);
    };
  }, []);

  useEffect(() => {
    const rememberOperations = (event: Event) => {
      const operations = (event as CustomEvent<CampaignOperation[]>).detail;
      if (Array.isArray(operations)) pendingCampaignOperationsRef.current.push(...operations);
    };
    window.addEventListener(CAMPAIGN_OPERATION_EVENT, rememberOperations);
    return () => window.removeEventListener(CAMPAIGN_OPERATION_EVENT, rememberOperations);
  }, []);

  const setCampaign = useCallback<Dispatch<SetStateAction<CampaignState>>>((next) => {
    const top = typeof window === "undefined" ? 0 : interactionScrollRef.current ?? window.scrollY;
    interactionScrollRef.current = null;
    setCampaignState((current) => {
      const resolved = normalizeStableNpcCollections(typeof next === "function" ? next(current) : next);
      campaignRef.current = resolved;
      return resolved;
    });
    if (typeof window !== "undefined") restorePageScroll(top);
  }, [restorePageScroll]);

  useEffect(() => { campaignRef.current = campaign; }, [campaign]);

  useEffect(() => {
    const rememberMutation = (event: Event) => {
      pendingCombatMutationRef.current = (event as CustomEvent<CombatMutationContext>).detail;
    };
    window.addEventListener(COMBAT_MUTATION_EVENT, rememberMutation);
    return () => window.removeEventListener(COMBAT_MUTATION_EVENT, rememberMutation);
  }, []);

  function currentCombatIdentity(): CombatMutationContext {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY) || "{}") as { role?: PartyChatRole; gmRole?: boolean; dockedIds?: string[]; clientId?: string };
      return {
        role: partyChatRoleFromPreferences(parsed),
        dockedCharacterIds: Array.isArray(parsed.dockedIds) ? parsed.dockedIds.filter((entry): entry is string => typeof entry === "string") : [],
        clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
        sourceParticipantId: null,
        override: false,
      };
    } catch {
      return { role: null, dockedCharacterIds: [], clientId: null, sourceParticipantId: null, override: false };
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("adnd-color-mode");
      const enabled = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setDarkMode(enabled);
      document.documentElement.dataset.theme = enabled ? "dark" : "light";
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const navigate = (event: Event) => {
      const characterId = (event as CustomEvent<{ characterId?: string }>).detail?.characterId;
      if (!characterId) return;
      setTab("characters");
      setExpandedCharacterIds([characterId]);
      setCharacterOrder((current) => [characterId, ...current.filter((entry) => entry !== characterId)]);
      setEmojiPickerFor(null);
      window.setTimeout(() => document.getElementById(`character-sheet-${characterId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    };
    window.addEventListener(CHARACTER_NAVIGATE_EVENT, navigate);
    return () => window.removeEventListener(CHARACTER_NAVIGATE_EVENT, navigate);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("adnd-character-list-view");
        const parsed = stored ? JSON.parse(stored) as { order?: string[]; expanded?: string[] } : {};
        setCharacterOrder(Array.isArray(parsed.order) ? parsed.order.filter((entry) => typeof entry === "string") : []);
        setExpandedCharacterIds(Array.isArray(parsed.expanded) ? parsed.expanded.filter((entry) => typeof entry === "string") : []);
      } catch {}
      setCharacterViewReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleDarkMode() {
    setDarkMode((current) => {
      const next = !current;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      window.localStorage.setItem("adnd-color-mode", next ? "dark" : "light");
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    fetch("/api/campaign")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load campaign.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        const validCharacterCampaigns = Array.isArray(result.state?.characterCampaigns)
          ? result.state.characterCampaigns.filter((entry: { id?: unknown; name?: unknown }) => typeof entry.id === "string" && entry.id && typeof entry.name === "string" && entry.name.trim()).map((entry: { id: string; name: string }) => ({ id: entry.id, name: entry.name.trim() }))
          : [];
        const loadedCharacterCampaigns = validCharacterCampaigns.length ? validCharacterCampaigns : emptyCampaign.characterCampaigns;
        const requestedActiveCampaignId = typeof result.state?.activeCharacterCampaignId === "string" ? result.state.activeCharacterCampaignId : "default";
        const activeCharacterCampaignId = loadedCharacterCampaigns.some((entry: { id: string }) => entry.id === requestedActiveCampaignId)
          ? requestedActiveCampaignId
          : loadedCharacterCampaigns[0].id;
        const loadedTravelByCampaign = Object.fromEntries(loadedCharacterCampaigns.map((entry: { id: string }) => [entry.id, {
          ...defaultTravelPlanner(),
          ...(result.state?.travelByCampaign?.[entry.id] ?? {}),
        }]));
        const loadedCharacterFolders = (result.state?.characterFolders ?? [])
          .filter((folder: { id?: unknown; campaignId?: unknown }) => typeof folder.id === "string" && folder.id && typeof folder.campaignId === "string" && loadedCharacterCampaigns.some((entry: { id: string }) => entry.id === folder.campaignId))
          .map((folder: { id: string; campaignId: string; name?: unknown; color?: unknown }) => ({ id: folder.id, campaignId: folder.campaignId, name: typeof folder.name === "string" && folder.name.trim() ? folder.name.trim().slice(0, 60) : "Untitled folder", color: typeof folder.color === "string" && /^#[0-9a-f]{6}$/i.test(folder.color) ? folder.color : "#667085" }));
        const loadedCharacterFolderIds = new Set(loadedCharacterFolders.map((folder: { id: string }) => folder.id));
        const loadedCharacters = (result.state?.characters ?? []).map((character: Character) => {
          const regularStats = (character.stats ?? ["10", "10", "10", "10", "10", "10"]).map(decimalStat) as Character["stats"];
          const stats = result.state?.statOrderVersion === 2
            ? regularStats
            : [regularStats[0], regularStats[3], regularStats[4], regularStats[1], regularStats[2], regularStats[5]] as Character["stats"];
          const weapons = Array.from({ length: Math.max(3, character.weapons?.length ?? 0) }, (_, index) => {
            const weapon = character.weapons?.[index];
            return weapon ? { ...weapon, id: weapon.id || id(), category: weapon.category ?? (index === 1 ? "ranged" : "melee"), specialized: Boolean(weapon.specialized), proficient: Boolean(weapon.proficient), sourceInventoryStackId: weapon.sourceInventoryStackId ?? null, weaponRulesId: weapon.weaponRulesId ?? weaponRulesForName(weapon.name)?.id ?? null } : blankWeapon(index);
          }) as CharacterWeapon[];
          const equippedWeaponId = character.equippedWeaponId === "unarmed" || weapons.some((weapon) => weapon.id === character.equippedWeaponId) ? character.equippedWeaponId : null;
          const equippedCategory = weapons.find((weapon) => weapon.id === equippedWeaponId)?.category;
          return deriveCharacterRecord({
            ...character,
            campaignId: loadedCharacterCampaigns.some((entry: { id: string }) => entry.id === character.campaignId) ? character.campaignId : loadedCharacterCampaigns[0].id,
            folderId: typeof character.folderId === "string" && loadedCharacterFolderIds.has(character.folderId) ? character.folderId : null,
            alignment: (["Lawful Good", "Neutral Good", "Chaotic Good", "Lawful Neutral", "True Neutral", "Chaotic Neutral"] as const).includes(character.alignment as "Lawful Good") ? character.alignment : "True Neutral",
            movementRate: Number.isFinite(Number(character.movementRate)) ? Math.max(0, Number(character.movementRate)) : 90,
            maxHp: character.maxHp ?? Math.max(1, character.currentHp),
            baseArmorClass: Number.isFinite(Number(character.baseArmorClass)) ? Number(character.baseArmorClass) : Number(character.armorClass) || 10,
            armorClassOverride: character.armorClassOverride !== null && character.armorClassOverride !== undefined && Number.isFinite(Number(character.armorClassOverride)) ? Number(character.armorClassOverride) : null,
            hitDice: character.hitDice ?? `${Math.max(1, character.level ?? 1)}d${/fighter|paladin|ranger/i.test(character.className ?? "") ? 10 : 8}`,
            currentXp: Math.max(0, Math.trunc(character.currentXp ?? 0)),
            totalXp: Math.max(0, Math.trunc(character.totalXp ?? 0)),
            age: character.age ?? "",
            height: character.height ?? "",
            weight: character.weight ?? "",
            tileColor: character.tileColor ?? "#dfe9d9",
            emoji: character.emoji ?? "🛡️",
            rawStats: Array.isArray(character.rawStats) && character.rawStats.length === 6 ? character.rawStats.map(decimalStat) as Character["stats"] : undefined,
            exceptionalStrength: character.exceptionalStrength !== null && character.exceptionalStrength !== undefined && Number.isFinite(Number(character.exceptionalStrength)) ? Math.max(1, Math.min(100, Math.trunc(Number(character.exceptionalStrength)))) : null,
            statPool: Array.isArray(character.statPool) && character.statPool.length === 6 ? character.statPool.map((score) => Math.max(3, Math.min(18, Math.trunc(Number(score) || 10)))) : undefined,
            statRolls: Array.isArray(character.statRolls) && character.statRolls.length === 6 ? character.statRolls.map((roll) => Array.isArray(roll) ? roll.slice(0, 4).map((die) => Math.max(1, Math.min(6, Math.trunc(Number(die) || 1)))) : []) : undefined,
            statAssignmentComplete: character.statAssignmentComplete !== false,
            scoresLocked: typeof character.scoresLocked === "boolean" ? character.scoresLocked : character.statAssignmentComplete !== false && character.className !== "Unassigned",
            raceLocked: typeof character.raceLocked === "boolean" ? character.raceLocked : character.statAssignmentComplete !== false && character.className !== "Unassigned",
            startingHpRolled: typeof character.startingHpRolled === "boolean" ? character.startingHpRolled : character.statAssignmentComplete !== false && character.className !== "Unassigned",
            notes: character.notes ?? "",
            abilityNotes: typeof character.abilityNotes === "string" ? character.abilityNotes : "",
            diceMacros: Array.from({ length: 3 }, (_, index) => {
              const macro = character.diceMacros?.[index] ?? { name: "", expression: "" };
              return macro.name === `Macro ${index + 1}` && ["1d20", "1d6", "2d6"][index] === macro.expression ? { name: "", expression: "" } : macro;
            }) as Character["diceMacros"],
            weapons,
            equippedWeaponId,
            handState: normalizeHandState(character.handState, equippedCategory),
            weaponProficiencies: character.weaponProficiencies ?? "",
            weaponSpecializations: character.weaponSpecializations ?? "",
            weaponTraining: Array.isArray(character.weaponTraining) ? character.weaponTraining.map((entry) => ({ weaponRulesId: String(entry.weaponRulesId ?? ""), proficient: Boolean(entry.proficient), specialized: Boolean(entry.specialized), specializationOverride: Boolean(entry.specializationOverride) })).filter((entry) => entry.weaponRulesId) : [],
            weaponTrainingLocked: Boolean(character.weaponTrainingLocked),
            classLevels: character.classLevels && typeof character.classLevels === "object" ? Object.fromEntries(Object.entries(character.classLevels).map(([name, level]) => [name, Math.max(1, Math.floor(Number(level) || 1))])) : Object.fromEntries(String(character.className ?? "").split("/").filter(Boolean).map((name) => [name.trim(), Math.max(1, Math.floor(character.level ?? 1))])),
            spellbook: Array.isArray(character.spellbook) ? character.spellbook.map((spell) => { const storedCastingTime = Number(spell.castingTime); return { id: spell.id || id(), name: String(spell.name ?? ""), level: Math.max(1, Math.trunc(Number(spell.level) || 1)), castingTime: Number.isFinite(storedCastingTime) ? Math.max(0, Math.trunc(storedCastingTime)) : 1, text: String(spell.text ?? ""), trackId: spell.trackId, understood: spell.understood ?? true, acquisition: spell.acquisition, acquisitionClassLevel: spell.acquisitionClassLevel, maximumSpellLevel: spell.maximumSpellLevel }; }) : [],
            spellSlots: Array.isArray(character.spellSlots) ? character.spellSlots.map((slot) => ({ id: slot.id || id(), level: Math.max(1, Math.trunc(Number(slot.level) || 1)), spellbookId: typeof slot.spellbookId === "string" ? slot.spellbookId : null, expended: slot.expended ?? false, trackId: slot.trackId, preparedSpellName: typeof slot.preparedSpellName === "string" ? slot.preparedSpellName : null, castingTime: Number.isFinite(Number(slot.castingTime)) ? Math.max(0, Math.trunc(Number(slot.castingTime))) : undefined, overCapacity: Boolean(slot.overCapacity) })) : [],
            inventoryLines: ensureInventoryLines(character.inventoryLines, stats[0]),
            stats,
          } as Character);
        });
        const loadedStableNpcs = (result.state?.stableNpcs ?? []).map(normalizeStableNpc);
        const stableNpcIds = new Set(loadedStableNpcs.map((npc) => npc.id));
        const characterIds = new Set(loadedCharacters.map((character) => character.id));
        const loadedDashboard = result.state?.dashboard ?? {};
        const legacyMarchingIds = (loadedDashboard.marchingOrderIds ?? []) as string[];
        const loadedSlotCount = Math.max(25, Array.isArray(loadedDashboard.marchingOrderSlots) ? loadedDashboard.marchingOrderSlots.length : 0);
        const loadedSlots = Array.from({ length: loadedSlotCount }, (_, index) =>
          Array.isArray(loadedDashboard.marchingOrderSlots)
            ? loadedDashboard.marchingOrderSlots[index] ?? null
            : legacyMarchingIds[index] ?? null,
        ) as Array<string | null>;
        const slotIds = loadedSlots.filter((entry): entry is string => Boolean(entry));
        const marchingOrderIds = Array.from(new Set([...slotIds, ...legacyMarchingIds])).filter((entry) => characterIds.has(entry) || stableNpcIds.has(entry));
        const missionCharacterIds = Array.from(new Set([
          ...(result.state?.missionCharacterIds ?? []),
          ...marchingOrderIds.filter((entry) => characterIds.has(entry)),
        ])).filter((entry) => characterIds.has(entry));
        const expeditionNpcIds = Array.from(new Set([
          ...(result.state?.expeditionNpcIds ?? []),
          ...marchingOrderIds.filter((entry) => stableNpcIds.has(entry)),
        ])).filter((entry) => stableNpcIds.has(entry));
        const loadedLights = loadedDashboard.lights ?? [];
        const loadedEncounterHistory = (loadedDashboard.encounterHistory ?? []).map((check: { tableDieSize?: number; tableRoll?: number; numberDieSize?: number; numberRoll?: number }) => ({
          ...check,
          tableDieSize: check.tableDieSize ?? check.numberDieSize,
          tableRoll: check.tableRoll ?? check.numberRoll,
        }));
        const loadedXpTracker = result.state?.xpTracker ?? {};
        let highestEnemyNumber = 0;
        let highestNpcNumber = 0;
        const loadedSegmentedParticipants = (result.state?.segmentedInitiative?.participants ?? []).map((participant) => {
          let markerNumber: number | null = null;
          if (participant.kind === "enemy") {
            const stored = Number(participant.markerNumber);
            markerNumber = Number.isInteger(stored) && stored > 0 ? stored : highestEnemyNumber + 1;
            highestEnemyNumber = Math.max(highestEnemyNumber, markerNumber);
          } else if (participant.kind === "npc") {
            const stored = Number(participant.markerNumber);
            markerNumber = Number.isInteger(stored) && stored > 0 ? stored : highestNpcNumber + 1;
            highestNpcNumber = Math.max(highestNpcNumber, markerNumber);
          }
          const genericName = participant.kind === "enemy" ? "Enemy" : participant.kind === "npc" ? "NPC" : "";
          const storedName = String(participant.name ?? "").trim();
          const participantName = participant.kind === "character"
            ? storedName || loadedCharacters.find((character) => character.id === participant.characterId)?.name || "Character"
            : !storedName || storedName === genericName
              ? `${genericName} ${markerNumber}`
              : storedName;
          const linkedCharacter = participant.kind === "character" ? loadedCharacters.find((character) => character.id === participant.characterId) : undefined;
          const linkedStableNpc = participant.stableNpcId ? loadedStableNpcs.find((npc) => npc.id === participant.stableNpcId) : undefined;
          const loadedHp = linkedCharacter?.currentHp ?? linkedStableNpc?.currentHp ?? participant.currentHp ?? 1;
          const forcedVitalityAction = (participant.kind === "character" || participant.kind === "npc")
            ? loadedHp <= -10 ? "skip" : loadedHp < 0 ? "die" : loadedHp === 0 ? "unconscious" : null
            : null;
          return {
            ...participant,
            markerNumber,
            name: participantName,
            hitDice: participant.hitDice ?? "",
            attackBonus: participant.attackBonus ?? null,
            armorClass: participant.armorClass ?? null,
            currentHp: loadedHp,
            maxHp: linkedStableNpc?.maxHp ?? participant.maxHp ?? Math.max(1, participant.currentHp ?? 1),
            nonIntelligent: participant.nonIntelligent ?? false,
            armoredHead: participant.armoredHead ?? true,
            joinedRound: participant.joinedRound ?? participant.declarationRound ?? 1,
            holdSegment: participant.holdSegment ?? 6,
            specializedRof: participant.specializedRof ?? 2,
            subInitiativeRoll: participant.subInitiativeRoll ?? null,
            ready: forcedVitalityAction ? true : participant.ready ?? false,
            targetId: participant.targetId ?? null,
            targetIds: Array.isArray(participant.targetIds) ? participant.targetIds.filter((entry: unknown): entry is string => typeof entry === "string") : participant.targetId ? [participant.targetId] : [],
            areaOfEffect: participant.areaOfEffect ?? false,
            preparedSpellSlotId: typeof participant.preparedSpellSlotId === "string" ? participant.preparedSpellSlotId : null,
            damageExpression: participant.damageExpression ?? "1d8",
            onslaughtAttacks: Array.isArray(participant.onslaughtAttacks) && participant.onslaughtAttacks.length >= 2
              ? participant.onslaughtAttacks.slice(0, 10).map((attack, index, attacks) => ({
                id: attack.id || `onslaught-${index + 1}`,
                timing: index === 0 ? "segment-1" as const : index === attacks.length - 1 ? "segment-10" as const : "rolled" as const,
                damageExpression: attack.damageExpression ?? participant.damageExpression ?? "1d8",
                rolledSegment: attack.rolledSegment ?? null,
              }))
              : [
                { id: "onslaught-1", timing: "segment-1" as const, damageExpression: participant.damageExpression ?? "1d8", rolledSegment: null },
                { id: "onslaught-2", timing: "rolled" as const, damageExpression: participant.damageExpression ?? "1d8", rolledSegment: null },
                { id: "onslaught-3", timing: "segment-10" as const, damageExpression: participant.damageExpression ?? "1d8", rolledSegment: null },
              ],
            equippedWeaponId: participant.equippedWeaponId ?? null,
            pendingWeaponId: participant.pendingWeaponId ?? null,
            resolutions: participant.resolutions ?? {},
            armorMode: participant.armorMode === "worn" ? "worn" : "natural",
            armorProfile: normalizeMonsterArmorProfile(participant.armorMode === "worn" ? "worn" : "natural", participant.armorProfile, participant.armorClass ?? null),
            attackMode: participant.attackMode === "weapon" ? "weapon" : "natural",
            naturalSpeed: ["fast", "normal", "slow"].includes(String(participant.naturalSpeed)) ? participant.naturalSpeed : "normal",
            weaponRulesId: typeof participant.weaponRulesId === "string" ? participant.weaponRulesId : null,
            weaponRulesIds: Array.isArray(participant.weaponRulesIds) ? participant.weaponRulesIds.filter((entry: unknown): entry is string => typeof entry === "string") : typeof participant.weaponRulesId === "string" ? [participant.weaponRulesId] : [],
            manualHitModifier: typeof participant.manualHitModifier === "string" ? participant.manualHitModifier : "+0",
            manualDamageModifier: typeof participant.manualDamageModifier === "string" ? participant.manualDamageModifier : "+0",
            temporaryDamage: Math.max(0, Number(participant.temporaryDamage) || 0),
            movementRate: Math.max(0, Number(participant.movementRate) || 0),
            unarmedOverrides: normalizeUnarmedOverrides(participant.unarmedOverrides),
            size: ["tiny", "small", "medium", "large", "huge", "gargantuan"].includes(String(participant.size)) ? participant.size : participant.large ? "large" : "medium",
            large: ["large", "huge", "gargantuan"].includes(String(participant.size)) || Boolean(participant.large),
            action: forcedVitalityAction ?? (String(participant.action) === "unarmed" ? "grapple" : participant.action),
            statusNote: forcedVitalityAction === "skip" ? "EXSANGUINATED" : forcedVitalityAction === "die" ? "Dying" : forcedVitalityAction === "unconscious" ? "Unconscious" : participant.statusNote ?? "",
          };
        });
        const loadedSegmentedEffects = result.state?.segmentedInitiative?.effects ?? [];
        const automaticUnconsciousEffects = loadedSegmentedParticipants
          .filter((participant) => (participant.kind === "character" || participant.kind === "npc") && participant.currentHp <= 0 && participant.currentHp > -10)
          .filter((participant) => !loadedSegmentedEffects.some((effect: { participantId?: string; name?: string }) => effect.participantId === participant.id && effect.name === "Unconscious"))
          .map((participant) => ({ id: id(), name: "Unconscious", target: participant.name, participantId: participant.id, description: "Cannot take voluntary actions while at 0 or negative HP.", remainingRounds: 1 }));
        const state = {
          ...emptyCampaign,
          ...result.state,
          statOrderVersion: 2,
          characterCampaigns: loadedCharacterCampaigns,
          activeCharacterCampaignId,
          sharedInventoryByCampaign: Object.fromEntries(loadedCharacterCampaigns.map((entry: { id: string }) => [entry.id, []])),
          partyFundsByCampaign: Object.fromEntries(loadedCharacterCampaigns.map((entry: { id: string }) => [entry.id, Math.max(0, result.state?.partyFundsByCampaign?.[entry.id] ?? (entry.id === activeCharacterCampaignId ? result.state?.partyFund ?? 0 : 0))])),
          partyFund: Math.max(0, result.state?.partyFundsByCampaign?.[activeCharacterCampaignId] ?? result.state?.partyFund ?? 0),
          characters: loadedCharacters,
          characterFolders: loadedCharacterFolders,
          stableNpcs: loadedStableNpcs,
          discardedStableNpcs: Array.isArray(result.state?.discardedStableNpcs) ? result.state.discardedStableNpcs : [],
          expeditionNpcIds,
          missionCharacterIds,
          travelByCampaign: loadedTravelByCampaign,
          inventoryManagement: normalizeInventoryManagement(result.state?.inventoryManagement, loadedCharacters, activeCharacterCampaignId),
          xpTracker: {
            ...emptyCampaign.xpTracker,
            ...loadedXpTracker,
            enemies: (loadedXpTracker.enemies ?? []).map((enemy: { id: string; name: string; hitDice?: string | number; hitPoints?: number; specialAbilities?: number; exceptionalAbilities?: number; xp?: number }) => ({
              ...enemy,
              hitDice: String(enemy.hitDice ?? "1"),
              hitPoints: Math.max(1, enemy.hitPoints ?? 1),
              specialAbilities: Math.max(0, enemy.specialAbilities ?? 0),
              exceptionalAbilities: Math.max(0, enemy.exceptionalAbilities ?? 0),
              xp: Math.max(0, Math.trunc(enemy.xp ?? 0)),
            })),
            treasureXpAwardedItemValues: loadedXpTracker.treasureXpAwardedItemValues ?? {},
            treasureGp: Math.max(0, Math.trunc(loadedXpTracker.treasureGp ?? 0)),
            otherXp: Math.max(0, Math.trunc(loadedXpTracker.otherXp ?? 0)),
            shareWeights: loadedXpTracker.shareWeights ?? {},
            primeXpBonuses: loadedXpTracker.primeXpBonuses ?? {},
            recentEnemies: loadedXpTracker.recentEnemies ?? [],
          },
          segmentedInitiative: {
            ...emptyCampaign.segmentedInitiative,
            ...(result.state?.segmentedInitiative ?? {}),
            partySurpriseRoll: result.state?.segmentedInitiative?.partySurpriseRoll ?? null,
            oppositionSurpriseRoll: result.state?.segmentedInitiative?.oppositionSurpriseRoll ?? null,
            partySurpriseSegments: result.state?.segmentedInitiative?.partySurpriseSegments
              ?? (result.state?.segmentedInitiative?.partySurprised ? 1 : 0),
            oppositionSurpriseSegments: result.state?.segmentedInitiative?.oppositionSurpriseSegments
              ?? (result.state?.segmentedInitiative?.oppositionSurprised ? 1 : 0),
            partySurpriseThreshold: result.state?.segmentedInitiative?.partySurpriseThreshold ?? 2,
            oppositionSurpriseThreshold: result.state?.segmentedInitiative?.oppositionSurpriseThreshold ?? 2,
            participants: loadedSegmentedParticipants,
            engagements: normalizeEngagements(result.state?.segmentedInitiative?.engagements),
            grappleHolds: Array.isArray(result.state?.segmentedInitiative?.grappleHolds) ? result.state.segmentedInitiative.grappleHolds : [],
            pendingUnarmed: result.state?.segmentedInitiative?.pendingUnarmed ?? null,
            effects: [...loadedSegmentedEffects, ...automaticUnconsciousEffects],
            declarationStartedAt: result.state?.segmentedInitiative?.declarationStartedAt
              ?? (result.state?.segmentedInitiative?.phase === "declaration" ? Date.now() : null),
            showAllDeclarations: Boolean(result.state?.segmentedInitiative?.showAllDeclarations),
            combatTallies: result.state?.segmentedInitiative?.combatTallies ?? {},
            lastCheers: Array.isArray(result.state?.segmentedInitiative?.lastCheers) ? result.state.segmentedInitiative.lastCheers : [],
          },
          missionCharacterIds,
          dashboard: {
            ...emptyCampaign.dashboard,
            ...loadedDashboard,
            encounterTableDieSize: loadedDashboard.encounterTableDieSize ?? loadedDashboard.encounterNumberDieSize ?? emptyCampaign.dashboard.encounterTableDieSize,
            partySurpriseChance: loadedDashboard.partySurpriseChance ?? emptyCampaign.dashboard.partySurpriseChance,
            foesSurpriseChance: loadedDashboard.foesSurpriseChance ?? emptyCampaign.dashboard.foesSurpriseChance,
            encounterActive: loadedDashboard.encounterActive ?? false,
            marchingOrderIds,
            marchingOrderSlots: loadedSlots.map((entry) => entry && marchingOrderIds.includes(entry) ? entry : null),
            scoutingCharacterId: loadedDashboard.scoutingCharacterId && (missionCharacterIds.includes(loadedDashboard.scoutingCharacterId) || expeditionNpcIds.includes(loadedDashboard.scoutingCharacterId)) ? loadedDashboard.scoutingCharacterId : null,
            encounterHistory: loadedEncounterHistory,
            lights: [
              loadedLights.find((light: { type: string }) => light.type === "torch") ?? emptyCampaign.dashboard.lights[0],
              loadedLights.find((light: { type: string }) => light.type === "lantern") ?? emptyCampaign.dashboard.lights[1],
            ],
          },
        } as CampaignState;
        setCampaign(state);
        versionRef.current = result.version || 0;
        serverCampaignRef.current = state;
        lastSavedRef.current = JSON.stringify(state);
        hydratedRef.current = true;
        setSaveStatus("saved");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load campaign.");
        hydratedRef.current = true;
        setSaveStatus("error");
      });
    return () => {
      active = false;
    };
  }, [setCampaign]);

  useEffect(() => {
    if (!characterViewReady) return;
    try { window.localStorage.setItem("adnd-character-list-view", JSON.stringify({ order: characterOrder, expanded: expandedCharacterIds })); } catch {}
  }, [characterOrder, characterViewReady, expandedCharacterIds]);

  async function flushCampaignSave() {
    if (!hydratedRef.current) return;
    if (campaignSaveInFlightRef.current) {
      campaignSaveRequestedRef.current = true;
      return;
    }
    campaignSaveInFlightRef.current = true;
    let conflictRetries = 0;
    try {
      do {
        campaignSaveRequestedRef.current = false;
        let pending = pendingCampaignSaveRef.current;
        if (!pending) {
          const submittedState = campaignRef.current;
          const submittedSerialized = JSON.stringify(submittedState);
          if (submittedSerialized === lastSavedRef.current) break;
          const baseState = serverCampaignRef.current;
          const explicitOperations = [...pendingCampaignOperationsRef.current];
          const generatedOperations = promoteAtomicCampaignOperations(diffCampaignOperations(baseState, submittedState), baseState);
          const operations = replaceGeneratedOperations(generatedOperations, explicitOperations);
          if (!operations.length) break;
          pending = {
            mutationId: sharedId(),
            operations,
            submittedState,
            baseState,
            expectedVersion: versionRef.current,
            combatActor: pendingCombatMutationRef.current ?? currentCombatIdentity(),
            explicitOperationCount: explicitOperations.length,
          };
          pendingCampaignSaveRef.current = pending;
        }
        setSaveStatus("saving");
        const response = await fetch("/api/campaign", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ operations: pending.operations, mutationId: pending.mutationId, expectedVersion: pending.expectedVersion, combatActor: pending.combatActor }),
        });
        const result = await response.json();
        if (response.status === 403) {
          if (result.state && typeof result.version === "number") {
            const authoritativeState = normalizeRemoteCampaignState(result.state);
            const serialized = JSON.stringify(authoritativeState);
            const currentState = campaignRef.current;
            // The rejected request itself is the merge base. This removes its
            // denied changes while preserving input made after it was sent.
            const reconciled = mergeCampaignStates(pending.submittedState, currentState, authoritativeState);
            versionRef.current = result.version;
            serverCampaignRef.current = authoritativeState;
            lastSavedRef.current = serialized;
            setCampaign(reconciled);
            if (JSON.stringify(reconciled) !== serialized) campaignSaveRequestedRef.current = true;
          }
          pendingCampaignOperationsRef.current.splice(0, pending.explicitOperationCount);
          pendingCampaignSaveRef.current = null;
          if (pendingCombatMutationRef.current === pending.combatActor) pendingCombatMutationRef.current = null;
          setSaveStatus(campaignSaveRequestedRef.current ? "saving" : "saved");
          // A denied stale/background mutation has already been reconciled to
          // the authoritative state. Do not turn it into a persistent Reload
          // banner; explicit controls remain disabled by the same permissions.
          setLoadError("");
          break;
        }
        if (response.status === 409 && result.state && typeof result.version === "number") {
          const authoritativeState = normalizeRemoteCampaignState(result.state);
          versionRef.current = result.version;
          serverCampaignRef.current = authoritativeState;
          lastSavedRef.current = JSON.stringify(authoritativeState);
          const reconciled = mergeCampaignStates(pending.baseState, campaignRef.current, authoritativeState);
          if (JSON.stringify(reconciled) !== JSON.stringify(campaignRef.current)) setCampaign(reconciled);
          pendingCampaignSaveRef.current = null;
          campaignSaveRequestedRef.current = true;
          conflictRetries += 1;
          const backoff = Math.min(600, 40 * (2 ** Math.min(conflictRetries, 3))) + secureRandomIndex(61);
          await new Promise((resolve) => window.setTimeout(resolve, backoff));
          continue;
        }
        if (!response.ok || !result.state || typeof result.version !== "number") throw new Error(result.error || "Could not save campaign.");

        const authoritativeState = normalizeRemoteCampaignState(result.state);
        const confirmedState = result.version >= versionRef.current ? authoritativeState : serverCampaignRef.current;
        if (result.version >= versionRef.current) {
          versionRef.current = result.version;
          serverCampaignRef.current = authoritativeState;
          lastSavedRef.current = JSON.stringify(authoritativeState);
        }
        pendingCampaignOperationsRef.current.splice(0, pending.explicitOperationCount);
        pendingCampaignSaveRef.current = null;
        if (pendingCombatMutationRef.current === pending.combatActor) pendingCombatMutationRef.current = null;

        // Preserve keystrokes or clicks made after this request began while
        // incorporating other clients' accepted changes from the response.
        const currentState = campaignRef.current;
        const reconciled = mergeCampaignStates(pending.submittedState, currentState, confirmedState);
        if (JSON.stringify(reconciled) !== JSON.stringify(currentState)) setCampaign(reconciled);
        setLoadError("");
        setSaveStatus("saved");
        if (JSON.stringify(reconciled) !== lastSavedRef.current) campaignSaveRequestedRef.current = true;
      } while (campaignSaveRequestedRef.current);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not save campaign.");
      setSaveStatus("error");
      if (campaignRetryTimerRef.current !== null) window.clearTimeout(campaignRetryTimerRef.current);
      campaignRetryTimerRef.current = window.setTimeout(() => { campaignRetryTimerRef.current = null; void flushCampaignSave(); }, 1200);
    } finally {
      campaignSaveInFlightRef.current = false;
      if (campaignSaveRequestedRef.current && JSON.stringify(campaignRef.current) !== lastSavedRef.current) void flushCampaignSave();
    }
  }

  useEffect(() => {
    if (!hydratedRef.current || JSON.stringify(campaign) === lastSavedRef.current) return;
    const timer = window.setTimeout(() => { void flushCampaignSave(); }, 220);
    return () => window.clearTimeout(timer);
  }, [campaign]);

  useEffect(() => () => {
    if (campaignRetryTimerRef.current !== null) window.clearTimeout(campaignRetryTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshSharedCampaign = async () => {
      if (!active || !hydratedRef.current || campaignPollInFlightRef.current) return;
      campaignPollInFlightRef.current = true;
      try {
        const response = await fetch("/api/campaign", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || typeof result.version !== "number" || result.version <= versionRef.current || !result.state) return;
        const priorServerState = serverCampaignRef.current;
        const currentState = campaignRef.current;
        const authoritativeState = normalizeRemoteCampaignState(result.state);
        const reconciled = mergeCampaignStates(priorServerState, currentState, authoritativeState);
        const serialized = JSON.stringify(authoritativeState);
        versionRef.current = result.version;
        serverCampaignRef.current = authoritativeState;
        lastSavedRef.current = serialized;
        campaignRef.current = reconciled;
        setCampaign(reconciled);
        setLoadError("");
        setSaveStatus("saved");
        if (JSON.stringify(reconciled) !== serialized) campaignSaveRequestedRef.current = true;
      } catch {
        // A later poll retries; transient sync failures should not interrupt play.
      } finally {
        campaignPollInFlightRef.current = false;
      }
    };
    const timer = window.setInterval(refreshSharedCampaign, 650);
    void refreshSharedCampaign();
    return () => { active = false; window.clearInterval(timer); };
  }, [setCampaign]);

  function updateCharacter(characterId: string, patch: Partial<Character>) {
    setCampaign((current) => {
      let characters = current.characters.map((character) =>
        character.id === characterId ? (() => {
          const next = { ...character, ...patch };
          const refreshRules = patch.className !== undefined
            || patch.level !== undefined
            || patch.classLevels !== undefined
            || patch.race !== undefined
            || patch.rawStats !== undefined
            || patch.stats !== undefined
            || patch.age !== undefined
            || patch.weaponTraining !== undefined
            || patch.spellbook !== undefined
            || patch.spellSlots !== undefined;
          if (!refreshRules) return next;
          const completingClass = patch.statAssignmentComplete === true && character.statAssignmentComplete === false;
          const regeneratePhysical = completingClass && (!character.startingInventoryGranted || !character.height || !character.weight);
          const regenerateAge = completingClass && (!character.startingInventoryGranted || !character.age);
          return deriveCharacterRecord(next, { regeneratePhysical, regenerateAge });
        })() : character,
      );
      let inventoryManagement = current.inventoryManagement;
      if (patch.className !== undefined || patch.statAssignmentComplete !== undefined || patch.weaponTrainingLocked !== undefined) {
        const character = characters.find((entry) => entry.id === characterId);
        if (character) {
          const grants = addCharacterGenerationGrants(inventoryManagement, characters, character);
          characters = characters.map((entry) => entry.id === characterId ? grants.character : entry);
          inventoryManagement = grants.inventory;
        }
      }
      return syncPhysicalEquipment({ ...current, characters, inventoryManagement });
    });
  }

  function addCharacter() {
    const character = { ...newCharacter(), campaignId: campaign.activeCharacterCampaignId };
    setCampaign((current) => {
      const characters = [...current.characters, character];
      return syncPhysicalEquipment({ ...current, characters, inventoryManagement: addStarterKit(current.inventoryManagement, characters, character) });
    });
    setCharacterOrder([...orderedCharacters.map((entry) => entry.id), character.id]);
    setExpandedCharacterIds((current) => [...current, character.id]);
  }

  function moveCharacter(characterId: string, direction: -1 | 1) {
    setCharacterOrder((current) => {
      const order = orderedCharacters.map((character) => character.id);
      const index = order.indexOf(characterId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return order;
    });
  }

  function toggleCharacterExpanded(characterId: string) {
    setExpandedCharacterIds((current) => current.includes(characterId)
      ? current.filter((entry) => entry !== characterId)
      : [...current, characterId]);
  }

  function removeCharacter(characterId: string) {
    const character = campaign.characters.find((entry) => entry.id === characterId);
    if (!character || !window.confirm(`Move ${character.name} to character discard? It can be restored later.`)) return;
    setCharacterOrder((current) => current.filter((entry) => entry !== characterId));
    setExpandedCharacterIds((current) => current.filter((entry) => entry !== characterId));
    setEmojiPickerFor((current) => current === characterId ? null : current);
    setCampaign((current) => {
      const owner = current.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === characterId);
      const inventoryManagement = owner ? discardInventoryOwner(current.inventoryManagement, owner.id).state : current.inventoryManagement;
      return {
      ...current,
      inventoryManagement,
      characters: current.characters.filter((character) => character.id !== characterId),
      discardedCharacters: [{ id: id(), character, discardedAt: Date.now() }, ...current.discardedCharacters],
      missionCharacterIds: current.missionCharacterIds.filter((id) => id !== characterId),
      initiativeResults: current.initiativeResults.filter(
        (result) => result.characterId !== characterId,
      ),
      dashboard: {
        ...current.dashboard,
        marchingOrderIds: current.dashboard.marchingOrderIds.filter((id) => id !== characterId),
        marchingOrderSlots: current.dashboard.marchingOrderSlots.map((id) => id === characterId ? null : id),
        lightCarrierIds: current.dashboard.lightCarrierIds.filter((id) => id !== characterId),
        scoutingCharacterId: current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId,
      },
      segmentedInitiative: {
        ...current.segmentedInitiative,
        participants: current.segmentedInitiative.participants.filter(
          (participant) => participant.characterId !== characterId,
        ),
      },
    }; });
  }

  function restoreDiscardedCharacter(discardId: string) {
    setCampaign((current) => {
      const discard = current.discardedCharacters.find((entry) => entry.id === discardId);
      if (!discard || current.characters.some((entry) => entry.id === discard.character.id)) return current;
      return {
        ...current,
        characters: [...current.characters, { ...discard.character, campaignId: current.activeCharacterCampaignId, folderId: current.characterFolders.some((folder) => folder.id === discard.character.folderId && folder.campaignId === current.activeCharacterCampaignId) ? discard.character.folderId : null }],
        discardedCharacters: current.discardedCharacters.filter((entry) => entry.id !== discardId),
      };
    });
  }

  function toggleMissionCharacter(characterId: string) {
    setCampaign((current) => {
      const onMission = current.missionCharacterIds.includes(characterId);
      const missionCharacterIds = onMission
        ? current.missionCharacterIds.filter((entry) => entry !== characterId)
        : [...current.missionCharacterIds, characterId];
      const slots = current.dashboard.marchingOrderSlots.map((entry) =>
        onMission && entry === characterId ? null : entry,
      );
      if (!onMission && !slots.includes(characterId)) {
        const firstEmpty = slots.indexOf(null);
        if (firstEmpty >= 0) slots[firstEmpty] = characterId;
        else slots.push(characterId, ...Array.from({ length: Math.max(0, current.dashboard.marchColumns - 1) }, () => null));
      }
      return {
        ...current,
        missionCharacterIds,
        initiativeResults: current.initiativeResults.filter((entry) => entry.characterId !== characterId),
        dashboard: {
          ...current.dashboard,
          marchingOrderIds: onMission
            ? current.dashboard.marchingOrderIds.filter((entry) => entry !== characterId)
            : Array.from(new Set([...current.dashboard.marchingOrderIds, characterId])),
          marchingOrderSlots: slots,
          lightCarrierIds: onMission
            ? current.dashboard.lightCarrierIds.filter((entry) => entry !== characterId)
            : current.dashboard.lightCarrierIds,
          scoutingCharacterId: onMission && current.dashboard.scoutingCharacterId === characterId ? null : current.dashboard.scoutingCharacterId,
        },
      };
    });
  }

  function createCharacterCampaign() {
    const proposed = window.prompt("Campaign name", `Campaign ${campaign.characterCampaigns.length + 1}`)?.trim();
    if (!proposed) return;
    const campaignId = id();
    setCampaign((current) => ({
      ...current,
      characterCampaigns: [...current.characterCampaigns, { id: campaignId, name: proposed }],
      activeCharacterCampaignId: campaignId,
      sharedInventoryByCampaign: { ...current.sharedInventoryByCampaign, [campaignId]: [] },
      travelByCampaign: { ...(current.travelByCampaign ?? {}), [campaignId]: defaultTravelPlanner() },
      partyFund: 0,
      partyFundsByCampaign: { ...current.partyFundsByCampaign, [campaignId]: 0 },
    }));
    setExpandedCharacterIds([]);
    setEmojiPickerFor(null);
  }

  function renameCharacterCampaign() {
    const currentCampaign = campaign.characterCampaigns.find((entry) => entry.id === campaign.activeCharacterCampaignId);
    if (!currentCampaign) return;
    const proposed = window.prompt("Campaign name", currentCampaign.name)?.trim();
    if (!proposed || proposed === currentCampaign.name) return;
    setCampaign((current) => ({
      ...current,
      characterCampaigns: current.characterCampaigns.map((entry) => entry.id === current.activeCharacterCampaignId ? { ...entry, name: proposed } : entry),
    }));
  }

  function deleteCharacterCampaign() {
    if (campaign.characterCampaigns.length <= 1) return window.alert("At least one campaign must remain.");
    if (window.prompt("Enter deletion password") !== "MustardDog8") return;
    const campaignId = campaign.activeCharacterCampaignId;
    const fallback = campaign.characterCampaigns.find((entry) => entry.id !== campaignId)!;
    setCampaign((current) => ({
      ...current,
      activeCharacterCampaignId: fallback.id,
      characterCampaigns: current.characterCampaigns.filter((entry) => entry.id !== campaignId),
      characters: current.characters.filter((entry) => entry.campaignId !== campaignId),
      characterFolders: current.characterFolders.filter((entry) => entry.campaignId !== campaignId),
      stableNpcs: current.stableNpcs.filter((entry) => entry.campaignId !== campaignId),
      discardedStableNpcs: current.discardedStableNpcs.filter((entry) => entry.npc.campaignId !== campaignId),
      expeditionNpcIds: current.expeditionNpcIds.filter((npcId) => current.stableNpcs.some((entry) => entry.id === npcId && entry.campaignId !== campaignId)),
      missionCharacterIds: current.missionCharacterIds.filter((characterId) => current.characters.some((entry) => entry.id === characterId && entry.campaignId !== campaignId)),
      inventoryManagement: { ...current.inventoryManagement, owners: current.inventoryManagement.owners.filter((entry) => entry.campaignId !== campaignId), locations: current.inventoryManagement.locations.filter((entry) => entry.campaignId !== campaignId), containers: current.inventoryManagement.containers.filter((entry) => entry.campaignId !== campaignId), stacks: current.inventoryManagement.stacks.filter((entry) => entry.campaignId !== campaignId) },
      partyFund: current.partyFundsByCampaign[fallback.id] ?? 0,
      partyFundsByCampaign: Object.fromEntries(Object.entries(current.partyFundsByCampaign).filter(([id]) => id !== campaignId)),
      sharedInventoryByCampaign: Object.fromEntries(Object.entries(current.sharedInventoryByCampaign).filter(([id]) => id !== campaignId)),
      travelByCampaign: Object.fromEntries(Object.entries(current.travelByCampaign ?? {}).filter(([id]) => id !== campaignId)),
      segmentedInitiative: { ...current.segmentedInitiative, participants: [] },
    }));
  }

  const statusLabel =
    saveStatus === "loading"
      ? "Loading campaign…"
      : saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "error"
          ? "Save problem"
          : "Saved";

  const characterPositions = new Map(characterOrder.map((characterId, index) => [characterId, index]));
  const orderedCharacters = campaign.characters
    .filter((character) => character.campaignId === campaign.activeCharacterCampaignId)
    .sort((a, b) => (characterPositions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (characterPositions.get(b.id) ?? Number.MAX_SAFE_INTEGER));

  return (
    <main className="toolkit-shell">
      <header className="campaign-header">
        <div className="campaign-brand"><h1>AD&amp;D Dashboard</h1><span className="dashboard-byline">by Gamemaster Jer</span></div>
        <div className="header-actions">
          <span className={`save-status ${saveStatus}`} aria-live="polite">{statusLabel}</span>
          <button className="theme-toggle" onClick={toggleDarkMode} aria-pressed={darkMode}>{darkMode ? "☀️ Light" : "🌙 Dark"}</button>
        </div>
      </header>

      {loadError && (
        <div className="error-banner" role="alert">
          {loadError} <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}

      <nav className="tabs" aria-label="Toolkit sections">
        {(
          [
            ["dashboard", "Crawl & Dashboard"],
            ["characters", "Characters"],
            ["segmented", "Combat"],
            ["inventory-management", "Items"],
            ["party", "Shopping"],
            ["expeditions", "Expeditions"],
            ["travel", "Travel"],
            ["xp", "XP"],
            ["player-guide", "Player Guide"],
            ["gm-guide", "GM Guide"],
            ["phb", "AD&D PHB"],
            ["dmg", "AD&D DMG"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab-${key}${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" ? (
        <DashboardPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "characters" ? (
        <CharacterSheetPanel
          campaign={campaign}
          setCampaign={setCampaign}
          characters={orderedCharacters}
          expandedCharacterIds={expandedCharacterIds}
          setExpandedCharacterIds={setExpandedCharacterIds}
          emojiPickerFor={emojiPickerFor}
          setEmojiPickerFor={setEmojiPickerFor}
          updateCharacter={updateCharacter}
          addCharacter={addCharacter}
          moveCharacter={moveCharacter}
          toggleCharacterExpanded={toggleCharacterExpanded}
          removeCharacter={removeCharacter}
          restoreDiscardedCharacter={restoreDiscardedCharacter}
          toggleMissionCharacter={toggleMissionCharacter}
          createCharacterCampaign={createCharacterCampaign}
          renameCharacterCampaign={renameCharacterCampaign}
          deleteCharacterCampaign={deleteCharacterCampaign}
        />
      ) : tab === "party" ? (
        <PartyPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "expeditions" ? (
        <ExpeditionsPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "travel" ? (
        <TravelPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "inventory-management" ? (
        <InventoryManagementPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "xp" ? (
        <XpPanel campaign={campaign} setCampaign={setCampaign} />
      ) : tab === "player-guide" ? (
        <section className="pdf-reader-shell" aria-label="OSRIC Player Guide">
          <iframe title="OSRIC 3.0 Player Guide" src="/osric-player-guide.pdf#view=FitH&pagemode=bookmarks&spread=even" />
          <p>Open or download the <a href="/osric-player-guide.pdf" target="_blank" rel="noreferrer">OSRIC Player Guide PDF</a>.</p>
        </section>
      ) : tab === "gm-guide" ? (
        <section className="pdf-reader-shell" aria-label="OSRIC Gamemaster Guide">
          <iframe title="OSRIC 3.0 Gamemaster Guide" src="/osric-gamemaster-guide.pdf#view=FitH&pagemode=bookmarks&spread=even" />
          <p>Open or download the <a href="/osric-gamemaster-guide.pdf" target="_blank" rel="noreferrer">OSRIC Gamemaster Guide PDF</a>.</p>
        </section>
      ) : tab === "phb" ? (
        <section className="pdf-reader-shell" aria-label="AD&D Players Handbook">
          <iframe title="AD&D Players Handbook" src="/add-players-handbook.pdf#view=FitH&pagemode=bookmarks&spread=even" />
          <p>Open or download the <a href="/add-players-handbook.pdf" target="_blank" rel="noreferrer">AD&amp;D Players Handbook PDF</a>.</p>
        </section>
      ) : tab === "dmg" ? (
        <section className="pdf-reader-shell" aria-label="AD&D Dungeon Masters Guide">
          <iframe title="AD&D Dungeon Masters Guide" src="/add-dungeon-masters-guide.pdf#view=FitH&pagemode=bookmarks&spread=even" />
          <p>Open or download the <a href="/add-dungeon-masters-guide.pdf" target="_blank" rel="noreferrer">AD&amp;D Dungeon Masters Guide PDF</a>.</p>
        </section>
      ) : (
        <SegmentedInitiativePanel
          campaign={campaign}
          setCampaign={setCampaign}
        />
      )}
      <ChatDrawer campaign={campaign} setCampaign={setCampaign} combatTabActive={tab === "segmented"} />
    </main>
  );
}
