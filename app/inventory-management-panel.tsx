"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { siteCatalog } from "./catalog-data";
import { ADND_CURRENCY_RULE, CURRENCY_BY_CODE, CURRENCY_DEFINITIONS, currencyCodeFromName, formatGpAsPrice } from "./currency.ts";
import { equipmentDefaultForName, equipmentDisplayName, osricEquipmentDefaults, type EquipmentDefault } from "./equipment-defaults";
import { phbWeaponRules, weaponHandednessHint } from "./weapon-rules";
import { EquipmentRulesInfoButton, WeaponRulesTooltip } from "./weapon-rules-tooltip";
import { effectiveArmorMovementRate, encumbranceLoadPercent, encumbranceSummary } from "./movement";
import { PARTY_CHAT_PREFERENCES_KEY } from "./party-chat-role";
import { characterTileStyle } from "./tile-color";
import type { CampaignState, Character, EncumbranceClass, InventoryContainer, InventoryEquipment, InventoryManagementState, InventoryStack, PhysicalInventoryOwner } from "./types";
import {
  activeCharacterOwnerIds,
  appendInventoryActivity,
  autoAssign,
  clearInventoryDiscard,
  combinableInventoryStackIds,
  combineInventoryStacks,
  containerIsHidden,
  discardInventoryContainer,
  discardInventoryLocation,
  discardInventoryOwner,
  discardInventoryStack,
  dumpContainerContentsToGround,
  dumpHolderToGround,
  encumbranceClassLabel,
  formatStoneUnits,
  getContainerCapacityUnits,
  getContainerDescendantIds,
  getContainerEffectiveLoadUnits,
  getContainerPathToRoot,
  getContainerRootHolder,
  getContainerUsedUnits,
  getOwnerCapacityUnits,
  getOwnerUsedUnits,
  getStackEncumbranceUnits,
  giveAllTo,
  handLoadoutIssue,
  inventoryId,
  inventoryStackDisplayName,
  inventoryStacksGpValue,
  initiateInventorySale,
  isCoinStack,
  moveContainer,
  moveStack,
  moveStackToGround,
  moveStackToHand,
  moveStackToWorn,
  carrierBagsForOwner,
  normalizeInventoryManagement,
  pocketsToUnits,
  restoreInventoryDiscard,
  smartStack,
  setContainerHidden,
  setLocationHidden,
  sortAndRebalanceInventory,
  splitStack,
  spreadEvenly,
  stackRequiresBothHands,
  stoneToUnits,
  syncPhysicalEquipment,
  visibleInventoryOwners,
  UNITS_PER_POCKET,
  UNITS_PER_STONE,
} from "./inventory-management";

type Props = { campaign: CampaignState; setCampaign: Dispatch<SetStateAction<CampaignState>> };
type FormKind = "location" | "inventory" | "container" | "item" | "equipment" | null;
type DragPayload = { kind: "stack" | "container"; id: string };
type GroundSortKey = "name" | "kind" | "lastHolder" | "weight" | "value";
const TEXT_INVENTORY_CARD_MIME = "application/x-adnd-text-inventory-card";
const TEXT_INVENTORY_COLUMN_BREAK = "__adnd_text_inventory_right_column__";

const coinPresets = [...CURRENCY_DEFINITIONS].reverse().map((definition) => ({
  id: definition.code,
  name: definition.name,
  label: `${definition.tileEmoji} ${definition.label}${definition.treasureOnly ? " · treasure" : ""}`,
  gpValue: definition.gpValue,
}));

function capacityInputUnits(value: FormDataEntryValue | null, unit: FormDataEntryValue | null) {
  const amount = Math.max(0, Number(value) || 0);
  return unit === "coin" ? Math.round(amount) : unit === "pocket" ? pocketsToUnits(amount) : stoneToUnits(amount);
}

function dragPayload(event: DragEvent): DragPayload | null {
  try { return JSON.parse(event.dataTransfer.getData("application/x-adnd-inventory")) as DragPayload; } catch { return null; }
}

function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-adnd-inventory", JSON.stringify(payload));
}

function setTextInventoryCardDragPayload(event: DragEvent, key: string) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(TEXT_INVENTORY_CARD_MIME, key);
}

function textInventoryCardDragKey(event: DragEvent) {
  return event.dataTransfer.getData(TEXT_INVENTORY_CARD_MIME);
}

function postureHandLabels(character: Character) {
  const weapon = character.weapons.find((entry) => entry.id === character.equippedWeaponId)?.name || "Unarmed";
  switch (character.handState) {
    case "one-hand-shield": return { main: weapon, offhand: "Shield" };
    case "one-hand-light": return { main: weapon, offhand: "Torch / lantern" };
    case "one-hand-missile": return { main: weapon, offhand: "Javelin / sling" };
    case "one-hand-offhand": return { main: weapon, offhand: "Off-hand weapon" };
    case "two-hand-melee":
    case "two-hand-ranged": return { main: `${weapon} · 2H`, offhand: `${weapon} · 2H` };
    case "unarmed": return { main: "Unarmed", offhand: "Empty" };
    default: return { main: weapon, offhand: "Empty" };
  }
}

function capacityTone(used: number, capacity: number) {
  return used > capacity ? "over" : used === capacity && capacity > 0 ? "full" : "comfortable";
}

function formatItemUnits(units: number) {
  const rounded = Math.max(0, Math.round(units));
  return rounded < 100 ? `${rounded} unit${rounded === 1 ? "" : "s"}` : formatStoneUnits(rounded);
}

function compactItemWeight(units: number) {
  const safeUnits = Math.max(0, Math.round(Number(units) || 0));
  if (safeUnits === UNITS_PER_POCKET) return "1 pocket ea.";
  const quarterStones = Math.round(safeUnits / UNITS_PER_POCKET);
  const whole = Math.floor(quarterStones / 4);
  const remainder = quarterStones % 4;
  const fraction = remainder === 1 ? "1/4th" : remainder === 2 ? "1/2" : remainder === 3 ? "3/4ths" : "";
  const amount = whole && fraction ? `${whole} ${fraction}` : whole ? `${whole}` : fraction || (safeUnits ? (safeUnits / UNITS_PER_STONE).toFixed(2).replace(/^0/, "") : "0");
  return `${amount} stone ea.`;
}

function inventoryStackEmoji(stack: InventoryStack) {
  if (stack.equipment?.kind === "shield") return "🛡️";
  if (stack.equipment?.kind === "armor") return "👖";
  if (stack.equipment?.kind === "weapon") {
    if (stack.equipment.weaponType === "ranged") return stack.equipment.twoHanded ? "🏹" : "🪃";
    return stack.equipment.twoHanded ? "🪓" : "🗡️";
  }
  const currencyCode = currencyCodeFromName(stack.name);
  if (currencyCode) return CURRENCY_DEFINITIONS.find((definition) => definition.code === currencyCode)?.tileEmoji ?? "🪙";
  return stack.itemKind === "treasure" ? "💎" : "•";
}

function stackPlacementKey(stack: InventoryStack) {
  return [stack.containerId ?? "", stack.locationId ?? "", stack.placement ?? "", stack.handSlot ?? ""].join("|");
}

function containerPlacementKey(container: InventoryContainer) {
  return [container.holderType, container.holderId, container.hidden ? "hidden" : "visible"].join("|");
}

function stackIsInsideMovedContainer(stack: InventoryStack, containers: InventoryContainer[], movedContainerIds: Set<string>) {
  const containersById = new Map(containers.map((container) => [container.id, container]));
  const seen = new Set<string>();
  let containerId = stack.containerId;
  while (containerId && !seen.has(containerId)) {
    if (movedContainerIds.has(containerId)) return true;
    seen.add(containerId);
    const container = containersById.get(containerId);
    containerId = container?.holderType === "container" ? container.holderId : null;
  }
  return false;
}

