"use client";

import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { siteCatalog } from "./catalog-data";
import { currencyCodeFromName, formatGpAsPrice } from "./currency";
import { equipmentDefaultForName, equipmentDisplayName } from "./equipment-defaults";
import {
  appendInventoryActivity,
  formatStoneUnits,
  getContainerCapacityUnits,
  getContainerDescendantIds,
  getContainerPathToRoot,
  getContainerRootHolder,
  getContainerUsedUnits,
  inventoryCoinStacksForOwner,
  inventoryId,
  inventoryStackDisplayName,
  inventoryStacksForOwner,
  inventoryStacksGpValue,
  handLoadoutIssue,
  moveContainer,
  moveStack,
  moveStackToHand,
  moveStackToWorn,
  placeStackInNonQuickInventory,
  refundInventoryCoins,
  spendInventoryCoinsSmallestFirst,
  stackRequiresBothHands,
  syncPhysicalEquipment,
} from "./inventory-management";
import { weaponHandednessHint } from "./weapon-rules";
import type { CampaignState, CatalogItem, Character, InventoryContainer, InventoryManagementState, InventoryStack } from "./types";

type Props = {
  campaign: CampaignState;
  setCampaign: Dispatch<SetStateAction<CampaignState>>;
  character: Character;
  canEdit: boolean;
};

const CHARACTER_INVENTORY_DRAG_TYPE = "application/x-adnd-character-inventory";

function itemEmoji(stack: InventoryStack) {
  if (stack.equipment?.kind === "shield") return "🛡️";
  if (stack.equipment?.kind === "armor") return "👖";
  if (stack.equipment?.kind === "weapon") return stack.equipment.weaponType === "ranged" ? "🏹" : "🗡️";
  return currencyCodeFromName(stack.name) ? "🪙" : stack.itemKind === "treasure" ? "💎" : "•";
}

function catalogStack(item: CatalogItem, campaignId: string, quantity: number): InventoryStack {
  const equipmentDefault = equipmentDefaultForName(item.name);
  return {
    id: inventoryId("sheet-purchase"),
    campaignId,
    catalogItemId: item.id,
    customIdentity: null,
    name: item.name,
    quantity,
    unitEncumbranceUnits: item.encumbranceUnits,
    encumbranceClass: item.encumbranceClass,
    itemKind: "normal",
    gpValue: item.priceGp,
    containerId: null,
    locationId: null,
    placement: "ground",
    handSlot: null,
    lastHolder: "Character sheet purchase",
    notes: item.description ?? "",
    equipment: equipmentDefault ? { ...equipmentDefault.equipment, weaponRulesId: item.weaponRulesId ?? equipmentDefault.equipment.weaponRulesId } : null,
    trainingByCharacter: {},
  };
}

function campaignGroundStack(state: InventoryManagementState, stack: InventoryStack, campaignId: string) {
  if (stack.campaignId !== campaignId) return false;
  if (!stack.containerId) return !stack.locationId && stack.placement === "ground";
  return getContainerRootHolder(state, stack.containerId)?.type === "ground";
}

function containerPathLabel(state: InventoryManagementState, containerId: string | null | undefined) {
  if (!containerId) return "Ground";
  return getContainerPathToRoot(state, containerId).reverse().map((container) => container.name).join(" › ") || "Container";
}