export default function InventoryManagementPanel({ campaign, setCampaign }: Props) {
  const [form, setForm] = useState<FormKind>(null);
  const [notice, setNotice] = useState("Ready.");
  const [catalogMode, setCatalogMode] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [customCoinPreset, setCustomCoinPreset] = useState("");
  const [equipmentKind, setEquipmentKind] = useState<InventoryEquipment["kind"]>("weapon");
  const [equipmentDefaultId, setEquipmentDefaultId] = useState(osricEquipmentDefaults[0]?.id ?? "");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [scopeOwnerIds, setScopeOwnerIds] = useState<string[] | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNode, setDraggingNode] = useState<{ key: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const [activeBoardNodeKey, setActiveBoardNodeKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [flashingStackIds, setFlashingStackIds] = useState<Set<string>>(new Set());
  const [capacityWarningKeys, setCapacityWarningKeys] = useState<Set<string>>(new Set());
  const [groundSort, setGroundSort] = useState<{ key: GroundSortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });
  const [expandedGroundContainers, setExpandedGroundContainers] = useState<Set<string>>(new Set());
  const [openItemActionIds, setOpenItemActionIds] = useState<Set<string>>(new Set());
  const [partialMove, setPartialMove] = useState<{ stackId: string; quantity: number } | null>(null);
  const [desktopTextInventoryMode, setDesktopTextInventoryMode] = useState(false);
  const [mobileTextInventoryOverride, setMobileTextInventoryOverride] = useState<boolean | null>(null);
  const [isMobileInventory, setIsMobileInventory] = useState(false);
  const [textCollapsed, setTextCollapsed] = useState<Set<string>>(new Set());
  const [textInventoryOrder, setTextInventoryOrder] = useState<string[]>([]);
  const [boardNodeHeights, setBoardNodeHeights] = useState<Record<string, number>>({});
  const [viewerDockedCharacterIds, setViewerDockedCharacterIds] = useState<string[]>([]);
  const [inventoryIdentityLoaded, setInventoryIdentityLoaded] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const previousInventoryRef = useRef<Pick<InventoryManagementState, "stacks" | "containers"> | null>(null);
  const flashTimers = useRef(new Map<string, number>());
  const capacityWarningTimers = useRef(new Map<string, number>());
  const activeCampaignId = campaign.activeCharacterCampaignId;
  const state = campaign.inventoryManagement;
  const marchingOwnerIds = useMemo(() => activeCharacterOwnerIds(state, campaign), [state, campaign]);
  const textInventoryMode = isMobileInventory ? mobileTextInventoryOverride ?? true : desktopTextInventoryMode;

  function setTextInventoryMode(next: boolean) {
    if (isMobileInventory) {
      setMobileTextInventoryOverride(next);
      return;
    }
    setDesktopTextInventoryMode(next);
    window.localStorage.setItem("adnd-desktop-inventory-text-mode", next ? "text" : "board");
  }

  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    const update = (matches: boolean) => setIsMobileInventory(matches);
    update(query.matches);
    setDesktopTextInventoryMode(window.localStorage.getItem("adnd-desktop-inventory-text-mode") === "text");
    const handleChange = (event: MediaQueryListEvent) => update(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const readIdentity = (value?: { dockedIds?: string[] }) => {
      setViewerDockedCharacterIds(Array.isArray(value?.dockedIds) ? value.dockedIds.filter((entry): entry is string => typeof entry === "string") : []);
      setInventoryIdentityLoaded(true);
    };
    try { readIdentity(JSON.parse(window.localStorage.getItem(PARTY_CHAT_PREFERENCES_KEY) || "{}") as { dockedIds?: string[] }); }
    catch { readIdentity(); }
    const roleChange = (event: Event) => readIdentity((event as CustomEvent<{ dockedIds?: string[] }>).detail);
    window.addEventListener("adnd-role-change", roleChange);
    return () => window.removeEventListener("adnd-role-change", roleChange);
  }, []);

  useEffect(() => {
    const normalized = normalizeInventoryManagement(campaign.inventoryManagement, campaign.characters, campaign.activeCharacterCampaignId);
    if (JSON.stringify(normalized) !== JSON.stringify(campaign.inventoryManagement)) setCampaign((current) => syncPhysicalEquipment({ ...current, inventoryManagement: normalized }));
  }, [campaign.characters, campaign.activeCharacterCampaignId, campaign.inventoryManagement, setCampaign]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`adnd-text-inventory-order:${activeCampaignId}`);
      setTextInventoryOrder(stored ? JSON.parse(stored) as string[] : []);
    } catch { setTextInventoryOrder([]); }
  }, [activeCampaignId]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => {
      const next = Object.fromEntries([...board.querySelectorAll<HTMLElement>("[data-inventory-board-node]")].map((node) => [node.dataset.inventoryBoardNode ?? "", Math.ceil(node.offsetHeight)]));
      setBoardNodeHeights((current) => Object.keys(next).length === Object.keys(current).length && Object.entries(next).every(([key, height]) => current[key] === height) ? current : next);
    };
    const observer = new ResizeObserver(measure);
    board.querySelectorAll<HTMLElement>("[data-inventory-board-node]").forEach((node) => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [campaign.inventoryManagement, collapsed]);

  const ownerOrder = new Map(marchingOwnerIds.map((id, index) => [id, index]));
  const owners = [...visibleInventoryOwners(state, campaign)].sort((left, right) => (ownerOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (ownerOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  const inventoryOwnerKey = owners.map((owner) => `${owner.id}:${owner.characterId ?? ""}`).join("|");
  const inventoryIdentityKey = `${activeCampaignId}:${[...viewerDockedCharacterIds].sort().join(",")}`;

  useEffect(() => {
    if (!inventoryIdentityLoaded) return;
    const characterOwners = owners.filter((owner) => owner.type === "character");
    const defaultCollapsed = new Set(characterOwners.flatMap((owner) => {
      const chosen = Boolean(owner.characterId && viewerDockedCharacterIds.includes(owner.characterId));
      return chosen ? [`worn:${owner.id}`] : [`owner:${owner.id}`, `worn:${owner.id}`];
    }));
    const defaultTextCollapsed = new Set(characterOwners
      .filter((owner) => !owner.characterId || !viewerDockedCharacterIds.includes(owner.characterId))
      .map((owner) => `text:owner:${owner.id}`));
    const preferenceKey = `adnd-inventory-collapse-default-v2:${inventoryIdentityKey}`;
    try {
      const stored = window.localStorage.getItem(`adnd-inventory-collapsed:${activeCampaignId}`);
      if (window.localStorage.getItem(preferenceKey) && stored) setCollapsed(new Set(JSON.parse(stored) as string[]));
      else {
        setCollapsed(defaultCollapsed);
        window.localStorage.setItem(`adnd-inventory-collapsed:${activeCampaignId}`, JSON.stringify([...defaultCollapsed]));
        window.localStorage.setItem(preferenceKey, "1");
      }
    } catch { setCollapsed(defaultCollapsed); }
    setTextCollapsed(defaultTextCollapsed);
  }, [inventoryIdentityKey, inventoryIdentityLoaded, inventoryOwnerKey]);

  const allLocations = state.locations.filter((location) => location.campaignId === activeCampaignId);
  const locations = allLocations.filter((location) => !location.hidden);
  const ownerIds = new Set(owners.map((owner) => owner.id));
  const locationIds = new Set(locations.map((location) => location.id));
  const allCampaignContainers = state.containers.filter((container) => container.campaignId === activeCampaignId);
  const containers = allCampaignContainers.filter((container) => !containerIsHidden(state, container.id) && (() => {
    const root = getContainerRootHolder(state, container.id);
    return root?.type === "owner" ? ownerIds.has(root.id) : root?.type === "location" ? locationIds.has(root.id) : root?.type === "ground";
  })());
  const hiddenLocations = allLocations.filter((location) => location.hidden);
  const hiddenContainers = allCampaignContainers.filter((container) => container.hidden && container.movable);
  const containerIds = new Set(containers.map((container) => container.id));
  const campaignStacks = state.stacks.filter((stack) => stack.campaignId === activeCampaignId && (!stack.containerId || containerIds.has(stack.containerId)));
  const groundStacks = campaignStacks.filter((stack) => !stack.containerId && !stack.locationId && stack.placement === "ground");
  const sellStacks = campaignStacks.filter((stack) => !stack.containerId && !stack.locationId && stack.placement === "sell");
  const paymentStacks = campaignStacks.filter((stack) => !stack.containerId && !stack.locationId && stack.placement === "payment");
  const counterStacks = campaignStacks.filter((stack) => !stack.containerId && !stack.locationId && stack.placement === "counter");
  const groundContainers = containers.filter((container) => container.holderType === "ground");
  const activeDiscardEntries = (state.discarded ?? []).filter((entry) => entry.owners.some((owner) => owner.campaignId === activeCampaignId) || entry.locations.some((location) => location.campaignId === activeCampaignId) || entry.containers.some((container) => container.campaignId === activeCampaignId) || entry.stacks.some((stack) => stack.campaignId === activeCampaignId));
  const defaultScope = marchingOwnerIds;
  const effectiveScopeOwnerIds = (scopeOwnerIds ?? defaultScope).filter((id) => owners.some((owner) => owner.id === id));
  const salePayout = sellStacks.reduce((sum, stack) => sum + (Number(stack.gpValue) || 0) * stack.quantity * (isCoinStack(stack) ? 0.95 : stack.itemKind === "treasure" ? 1 : 0.1), 0);
  const paymentTotal = inventoryStacksGpValue(paymentStacks);
  const counterTotal = inventoryStacksGpValue(counterStacks);

  useEffect(() => {
    const marker = `adnd-inventory-square-layout-v1:${activeCampaignId}`;
    try {
      if (window.localStorage.getItem(marker)) return;
      let innerFrame = 0;
      const outerFrame = window.requestAnimationFrame(() => {
        innerFrame = window.requestAnimationFrame(() => {
          snapAndSort();
          window.localStorage.setItem(marker, "1");
        });
      });
      return () => { window.cancelAnimationFrame(outerFrame); if (innerFrame) window.cancelAnimationFrame(innerFrame); };
    } catch { return; }
  }, [activeCampaignId]);

  function flashInventoryStacks(stackIds: string[]) {
    const uniqueIds = [...new Set(stackIds)];
    if (!uniqueIds.length) return;
    uniqueIds.forEach((id) => {
      const timer = flashTimers.current.get(id);
      if (timer) window.clearTimeout(timer);
    });
    setFlashingStackIds((current) => {
      const next = new Set(current);
      uniqueIds.forEach((id) => next.delete(id));
      return next;
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      setFlashingStackIds((current) => new Set([...current, ...uniqueIds]));
      uniqueIds.forEach((id) => {
        flashTimers.current.set(id, window.setTimeout(() => {
          setFlashingStackIds((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
          flashTimers.current.delete(id);
        }, 620));
      });
    }));
  }

  function flashCapacityWarning(key: string) {
    const timer = capacityWarningTimers.current.get(key);
    if (timer) window.clearTimeout(timer);
    setCapacityWarningKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      setCapacityWarningKeys((current) => new Set([...current, key]));
      capacityWarningTimers.current.set(key, window.setTimeout(() => {
        setCapacityWarningKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        capacityWarningTimers.current.delete(key);
      }, 900));
    }));
  }

  useEffect(() => {
    const previous = previousInventoryRef.current;
    previousInventoryRef.current = { stacks: state.stacks, containers: state.containers };
    if (!previous) return;
    const previousStacks = new Map(previous.stacks.map((stack) => [stack.id, stack]));
    const previousContainers = new Map(previous.containers.map((container) => [container.id, container]));
    const movedContainerIds = new Set(state.containers.filter((container) => {
      const earlier = previousContainers.get(container.id);
      return earlier && containerPlacementKey(earlier) !== containerPlacementKey(container);
    }).map((container) => container.id));
    const affectedStackIds = state.stacks.filter((stack) => {
      const earlier = previousStacks.get(stack.id);
      return !earlier
        || stackPlacementKey(earlier) !== stackPlacementKey(stack)
        || stack.quantity > earlier.quantity
        || stackIsInsideMovedContainer(stack, state.containers, movedContainerIds);
    }).map((stack) => stack.id);
    flashInventoryStacks(affectedStackIds);
  }, [state.containers, state.stacks]);

  useEffect(() => () => {
    flashTimers.current.forEach((timer) => window.clearTimeout(timer));
    flashTimers.current.clear();
    capacityWarningTimers.current.forEach((timer) => window.clearTimeout(timer));
    capacityWarningTimers.current.clear();
  }, []);

  useEffect(() => {
    if (!draggingNode) return;
    const move = (event: PointerEvent) => setDraftPositions((current) => ({ ...current, [draggingNode.key]: { x: Math.max(0, draggingNode.x + event.clientX - draggingNode.startX), y: Math.max(0, draggingNode.y + event.clientY - draggingNode.startY) } }));
    const stop = () => {
      setDraggingNode(null);
      setCampaign((current) => ({ ...current, inventoryManagement: { ...current.inventoryManagement, layoutPositions: { ...current.inventoryManagement.layoutPositions, ...draftPositions } } }));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
  }, [draggingNode, draftPositions, setCampaign]);

  function updateInventory(updater: (current: InventoryManagementState) => InventoryManagementState) {
    setCampaign((current) => syncPhysicalEquipment({ ...current, inventoryManagement: updater(current.inventoryManagement) }));
  }

  function commitInventory(next: InventoryManagementState, action: string, details: string[] | string) {
    updateInventory(() => appendInventoryActivity(next, action, details));
  }

  function announce(message: string) { setNotice(message); }

  function toggleCollapsed(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { window.localStorage.setItem(`adnd-inventory-collapsed:${activeCampaignId}`, JSON.stringify([...next])); } catch { /* local preference only */ }
      return next;
    });
  }

  function toggleTextCollapsed(key: string) {
    setTextCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function textInventoryColumnsFor(availableKeys: string[]) {
    const visibleOrder = textInventoryOrder.filter((key) => availableKeys.includes(key));
    const missing = availableKeys.filter((key) => !visibleOrder.includes(key));
    if (!textInventoryOrder.includes(TEXT_INVENTORY_COLUMN_BREAK)) {
      const initial = [...visibleOrder, ...missing];
      const splitAt = Math.ceil(initial.length / 2);
      return [initial.slice(0, splitAt), initial.slice(splitAt)] as [string[], string[]];
    }
    const breakAt = textInventoryOrder.indexOf(TEXT_INVENTORY_COLUMN_BREAK);
    const left = textInventoryOrder.slice(0, breakAt).filter((key) => availableKeys.includes(key));
    const right = textInventoryOrder.slice(breakAt + 1).filter((key) => availableKeys.includes(key));
    return [[...left, ...missing], right] as [string[], string[]];
  }

  function saveTextInventoryColumns(columns: [string[], string[]]) {
    const visible = new Set([...columns[0], ...columns[1]]);
    const hidden = textInventoryOrder.filter((key) => key !== TEXT_INVENTORY_COLUMN_BREAK && !visible.has(key));
    const next = [...columns[0], TEXT_INVENTORY_COLUMN_BREAK, ...columns[1], ...hidden];
    setTextInventoryOrder(next);
    try { window.localStorage.setItem(`adnd-text-inventory-order:${activeCampaignId}`, JSON.stringify(next)); } catch { /* local view preference only */ }
  }

  function reorderTextInventories(draggedKey: string, targetKey: string, targetColumn?: 0 | 1) {
    if (!draggedKey || draggedKey === targetKey) return;
    const availableKeys = ["ground", "sell", ...owners.map((owner) => `owner:${owner.id}`), ...locations.map((location) => `location:${location.id}`)];
    if (!availableKeys.includes(draggedKey) || (targetKey && !availableKeys.includes(targetKey))) return;
    const columns = textInventoryColumnsFor(availableKeys);
    columns[0] = columns[0].filter((key) => key !== draggedKey);
    columns[1] = columns[1].filter((key) => key !== draggedKey);
    const destination = targetColumn ?? (columns[1].includes(targetKey) ? 1 : 0);
    const targetIndex = targetKey ? columns[destination].indexOf(targetKey) : -1;
    if (targetIndex < 0) columns[destination].push(draggedKey);
    else columns[destination].splice(targetIndex, 0, draggedKey);
    saveTextInventoryColumns(columns);
  }

  function dropTextInventoryCard(event: DragEvent, targetKey: string, targetColumn?: 0 | 1) {
    const draggedKey = textInventoryCardDragKey(event);
    if (!draggedKey) return false;
    event.preventDefault();
    event.stopPropagation();
    reorderTextInventories(draggedKey, targetKey, targetColumn);
    return true;
  }

  function setTextContainerBranches(containerIds: string[]) {
    const keys = containerIds.flatMap((id) => [id, ...getContainerDescendantIds(state, id)]).map((id) => `text:container:${id}`);
    if (!keys.length) return;
    setTextCollapsed((current) => {
      const shouldCollapse = keys.some((key) => !current.has(key));
      const next = new Set(current);
      keys.forEach((key) => shouldCollapse ? next.add(key) : next.delete(key));
      return next;
    });
  }

  function TextCardGrab({ cardKey }: { cardKey: string }) {
    return <span className="text-card-grab" draggable aria-label="Drag to reorder inventory" title="Drag to reorder" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onDragStart={(event) => { event.stopPropagation(); setTextInventoryCardDragPayload(event, cardKey); }}>⠿</span>;
  }

  function beginNodeDrag(event: ReactPointerEvent, key: string, fallback: { x: number; y: number }) {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    setActiveBoardNodeKey(key);
    const current = draftPositions[key] ?? state.layoutPositions[key] ?? fallback;
    setDraftPositions((positions) => ({ ...positions, [key]: current }));
    setDraggingNode({ key, startX: event.clientX, startY: event.clientY, x: current.x, y: current.y });
  }

  function snapAndSort() {
    const step = 616;
    const columns = Math.max(1, Math.floor(((boardRef.current?.clientWidth ?? 1080) - 24) / step));
    const groundKey = "utility:ground";
    const sellKey = "utility:sell";
    const keys = [...owners.map((owner) => `owner:${owner.id}`), ...locations.map((location) => `location:${location.id}`)];
    const groundHeight = collapsed.has(groundKey) ? 88 : (boardNodeHeights[groundKey] ?? 360);
    const sellHeight = collapsed.has(sellKey) ? 88 : (boardNodeHeights[sellKey] ?? 260);
    const positions: Record<string, { x: number; y: number }> = {
      [groundKey]: { x: 12, y: 12 },
      [sellKey]: { x: 12, y: 12 + groundHeight + 16 },
    };
    const columnHeights = Array.from({ length: columns }, () => 12 + groundHeight + sellHeight + 32);
    for (const key of keys) {
      const column = columnHeights.indexOf(Math.min(...columnHeights));
      positions[key] = { x: 12 + column * step, y: columnHeights[column] };
      const owner = key.startsWith("owner:") ? owners.find((entry) => `owner:${entry.id}` === key) : undefined;
      const reservedHeight = owner?.type === "character" ? 680 : owner ? 500 : 360;
      columnHeights[column] += Math.max(boardNodeHeights[key] ?? 0, reservedHeight) + 16;
    }
    setDraftPositions(positions);
    updateInventory((current) => ({ ...current, layoutPositions: { ...current.layoutPositions, ...positions } }));
    announce("Snapped and sorted.");
  }

  function reportContainerMove(result: ReturnType<typeof moveContainer>, destination: string, warningKey?: string) {
    if (result.moved) {
      const movedContainer = result.state.containers.find((container) => container.lastHolder != null && container.holderId !== state.containers.find((entry) => entry.id === container.id)?.holderId);
      commitInventory(result.state, "Move container", `${movedContainer?.name ?? "Container"} → ${destination}`);
      announce(`Container and contents moved to ${destination}.`);
    } else {
      if (warningKey) flashCapacityWarning(warningKey);
      const available = Number.isFinite(result.availableUnits) ? formatStoneUnits(result.availableUnits) : "∞";
      announce(`${result.reason} Required ${formatStoneUnits(result.requiredUnits)}; available ${available}.`);
    }
  }

  function dropOnContainer(event: DragEvent, container: InventoryContainer) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload) return;
    if (payload.kind === "container") return reportContainerMove(moveContainer(state, payload.id, { type: "container", id: container.id }, campaign.characters), container.name, `container:${container.id}`);
    const result = moveStack(state, payload.id, { type: "container", id: container.id }, campaign.characters);
    if (result.moved) commitInventory(result.state, "Move item", `${result.moved} × ${state.stacks.find((stack) => stack.id === payload.id)?.name ?? "Item"} → ${container.name}`);
    else flashCapacityWarning(`container:${container.id}`);
    announce(result.moved ? `${result.moved} moved to ${container.name}.${result.reason === "Moved." ? "" : ` ${result.reason}`}` : result.reason);
  }

  function dropOnOwner(event: DragEvent, owner: PhysicalInventoryOwner) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload) return;
    if (payload.kind === "container") return reportContainerMove(moveContainer(state, payload.id, { type: "owner", id: owner.id }, campaign.characters), owner.name, `owner:${owner.id}`);
    const result = giveAllTo(state, payload.id, owner.id, campaign.characters);
    if (result.moved) commitInventory(result.state, "Assign to carrier", result.details ?? [`Stack → ${owner.name}`]);
    else flashCapacityWarning(`owner:${owner.id}`);
    announce(result.moved ? `Entire stack moved to ${owner.name}.` : result.reason);
  }

  function dropOnLocation(event: DragEvent, locationId: string, locationName: string) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload) return;
    if (payload.kind === "container") return reportContainerMove(moveContainer(state, payload.id, { type: "location", id: locationId }, campaign.characters), locationName);
    const result = moveStack(state, payload.id, { type: "location", id: locationId }, campaign.characters);
    if (result.moved) commitInventory(result.state, "Move item", `${result.moved} × ${state.stacks.find((stack) => stack.id === payload.id)?.name ?? "Item"} → ${locationName}`);
    announce(result.moved ? `Stack moved to ${locationName}.` : result.reason);
  }

  function dropOnGround(event: DragEvent) {
    event.preventDefault();
    const payload = dragPayload(event);
    if (!payload) return;
    if (payload.kind === "container") return reportContainerMove(moveContainer(state, payload.id, { type: "ground" }, campaign.characters), "Ground");
    const result = moveStackToGround(state, payload.id);
    if (result.moved) commitInventory(result.state, "Drop item", `${result.moved} × ${state.stacks.find((stack) => stack.id === payload.id)?.name ?? "Item"} → Ground`);
    announce(result.moved ? "Dropped on the Ground." : result.reason);
  }

  function dropOnSell(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload || payload.kind !== "stack") return announce("Only item stacks can be sold.");
    const result = moveStack(state, payload.id, { type: "sell" }, campaign.characters);
    if (result.moved) commitInventory(result.state, "Stage sale", `${result.moved} × ${state.stacks.find((stack) => stack.id === payload.id)?.name ?? "Item"} → Sell`);
    announce(result.moved ? "Moved to Sell." : result.reason);
  }

  function quantityForMove(stack: InventoryStack, destination: string) {
    if (stack.quantity <= 1) return 1;
    const raw = window.prompt(`Move how many ${stack.name} to ${destination}?`, String(stack.quantity));
    if (raw === null) return null;
    const quantity = Math.trunc(Number(raw));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > stack.quantity) {
      announce(`Enter a whole number from 1 to ${stack.quantity}.`);
      return null;
    }
    return quantity;
  }

  function moveToPayment(stackId: string, requestedQuantity?: number) {
    const stack = state.stacks.find((entry) => entry.id === stackId);
    if (!stack) return announce("That stack no longer exists.");
    if (stack.itemKind !== "treasure") return announce("Only coins and treasure can be used as Payment.");
    const quantity = requestedQuantity ?? quantityForMove(stack, "Payment");
    if (quantity == null) return;
    const result = moveStack(state, stackId, { type: "payment" }, campaign.characters, quantity);
    if (result.moved) commitInventory(result.state, "Add payment", `${result.moved} × ${stack.name} → Payment`);
    announce(result.moved ? `${result.moved} × ${stack.name} added to Payment.` : result.reason);
  }

  function dropOnPayment(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload || payload.kind !== "stack") return announce("Only coin and treasure stacks can be used as Payment.");
    moveToPayment(payload.id);
  }

  function dropOnCounter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload || payload.kind !== "stack") return announce("Only item stacks can be placed at Pickup.");
    const stack = state.stacks.find((entry) => entry.id === payload.id);
    const result = moveStack(state, payload.id, { type: "counter" }, campaign.characters);
    if (result.moved) commitInventory(result.state, "Move to pickup", `${result.moved} × ${stack?.name ?? "Item"} → Purchases & change`);
    announce(result.moved ? "Moved to Purchases & change." : result.reason);
  }

  function dropOnHand(event: DragEvent, ownerId: string, slot: "main" | "offhand") {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload || payload.kind !== "stack") return announce("Hands can hold one item stack at a time.");
    const result = moveStackToHand(state, payload.id, ownerId, slot, campaign.characters);
    if (result.moved) commitInventory(result.state, "Equip hand", result.reason);
    announce(result.reason);
  }

  function dropOnWorn(event: DragEvent, ownerId: string) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayload(event);
    if (!payload || payload.kind !== "stack") return announce("Only one item at a time can be added to Worn.");
    const result = moveStackToWorn(state, payload.id, ownerId);
    if (result.moved) commitInventory(result.state, "Wear item", result.reason);
    announce(result.reason);
  }

  function requestPartialMove(stack: InventoryStack) {
    const raw = window.prompt(`Move how many ${stack.name}?`, String(Math.max(1, Math.floor(stack.quantity / 2))));
    if (raw === null) return;
    const quantity = Math.trunc(Number(raw));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity >= stack.quantity) return announce(`Enter a whole number from 1 to ${stack.quantity - 1}.`);
    setPartialMove({ stackId: stack.id, quantity });
    announce(`Choose where to move ${quantity} × ${stack.name}.`);
  }

  function handleStackMoveSelect(stack: InventoryStack, value: string) {
    if (value === "move-some") return requestPartialMove(stack);
    if (!value) return;
    const requestedQuantity = partialMove?.stackId === stack.id ? partialMove.quantity : undefined;
    setPartialMove(null);
    moveStackBySelect(stack.id, value, requestedQuantity);
  }

  function moveStackBySelect(stackId: string, value: string, requestedQuantity?: number) {
    if (!value) return;
    if (value === "ground") {
      const result = moveStack(state, stackId, { type: "ground" }, campaign.characters, requestedQuantity);
      if (result.moved) commitInventory(result.state, "Drop item", `${result.moved} × ${state.stacks.find((stack) => stack.id === stackId)?.name ?? "Item"} → Ground`);
      return announce(result.moved ? "Dropped on the Ground." : result.reason);
    }
    if (value === "sell") {
      const result = moveStack(state, stackId, { type: "sell" }, campaign.characters, requestedQuantity);
      if (result.moved) commitInventory(result.state, "Stage sale", `${result.moved} × ${state.stacks.find((stack) => stack.id === stackId)?.name ?? "Item"} → Sell`);
      return announce(result.moved ? "Moved to Sell." : result.reason);
    }
    if (value === "payment") return moveToPayment(stackId, requestedQuantity);
    if (value === "counter") {
      const result = moveStack(state, stackId, { type: "counter" }, campaign.characters, requestedQuantity);
      if (result.moved) commitInventory(result.state, "Move to pickup", `${result.moved} × ${state.stacks.find((stack) => stack.id === stackId)?.name ?? "Item"} → Purchases & change`);
      return announce(result.moved ? "Moved to Purchases & change." : result.reason);
    }
    const [type, id, slot] = value.split(":");
    if (type === "owner") {
      if (requestedQuantity) return announce("Choose one of that carrier’s containers when moving part of a stack.");
      const result = smartStack(state, stackId, [id], campaign.characters);
      commitInventory(result.state, "Smart assign", result.details?.length ? result.details : result.reason);
      if (result.remaining) flashCapacityWarning(`owner:${id}`);
      return announce(result.reason);
    }
    if (type === "hand") {
      if (requestedQuantity && requestedQuantity > 1) return announce("A hand can receive only 1 item from a stack.");
      const result = moveStackToHand(state, stackId, id, slot as "main" | "offhand", campaign.characters);
      if (result.moved) commitInventory(result.state, "Equip hand", result.reason);
      return announce(result.reason);
    }
    const result = moveStack(state, stackId, { type: type as "container" | "location", id }, campaign.characters, requestedQuantity);
    if (result.moved) commitInventory(result.state, "Move item", `${result.moved} × ${state.stacks.find((stack) => stack.id === stackId)?.name ?? "Item"} → ${type === "container" ? state.containers.find((container) => container.id === id)?.name : state.locations.find((location) => location.id === id)?.name}`);
    else if (type === "container") flashCapacityWarning(`container:${id}`);
    announce(result.reason);
  }

  function moveContainerBySelect(containerId: string, value: string) {
    if (!value) return;
    if (value === "ground") return reportContainerMove(moveContainer(state, containerId, { type: "ground" }, campaign.characters), "Ground");
    const [type, id] = value.split(":");
    reportContainerMove(moveContainer(state, containerId, { type: type as "owner" | "location" | "container", id }, campaign.characters), type === "container" ? containers.find((entry) => entry.id === id)?.name ?? "container" : owners.find((entry) => entry.id === id)?.name ?? locations.find((entry) => entry.id === id)?.name ?? "destination", type === "location" ? undefined : `${type}:${id}`);
  }

  function deleteStack(stack: InventoryStack) {
    const raw = window.prompt(`Discard how many ${stack.name}?`, String(stack.quantity));
    if (raw === null) return;
    const quantity = Math.trunc(Number(raw));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > stack.quantity) return announce(`Enter a whole number from 1 to ${stack.quantity}.`);
    const result = discardInventoryStack(state, stack.id, quantity);
    commitInventory(result.state, "Discard item", result.reason);
    announce(result.reason);
  }

  function discardOne(stack: InventoryStack) {
    const result = discardInventoryStack(state, stack.id, 1);
    commitInventory(result.state, "Discard 1 item", result.reason);
    announce(result.reason);
  }

  function split(stack: InventoryStack) {
    const raw = window.prompt(`Take how many ${stack.name} from this stack?`, String(Math.floor(stack.quantity / 2)));
    if (raw === null) return;
    const quantity = Math.trunc(Number(raw));
    if (quantity <= 0 || quantity >= stack.quantity) return announce(`Enter a whole number from 1 to ${stack.quantity - 1}.`);
    updateInventory((current) => splitStack(current, stack.id, quantity));
    announce(`Took ${quantity} ${stack.name}; ${stack.quantity - quantity} remain in the original stack.`);
  }

  function sortInventoryLoads() {
    const orderedIds = [...marchingOwnerIds, ...owners.map((owner) => owner.id).filter((id) => !marchingOwnerIds.includes(id))];
    const result = sortAndRebalanceInventory(state, orderedIds, campaign.characters);
    commitInventory(result.state, "Sort load", result.details.length ? result.details : result.reason);
    announce(result.reason);
  }

  function equipmentClass(units: number): EncumbranceClass {
    return units <= 1 ? "coin" : units <= 100 ? "pocket" : units <= 400 ? "sack" : "bulky";
  }

  function addEquipmentStack(name: string, equipment: InventoryEquipment, encumbranceUnits: number, gpValue: number | null, notes = "", catalogItemId: string | null = null) {
    const stack: InventoryStack = {
      id: inventoryId("equipment"),
      campaignId: activeCampaignId,
      catalogItemId,
      customIdentity: catalogItemId ? null : `equipment:${name.toLowerCase()}:${inventoryId("identity")}`,
      name,
      quantity: 1,
      unitEncumbranceUnits: Math.max(1, Math.round(encumbranceUnits)),
      encumbranceClass: equipmentClass(encumbranceUnits),
      itemKind: "normal",
      gpValue,
      containerId: null,
      locationId: null,
      placement: "ground",
      notes,
      equipment: { ...equipment },
      trainingByCharacter: {},
    };
    updateInventory((current) => appendInventoryActivity({ ...current, stacks: [...current.stacks, stack] }, "Add equipment", `${name} → Ground`));
    setForm(null);
    announce(`${name} added to Ground as equipment.`);
  }

  function addEquipmentDefault(entry: EquipmentDefault) {
    const catalogItem = siteCatalog.find((item) => equipmentDefaultForName(item.name)?.id === entry.id);
    addEquipmentStack(catalogItem?.name ?? entry.name, entry.equipment, catalogItem?.encumbranceUnits ?? entry.encumbranceUnits, catalogItem?.priceGp ?? entry.priceGp, entry.equipment.source ?? "OSRIC", catalogItem?.id ?? null);
  }

  function submitEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const units = capacityInputUnits(data.get("weight"), data.get("weightUnit"));
    if (!name || units <= 0) return announce("Enter an equipment name and weight.");
    const equipment: InventoryEquipment = equipmentKind === "weapon" ? {
      kind: "weapon",
      weaponType: String(data.get("weaponType") ?? "melee") as "melee" | "ranged" | "other",
      damage: String(data.get("damage") ?? "").trim(),
      damageLarge: String(data.get("damageLarge") ?? "").trim(),
      attackBonus: Number(data.get("attackBonus")) || 0,
      twoHanded: data.get("twoHanded") === "on",
      source: "Custom",
      weaponRulesId: String(data.get("weaponRulesId") ?? "") || null,
    } : equipmentKind === "armor" ? {
      kind: "armor",
      ascendingAc: Math.max(10, Number(data.get("ascendingAc")) || 10),
      source: "Custom",
    } : {
      kind: "shield",
      shieldBonus: Math.max(0, Number(data.get("shieldBonus")) || 1),
      source: "Custom",
    };
    addEquipmentStack(name, equipment, units, data.get("gpValue") === "" ? null : Math.max(0, Number(data.get("gpValue")) || 0), String(data.get("notes") ?? "").trim());
  }

  function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    if (!name) return announce("Enter a location name.");
    updateInventory((current) => ({ ...current, locations: [...current.locations, { id: inventoryId("location"), campaignId: activeCampaignId, name, notes: String(data.get("notes") ?? "").trim(), infiniteCapacity: true }] }));
    setForm(null);
    announce(`${name} added.`);
  }

  function submitInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const capacityUnits = capacityInputUnits(data.get("capacity"), data.get("unit"));
    if (!name || capacityUnits <= 0) return announce("Enter a name and capacity.");
    updateInventory((current) => {
      const owner: PhysicalInventoryOwner = { id: inventoryId("owner"), campaignId: activeCampaignId, name, type: String(data.get("type")) as PhysicalInventoryOwner["type"], capacityUnits, notes: String(data.get("notes") ?? "").trim() };
      return { ...current, owners: [...current.owners, owner], containers: owner.type !== "character" ? [...current.containers, carrierBagsForOwner(owner)] : current.containers };
    });
    setForm(null);
    announce(`${name} added with ${formatStoneUnits(capacityUnits)} capacity and ${name}'s Bags.`);
  }

  function submitContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const template = siteCatalog.find((item) => item.id === data.get("template") && item.containerCapacityUnits);
    const name = String(data.get("name") ?? "").trim() || template?.name || "";
    const capacityUnits = template?.containerCapacityUnits ?? capacityInputUnits(data.get("capacity"), data.get("unit"));
    const target = String(data.get("holder") ?? "ground");
    if (!name || capacityUnits <= 0) return announce("Enter a name and capacity.");
    const created: InventoryContainer = { id: inventoryId("container"), campaignId: activeCampaignId, name, capacityUnits, tareWeightUnits: template?.encumbranceUnits ?? capacityInputUnits(data.get("tare"), data.get("tareUnit")), holderType: "ground", holderId: activeCampaignId, containerType: "container", intrinsic: false, movable: true };
    let next: InventoryManagementState = { ...state, containers: [...state.containers, created] };
    if (target !== "ground") {
      const [type, id] = target.split(":");
      const result = moveContainer(next, created.id, { type: type as "owner" | "location" | "container", id }, campaign.characters);
      if (!result.moved) return announce(result.reason);
      next = result.state;
    }
    updateInventory(() => next);
    setForm(null);
    announce(`${name} created.`);
  }

  function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Math.max(1, Math.trunc(Number(data.get("quantity")) || 1));
    let stack: InventoryStack;
    if (catalogMode) {
      const item = siteCatalog.find((entry) => entry.id === catalogItemId);
      if (!item) return announce("Choose an item.");
      const coin = currencyCodeFromName(item.name) != null;
      const equipmentDefault = equipmentDefaultForName(item.name);
      stack = { id: inventoryId("stack"), campaignId: activeCampaignId, catalogItemId: item.id, customIdentity: null, name: item.name, quantity, unitEncumbranceUnits: item.encumbranceUnits, encumbranceClass: item.encumbranceClass, itemKind: coin || data.get("kind") === "treasure" ? "treasure" : "normal", gpValue: item.priceGp, containerId: null, locationId: null, placement: "ground", notes: item.description ?? "", equipment: equipmentDefault ? { ...equipmentDefault.equipment } : null, trainingByCharacter: {} };
    } else {
      const coinPreset = coinPresets.find((entry) => entry.id === customCoinPreset);
      const name = coinPreset?.name ?? String(data.get("name") ?? "").trim();
      if (!name) return announce("Enter an item name.");
      const preset = (coinPreset ? "coin" : String(data.get("class") ?? "pocket")) as EncumbranceClass;
      const unitEncumbranceUnits = coinPreset ? 1 : preset === "coin" ? 1 : preset === "pocket" ? 100 : preset === "sack" ? 400 : stoneToUnits(Number(data.get("customStone")) || 0);
      if (unitEncumbranceUnits <= 0) return announce("Enter a valid size.");
      const coinCode = currencyCodeFromName(name);
      const coin = coinCode != null;
      const notes = String(data.get("notes") ?? "").trim();
      stack = { id: inventoryId("stack"), campaignId: activeCampaignId, catalogItemId: null, customIdentity: `${name.toLowerCase()}|${unitEncumbranceUnits}|${notes}`, name, quantity, unitEncumbranceUnits, encumbranceClass: preset, itemKind: coinPreset || coin || data.get("kind") === "treasure" ? "treasure" : "normal", gpValue: coinPreset?.gpValue ?? (coinCode ? CURRENCY_BY_CODE[coinCode].gpValue : data.get("gpValue") === "" ? null : Math.max(0, Number(data.get("gpValue")) || 0)), containerId: null, locationId: null, placement: "ground", notes };
    }
    updateInventory((current) => {
      const existing = current.stacks.find((entry) => entry.campaignId === activeCampaignId && entry.placement === "ground" && !entry.containerId && !entry.locationId && entry.catalogItemId === stack.catalogItemId && entry.customIdentity === stack.customIdentity && entry.itemKind === stack.itemKind && entry.unitEncumbranceUnits === stack.unitEncumbranceUnits && entry.gpValue === stack.gpValue);
      return existing ? { ...current, stacks: current.stacks.map((entry) => entry.id === existing.id ? { ...entry, quantity: entry.quantity + quantity } : entry) } : { ...current, stacks: [...current.stacks, stack] };
    });
    setForm(null);
    setCatalogItemId("");
    setCustomCoinPreset("");
    announce(`${stack.name} ×${quantity} added to Ground.`);
  }

  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return siteCatalog.filter((item) => !item.containerCapacityUnits && (!query || `${item.name} ${item.category}`.toLowerCase().includes(query))).slice(0, 80);
  }, [catalogSearch]);
  const filteredEquipmentDefaults = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    return osricEquipmentDefaults.filter((entry) => !query || `${entry.name} ${entry.equipment.kind} ${entry.equipment.weaponType ?? ""}`.toLowerCase().includes(query));
  }, [equipmentSearch]);

  useEffect(() => {
    if (filteredEquipmentDefaults.length && !filteredEquipmentDefaults.some((entry) => entry.id === equipmentDefaultId)) {
      setEquipmentDefaultId(filteredEquipmentDefaults[0].id);
    }
  }, [equipmentDefaultId, filteredEquipmentDefaults]);

  useEffect(() => {
    if (filteredCatalog.length === 1 && catalogItemId !== filteredCatalog[0].id) {
      setCatalogItemId(filteredCatalog[0].id);
      return;
    }
    if (catalogItemId && !filteredCatalog.some((item) => item.id === catalogItemId)) setCatalogItemId("");
  }, [catalogItemId, filteredCatalog]);

  function handDestinationDisabled(stack: InventoryStack, ownerId: string, slot: "main" | "offhand") {
    const quick = containers.find((container) => container.containerType === "quick-access" && container.holderType === "owner" && container.holderId === ownerId);
    if (!quick) return true;
    const targetHeld = campaignStacks.find((entry) => entry.containerId === quick.id && entry.handSlot === slot && entry.id !== stack.id);
    if (targetHeld) return true;
    const otherSlot = slot === "main" ? "offhand" : "main";
    const otherHeld = campaignStacks.find((entry) => entry.containerId === quick.id && entry.handSlot === otherSlot && entry.id !== stack.id);
    const owner = owners.find((entry) => entry.id === ownerId);
    const character = owner?.characterId ? campaign.characters.find((entry) => entry.id === owner.characterId) : undefined;
    return Boolean(otherHeld && (stackRequiresBothHands(stack, character) || stackRequiresBothHands(otherHeld, character)));
  }

  function destinationOptions(stack: InventoryStack, allowMoveSome = false) {
    const pendingQuantity = partialMove?.stackId === stack.id ? partialMove.quantity : null;
    return <>
      <option value="">{pendingQuantity ? `Move ${pendingQuantity} to…` : "Move to…"}</option>
      {allowMoveSome && stack.quantity > 1 && !pendingQuantity && <option value="move-some">Move some…</option>}
      <option value="ground">Ground</option>
      <option value="sell">Sell</option>
      <option value="payment">Payment · coins &amp; treasure</option>
      <option value="counter">Purchases &amp; change</option>
      {owners.map((owner) => {
        const heldContainers = containers.filter((container) => container.containerType !== "worn" && getContainerRootHolder(state, container.id)?.type === "owner" && getContainerRootHolder(state, container.id)?.id === owner.id);
        return <optgroup label={owner.name} key={owner.id}><option value={`owner:${owner.id}`} disabled={Boolean(pendingQuantity)}>{owner.name} · smart sort</option>{owner.type === "character" && <><option value={`hand:${owner.id}:main`} disabled={Boolean(pendingQuantity && pendingQuantity > 1) || handDestinationDisabled(stack, owner.id, "main")}>Hand 1</option><option value={`hand:${owner.id}:offhand`} disabled={Boolean(pendingQuantity && pendingQuantity > 1) || handDestinationDisabled(stack, owner.id, "offhand")}>Hand 2</option></>}{heldContainers.map((container) => <option key={container.id} value={`container:${container.id}`}>{"↳ ".repeat(Math.max(0, getContainerPathToRoot(state, container.id).length - 1))}{container.name}</option>)}</optgroup>;
      })}
      {locations.map((location) => <optgroup label={location.name} key={location.id}><option value={`location:${location.id}`}>{location.name} · loose</option>{containers.filter((container) => getContainerRootHolder(state, container.id)?.type === "location" && getContainerRootHolder(state, container.id)?.id === location.id).map((container) => <option key={container.id} value={`container:${container.id}`}>{container.name}</option>)}</optgroup>)}
    </>;
  }

  function containerDestinationOptions(container: InventoryContainer) {
    const blocked = getContainerDescendantIds(state, container.id);
    blocked.add(container.id);
    return <>
      <option value="">Move container to…</option>
      <option value="ground">Ground</option>
      {owners.map((owner) => <optgroup label={owner.name} key={owner.id}><option value={`owner:${owner.id}`}>{owner.name}</option>{containers.filter((entry) => !blocked.has(entry.id) && entry.containerType !== "worn" && getContainerRootHolder(state, entry.id)?.type === "owner" && getContainerRootHolder(state, entry.id)?.id === owner.id).map((entry) => <option value={`container:${entry.id}`} key={entry.id}>Inside {entry.name}</option>)}</optgroup>)}
      {locations.map((location) => <optgroup label={location.name} key={location.id}><option value={`location:${location.id}`}>{location.name}</option>{containers.filter((entry) => !blocked.has(entry.id) && getContainerRootHolder(state, entry.id)?.type === "location" && getContainerRootHolder(state, entry.id)?.id === location.id).map((entry) => <option value={`container:${entry.id}`} key={entry.id}>Inside {entry.name}</option>)}</optgroup>)}
    </>;
  }

  function StackTile({ stack, compact = false, disabled = false }: { stack: InventoryStack; compact?: boolean; disabled?: boolean }) {
    const combinable = combinableInventoryStackIds(state, stack.id).length > 1;
    const toggleActions = () => setOpenItemActionIds((current) => { const next = new Set(current); if (next.has(stack.id)) next.delete(stack.id); else next.add(stack.id); return next; });
    const actionToggle = !disabled ? <button className="inventory-actions-toggle" title="Show item actions" type="button" aria-expanded={openItemActionIds.has(stack.id)} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); toggleActions(); }}>Actions</button> : null;
    const tileEmoji = inventoryStackEmoji(stack);
    const tileTone = stack.itemKind === "treasure" ? "treasure" : stack.equipment?.kind === "weapon" ? "weapon" : stack.equipment ? "wearable" : "ordinary";
    const root = stack.containerId ? getContainerRootHolder(state, stack.containerId) : null;
    const stackOwner = root?.type === "owner" ? owners.find((entry) => entry.id === root.id) : undefined;
    const stackCharacter = stackOwner?.characterId ? campaign.characters.find((entry) => entry.id === stackOwner.characterId) : undefined;
    const handsHint = stack.equipment?.kind === "weapon" ? weaponHandednessHint({ name: stack.name, weaponRulesId: stack.equipment.weaponRulesId, twoHanded: stack.equipment.twoHanded }, stackCharacter) : "";
    return <article className={`inventory-stack-tile ${tileTone} ${compact ? "compact" : ""} ${disabled ? "mirrored" : ""} ${flashingStackIds.has(stack.id) ? "inventory-item-flash" : ""}`} draggable={!disabled} onDragStart={(event) => { if (disabled || (event.target as HTMLElement).closest(".inventory-tile-actions, .inventory-actions-toggle")) { event.preventDefault(); return; } event.stopPropagation(); setDragPayload(event, { kind: "stack", id: stack.id }); }}>
      <div className="inventory-stack-main"><span className="tile-grip" aria-hidden>⠿</span>{tileEmoji && <span className="inventory-item-emoji" aria-hidden>{tileEmoji}</span>}<span className="inventory-stack-copy"><b>{inventoryStackDisplayName(stack)} <small className="inline-item-weight">{compactItemWeight(stack.unitEncumbranceUnits)} {encumbranceClassLabel(stack.encumbranceClass)}</small></b>{stack.equipment && <small>{stack.equipment.kind}{handsHint ? <> · <span className="weapon-hands-hint">{handsHint}</span></> : null}</small>}</span>{!stack.equipment && stack.name !== "Ammo" && <strong>×{stack.quantity}</strong>}</div>
      {!compact && <div className="inventory-stack-meta">{actionToggle}</div>}
      {compact && actionToggle}
      {!disabled && openItemActionIds.has(stack.id) && <div className="inventory-tile-actions stack-actions-popout open" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><div><select aria-label={`Move ${stack.name}`} value="" onChange={(event) => handleStackMoveSelect(stack, event.target.value)}>{destinationOptions(stack, true)}</select>{stack.quantity > 1 && <button type="button" onClick={() => split(stack)}>Take from stack</button>}{combinable && <button type="button" onClick={() => { const result = combineInventoryStacks(state, stack.id); commitInventory(result.state, "Combine stacks", result.reason); announce(result.reason); }}>Combine</button>}<button type="button" onClick={() => { const result = smartStack(state, stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Smart stack", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Smart stack</button><button className="danger-link" type="button" onClick={() => discardOne(stack)}>Discard 1</button><button className="danger-link" type="button" onClick={() => deleteStack(stack)}>Discard…</button></div></div>}
    </article>;
  }

  function ContainerTile({ container, depth = 0 }: { container: InventoryContainer; depth?: number }) {
    const key = `container:${container.id}`;
    const isCollapsed = collapsed.has(key);
    const used = getContainerUsedUnits(state, container.id);
    const capacity = getContainerCapacityUnits(container, campaign.characters);
    const contents = campaignStacks.filter((stack) => stack.containerId === container.id && !stack.handSlot);
    const children = containers.filter((entry) => entry.holderType === "container" && entry.holderId === container.id);
    const actions = <details className="inventory-tile-actions container-actions-menu"><summary>Container actions</summary><div>
      {container.movable && <select aria-label={`Move ${container.name}`} defaultValue="" onChange={(event) => { moveContainerBySelect(container.id, event.target.value); event.currentTarget.value = ""; }}>{containerDestinationOptions(container)}</select>}
      <button type="button" onClick={() => { const name = window.prompt("Container name", container.name)?.trim(); if (name) commitInventory({ ...state, containers: state.containers.map((entry) => entry.id === container.id ? { ...entry, name } : entry) }, "Rename container", `${container.name} → ${name}`); }}>Rename</button>
      <button type="button" onClick={() => { const result = dumpContainerContentsToGround(state, container.id); commitInventory(result.state, "Dump container", result.reason); announce(result.reason); }}>Dump</button>
      {container.movable && <button type="button" onClick={() => { commitInventory(setContainerHidden(state, container.id, true), "Hide container", container.name); announce(`${container.name} hidden.`); }}>Hide</button>}
      {container.containerType === "container" && <button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${container.name} and everything inside it?`)) return; const result = discardInventoryContainer(state, container.id); commitInventory(result.state, "Discard container", result.reason); announce(result.reason); }}>Discard</button>}
    </div></details>;
    return <article className={`inventory-container-tile ${container.containerType} ${isCollapsed ? "collapsed" : ""} ${capacityWarningKeys.has(`container:${container.id}`) ? "inventory-capacity-warning" : ""}`} style={{ "--nest-depth": depth } as React.CSSProperties} draggable={container.movable} onDragStart={(event) => { event.stopPropagation(); setDragPayload(event, { kind: "container", id: container.id }); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnContainer(event, container)}>
      <header><span><b>{container.containerType === "quick-access" ? "⚡ Quick Access" : "📦 "}{container.containerType === "quick-access" ? "" : container.name}</b>{children.length > 0 && <small>{children.length} nested</small>}</span><strong>{formatStoneUnits(used)} / {formatStoneUnits(capacity)}</strong><span className="container-header-actions">{actions}<button className="collapse-button" type="button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(key)}>{isCollapsed ? "Expand" : "Collapse"}</button></span></header>
      {!isCollapsed && <>
        <div className={`inventory-meter ${capacityTone(used, capacity)}`}><span style={{ width: `${Math.min(100, capacity ? used / capacity * 100 : 0)}%` }} /></div>
        <p className="capacity-copy">{used > capacity ? `${formatStoneUnits(used - capacity)} over` : used === capacity ? "At capacity" : ""}{container.tareWeightUnits ? ` · ${formatStoneUnits(container.tareWeightUnits)} tare` : ""}</p>
        <div className="inventory-tile-list">{contents.map((stack) => <StackTile key={stack.id} stack={stack} />)}{children.map((child) => <ContainerTile key={child.id} container={child} depth={depth + 1} />)}{!contents.length && !children.length && <p className="drop-hint">Drop items or containers here</p>}</div>
      </>}
    </article>;
  }

  function HandSlot({ owner, character, slot }: { owner: PhysicalInventoryOwner; character: Character; slot: "main" | "offhand" }) {
    const quick = containers.find((container) => container.containerType === "quick-access" && container.holderType === "owner" && container.holderId === owner.id);
    const actualHeld = quick ? campaignStacks.find((stack) => stack.containerId === quick.id && stack.handSlot === slot) : undefined;
    const otherSlot = slot === "main" ? "offhand" : "main";
    const otherHeld = quick ? campaignStacks.find((stack) => stack.containerId === quick.id && stack.handSlot === otherSlot) : undefined;
    const issue = handLoadoutIssue(slot === "main" ? actualHeld : otherHeld, slot === "offhand" ? actualHeld : otherHeld, character);
    const mirrored = !actualHeld && Boolean(otherHeld && stackRequiresBothHands(otherHeld, character));
    const held = actualHeld ?? (mirrored ? otherHeld : undefined);
    const labels = postureHandLabels(character);
    return <section className={`inventory-hand-slot ${slot} ${mirrored ? "reserved" : ""} ${issue ? "invalid" : ""}`} onDragOver={(event) => { if (!mirrored) event.preventDefault(); }} onDrop={(event) => { if (!mirrored) dropOnHand(event, owner.id, slot); }}>
      <small>{slot === "main" ? "Hand 1" : "Hand 2"}</small>
      {held ? <StackTile stack={held} compact disabled={mirrored} /> : <b>{labels[slot]}</b>}
      <span>{issue ? "Invalid hand setup — clear one hand" : mirrored ? `Reserved by ${held?.name}` : held && stackRequiresBothHands(held, character) ? "Two hands required" : "Individual hand slot"}</span>
    </section>;
  }

  function WornArea({ owner }: { owner: PhysicalInventoryOwner }) {
    const worn = containers.find((container) => container.containerType === "worn" && container.holderType === "owner" && container.holderId === owner.id);
    if (!worn) return null;
    const key = `worn:${owner.id}`;
    const isCollapsed = collapsed.has(key);
    const wornStacks = campaignStacks.filter((stack) => stack.containerId === worn.id).sort((left, right) => right.unitEncumbranceUnits - left.unitEncumbranceUnits || left.name.localeCompare(right.name));
    const tally = wornStacks.reduce((sum, stack) => sum + getStackEncumbranceUnits(stack), 0);
    return <section className={`inventory-worn-area ${isCollapsed ? "collapsed" : "expanded"}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnWorn(event, owner.id)}><header><span><b>🧥 Worn</b></span><strong>{formatItemUnits(tally)} worn</strong><button className="collapse-button" type="button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(key)}>{isCollapsed ? "Expand" : "Collapse"}</button></header>{!isCollapsed && <div className="worn-list">{wornStacks.map((stack) => <article className={`worn-item ${stack.itemKind === "treasure" ? "treasure" : stack.equipment?.kind === "weapon" ? "weapon" : stack.equipment ? "wearable" : "ordinary"} ${flashingStackIds.has(stack.id) ? "inventory-item-flash" : ""}`} key={stack.id} draggable onDragStart={(event) => setDragPayload(event, { kind: "stack", id: stack.id })}><span className="tile-grip">⠿</span><b>{stack.equipment?.kind === "weapon" ? <WeaponRulesTooltip rulesId={stack.equipment.weaponRulesId} name={stack.name}>{inventoryStackDisplayName(stack)}</WeaponRulesTooltip> : inventoryStackDisplayName(stack)}</b><small>{formatItemUnits(stack.unitEncumbranceUnits)}</small></article>)}{!wornStacks.length && <p className="drop-hint">Armor, clothing, and jewelry</p>}</div>}</section>;
  }

  function moveTextStackWithinList(stackId: string, offset: -1 | 1) {
    const stack = state.stacks.find((entry) => entry.id === stackId);
    if (!stack) return;
    const placement = stackPlacementKey(stack);
    const siblings = state.stacks.filter((entry) => entry.campaignId === stack.campaignId && stackPlacementKey(entry) === placement);
    const position = siblings.findIndex((entry) => entry.id === stackId);
    const neighbor = siblings[position + offset];
    if (!neighbor) return;
    updateInventory((current) => {
      const stacks = [...current.stacks];
      const sourceIndex = stacks.findIndex((entry) => entry.id === stackId);
      const destinationIndex = stacks.findIndex((entry) => entry.id === neighbor.id);
      if (sourceIndex < 0 || destinationIndex < 0) return current;
      [stacks[sourceIndex], stacks[destinationIndex]] = [stacks[destinationIndex], stacks[sourceIndex]];
      return { ...current, stacks };
    });
  }

  function TextStackLine({ stack }: { stack: InventoryStack }) {
    const combinable = combinableInventoryStackIds(state, stack.id).length > 1;
    const kindClass = stack.itemKind === "treasure" ? "treasure" : stack.equipment?.kind === "weapon" ? "weapon" : stack.equipment ? "wearable" : "ordinary";
    const coinCode = currencyCodeFromName(stack.name);
    const isCoin = Boolean(coinCode);
    const displayName = coinCode ? `${stack.quantity.toLocaleString()} ${CURRENCY_BY_CODE[coinCode].name}` : inventoryStackDisplayName(stack);
    const showQuantityBadge = !isCoin && stack.quantity > 1;
    const quantityFontSize = Math.max(7, 15 - Math.max(0, String(stack.quantity).length - 2) * 2);
    const siblings = state.stacks.filter((entry) => entry.campaignId === stack.campaignId && stackPlacementKey(entry) === stackPlacementKey(stack));
    const siblingIndex = siblings.findIndex((entry) => entry.id === stack.id);
    return <article className={`text-inventory-item ${kindClass} ${flashingStackIds.has(stack.id) ? "inventory-item-flash" : ""}`}>
      <span className="text-item-grab" draggable aria-label={`Drag ${stack.name}`} title="Drag item" onDragStart={(event) => { event.stopPropagation(); setDragPayload(event, { kind: "stack", id: stack.id }); }}>⠿</span>
      <span className={`text-item-icon ${showQuantityBadge ? "quantity" : ""}`} style={showQuantityBadge ? { fontSize: quantityFontSize } : undefined} aria-label={showQuantityBadge ? `Quantity ${stack.quantity}` : undefined} aria-hidden={showQuantityBadge ? undefined : true}>{showQuantityBadge ? stack.quantity : inventoryStackEmoji(stack)}</span>
      <span className="text-item-copy"><b>{stack.equipment?.kind === "weapon" ? <WeaponRulesTooltip rulesId={stack.equipment.weaponRulesId} name={stack.name}>{displayName}</WeaponRulesTooltip> : displayName}</b>{!isCoin && <small>{compactItemWeight(stack.unitEncumbranceUnits)}{stack.equipment ? ` · ${stack.equipment.kind}` : ""}</small>}</span>
      <span className="mobile-reorder-controls" aria-label={`Reorder ${stack.name}`}><button type="button" aria-label={`Move ${stack.name} up`} disabled={siblingIndex <= 0} onClick={() => moveTextStackWithinList(stack.id, -1)}>↑</button><button type="button" aria-label={`Move ${stack.name} down`} disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1} onClick={() => moveTextStackWithinList(stack.id, 1)}>↓</button></span>
      <details className="text-line-actions"><summary>Actions</summary><div>
        <label>Move to<select aria-label={`Move ${stack.name}`} value="" onChange={(event) => handleStackMoveSelect(stack, event.target.value)}>{destinationOptions(stack, true)}</select></label>
        <span className="text-action-buttons">{stack.quantity > 1 && <button type="button" onClick={() => split(stack)}>Take from stack</button>}{combinable && <button type="button" onClick={() => { const result = combineInventoryStacks(state, stack.id); commitInventory(result.state, "Combine stacks", result.reason); announce(result.reason); }}>Combine</button>}<button type="button" onClick={() => { const result = autoAssign(state, stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Assign", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Assign</button><button type="button" onClick={() => { const result = spreadEvenly(state, stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Spread evenly", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Spread</button><button type="button" onClick={() => { const result = smartStack(state, stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Smart stack", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Smart stack</button><button className="danger-link" type="button" onClick={() => discardOne(stack)}>Discard 1</button><button className="danger-link" type="button" onClick={() => deleteStack(stack)}>Discard…</button></span>
      </div></details>
    </article>;
  }

  function TextContainerTree({ container, depth = 0 }: { container: InventoryContainer; depth?: number }) {
    const key = `text:container:${container.id}`;
    const isCollapsed = textCollapsed.has(key);
    const used = getContainerUsedUnits(state, container.id);
    const capacity = getContainerCapacityUnits(container, campaign.characters);
    const contents = campaignStacks.filter((stack) => stack.containerId === container.id && !stack.handSlot);
    const children = containers.filter((entry) => entry.holderType === "container" && entry.holderId === container.id);
    const loadPercent = Math.min(100, capacity ? used / capacity * 100 : 0);
    return <section className={`text-container-tree ${container.containerType} ${isCollapsed ? "collapsed" : ""} ${capacityWarningKeys.has(`container:${container.id}`) ? "inventory-capacity-warning" : ""}`} style={{ "--text-depth": depth } as React.CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!textInventoryCardDragKey(event)) dropOnContainer(event, container); }}>
      <header onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".text-line-actions")) setTextContainerBranches([container.id]); }}>
        <button className="text-tree-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}>{container.movable && <span className="text-item-grab text-container-grab" draggable aria-label={`Drag ${container.name}`} title="Drag container" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onDragStart={(event) => { event.stopPropagation(); setDragPayload(event, { kind: "container", id: container.id }); }}>⠿</span>}<span className="text-tree-caret" aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span className="text-container-name">{container.containerType === "quick-access" ? "⚡ Quick Access" : `📦 ${container.name}`}</span></button>
        <strong>{formatStoneUnits(used)} / {formatStoneUnits(capacity)}</strong>
        <details className="text-line-actions container"><summary>Actions</summary><div>
          {container.movable && <label>Move to<select aria-label={`Move ${container.name}`} defaultValue="" onChange={(event) => { moveContainerBySelect(container.id, event.target.value); event.currentTarget.value = ""; }}>{containerDestinationOptions(container)}</select></label>}
          <span className="text-action-buttons"><button type="button" onClick={() => { const name = window.prompt("Container name", container.name)?.trim(); if (name) commitInventory({ ...state, containers: state.containers.map((entry) => entry.id === container.id ? { ...entry, name } : entry) }, "Rename container", `${container.name} → ${name}`); }}>Rename</button><button type="button" onClick={() => { const result = dumpContainerContentsToGround(state, container.id); commitInventory(result.state, "Dump container", result.reason); announce(result.reason); }}>Dump</button>{container.movable && <button type="button" onClick={() => { commitInventory(setContainerHidden(state, container.id, true), "Hide container", container.name); announce(`${container.name} hidden.`); }}>Hide</button>}{container.containerType === "container" && <button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${container.name} and everything inside it?`)) return; const result = discardInventoryContainer(state, container.id); commitInventory(result.state, "Discard container", result.reason); announce(result.reason); }}>Discard</button>}</span>
        </div></details>
      </header>
      <div className="text-load-meter"><div className={`inventory-meter ${capacityTone(used, capacity)}`}><span style={{ width: `${loadPercent}%` }} /></div><small>{used > capacity ? `${formatStoneUnits(used - capacity)} over` : used === capacity && capacity > 0 ? "At capacity" : `${Math.round(loadPercent)}% full`}</small></div>
      {!isCollapsed && <div className="text-tree-contents">{contents.map((stack) => <TextStackLine key={stack.id} stack={stack} />)}{children.map((child) => <TextContainerTree key={child.id} container={child} depth={depth + 1} />)}{!contents.length && !children.length && <p className="text-empty-line">Empty</p>}</div>}
    </section>;
  }

  function TextPile({ title, icon, stacks, collapseKey, onDrop }: { title: string; icon: string; stacks: InventoryStack[]; collapseKey: string; onDrop?: (event: DragEvent) => void }) {
    const key = `text:pile:${collapseKey}`;
    const isCollapsed = textCollapsed.has(key);
    return <section className={`text-inventory-pile ${isCollapsed ? "collapsed" : ""}`} onDragOver={(event) => { if (onDrop) event.preventDefault(); }} onDrop={(event) => { if (!onDrop || textInventoryCardDragKey(event)) return; event.stopPropagation(); onDrop(event); }}><header><button className="text-tree-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}><span className="text-tree-caret" aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span>{icon} {title}</span></button><strong>{stacks.length}</strong></header>{!isCollapsed && <div className="text-tree-contents">{stacks.map((stack) => <TextStackLine key={stack.id} stack={stack} />)}{!stacks.length && <p className="text-empty-line">Drop items here</p>}</div>}</section>;
  }

  function TextOwnerInventory({ owner }: { owner: PhysicalInventoryOwner }) {
    const key = `text:owner:${owner.id}`;
    const cardKey = `owner:${owner.id}`;
    const isCollapsed = textCollapsed.has(key);
    const used = getOwnerUsedUnits(state, owner.id);
    const capacity = getOwnerCapacityUnits(owner, campaign.characters);
    const roots = containers.filter((container) => container.holderType === "owner" && container.holderId === owner.id && container.containerType !== "worn");
    const character = owner.characterId ? campaign.characters.find((entry) => entry.id === owner.characterId) : undefined;
    const worn = containers.find((container) => container.containerType === "worn" && container.holderType === "owner" && container.holderId === owner.id);
    const wornStacks = worn ? campaignStacks.filter((stack) => stack.containerId === worn.id) : [];
    const quick = containers.find((container) => container.containerType === "quick-access" && container.holderType === "owner" && container.holderId === owner.id);
    const handStacks = quick ? campaignStacks.filter((stack) => stack.containerId === quick.id && stack.handSlot) : [];
    const handsIssue = character ? handLoadoutIssue(handStacks.find((stack) => stack.handSlot === "main"), handStacks.find((stack) => stack.handSlot === "offhand"), character) : "";
    const ownerIcon = character?.emoji ?? (owner.type === "animal" ? "🐴" : owner.type === "vehicle" ? "🛞" : owner.type === "npc" ? "🧑" : "📦");
    const encumbrance = character ? encumbranceSummary(effectiveArmorMovementRate(campaign, character), used, capacity) : null;
    const loadPercent = character ? encumbranceLoadPercent(used, capacity) : Math.min(100, capacity ? used / capacity * 100 : 0);
    return <article className={`text-inventory-card owner ${character ? "character" : ""} ${isCollapsed ? "collapsed" : ""} ${capacityWarningKeys.has(`owner:${owner.id}`) ? "inventory-capacity-warning" : ""}`} style={character ? characterTileStyle(character.tileColor) : undefined} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTextInventoryCard(event, cardKey)) dropOnOwner(event, owner); }}>
      <header className="text-inventory-card-header" onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".text-line-actions")) setTextContainerBranches(roots.map((container) => container.id)); }}><button className="text-card-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}><TextCardGrab cardKey={cardKey} /><span aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span className="text-owner-icon" aria-hidden>{ownerIcon}</span><span><b>{owner.name}</b><small>{owner.type}</small></span></button><strong>{formatStoneUnits(used)} / {formatStoneUnits(capacity)}</strong><details className="text-line-actions inventory"><summary>Actions</summary><div><span className="text-action-buttons"><button type="button" onClick={() => { const result = dumpHolderToGround(state, { type: "owner", id: owner.id }); updateInventory(() => result.state); announce(result.reason); }}>Dump to Ground</button>{owner.type !== "character" && <button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${owner.name} and its entire inventory?`)) return; const result = discardInventoryOwner(state, owner.id); commitInventory(result.state, "Discard carrier", result.reason); announce(result.reason); }}>Discard carrier</button>}</span></div></details></header>
      <div className="text-load-meter owner"><div className={`inventory-meter ${encumbrance ? `encumbrance-${encumbrance.band}` : capacityTone(used, capacity)}`}><span style={{ width: `${loadPercent}%` }} /></div><small>{character ? `Move ${encumbrance?.rate}/${encumbrance?.maxRate} ft` : used > capacity ? `${formatStoneUnits(used - capacity)} over` : `${Math.round(loadPercent)}% full`}</small></div>
      {!isCollapsed && <div className="text-inventory-card-body">
        {character && <section className={`text-loadout-group ${handsIssue ? "invalid" : ""}`}><h4>Hands</h4>{handsIssue && <p className="hand-loadout-warning" role="alert">⚠ {handsIssue} Weapon attacks and shield protection are inactive.</p>}<div className="text-hand-list">{(["main", "offhand"] as const).map((slot) => { const held = handStacks.find((stack) => stack.handSlot === slot); const other = handStacks.find((stack) => stack.handSlot !== slot); const reserved = Boolean(!held && other && stackRequiresBothHands(other, character)); return <div className="text-hand-line" key={slot} onDragOver={(event) => { if (!reserved) event.preventDefault(); }} onDrop={(event) => { if (!reserved && !textInventoryCardDragKey(event)) dropOnHand(event, owner.id, slot); }}><span>{slot === "main" ? "Hand 1" : "Hand 2"}</span>{held ? <TextStackLine stack={held} /> : <p className="text-empty-line">{reserved ? `Reserved by ${other?.name ?? "two-handed item"}` : "Drop equipment here"}</p>}</div>; })}</div></section>}
        {character && <section className="text-loadout-group" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!textInventoryCardDragKey(event)) dropOnWorn(event, owner.id); }}><h4>Worn</h4><div className="text-tree-contents">{wornStacks.map((stack) => <TextStackLine key={stack.id} stack={stack} />)}{!wornStacks.length && <p className="text-empty-line">Drop wearable equipment here</p>}</div></section>}
        <section className="text-loadout-group storage"><h4>Containers <small>{roots.length} carried</small></h4><div className="text-container-list">{roots.map((container) => <TextContainerTree key={container.id} container={container} />)}{!roots.length && <p className="text-empty-line">No containers</p>}</div></section>
        {owner.notes && <p className="text-inventory-notes">{owner.notes}</p>}
      </div>}
    </article>;
  }

  function TextLocationInventory({ location }: { location: (typeof locations)[number] }) {
    const key = `text:location:${location.id}`;
    const cardKey = `location:${location.id}`;
    const isCollapsed = textCollapsed.has(key);
    const roots = containers.filter((container) => container.holderType === "location" && container.holderId === location.id);
    const looseStacks = campaignStacks.filter((stack) => !stack.containerId && stack.locationId === location.id);
    return <article className={`text-inventory-card location ${isCollapsed ? "collapsed" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTextInventoryCard(event, cardKey)) dropOnLocation(event, location.id, location.name); }}><header className="text-inventory-card-header" onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".text-line-actions")) setTextContainerBranches(roots.map((container) => container.id)); }}><button className="text-card-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}><TextCardGrab cardKey={cardKey} /><span aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span className="text-owner-icon" aria-hidden>📍</span><span><b>{location.name}</b><small>location</small></span></button><strong>∞</strong><details className="text-line-actions inventory"><summary>Actions</summary><div><span className="text-action-buttons"><button type="button" onClick={() => { const result = dumpHolderToGround(state, { type: "location", id: location.id }); commitInventory(result.state, "Dump location", result.reason); announce(result.reason); }}>Dump to Ground</button><button type="button" onClick={() => { commitInventory(setLocationHidden(state, location.id, true), "Hide location", location.name); announce(`${location.name} hidden.`); }}>Hide</button><button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${location.name} and everything stored there?`)) return; const result = discardInventoryLocation(state, location.id); commitInventory(result.state, "Discard location", result.reason); announce(result.reason); }}>Discard</button></span></div></details></header>{!isCollapsed && <div className="text-inventory-card-body"><TextPile title="Loose items" icon="•" stacks={looseStacks} collapseKey={`location-${location.id}-loose`} onDrop={(event) => dropOnLocation(event, location.id, location.name)} /><section className="text-loadout-group storage"><h4>Containers <small>{roots.length}</small></h4><div className="text-container-list">{roots.map((container) => <TextContainerTree key={container.id} container={container} />)}{!roots.length && <p className="text-empty-line">No containers</p>}</div></section>{location.notes && <p className="text-inventory-notes">{location.notes}</p>}</div>}</article>;
  }

  const boardNodes = [
    { key: "utility:sell", kind: "sell" as const },
    { key: "utility:ground", kind: "ground" as const },
    ...owners.map((owner) => ({ key: `owner:${owner.id}`, kind: "owner" as const, value: owner })),
    ...locations.map((location) => ({ key: `location:${location.id}`, kind: "location" as const, value: location })),
  ];
  function fallbackBoardPosition(kind: "sell" | "ground" | "owner" | "location", index: number) {
    if (kind === "ground") return { x: 12, y: 12 };
    if (kind === "sell") return { x: 12, y: 388 };
    const inventoryIndex = Math.max(0, index - 2);
    return { x: 12 + (inventoryIndex % 2) * 616, y: 664 + Math.floor(inventoryIndex / 2) * 700 };
  }
  const boardHeight = Math.max(420, ...boardNodes.map((node, index) => {
    const fallback = fallbackBoardPosition(node.kind, index);
    const position = draftPositions[node.key] ?? state.layoutPositions[node.key] ?? fallback;
    const fallbackHeight = collapsed.has(node.key) ? 150 : node.kind === "ground" ? 360 : 420;
    return position.y + (boardNodeHeights[node.key] ?? fallbackHeight) + 18;
  }));

  const groundRows = [
    ...groundStacks.map((stack) => ({ id: stack.id, rowKind: "stack" as const, name: inventoryStackDisplayName(stack), kind: stack.itemKind, lastHolder: stack.lastHolder ?? "—", weight: getStackEncumbranceUnits(stack), value: (stack.gpValue ?? 0) * stack.quantity, quantity: stack.quantity, stack })),
    ...groundContainers.map((container) => ({ id: container.id, rowKind: "container" as const, name: container.name, kind: "container", lastHolder: container.lastHolder ?? "—", weight: getContainerEffectiveLoadUnits(state, container.id), value: 0, quantity: 1, container })),
  ].sort((left, right) => {
    const leftValue = groundSort.key === "name" ? left.name : groundSort.key === "kind" ? left.kind : groundSort.key === "lastHolder" ? left.lastHolder : groundSort.key === "weight" ? left.weight : left.value;
    const rightValue = groundSort.key === "name" ? right.name : groundSort.key === "kind" ? right.kind : groundSort.key === "lastHolder" ? right.lastHolder : groundSort.key === "weight" ? right.weight : right.value;
    const comparison = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
    return groundSort.direction === "asc" ? comparison : -comparison;
  });

  function changeGroundSort(key: GroundSortKey) {
    setGroundSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  }

  function TradeBoardTile({ nodeKey, position, fallback, isCollapsed }: { nodeKey: string; position: { x: number; y: number }; fallback: { x: number; y: number }; isCollapsed: boolean }) {
    return <article data-inventory-board-node={nodeKey} className={`inventory-board-node utility-node sell-board-tile ${isCollapsed ? "collapsed" : ""}`} style={{ left: position.x, top: position.y, zIndex: activeBoardNodeKey === nodeKey ? 3 : 1 }} onPointerDown={() => setActiveBoardNodeKey(nodeKey)}>
      <div className="inventory-node-handle" onPointerDown={(event) => beginNodeDrag(event, nodeKey, fallback)}><span>⠿ MOVE</span><button className="collapse-button" type="button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(nodeKey)}>{isCollapsed ? "Expand" : "Collapse"}</button></div>
      <header><span className="owner-symbol">💵</span><span><h3>Sell</h3></span><strong>{sellStacks.length} sale</strong></header>
      {!isCollapsed && <div className="utility-tile-body" title="Paid items and AD&D coinage change wait here until dragged to a carrier or Ground."><p className="utility-tile-copy">Sell goods, stage Payment, then drag purchases and change to their final inventory. {ADND_CURRENCY_RULE}</p><div className="sell-zone-grid">
        <section className="sell-zone sale-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnSell}><header><span><b>Items for sale</b><small>Ordinary 10% · treasure 100% · coins 95%</small></span><strong>{formatGpAsPrice(salePayout)}</strong></header>{!sellStacks.length ? <p className="drop-hint large">Drop item stacks here</p> : <div className="sell-stack-grid">{sellStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}<button className="sell-initiate-button" type="button" disabled={!sellStacks.length} onClick={() => { if (!window.confirm(`Sell all ${sellStacks.length} stack${sellStacks.length === 1 ? "" : "s"}? Proceeds will stay here in Purchases & change.`)) return; const result = initiateInventorySale(state, activeCampaignId); commitInventory(result.state, "Complete sale", result.reason); announce(result.reason); }}>Initiate sale</button></section>
        <section className="sell-zone payment-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnPayment}><header><span><b>Payment</b><small>Drop any quantity of coins or treasure</small></span><strong>{formatGpAsPrice(paymentTotal)}</strong></header>{!paymentStacks.length ? <p className="drop-hint large">Drop coins or treasure here</p> : <div className="sell-stack-grid">{paymentStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}</section>
        <section className="sell-zone counter-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnCounter}><header><span><b>Purchases &amp; change</b><small>Pickup area · drag piles to inventories</small></span><strong>{formatGpAsPrice(counterTotal)}</strong></header>{!counterStacks.length ? <p className="drop-hint large">Completed purchases and change appear here</p> : <div className="sell-stack-grid">{counterStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}</section>
      </div></div>}
    </article>;
  }

  function GroundBoardTile({ nodeKey, position, fallback, isCollapsed }: { nodeKey: string; position: { x: number; y: number }; fallback: { x: number; y: number }; isCollapsed: boolean }) {
    return <article data-inventory-board-node={nodeKey} className={`inventory-board-node utility-node ground-board-tile ${isCollapsed ? "collapsed" : ""}`} style={{ left: position.x, top: position.y, zIndex: activeBoardNodeKey === nodeKey ? 3 : 1 }} onPointerDown={() => setActiveBoardNodeKey(nodeKey)} onDragOver={(event) => event.preventDefault()} onDrop={dropOnGround}>
      <div className="inventory-node-handle" onPointerDown={(event) => beginNodeDrag(event, nodeKey, fallback)}><span>⠿ MOVE</span><button className="collapse-button" type="button" aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(nodeKey)}>{isCollapsed ? "Expand" : "Collapse"}</button></div>
      <header><span className="owner-symbol">🌱</span><span><h3>Ground</h3><p>Unassigned inventory</p></span><strong>{groundRows.length} entr{groundRows.length === 1 ? "y" : "ies"}</strong></header>
      {!isCollapsed && <div className="utility-tile-body" title="New items, purchases, sale proceeds, and dropped gear collect here."><p className="utility-tile-copy">New items, purchases, sale proceeds, and dropped gear collect here.</p><details className="assignment-scope"><summary>Assignment scope · {effectiveScopeOwnerIds.length} selected</summary><div>{owners.map((owner) => <label key={owner.id}><input type="checkbox" checked={effectiveScopeOwnerIds.includes(owner.id)} onChange={(event) => setScopeOwnerIds(event.target.checked ? [...effectiveScopeOwnerIds, owner.id] : effectiveScopeOwnerIds.filter((id) => id !== owner.id))} /> {owner.name} <small>{owner.type}</small></label>)}</div></details>
        {!groundRows.length ? <p className="drop-hint large">Drop items or containers here</p> : <div className="ground-table-wrap"><table className="ground-table"><thead><tr><th><button type="button" onClick={() => changeGroundSort("name")}>Name</button></th><th>Qty</th><th><button type="button" onClick={() => changeGroundSort("kind")}>Type</button></th><th><button type="button" onClick={() => changeGroundSort("lastHolder")}>Last holder</button></th><th><button type="button" onClick={() => changeGroundSort("weight")}>Weight</button></th><th><button type="button" onClick={() => changeGroundSort("value")}>Price</button></th><th>Actions</th></tr></thead><tbody>{groundRows.map((row) => <tr key={`${row.rowKind}:${row.id}`} draggable onDragStart={(event) => setDragPayload(event, { kind: row.rowKind, id: row.id })}><td><b>{row.rowKind === "container" ? "📦 " : ""}{row.name}</b></td><td>{row.quantity}</td><td>{row.kind === "normal" ? "ordinary" : row.kind}</td><td>{row.lastHolder}</td><td>{formatItemUnits(row.weight)}</td><td>{row.rowKind === "stack" && row.stack.gpValue != null ? formatGpAsPrice(row.value, "Free") : "—"}</td><td>{row.rowKind === "stack" ? <div className="ground-actions"><button type="button" onClick={() => { const result = autoAssign(state, row.stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Assign", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Assign</button><button type="button" onClick={() => { const result = spreadEvenly(state, row.stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Spread evenly", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Spread</button>{combinableInventoryStackIds(state, row.stack.id).length > 1 && <button type="button" onClick={() => { const result = combineInventoryStacks(state, row.stack.id); commitInventory(result.state, "Combine stacks", result.reason); announce(result.reason); }}>Combine</button>}<button className="sell-row-button" type="button" onClick={() => moveStackBySelect(row.stack.id, "sell")}>Sell</button><select defaultValue="" onChange={(event) => { moveStackBySelect(row.stack.id, event.target.value); event.currentTarget.value = ""; }}>{destinationOptions(row.stack)}</select><button className="danger-link" type="button" onClick={() => deleteStack(row.stack)}>Discard</button></div> : <div className="ground-actions"><select defaultValue="" onChange={(event) => { moveContainerBySelect(row.container.id, event.target.value); event.currentTarget.value = ""; }}>{containerDestinationOptions(row.container)}</select><button type="button" onClick={() => setExpandedGroundContainers((current) => { const next = new Set(current); if (next.has(row.container.id)) next.delete(row.container.id); else next.add(row.container.id); return next; })}>{expandedGroundContainers.has(row.container.id) ? "Close" : "Inspect"}</button><button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${row.container.name} and everything inside it?`)) return; const result = discardInventoryContainer(state, row.container.id); commitInventory(result.state, "Discard container", result.reason); announce(result.reason); }}>Discard</button></div>}</td></tr>)}</tbody></table></div>}
        {groundContainers.filter((container) => expandedGroundContainers.has(container.id)).map((container) => <div className="ground-container-inspector" key={container.id}><ContainerTile container={container} /></div>)}
      </div>}
    </article>;
  }

  function TextGroundInventory() {
    const key = "text:ground";
    const cardKey = "ground";
    const isCollapsed = textCollapsed.has(key);
    return <article className={`text-inventory-card utility ground ${isCollapsed ? "collapsed" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTextInventoryCard(event, cardKey)) dropOnGround(event); }}><header className="text-inventory-card-header" onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest(".text-line-actions")) setTextContainerBranches(groundContainers.map((container) => container.id)); }}><button className="text-card-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}><TextCardGrab cardKey={cardKey} /><span aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span className="text-owner-icon" aria-hidden>🌱</span><span><b>Ground</b><small>unassigned inventory</small></span></button><strong>{groundRows.length} entries</strong></header>{!isCollapsed && <div className="text-inventory-card-body"><details className="assignment-scope text-mode-scope"><summary>Assignment scope · {effectiveScopeOwnerIds.length} selected</summary><div>{owners.map((owner) => <label key={owner.id}><input type="checkbox" checked={effectiveScopeOwnerIds.includes(owner.id)} onChange={(event) => setScopeOwnerIds(event.target.checked ? [...effectiveScopeOwnerIds, owner.id] : effectiveScopeOwnerIds.filter((id) => id !== owner.id))} /> {owner.name} <small>{owner.type}</small></label>)}</div></details><TextPile title="Loose items" icon="•" stacks={groundStacks} collapseKey="ground-loose" onDrop={dropOnGround} /><section className="text-loadout-group storage"><h4>Containers <small>{groundContainers.length}</small></h4><div className="text-container-list">{groundContainers.map((container) => <TextContainerTree key={container.id} container={container} />)}{!groundContainers.length && <p className="text-empty-line">No containers</p>}</div></section></div>}</article>;
  }

  function TextSellInventory() {
    const key = "text:sell";
    const cardKey = "sell";
    const isCollapsed = textCollapsed.has(key);
    return <article className={`text-inventory-card utility sell ${isCollapsed ? "collapsed" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { if (!dropTextInventoryCard(event, cardKey)) dropOnSell(event); }}><header className="text-inventory-card-header"><button className="text-card-toggle" type="button" aria-expanded={!isCollapsed} onClick={() => toggleTextCollapsed(key)}><TextCardGrab cardKey={cardKey} /><span aria-hidden>{isCollapsed ? "▸" : "▾"}</span><span className="text-owner-icon" aria-hidden>💵</span><span><b>Sell</b><small>trade counter</small></span></button><strong>{formatGpAsPrice(salePayout)}</strong></header>{!isCollapsed && <div className="text-inventory-card-body"><TextPile title="Items for sale" icon="🏷️" stacks={sellStacks} collapseKey="sell-items" onDrop={dropOnSell} />{sellStacks.length > 0 && <button className="sell-initiate-button text-mode-sell-button" type="button" onClick={() => { if (!window.confirm(`Sell all ${sellStacks.length} stack${sellStacks.length === 1 ? "" : "s"}? Proceeds will stay here in Purchases & change.`)) return; const result = initiateInventorySale(state, activeCampaignId); commitInventory(result.state, "Complete sale", result.reason); announce(result.reason); }}>Initiate sale · {formatGpAsPrice(salePayout)}</button>}<TextPile title="Payment" icon="🪙" stacks={paymentStacks} collapseKey="sell-payment" onDrop={dropOnPayment} /><TextPile title="Purchases & change" icon="🧾" stacks={counterStacks} collapseKey="sell-counter" onDrop={dropOnCounter} /></div>}</article>;
  }

  function TextInventoryView() {
    const availableKeys = ["ground", "sell", ...owners.map((owner) => `owner:${owner.id}`), ...locations.map((location) => `location:${location.id}`)];
    const columns = textInventoryColumnsFor(availableKeys);
    const allKeys = [
      "text:ground",
      "text:sell",
      "text:pile:ground-loose",
      "text:pile:sell-items",
      "text:pile:sell-payment",
      "text:pile:sell-counter",
      ...owners.map((owner) => `text:owner:${owner.id}`),
      ...locations.map((location) => `text:location:${location.id}`),
      ...locations.map((location) => `text:pile:location-${location.id}-loose`),
      ...containers.map((container) => `text:container:${container.id}`),
    ];
    const renderEntry = (entryKey: string) => {
      if (entryKey === "ground") return <TextGroundInventory key={entryKey} />;
      if (entryKey === "sell") return <TextSellInventory key={entryKey} />;
      if (entryKey.startsWith("owner:")) { const owner = owners.find((entry) => `owner:${entry.id}` === entryKey); return owner ? <TextOwnerInventory key={entryKey} owner={owner} /> : null; }
      const location = locations.find((entry) => `location:${entry.id}` === entryKey);
      return location ? <TextLocationInventory key={entryKey} location={location} /> : null;
    };
    return <section className="text-inventory-view"><div className="text-inventory-heading"><span><h3>Text inventory</h3><small>Drag ⠿ headers within or between columns · either column may hold any number · double-click a header to fold its containers</small></span><span><button type="button" onClick={() => setTextCollapsed(new Set(allKeys))}>Collapse all</button><button type="button" onClick={() => setTextCollapsed(new Set())}>Expand all</button></span></div><div className="text-inventory-grid">{columns.map((column, index) => <div className="text-inventory-column" data-text-inventory-column={index === 0 ? "left" : "right"} key={index} onDragOver={(event) => { if (textInventoryCardDragKey(event)) event.preventDefault(); }} onDrop={(event) => dropTextInventoryCard(event, "", index as 0 | 1)}>{column.map(renderEntry)}</div>)}</div></section>;
  }

  return <section className="section-stack inventory-management-shell">
    <div className="workspace-action-row inventory-management-header"><div className="inventory-header-actions"><button type="button" onClick={() => setForm("location")}>+ Location</button><button type="button" onClick={() => setForm("inventory")}>+ Carrier</button><button type="button" onClick={() => setForm("container")}>+ Container</button><button type="button" onClick={() => setForm("equipment")}>+ Equipment</button><button className="primary-button" type="button" onClick={() => setForm("item")}>+ Item / treasure</button><button type="button" onClick={sortInventoryLoads}>⚖ Sort load</button>{!textInventoryMode && <button type="button" onClick={snapAndSort}>⊞ Snap &amp; sort</button>}</div><label className="inventory-text-mode-toggle"><input type="checkbox" role="switch" checked={textInventoryMode} onChange={(event) => setTextInventoryMode(event.target.checked)} /><span><b>Text inventory</b><small>Nested list view</small></span></label></div>
    <p className="notice inventory-notice" role="status">{notice}</p>

    <div className="inventory-utility-panels">
      <details className="panel inventory-hidden-panel"><summary>Hidden · {hiddenLocations.length + hiddenContainers.length}</summary><div>{!hiddenLocations.length && !hiddenContainers.length ? <p className="compact-empty">Nothing hidden.</p> : <>{hiddenLocations.map((location) => <div key={location.id}><span>📍 <b>{location.name}</b></span><button type="button" onClick={() => commitInventory(setLocationHidden(state, location.id, false), "Show location", location.name)}>Show</button></div>)}{hiddenContainers.map((container) => <div key={container.id}><span>📦 <b>{container.name}</b></span><button type="button" onClick={() => commitInventory(setContainerHidden(state, container.id, false), "Show container", container.name)}>Show</button></div>)}</>}</div></details>
      <details className="panel inventory-log-panel"><summary>Log · {(state.activityLog ?? []).length}</summary><div className="inventory-log-heading"><span>Latest first</span><button className="text-button" type="button" disabled={!(state.activityLog ?? []).length} onClick={() => updateInventory((current) => ({ ...current, activityLog: [] }))}>Clear</button></div>{!(state.activityLog ?? []).length ? <p className="compact-empty">No inventory actions yet.</p> : <ol>{(state.activityLog ?? []).map((entry) => <li key={entry.id}><header><b>{entry.action}</b><time>{new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></header>{entry.details.map((detail, index) => <span key={`${entry.id}:${index}`}>{detail}</span>)}</li>)}</ol>}</details>
    </div>

    {form && <section className="panel inventory-create-panel">
      <div className="split-heading"><h3>{form === "location" ? "Add location" : form === "inventory" ? "Add finite carrier" : form === "container" ? "Create container" : form === "equipment" ? "Add equipment" : "Add item or treasure to Ground"}</h3><button type="button" onClick={() => setForm(null)} aria-label="Close create form">×</button></div>
      {form === "location" && <form className="inventory-form-grid" onSubmit={submitLocation}><label>Name<input name="name" autoFocus placeholder="Buried Cache — Hex 0712" /></label><label className="wide">Notes<textarea name="notes" /></label><button className="primary-button" type="submit">Add location</button></form>}
      {form === "inventory" && <form className="inventory-form-grid" onSubmit={submitInventory}><label>Name<input name="name" autoFocus placeholder="Mule" /></label><label>Type<select name="type"><option value="npc">NPC</option><option value="animal">Animal</option><option value="vehicle">Vehicle</option><option value="other">Other</option></select></label><label>Capacity<input name="capacity" type="number" min="0.01" step="0.01" defaultValue="30" /></label><label>Unit<select name="unit"><option value="stone">Stone</option><option value="pocket">Pockets</option></select></label><label className="wide">Notes<textarea name="notes" /></label><button className="primary-button" type="submit">Add inventory</button></form>}
      {form === "container" && <form className="inventory-form-grid" onSubmit={submitContainer}><label className="wide">Template<select name="template" defaultValue=""><option value="">Custom container</option>{siteCatalog.filter((item) => item.containerCapacityUnits).map((item) => <option value={item.id} key={item.id}>{item.name} · {formatStoneUnits(item.containerCapacityUnits ?? 0)}</option>)}</select></label><label>Name<input name="name" autoFocus placeholder="Small sack" /></label><label>Capacity<input name="capacity" type="number" min="0.01" step="0.01" defaultValue="1" /></label><label>Unit<select name="unit"><option value="stone">Stone</option><option value="pocket">Pockets</option><option value="coin">Coin-size units</option></select></label><label>Starting holder<select name="holder" defaultValue="ground"><option value="ground">Ground</option>{owners.map((owner) => <optgroup label={owner.name} key={owner.id}><option value={`owner:${owner.id}`}>{owner.name}</option>{containers.filter((container) => container.containerType !== "worn" && getContainerRootHolder(state, container.id)?.type === "owner" && getContainerRootHolder(state, container.id)?.id === owner.id).map((container) => <option value={`container:${container.id}`} key={container.id}>Inside {container.name}</option>)}</optgroup>)}{locations.map((location) => <optgroup label={location.name} key={location.id}><option value={`location:${location.id}`}>{location.name}</option>{containers.filter((container) => getContainerRootHolder(state, container.id)?.type === "location" && getContainerRootHolder(state, container.id)?.id === location.id).map((container) => <option value={`container:${container.id}`} key={container.id}>Inside {container.name}</option>)}</optgroup>)}</select></label><label>Tare<input name="tare" type="number" min="0" step="0.01" defaultValue="0" /></label><label>Tare unit<select name="tareUnit"><option value="stone">Stone</option><option value="pocket">Pockets</option><option value="coin">Coin-size units</option></select></label><button className="primary-button" type="submit">Create container</button></form>}
      {form === "equipment" && <div className="equipment-create-shell">
        <section className="equipment-quick-add"><div className="split-heading"><div><h4>AD&amp;D equipment</h4><p>Weapon mechanics use the shared Players Handbook catalogue.</p></div><EquipmentRulesInfoButton /></div><div className="equipment-quick-controls"><input aria-label="Search AD&D equipment" value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Search weapons and armor" /><select aria-label="AD&D equipment" value={equipmentDefaultId} onChange={(event) => setEquipmentDefaultId(event.target.value)}>{filteredEquipmentDefaults.map((entry) => <option value={entry.id} key={entry.id}>{equipmentDisplayName(entry.name, entry.equipment)} · {entry.equipment.kind}{entry.equipment.damage ? ` · ${entry.equipment.damage}` : ""}</option>)}</select>{osricEquipmentDefaults.find((entry) => entry.id === equipmentDefaultId)?.equipment.weaponRulesId && <WeaponRulesTooltip rulesId={osricEquipmentDefaults.find((entry) => entry.id === equipmentDefaultId)?.equipment.weaponRulesId}>ⓘ</WeaponRulesTooltip>}<button className="primary-button" type="button" disabled={!filteredEquipmentDefaults.some((entry) => entry.id === equipmentDefaultId)} onClick={() => { const entry = filteredEquipmentDefaults.find((item) => item.id === equipmentDefaultId); if (entry) addEquipmentDefault(entry); }}>Add selected</button></div></section>
        <details className="equipment-custom-panel"><summary>Custom equipment · setup</summary><div className="mode-switch equipment-kind-switch">{(["weapon", "armor", "shield"] as InventoryEquipment["kind"][]).map((kind) => <button type="button" className={equipmentKind === kind ? "active" : ""} key={kind} onClick={() => setEquipmentKind(kind)}>{kind}</button>)}</div><form className="inventory-form-grid" onSubmit={submitEquipment}><label>Name<input name="name" autoFocus placeholder={equipmentKind === "weapon" ? "Silvered falchion" : equipmentKind === "armor" ? "Bronze cuirass" : "Tower shield"} /></label>{equipmentKind === "weapon" && <><label className="wide">Rules weapon<select name="weaponRulesId" defaultValue="" onChange={(event) => { const rules = phbWeaponRules.find((entry) => entry.id === event.target.value); const form = event.currentTarget.form; const damage = form?.elements.namedItem("damage") as HTMLInputElement | null; const damageLarge = form?.elements.namedItem("damageLarge") as HTMLInputElement | null; if (rules && damage && damageLarge) { damage.value = rules.damageSM; damageLarge.value = rules.damageL; } }}><option value="">Unmapped custom weapon</option>{phbWeaponRules.map((rules) => <option value={rules.id} key={rules.id}>{rules.name}</option>)}</select><small>Supplies damage, speed, reach, damage type, and armour adjustments. Damage remains editable.</small></label><label>Weapon type<select name="weaponType"><option value="melee">Melee</option><option value="ranged">Ranged</option><option value="other">Other</option></select></label><label>Damage<input name="damage" placeholder="1d8" /></label><label>Damage vs Large<input name="damageLarge" placeholder="1d12" /></label><label>Hit &amp; damage bonus<input name="attackBonus" type="number" defaultValue="0" /></label><label className="equipment-check"><input name="twoHanded" type="checkbox" />Two-handed</label></>}{equipmentKind === "armor" && <label>Ascending AC<input name="ascendingAc" type="number" min="10" defaultValue="15" /></label>}{equipmentKind === "shield" && <label>AC bonus<input name="shieldBonus" type="number" min="0" defaultValue="1" /></label>}<label>Weight<input name="weight" type="number" min="0.01" step="0.01" defaultValue={equipmentKind === "weapon" ? "1" : equipmentKind === "armor" ? "2" : "0.5"} /></label><label>Unit<select name="weightUnit"><option value="stone">Stone</option><option value="pocket">Pockets</option><option value="coin">Coin-size units</option></select></label><label>GP value<input name="gpValue" type="number" min="0" step="0.005" /></label><label className="wide">Notes<textarea name="notes" /></label><button className="primary-button" type="submit">Add custom equipment</button></form></details>
      </div>}
      {form === "item" && <>
        <div className="mode-switch"><button className={catalogMode ? "active" : ""} type="button" onClick={() => setCatalogMode(true)}>Existing item</button><button className={!catalogMode ? "active" : ""} type="button" onClick={() => setCatalogMode(false)}>Custom item</button></div>
        <form className="inventory-form-grid" onSubmit={submitItem}>
          {catalogMode ? <>
            <label className="wide">Search<input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Sword, torch, armor…" /></label>
            <label className="wide">Item<select value={catalogItemId} onChange={(event) => setCatalogItemId(event.target.value)}><option value="">Choose…</option>{filteredCatalog.map((item) => <option value={item.id} key={item.id}>{equipmentDisplayName(item.name)} · {formatStoneUnits(item.encumbranceUnits)} · {item.category}</option>)}</select></label>
          </> : <>
            <label>Currency<select value={customCoinPreset} onChange={(event) => setCustomCoinPreset(event.target.value)}><option value="">Custom item or treasure</option>{coinPresets.map((coin) => <option value={coin.id} key={coin.id}>{coin.label} · {formatGpAsPrice(coin.gpValue)} each</option>)}</select></label>
            <label>Name<input name="name" autoFocus disabled={Boolean(customCoinPreset)} placeholder={customCoinPreset || "Silver Idol"} /></label>
            <label>Size{customCoinPreset ? <select key="coin-size" value="coin" disabled onChange={() => undefined}><option value="coin">Tiny · 1 unit</option></select> : <select key="custom-size" name="class" defaultValue="pocket"><option value="coin">Tiny · 1 unit</option><option value="pocket">Pocket · ¼ st</option><option value="sack">Sack · 1 st</option><option value="bulky">Custom stone</option></select>}</label>
            {!customCoinPreset && <label>Custom stone<input name="customStone" type="number" min="0.01" step="0.01" defaultValue="2" /></label>}
            <label>GP value{customCoinPreset ? <input key="coin-value" type="number" value={coinPresets.find((coin) => coin.id === customCoinPreset)?.gpValue ?? 0} readOnly /> : <input key="custom-value" name="gpValue" type="number" min="0" step="0.005" />}</label>
            <label className="wide">Notes<textarea name="notes" /></label>
          </>}
          <label>Quantity<input name="quantity" type="number" min="1" step="1" defaultValue="1" /></label>
          <label>Sale class{!catalogMode && customCoinPreset ? <select key="coin-kind" value="treasure" disabled onChange={() => undefined}><option value="treasure">Currency</option></select> : <select key="item-kind" name="kind" defaultValue="normal"><option value="normal">Ordinary · sells at 10%</option><option value="treasure">Treasure · sells at 100%</option></select>}</label>
          <button className="primary-button" type="submit">Add to Ground</button>
        </form>
      </>}
    </section>}

    {false && <section className="panel inventory-sell-tile">
      <div className="split-heading"><div><p className="eyebrow">Trade counter</p><h3>🪙 Sell</h3><p>Sell goods, stage payment for Shopping, then drag purchases and change to their final inventory.</p></div><button type="button" onClick={() => updateInventory((current) => ({ ...current, sellVisible: false }))}>Hide Sell</button></div>
      <div className="sell-zone-grid">
        <section className="sell-zone sale-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnSell}><header><span><b>Items for sale</b><small>Ordinary 10% · treasure 100% · coins 95%</small></span><strong>{formatGpAsPrice(salePayout)}</strong></header>{!sellStacks.length ? <p className="drop-hint large">Drop item stacks here</p> : <div className="sell-stack-grid">{sellStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}<button className="sell-initiate-button" type="button" disabled={!sellStacks.length} onClick={() => { if (!window.confirm(`Sell all ${sellStacks.length} stack${sellStacks.length === 1 ? "" : "s"}? Proceeds will stay here in Purchases & change.`)) return; const result = initiateInventorySale(state, activeCampaignId); commitInventory(result.state, "Complete sale", result.reason); announce(result.reason); }}>Initiate sale</button></section>
        <section className="sell-zone payment-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnPayment}><header><span><b>Payment</b><small>Drop any quantity of coins or treasure</small></span><strong>{formatGpAsPrice(paymentTotal)}</strong></header>{!paymentStacks.length ? <p className="drop-hint large">Drop coins or treasure here</p> : <div className="sell-stack-grid">{paymentStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}</section>
        <section className="sell-zone counter-zone" onDragOver={(event) => event.preventDefault()} onDrop={dropOnCounter}><header><span><b>Purchases &amp; change</b><small>Pickup area · drag piles to inventories</small></span><strong>{formatGpAsPrice(counterTotal)}</strong></header>{!counterStacks.length ? <p className="drop-hint large">Completed purchases and change appear here</p> : <div className="sell-stack-grid">{counterStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div>}</section>
      </div>
    </section>}

    {textInventoryMode ? <TextInventoryView /> : <section className="inventory-board-section"><div className="inventory-board-heading"><div><h3>Inventory board</h3></div><span>{owners.length} finite · {locations.length} infinite</span></div>
      <div className="inventory-board" ref={boardRef} style={{ height: boardHeight }}>
        {boardNodes.map((node, index) => {
          const fallback = fallbackBoardPosition(node.kind, index);
          const position = draftPositions[node.key] ?? state.layoutPositions[node.key] ?? fallback;
          const isCollapsed = collapsed.has(node.key);
          if (node.kind === "sell") return <TradeBoardTile key={node.key} nodeKey={node.key} position={position} fallback={fallback} isCollapsed={isCollapsed} />;
          if (node.kind === "ground") return <GroundBoardTile key={node.key} nodeKey={node.key} position={position} fallback={fallback} isCollapsed={isCollapsed} />;
          if (node.kind === "owner") {
            const owner = node.value;
            const used = getOwnerUsedUnits(state, owner.id);
            const capacity = getOwnerCapacityUnits(owner, campaign.characters);
            const roots = containers.filter((container) => container.holderType === "owner" && container.holderId === owner.id && container.containerType !== "worn");
            const character = owner.characterId ? campaign.characters.find((entry) => entry.id === owner.characterId) : undefined;
            const wornExpanded = Boolean(character && !collapsed.has(`worn:${owner.id}`));
            const encumbrance = character ? encumbranceSummary(effectiveArmorMovementRate(campaign, character), used, capacity) : null;
            const loadPercent = character ? encumbranceLoadPercent(used, capacity) : Math.min(100, capacity ? used / capacity * 100 : 0);
            return <article data-inventory-board-node={node.key} className={`inventory-board-node owner-node ${character ? "character-owner" : ""} ${wornExpanded ? "worn-expanded" : ""} ${isCollapsed ? "collapsed" : ""} ${capacityWarningKeys.has(`owner:${owner.id}`) ? "inventory-capacity-warning" : ""}`} key={node.key} style={{ left: position.x, top: position.y, zIndex: activeBoardNodeKey === node.key ? 3 : 1, ...(character ? characterTileStyle(character.tileColor) : {}) } as React.CSSProperties} onPointerDown={() => setActiveBoardNodeKey(node.key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnOwner(event, owner)}>
              <div className="inventory-node-handle" onPointerDown={(event) => beginNodeDrag(event, node.key, fallback)}><span>⠿ MOVE INVENTORY</span><button className="collapse-button" type="button" onClick={() => toggleCollapsed(node.key)}>{isCollapsed ? "Expand" : "Collapse"}</button></div>
              <header><span className="owner-symbol">{character?.emoji ?? (owner.type === "animal" ? "🐴" : owner.type === "vehicle" ? "🛞" : owner.type === "npc" ? "🧑" : "📦")}</span><span><h3>{owner.name}</h3><p>{owner.type}</p></span><strong>{formatStoneUnits(used)} / {formatStoneUnits(capacity)}</strong></header>
              {!isCollapsed && <>
                <div className={`inventory-meter ${encumbrance ? `encumbrance-${encumbrance.band}` : capacityTone(used, capacity)}`}><span style={{ width: `${loadPercent}%` }} /></div>
                <div className="node-utility-row"><b>{used > capacity ? `${formatStoneUnits(used - capacity)} over · ` : used === capacity ? "At capacity · " : ""}{character ? `Move ${encumbrance?.rate}/${encumbrance?.maxRate} ft` : ""}</b><span><button type="button" onClick={() => { const result = dumpHolderToGround(state, { type: "owner", id: owner.id }); updateInventory(() => result.state); announce(result.reason); }}>Dump</button>{owner.type !== "character" && <button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${owner.name} and its entire inventory?`)) return; const result = discardInventoryOwner(state, owner.id); commitInventory(result.state, "Discard carrier", result.reason); announce(result.reason); }}>Discard</button>}</span></div>
                {character && <section className="owner-loadout-section"><div className="owner-section-heading"><b>Hands</b><small>Drag equipment into either slot</small></div><div className="inventory-hand-row"><HandSlot owner={owner} character={character} slot="main" /><HandSlot owner={owner} character={character} slot="offhand" /></div><WornArea owner={owner} /></section>}
                <section className="owner-storage-section"><div className="owner-section-heading"><b>Containers</b><small>{roots.length} carried</small></div><div className="owner-containers">{roots.length ? roots.map((container) => <ContainerTile key={container.id} container={container} />) : <p className="drop-hint">No containers</p>}</div></section>
                {owner.notes && <p className="node-notes">{owner.notes}</p>}
              </>}
            </article>;
          }
          const location = node.value;
          const roots = containers.filter((container) => container.holderType === "location" && container.holderId === location.id);
          const looseStacks = campaignStacks.filter((stack) => !stack.containerId && stack.locationId === location.id);
          return <article data-inventory-board-node={node.key} className={`inventory-board-node location-node ${isCollapsed ? "collapsed" : ""}`} key={node.key} style={{ left: position.x, top: position.y, zIndex: activeBoardNodeKey === node.key ? 3 : 1 }} onPointerDown={() => setActiveBoardNodeKey(node.key)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropOnLocation(event, location.id, location.name)}><div className="inventory-node-handle" onPointerDown={(event) => beginNodeDrag(event, node.key, fallback)}><span>⠿ MOVE</span><button className="collapse-button" type="button" onClick={() => toggleCollapsed(node.key)}>{isCollapsed ? "Expand" : "Collapse"}</button></div><header><span className="owner-symbol">📍</span><span><h3>{location.name}</h3><p>Location</p></span><strong>∞</strong></header>{!isCollapsed && <><div className="node-utility-row"><b>{roots.length} containers · {looseStacks.length} loose</b><span><button type="button" onClick={() => { const result = dumpHolderToGround(state, { type: "location", id: location.id }); commitInventory(result.state, "Dump location", result.reason); announce(result.reason); }}>Dump</button><button type="button" onClick={() => { commitInventory(setLocationHidden(state, location.id, true), "Hide location", location.name); announce(`${location.name} hidden.`); }}>Hide</button><button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${location.name} and everything stored there?`)) return; const result = discardInventoryLocation(state, location.id); commitInventory(result.state, "Discard location", result.reason); announce(result.reason); }}>Discard</button></span></div>{looseStacks.length > 0 && <section className="loose-stacks"><h4>Loose items</h4><div className="inventory-tile-list">{looseStacks.map((stack) => <StackTile key={stack.id} stack={stack} />)}</div></section>}<div className="owner-containers">{roots.map((container) => <ContainerTile key={container.id} container={container} />)}{!roots.length && !looseStacks.length && <p className="drop-hint">Empty</p>}</div>{location.notes && <p className="node-notes">{location.notes}</p>}</>}</article>;
        })}
      </div>
    </section>}

    {false && <section className="panel inventory-ground" onDragOver={(event) => event.preventDefault()} onDrop={dropOnGround}><div className="split-heading"><div><p className="eyebrow">Unassigned inventory</p><h3>Ground</h3><p>New items, purchases, sale proceeds, and dropped gear collect here.</p></div><strong>{groundRows.length} entr{groundRows.length === 1 ? "y" : "ies"}</strong></div>
      <details className="assignment-scope"><summary>Assignment scope · {effectiveScopeOwnerIds.length} selected</summary><div>{owners.map((owner) => <label key={owner.id}><input type="checkbox" checked={effectiveScopeOwnerIds.includes(owner.id)} onChange={(event) => setScopeOwnerIds(event.target.checked ? [...effectiveScopeOwnerIds, owner.id] : effectiveScopeOwnerIds.filter((id) => id !== owner.id))} /> {owner.name} <small>{owner.type}</small></label>)}</div></details>
      {!groundRows.length ? <p className="drop-hint large">Drop items or containers here</p> : <div className="ground-table-wrap"><table className="ground-table"><thead><tr><th><button type="button" onClick={() => changeGroundSort("name")}>Name</button></th><th>Qty</th><th><button type="button" onClick={() => changeGroundSort("kind")}>Type</button></th><th><button type="button" onClick={() => changeGroundSort("lastHolder")}>Last holder</button></th><th><button type="button" onClick={() => changeGroundSort("weight")}>Weight</button></th><th><button type="button" onClick={() => changeGroundSort("value")}>Price</button></th><th>Actions</th></tr></thead><tbody>{groundRows.map((row) => <tr className={row.rowKind === "stack" && flashingStackIds.has(row.id) ? "inventory-item-flash" : ""} key={`${row.rowKind}:${row.id}`} draggable onDragStart={(event) => setDragPayload(event, { kind: row.rowKind, id: row.id })}><td><b>{row.rowKind === "container" ? "📦 " : ""}{row.name}</b></td><td>{row.quantity}</td><td>{row.kind === "normal" ? "ordinary" : row.kind}</td><td>{row.lastHolder}</td><td>{formatItemUnits(row.weight)}</td><td>{row.rowKind === "stack" && row.stack.gpValue != null ? formatGpAsPrice(row.value, "Free") : "—"}</td><td>{row.rowKind === "stack" ? <div className="ground-actions"><button type="button" onClick={() => { const result = autoAssign(state, row.stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Assign", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Assign</button><button type="button" onClick={() => { const result = spreadEvenly(state, row.stack.id, effectiveScopeOwnerIds, campaign.characters); commitInventory(result.state, "Spread evenly", result.details?.length ? result.details : result.reason); announce(result.reason); }}>Spread</button>{combinableInventoryStackIds(state, row.stack.id).length > 1 && <button type="button" onClick={() => { const result = combineInventoryStacks(state, row.stack.id); commitInventory(result.state, "Combine stacks", result.reason); announce(result.reason); }}>Combine</button>}<button className="sell-row-button" type="button" onClick={() => moveStackBySelect(row.stack.id, "sell")}>Sell</button><select defaultValue="" onChange={(event) => { moveStackBySelect(row.stack.id, event.target.value); event.currentTarget.value = ""; }}>{destinationOptions(row.stack)}</select><button className="danger-link" type="button" onClick={() => deleteStack(row.stack)}>Discard</button></div> : <div className="ground-actions"><select defaultValue="" onChange={(event) => { moveContainerBySelect(row.container.id, event.target.value); event.currentTarget.value = ""; }}>{containerDestinationOptions(row.container)}</select><button type="button" onClick={() => setExpandedGroundContainers((current) => { const next = new Set(current); if (next.has(row.container.id)) next.delete(row.container.id); else next.add(row.container.id); return next; })}>{expandedGroundContainers.has(row.container.id) ? "Close" : "Inspect"}</button><button className="danger-link" type="button" onClick={() => { if (!window.confirm(`Discard ${row.container.name} and everything inside it?`)) return; const result = discardInventoryContainer(state, row.container.id); commitInventory(result.state, "Discard container", result.reason); announce(result.reason); }}>Discard</button></div>}</td></tr>)}</tbody></table></div>}
      {groundContainers.filter((container) => expandedGroundContainers.has(container.id)).map((container) => <div className="ground-container-inspector" key={container.id}><ContainerTile container={container} /></div>)}
    </section>}

    <details className="panel inventory-discard-panel">
      <summary>Discard · {activeDiscardEntries.length}</summary>
      <div className="discard-actions"><p>Items, containers, locations, and non-character inventories can be restored.</p><button className="text-button danger-link" type="button" disabled={!activeDiscardEntries.length} onClick={() => { if (window.confirm("Permanently clear this campaign’s discarded inventory?")) commitInventory(clearInventoryDiscard(state, activeCampaignId), "Clear discard", "Campaign discard permanently cleared."); }}>Clear discard</button></div>
      {activeDiscardEntries.length === 0 ? <p className="compact-empty">Nothing discarded.</p> : activeDiscardEntries.map((entry) => <div className="discard-line" key={entry.id}><span><b>{entry.label}</b><small>{entry.kind} · {new Date(entry.discardedAt).toLocaleString()}</small></span><button className="text-button" type="button" onClick={() => { const result = restoreInventoryDiscard(state, entry.id); commitInventory(result.state, "Restore inventory", result.reason); announce(result.reason); }}>Restore</button></div>)}
    </details>
  </section>;
}