export default function CharacterInventoryPanel({ campaign, setCampaign, character, canEdit }: Props) {
  const [shopSearch, setShopSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<Set<string>>(() => new Set());
  const [partialMove, setPartialMove] = useState<{ stackId: string; quantity: number } | null>(null);
  const state = campaign.inventoryManagement;
  const owner = state.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
  const carriedContainers = owner ? state.containers.filter((container) => getContainerRootHolder(state, container.id)?.type === "owner" && getContainerRootHolder(state, container.id)?.id === owner.id) : [];
  const carriedRootContainers = owner ? carriedContainers.filter((container) => container.holderType === "owner" && container.holderId === owner.id) : [];
  const carriedStacks = owner ? inventoryStacksForOwner(state, owner.id) : [];
  const mainHand = carriedStacks.find((stack) => stack.handSlot === "main");
  const offhand = carriedStacks.find((stack) => stack.handSlot === "offhand");
  const handsIssue = handLoadoutIssue(mainHand, offhand, character);
  const coinStacks = owner ? inventoryCoinStacksForOwner(state, owner.id) : [];
  const moneyGp = inventoryStacksGpValue(coinStacks);
  const lastPurchase = owner ? state.characterShopPurchaseUndoByOwnerId?.[owner.id] : undefined;
  const lastPurchaseStacks = lastPurchase ? state.stacks.filter((stack) => stack.characterShopPurchaseUndoId === lastPurchase.id) : [];
  const lastPurchaseContainers = lastPurchase ? state.containers.filter((container) => container.characterShopPurchaseUndoId === lastPurchase.id) : [];
  const canUndoLastPurchase = Boolean(lastPurchase && (
    lastPurchase.kind === "stack"
      ? lastPurchaseStacks.reduce((sum, stack) => sum + stack.quantity, 0) === lastPurchase.quantity
      : lastPurchaseContainers.length === lastPurchase.quantity
        && !state.stacks.some((stack) => stack.containerId && lastPurchaseContainers.some((container) => container.id === stack.containerId))
        && !state.containers.some((container) => container.holderType === "container" && lastPurchaseContainers.some((purchased) => purchased.id === container.holderId) && container.characterShopPurchaseUndoId !== lastPurchase.id)
  ));
  const groundContainers = state.containers.filter((container) => container.campaignId === character.campaignId && getContainerRootHolder(state, container.id)?.type === "ground");
  const groundRootContainers = groundContainers.filter((container) => container.holderType === "ground");
  const groundStacks = state.stacks.filter((stack) => campaignGroundStack(state, stack, character.campaignId));
  const looseGroundStacks = groundStacks.filter((stack) => !stack.containerId);
  const selectedItem = siteCatalog.find((item) => item.id === selectedCatalogId);
  const priceGp = (selectedItem?.priceGp ?? 0) * quantity;
  const shopItems = useMemo(() => {
    const query = shopSearch.trim().toLowerCase();
    return siteCatalog
      .filter((item) => item.category !== "Animals & Mounts")
      .filter((item) => !query || `${item.name} ${item.category}`.toLowerCase().includes(query))
      .slice(0, 80);
  }, [shopSearch]);

  useEffect(() => {
    if (shopItems.length === 1 && selectedCatalogId !== shopItems[0].id) {
      setSelectedCatalogId(shopItems[0].id);
      return;
    }
    if (selectedCatalogId && !shopItems.some((item) => item.id === selectedCatalogId)) setSelectedCatalogId("");
  }, [selectedCatalogId, shopItems]);

  function moveItem(stackId: string, destination: string, requestedQuantity?: number) {
    if (!canEdit || !owner || !destination) return;
    if (requestedQuantity && requestedQuantity > 1 && (destination.startsWith("hand:") || destination === "worn")) return setNotice("Hands and Worn can receive only 1 item from a stack.");
    setCampaign((currentCampaign) => {
      const currentOwner = currentCampaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
      if (!currentOwner) return currentCampaign;
      let result;
      if (destination === "hand:main" || destination === "hand:offhand") result = moveStackToHand(currentCampaign.inventoryManagement, stackId, currentOwner.id, destination.endsWith("main") ? "main" : "offhand", currentCampaign.characters);
      else if (destination === "worn") result = moveStackToWorn(currentCampaign.inventoryManagement, stackId, currentOwner.id);
      else if (destination === "ground") result = moveStack(currentCampaign.inventoryManagement, stackId, { type: "ground" }, currentCampaign.characters, requestedQuantity, true);
      else result = moveStack(currentCampaign.inventoryManagement, stackId, { type: "container", id: destination.replace("container:", "") }, currentCampaign.characters, requestedQuantity, true);
      queueMicrotask(() => setNotice(result.reason));
      if (!result.moved) return currentCampaign;
      return syncPhysicalEquipment({ ...currentCampaign, inventoryManagement: appendInventoryActivity(result.state, "Character sheet inventory move", `${character.name}: ${result.reason}`) });
    });
  }

  function moveBag(container: InventoryContainer, destination: string) {
    if (!canEdit || !owner || !destination || container.intrinsic) return;
    setCampaign((currentCampaign) => {
      const currentOwner = currentCampaign.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
      if (!currentOwner) return currentCampaign;
      const target = destination === "ground"
        ? { type: "ground" as const }
        : destination === "owner"
          ? { type: "owner" as const, id: currentOwner.id }
          : { type: "container" as const, id: destination.replace("container:", "") };
      const result = moveContainer(currentCampaign.inventoryManagement, container.id, target, currentCampaign.characters);
      queueMicrotask(() => setNotice(result.reason));
      if (!result.moved) return currentCampaign;
      return syncPhysicalEquipment({ ...currentCampaign, inventoryManagement: appendInventoryActivity(result.state, "Character sheet container move", `${character.name}: ${result.reason}`) });
    });
  }

  function startItemDrag(event: DragEvent<HTMLElement>, stackId: string) {
    if (!canEdit) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(CHARACTER_INVENTORY_DRAG_TYPE, stackId);
    event.dataTransfer.setData("text/plain", stackId);
  }

  function draggedStackId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData(CHARACTER_INVENTORY_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
  }

  function dropItem(event: DragEvent<HTMLElement>, destination: string) {
    if (!canEdit) return;
    const stackId = draggedStackId(event);
    if (!stackId) return;
    event.preventDefault();
    event.stopPropagation();
    moveItem(stackId, destination);
  }

  function toggleContainer(containerId: string) {
    setCollapsedContainerIds((current) => {
      const next = new Set(current);
      if (next.has(containerId)) next.delete(containerId);
      else next.add(containerId);
      return next;
    });
  }

  function buy() {
    if (!canEdit || !owner || !selectedItem || quantity < 1) return;
    let finalNotice = "";
    setCampaign((current) => {
      const currentOwner = current.inventoryManagement.owners.find((entry) => entry.type === "character" && entry.characterId === character.id);
      const item = siteCatalog.find((entry) => entry.id === selectedItem.id);
      if (!currentOwner || !item) return current;
      const currentCost = item.priceGp * quantity;
      const payment = spendInventoryCoinsSmallestFirst(current.inventoryManagement, currentOwner.id, currentCost, current.characters);
      if (!payment.paid) {
        finalNotice = payment.reason;
        queueMicrotask(() => setNotice(finalNotice));
        return current;
      }
      let inventory = payment.state;
      const purchaseId = inventoryId("sheet-undo");
      let groundOverflow = 0;
      if (item.containerCapacityUnits && item.category === "Containers & Carrying") {
        for (let index = 0; index < quantity; index += 1) {
          const container: InventoryContainer = {
            id: inventoryId("sheet-container"), campaignId: character.campaignId, name: item.name,
            capacityUnits: item.containerCapacityUnits, tareWeightUnits: item.encumbranceUnits,
            holderType: "ground", holderId: character.campaignId, containerType: "container",
            intrinsic: false, movable: true, lastHolder: "Character sheet purchase", characterShopPurchaseUndoId: purchaseId,
          };
          inventory = { ...inventory, containers: [...inventory.containers, container] };
          const destinations = inventory.containers
            .filter((entry) => entry.id !== container.id && entry.containerType !== "quick-access" && entry.containerType !== "worn" && getContainerRootHolder(inventory, entry.id)?.type === "owner" && getContainerRootHolder(inventory, entry.id)?.id === currentOwner.id)
            .sort((left, right) => Number(right.containerType === "character-backpack") - Number(left.containerType === "character-backpack"));
          let stored = false;
          for (const destination of destinations) {
            const moved = moveContainer(inventory, container.id, { type: "container", id: destination.id }, current.characters);
            if (moved.moved) { inventory = moved.state; stored = true; break; }
          }
          if (!stored) groundOverflow += 1;
        }
      } else {
        const stack = { ...catalogStack(item, character.campaignId, quantity), characterShopPurchaseUndoId: purchaseId };
        inventory = { ...inventory, stacks: [...inventory.stacks, stack] };
        const placed = placeStackInNonQuickInventory(inventory, stack.id, currentOwner.id, current.characters);
        inventory = placed.state;
        groundOverflow += placed.remaining;
      }
      finalNotice = `${quantity} × ${item.name} purchased${payment.changeGp ? ` · ${formatGpAsPrice(payment.changeGp)} change` : ""}${groundOverflow ? ` · ${groundOverflow} overflow to Ground` : ""}.`;
      queueMicrotask(() => setNotice(finalNotice));
      inventory = {
        ...inventory,
        characterShopPurchaseUndoByOwnerId: {
          ...(inventory.characterShopPurchaseUndoByOwnerId ?? {}),
          [currentOwner.id]: { id: purchaseId, characterId: character.id, campaignId: character.campaignId, itemName: item.name, quantity, costGp: currentCost, kind: item.containerCapacityUnits && item.category === "Containers & Carrying" ? "container" : "stack" },
        },
      };
      return syncPhysicalEquipment({ ...current, inventoryManagement: appendInventoryActivity(inventory, "Character sheet purchase", `${character.name}: ${finalNotice}`) });
    });
  }

  function undoLastPurchase() {
    if (!canEdit || !owner || !lastPurchase || !canUndoLastPurchase) return;
    setCampaign((current) => {
      const currentOwner = current.inventoryManagement.owners.find((entry) => entry.id === owner.id);
      const purchase = current.inventoryManagement.characterShopPurchaseUndoByOwnerId?.[owner.id];
      if (!currentOwner || !purchase) return current;
      const stacks = current.inventoryManagement.stacks.filter((stack) => stack.characterShopPurchaseUndoId === purchase.id);
      const containers = current.inventoryManagement.containers.filter((container) => container.characterShopPurchaseUndoId === purchase.id);
      const intact = purchase.kind === "stack"
        ? stacks.reduce((sum, stack) => sum + stack.quantity, 0) === purchase.quantity
        : containers.length === purchase.quantity
          && !current.inventoryManagement.stacks.some((stack) => stack.containerId && containers.some((container) => container.id === stack.containerId))
          && !current.inventoryManagement.containers.some((container) => container.holderType === "container" && containers.some((purchased) => purchased.id === container.holderId) && container.characterShopPurchaseUndoId !== purchase.id);
      if (!intact) {
        queueMicrotask(() => setNotice("Undo is unavailable because that purchase has been changed or a purchased container has contents."));
        return current;
      }
      const undoId = purchase.id;
      const cleared = {
        ...current.inventoryManagement,
        stacks: current.inventoryManagement.stacks.filter((stack) => stack.characterShopPurchaseUndoId !== undoId),
        containers: current.inventoryManagement.containers.filter((container) => container.characterShopPurchaseUndoId !== undoId),
        characterShopPurchaseUndoByOwnerId: Object.fromEntries(Object.entries(current.inventoryManagement.characterShopPurchaseUndoByOwnerId ?? {}).filter(([ownerId]) => ownerId !== currentOwner.id)),
      };
      const refunded = refundInventoryCoins(cleared, currentOwner.id, purchase.costGp, current.characters);
      const finalNotice = refunded.refunded ? `${purchase.quantity} × ${purchase.itemName} removed · ${formatGpAsPrice(purchase.costGp)} refunded.` : `Purchase removed, but ${refunded.reason}`;
      queueMicrotask(() => setNotice(finalNotice));
      return syncPhysicalEquipment({ ...current, inventoryManagement: appendInventoryActivity(refunded.state, "Character sheet purchase undone", `${character.name}: ${finalNotice}`) });
    });
  }

  function requestPartialMove(stack: InventoryStack) {
    const raw = window.prompt(`Move how many ${stack.name}?`, String(Math.max(1, Math.floor(stack.quantity / 2))));
    if (raw === null) return;
    const requestedQuantity = Math.trunc(Number(raw));
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1 || requestedQuantity >= stack.quantity) return setNotice(`Enter a whole number from 1 to ${stack.quantity - 1}.`);
    setPartialMove({ stackId: stack.id, quantity: requestedQuantity });
    setNotice(`Choose where to move ${requestedQuantity} × ${stack.name}.`);
  }

  function handleMoveSelect(stack: InventoryStack, destination: string) {
    if (destination === "move-some") return requestPartialMove(stack);
    if (!destination) return;
    const requestedQuantity = partialMove?.stackId === stack.id ? partialMove.quantity : undefined;
    setPartialMove(null);
    moveItem(stack.id, destination, requestedQuantity);
  }

  function stackDestinations(stack: InventoryStack) {
    const pendingQuantity = partialMove?.stackId === stack.id ? partialMove.quantity : null;
    return <>
      <option value="">{pendingQuantity ? `Move ${pendingQuantity} to…` : "Move to…"}</option>
      {stack.quantity > 1 && !pendingQuantity && <option value="move-some">Move some…</option>}
      <option value="ground">Ground</option>
      {carriedContainers.map((container) => <option value={`container:${container.id}`} key={container.id}>{container.name}</option>)}
      <option value="hand:main" disabled={Boolean(pendingQuantity && pendingQuantity > 1)}>Hand 1</option>
      <option value="hand:offhand" disabled={Boolean(pendingQuantity && pendingQuantity > 1)}>Hand 2</option>
      {stack.equipment?.kind === "armor" && <option value="worn" disabled={Boolean(pendingQuantity && pendingQuantity > 1)}>Worn</option>}
    </>;
  }

  function ItemRow({ stack }: { stack: InventoryStack }) {
    const handsHint = stack.equipment?.kind === "weapon" ? weaponHandednessHint({ name: stack.name, weaponRulesId: stack.equipment.weaponRulesId, twoHanded: stack.equipment.twoHanded }, character) : "";
    return <div className="character-inventory-row" draggable={canEdit} onDragStart={(event) => startItemDrag(event, stack.id)} key={stack.id}>
      <span className="character-item-grip" aria-hidden title="Drag item">⠿</span>
      <span className="character-inventory-item"><i aria-hidden>{itemEmoji(stack)}</i><span><b>{inventoryStackDisplayName(stack)}<small className="character-inventory-item-weight">{formatStoneUnits(stack.unitEncumbranceUnits)}</small></b><small><span className="character-container-path">{containerPathLabel(state, stack.containerId)}</span>{stack.handSlot ? ` · Hand ${stack.handSlot === "main" ? "1" : "2"}` : ""}{handsHint ? <><br /><span className="weapon-hands-hint">{handsHint}</span></> : null}</small></span></span>
      <span className="character-inventory-quantity">×{stack.quantity}</span>
      <select aria-label={`Move ${stack.name}`} disabled={!canEdit} value="" onChange={(event) => handleMoveSelect(stack, event.target.value)}>{stackDestinations(stack)}</select>
    </div>;
  }

  function HandSlot({ slot }: { slot: "main" | "offhand" }) {
    const held = carriedStacks.find((stack) => stack.handSlot === slot);
    const other = carriedStacks.find((stack) => stack.handSlot === (slot === "main" ? "offhand" : "main"));
    const reserved = !held && Boolean(other && stackRequiresBothHands(other, character));
    return <section className={`character-hand-slot ${reserved ? "reserved" : ""} ${handsIssue ? "invalid" : ""}`}
      onDragOver={(event) => { if (canEdit && !reserved) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
      onDrop={(event) => { if (!reserved) dropItem(event, `hand:${slot}`); }}>
      <header><b>✋ Hand {slot === "main" ? "1" : "2"}</b><small>{reserved ? `Reserved by ${other?.name}` : held ? "Equipped" : "Empty"}</small></header>
      {held ? <ItemRow stack={held} /> : <p>{reserved ? "Two-handed item" : "Drop an item here"}</p>}
    </section>;
  }

  function ContainerTree({ container, depth = 0 }: { container: InventoryContainer; depth?: number }) {
    const childContainers = state.containers.filter((entry) => entry.holderType === "container" && entry.holderId === container.id);
    const directStacks = state.stacks.filter((stack) => stack.containerId === container.id && !stack.handSlot);
    const collapsed = collapsedContainerIds.has(container.id);
    const blocked = getContainerDescendantIds(state, container.id);
    const used = getContainerUsedUnits(state, container.id);
    const capacity = getContainerCapacityUnits(container, campaign.characters);
    const showCapacity = container.containerType !== "worn" && capacity > 0;
    const capacityRatio = used / Math.max(1, capacity);
    const loadPercent = Math.min(100, capacityRatio * 100);
    const capacityTone = used > capacity ? "over" : capacityRatio >= 1 ? "full" : capacityRatio >= 0.75 ? "warning" : "comfortable";
    return <section
      className={`character-container-tree ${container.containerType} ${collapsed ? "collapsed" : ""}`}
      style={{ "--character-container-depth": depth } as CSSProperties}
      onDragOver={(event) => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
      onDrop={(event) => dropItem(event, `container:${container.id}`)}
    >
      <header>
        <button type="button" className="character-container-toggle" aria-expanded={!collapsed} onClick={() => toggleContainer(container.id)}>
          <span aria-hidden>{collapsed ? "▸" : "▾"}</span>
          <span><b>{container.containerType === "quick-access" ? "⚡" : container.containerType === "worn" ? "👕" : "📦"} {container.name}</b><small>{container.containerType === "worn" ? "Worn equipment" : `${formatStoneUnits(used)} / ${formatStoneUnits(capacity)}`} · {directStacks.length + childContainers.length} direct</small></span>
        </button>
        {!container.intrinsic && <select aria-label={`Move ${container.name}`} disabled={!canEdit} defaultValue="" onChange={(event) => { moveBag(container, event.target.value); event.currentTarget.value = ""; }}><option value="">Move container…</option><option value="ground">Ground</option><option value="owner">Carry separately</option>{carriedContainers.filter((entry) => entry.id !== container.id && !blocked.has(entry.id) && entry.containerType !== "worn" && entry.containerType !== "quick-access").map((entry) => <option value={`container:${entry.id}`} key={entry.id}>Inside {entry.name}</option>)}</select>}
      </header>
      {showCapacity && <div className="character-container-capacity"><div className={`inventory-meter ${capacityTone}`} role="progressbar" aria-label={`${container.name} weight limit`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={Math.min(used, capacity)}><span style={{ width: `${loadPercent}%` }} /></div><small>{used > capacity ? `${formatStoneUnits(used - capacity)} over limit` : `${Math.round(loadPercent)}% full`}</small></div>}
      {!collapsed && <div className="character-container-contents">
        {directStacks.map((stack) => <ItemRow stack={stack} key={stack.id} />)}
        {childContainers.map((child) => <ContainerTree container={child} depth={depth + 1} key={child.id} />)}
        {!directStacks.length && !childContainers.length && <p className="character-container-drop-hint">Drop items here</p>}
      </div>}
    </section>;
  }

  return <details className="character-inventory-panel">
    <summary><span>Inventory, equipment &amp; shopping</span><b>{formatGpAsPrice(moneyGp)} · {carriedStacks.length} item pile{carriedStacks.length === 1 ? "" : "s"}</b></summary>
    <div className="character-inventory-body">
      {!canEdit && <p className="notice">View only. Only {character.name}&apos;s player or the GM can change this inventory.</p>}

      <section className="character-inventory-section">
        <div className="osric-subheading"><b>Carried inventory</b><span>Drag items between containers · use Move on touch</span></div>
        {handsIssue && <p className="hand-loadout-warning" role="alert">⚠ {handsIssue} Weapon attacks and shield protection are inactive until resolved.</p>}
        <div className="character-hand-slots"><HandSlot slot="main" /><HandSlot slot="offhand" /></div>
        <div className="character-container-forest">
          {carriedRootContainers.map((container) => <ContainerTree container={container} key={container.id} />)}
          {!carriedRootContainers.length && <p className="compact-empty">No carried containers.</p>}
        </div>
      </section>

      <details className="character-mini-shop">
        <summary><span>Mini shopping</span><small>Catalog equipment and containers only</small></summary>
        <div className="character-mini-shop-body">
          <div className="character-shop-controls">
            <label>Find item<input value={shopSearch} onChange={(event) => setShopSearch(event.target.value)} placeholder="rope, shield, sack…" /></label>
            <label>Catalog<select value={selectedCatalogId} onChange={(event) => setSelectedCatalogId(event.target.value)}><option value="">Choose item</option>{shopItems.map((item) => <option value={item.id} key={item.id}>{equipmentDisplayName(item.name)} · {item.category} · {formatGpAsPrice(item.priceGp)}</option>)}</select></label>
            <label>Qty<input type="number" min="1" max="999" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(999, Math.trunc(Number(event.target.value) || 1))))} /></label>
            <button type="button" className="primary-button" disabled={!canEdit || !selectedItem || moneyGp < priceGp} onClick={buy}>Buy · {formatGpAsPrice(priceGp)}</button>
          </div>
          {lastPurchase && <div className="character-shop-undo">
            <span>Last buy: {lastPurchase.quantity} × {equipmentDisplayName(lastPurchase.itemName)}</span>
            <button type="button" className="character-shop-undo-button" disabled={!canEdit || !canUndoLastPurchase} onClick={undoLastPurchase} title={canUndoLastPurchase ? "Remove this purchase and refund its full cost." : "Undo is available after the purchased item is restored, or purchased containers are emptied."}>Undo · {formatGpAsPrice(lastPurchase.costGp)}</button>
          </div>}
          {selectedItem && <p className="character-shop-selection"><b>{equipmentDisplayName(selectedItem.name)}</b> · {selectedItem.category}{selectedItem.containerCapacityUnits ? ` · holds ${formatStoneUnits(selectedItem.containerCapacityUnits)}` : ""} · purchases go to non-Quick Access inventory, then Ground if full.</p>}
        </div>
      </details>

      <section className="character-ground-list">
        <div className="osric-subheading"><b>Ground</b><span>{groundStacks.length} item piles · {groundContainers.length} containers</span></div>
        <div className="character-ground-dropzone" onDragOver={(event) => { if (canEdit) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => dropItem(event, "ground")}>
          {groundRootContainers.map((container) => <ContainerTree container={container} key={container.id} />)}
          {looseGroundStacks.map((stack) => <ItemRow stack={stack} key={stack.id} />)}
          {!groundRootContainers.length && !looseGroundStacks.length && <p className="character-container-drop-hint">Drop items on Ground</p>}
        </div>
      </section>
      {notice && <p className="character-inventory-notice" role="status">{notice}</p>}
    </div>
  </details>;
}
