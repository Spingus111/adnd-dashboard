"use client";

import { useMemo, useState } from "react";
import { siteCatalog } from "./catalog-data";
import { sendChatAction } from "./chat-events";
import { equipmentDefaultForName, equipmentDisplayName } from "./equipment-defaults";
import { appendInventoryActivity, completeInventoryPurchase, formatStoneUnits, inventoryId, inventoryStacksGpValue, normalizeInventoryManagement, syncPhysicalEquipment } from "./inventory-management";
import { ADND_CURRENCY_RULE, copperPiecesToGp, formatGpAsPrice, gpToCopperPieces } from "./currency";
import type { CampaignState, CatalogItem, InventoryShoppingLine, InventoryStack } from "./types";
import ResponsiveDisclosure from "./responsive-disclosure";
import { EquipmentRulesInfoButton, WeaponRulesTooltip } from "./weapon-rules-tooltip";
import { sharedId } from "./shared-id";

type Props = { campaign: CampaignState; setCampaign: React.Dispatch<React.SetStateAction<CampaignState>> };
type StartingLine = { id: string; name: string; quantity: number; priceGp: number };

function id() { return sharedId(); }
function money(value: number, zeroLabel = "0 gp") { return formatGpAsPrice(value, zeroLabel); }
function hasFunds(payment: number, cost: number) { return gpToCopperPieces(payment) >= gpToCopperPieces(cost); }
function cleanName(value: string) { const trimmed = value.trim(); return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : ""; }
function displayItemName(name: string) { return equipmentDisplayName(name); }

function purchaseStack(campaignId: string, line: Pick<InventoryShoppingLine, "catalogId" | "name" | "quantity" | "priceGp">): InventoryStack {
  const catalog = line.catalogId ? siteCatalog.find((item) => item.id === line.catalogId) : undefined;
  const equipment = equipmentDefaultForName(line.name)?.equipment ?? null;
  return {
    id: inventoryId("purchase"), campaignId, catalogItemId: catalog?.id ?? null,
    customIdentity: catalog ? null : `purchase:${line.name.trim().toLowerCase()}:${line.priceGp}:${inventoryId("identity")}`,
    name: line.name, quantity: Math.max(1, Math.trunc(line.quantity)),
    unitEncumbranceUnits: catalog?.encumbranceUnits ?? 100, encumbranceClass: catalog?.encumbranceClass ?? "pocket",
    itemKind: "normal", gpValue: Math.max(0, line.priceGp), containerId: null, locationId: null,
    placement: "counter", handSlot: null, lastHolder: "Shopping counter", notes: catalog?.description ?? "Purchased item",
    equipment: equipment ? { ...equipment } : null, trainingByCharacter: {},
  };
}

export default function PartyPanel({ campaign, setCampaign }: Props) {
  const [category, setCategory] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogQuantities, setCatalogQuantities] = useState<Record<string, number>>({});
  const [visibleCatalogCount, setVisibleCatalogCount] = useState(48);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [shoppingShares, setShoppingShares] = useState(1);
  const [startingGold, setStartingGold] = useState(100);
  const [startingLoadout, setStartingLoadout] = useState<StartingLine[]>([]);
  const [startingUnspent, setStartingUnspent] = useState(0);
  const [notice, setNotice] = useState("");

  const activeCampaignId = campaign.activeCharacterCampaignId;
  const cart = (campaign.inventoryManagement.shoppingCart ?? []).filter((line) => line.campaignId === activeCampaignId);
  const paymentStacks = campaign.inventoryManagement.stacks.filter((stack) => stack.campaignId === activeCampaignId && stack.placement === "payment" && !stack.containerId && !stack.locationId);
  const paymentTotal = inventoryStacksGpValue(paymentStacks);
  const shoppingCatalog = useMemo(() => siteCatalog.filter((item) => item.category !== "Travel Provisions" && (!["Weapons", "Armor & Shields"].includes(item.category) || Boolean(equipmentDefaultForName(item.name)))), []);
  const categories = useMemo(() => Array.from(new Set(shoppingCatalog.map((item) => item.category))).sort(), [shoppingCatalog]);
  const filteredCatalog = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    return shoppingCatalog.filter((item) => (category === "all" || item.category === category) && (!query || `${item.name} ${item.category} ${item.source ?? ""}`.toLowerCase().includes(query)));
  }, [catalogSearch, category, shoppingCatalog]);
  const cartTotal = cart.reduce((sum, item) => sum + item.priceGp * item.quantity, 0);

  function quantityFor(itemId: string) { return Math.max(1, Math.floor(catalogQuantities[itemId] ?? 1)); }

  function updateCart(updater: (current: InventoryShoppingLine[]) => InventoryShoppingLine[]) {
    setCampaign((current) => {
      const inventory = normalizeInventoryManagement(current.inventoryManagement, current.characters, current.activeCharacterCampaignId);
      const active = inventory.shoppingCart.filter((line) => line.campaignId === current.activeCharacterCampaignId);
      const next = updater(active.map((line) => ({ ...line })));
      return { ...current, inventoryManagement: { ...inventory, shoppingCart: [...inventory.shoppingCart.filter((line) => line.campaignId !== current.activeCharacterCampaignId), ...next] } };
    });
  }

  function addLinesToCart(lines: Array<Pick<InventoryShoppingLine, "catalogId" | "name" | "category" | "priceGp" | "quantity">>) {
    if (!lines.length) return setNotice("There is nothing to add to the bill.");
    updateCart((current) => {
      const next = [...current];
      for (const line of lines) {
        const existing = next.find((entry) => entry.catalogId === line.catalogId && entry.name === line.name && entry.priceGp === line.priceGp);
        if (existing) existing.quantity += Math.max(1, Math.trunc(line.quantity));
        else next.push({ ...line, id: id(), campaignId: activeCampaignId, quantity: Math.max(1, Math.trunc(line.quantity)) });
      }
      return next;
    });
    setNotice(`${lines.length === 1 ? lines[0].name : `${lines.length} item lines`} added to the shopping bill.`);
  }

  function addCartLine(item: CatalogItem, quantity = quantityFor(item.id)) {
    addLinesToCart([{ catalogId: item.id, name: item.name, category: item.category, priceGp: item.priceGp, quantity }]);
  }

  function addCustom() {
    const name = cleanName(customName);
    const price = Number(customPrice);
    if (!name || !Number.isFinite(price) || price < 0) return setNotice("Enter a custom item name and valid GP cost.");
    addLinesToCart([{ catalogId: null, name, category: "Custom", priceGp: price, quantity: Math.max(1, Math.floor(customQuantity)) }]);
    setCustomName(""); setCustomPrice(""); setCustomQuantity(1);
  }

  function purchaseLines(lines: Array<Pick<InventoryShoppingLine, "catalogId" | "name" | "quantity" | "priceGp">>, clearCartIds: string[] = []) {
    const total = lines.reduce((sum, line) => sum + Math.max(0, line.priceGp) * Math.max(1, line.quantity), 0);
    if (!lines.length) return setNotice("There is nothing to purchase.");
    if (!hasFunds(paymentTotal, total)) return setNotice(`Purchase blocked: Payment is short by ${money(total - paymentTotal)}.`);
    const purchases = lines.map((line) => purchaseStack(activeCampaignId, line));
    setCampaign((current) => {
      const normalized = normalizeInventoryManagement(current.inventoryManagement, current.characters, current.activeCharacterCampaignId);
      const result = completeInventoryPurchase(normalized, current.activeCharacterCampaignId, purchases, total);
      if (!result.purchased) return current;
      const cleared = new Set(clearCartIds);
      const inventory = { ...result.state, sellVisible: true, shoppingCart: result.state.shoppingCart.filter((line) => !cleared.has(line.id)) };
      return syncPhysicalEquipment({ ...current, inventoryManagement: appendInventoryActivity(inventory, "Shopping purchase", result.reason) });
    });
    const change = Math.max(0, paymentTotal - total);
    setNotice(`Purchase complete. Goods and ${money(change)} in change are waiting in Inventory → Sell → Purchases & change.`);
  }

  function randomStartingEquipment() {
    const budgetCopper = gpToCopperPieces(Number(startingGold) || 0);
    if (!budgetCopper) { setStartingLoadout([]); setStartingUnspent(0); return setNotice("Enter a positive starting-gold amount."); }
    const categoryWeight = (item: CatalogItem) => item.category === "Armor & Shields" ? 0.04 : item.category === "Weapons" ? 0.16 : item.category === "Religious & Arcane" ? 0.08 : item.category === "Vehicles & Vessels" ? 0.015 : 1;
    const mayDuplicate = (item: CatalogItem) => item.category !== "Clothing & Personal" && item.category !== "Armor & Shields" && !(item.category === "Weapons" && item.priceGp > 3);
    const additionalQuantityChance = (priceGp: number) => priceGp <= 0.1 ? 0.78 : priceGp <= 0.5 ? 0.64 : priceGp <= 1 ? 0.5 : priceGp <= 3 ? 0.32 : priceGp <= 10 ? 0.14 : 0.035;
    let remaining = budgetCopper;
    const generated = new Map<string, StartingLine>();
    for (let pass = 0; pass < 80 && remaining > 0; pass += 1) {
      const eligible = shoppingCatalog.filter((item) => gpToCopperPieces(item.priceGp) > 0 && gpToCopperPieces(item.priceGp) <= remaining && !generated.has(item.id));
      if (!eligible.length) break;
      let draw = Math.random() * eligible.reduce((sum, item) => sum + categoryWeight(item), 0);
      let chosen = eligible[eligible.length - 1];
      for (const item of eligible) { draw -= categoryWeight(item); if (draw <= 0) { chosen = item; break; } }
      const priceCopper = gpToCopperPieces(chosen.priceGp);
      let quantity = 1;
      if (mayDuplicate(chosen)) while (quantity < Math.min(10, Math.floor(remaining / priceCopper)) && Math.random() < additionalQuantityChance(chosen.priceGp)) quantity += 1;
      generated.set(chosen.id, { id: chosen.id, name: chosen.name, quantity, priceGp: chosen.priceGp });
      remaining -= priceCopper * quantity;
    }
    setStartingLoadout(Array.from(generated.values()).sort((left, right) => left.name.localeCompare(right.name)));
    setStartingUnspent(copperPiecesToGp(remaining));
    setNotice("Random starting equipment generated. Add it to the bill to purchase it with staged Payment.");
  }

  return <section className="section-stack inventory-management shopping-only">
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="panel shopping-payment-strip"><div><span>Payment staged</span><strong>{money(paymentTotal)}</strong><small>{paymentStacks.length} separate pile{paymentStacks.length === 1 ? "" : "s"} in the Sell tile</small></div><div><span>Current bill</span><strong>{money(cartTotal)}</strong><small className={hasFunds(paymentTotal, cartTotal) ? "funds-ready" : "funds-short"}>{cart.length ? hasFunds(paymentTotal, cartTotal) ? "Enough to purchase" : `${money(cartTotal - paymentTotal)} short` : "No items on the bill"}</small></div></section>

    <section className="panel shopping-panel">
      <div className="panel-heading"><div><h2>Shopping &amp; Master List</h2><p>Paid items and pp/gp/ep/sp/cp change wait in the Sell tile until dragged to a carrier or Ground. {ADND_CURRENCY_RULE}.</p></div><span className="catalog-count">{shoppingCatalog.length} curated items</span><EquipmentRulesInfoButton /></div>
      <div className="catalog-toolbar"><label className="catalog-search">Search items<input type="search" value={catalogSearch} onChange={(event) => { setCatalogSearch(event.target.value); setVisibleCatalogCount(48); }} placeholder="Sword, oil, cart, spellbook…" /></label><span>{filteredCatalog.length} matching</span></div>
      <div className="catalog-category-tabs" aria-label="Master list categories"><button className={category === "all" ? "selected" : ""} onClick={() => { setCategory("all"); setVisibleCatalogCount(48); }}>All</button>{categories.map((entry) => <button className={category === entry ? "selected" : ""} onClick={() => { setCategory(entry); setVisibleCatalogCount(48); }} key={entry}>{entry}</button>)}</div>
      <label className="mobile-catalog-category">Category<select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCatalogCount(48); }}><option value="all">All categories</option>{categories.map((entry) => <option value={entry} key={entry}>{entry}</option>)}</select></label>
      <ResponsiveDisclosure storageKey={`shopping-catalog:${category}`} className="shopping-catalog-disclosure" title={category === "all" ? "All equipment" : category} summary={`${filteredCatalog.length} item${filteredCatalog.length === 1 ? "" : "s"}`} mobileDefaultOpen>
      <div className="catalog-browser"><div className="catalog-row catalog-header" aria-hidden="true"><span>Quantity</span><span>Item</span><span>Cost</span><span>Load</span><span>Category</span><span>Source</span><span>Action</span></div>{filteredCatalog.length === 0 ? <div className="compact-empty">No master-list items match that search.</div> : filteredCatalog.slice(0, visibleCatalogCount).map((item) => {
        const lineTotal = item.priceGp * quantityFor(item.id);
        const load = item.containerCapacityUnits ? `${formatStoneUnits(item.containerCapacityUnits)} capacity` : `${formatStoneUnits(item.encumbranceUnits)} weight`;
        const displayName = displayItemName(item.name);
        return <article className="catalog-row" title="Ctrl-click to post this catalog item to chat" onClick={(event) => { if (event.ctrlKey) sendChatAction({ kind: "item", label: displayName, quantity: quantityFor(item.id), valueGp: item.priceGp }); }} key={item.id}><label>Qty<input aria-label={`${displayName} quantity`} type="number" min="1" value={quantityFor(item.id)} onChange={(event) => setCatalogQuantities((current) => ({ ...current, [item.id]: Math.max(1, Number(event.target.value) || 1) }))} /></label><strong className="catalog-item-name">{item.weaponRulesId ? <WeaponRulesTooltip rulesId={item.weaponRulesId} name={item.name}>{displayName}</WeaponRulesTooltip> : displayName}</strong><b>{money(item.priceGp, "Free")}</b><small className="catalog-load">{load}</small><span className="catalog-category">{item.category}</span><small className="catalog-source">{item.source || "—"}</small><div className="catalog-row-actions"><button onClick={() => addCartLine(item)}>Add to bill</button><button className="secondary-button" disabled={!hasFunds(paymentTotal, lineTotal)} title={!hasFunds(paymentTotal, lineTotal) ? "Not enough staged Payment" : "Buy this item now"} onClick={() => purchaseLines([{ catalogId: item.id, name: item.name, quantity: quantityFor(item.id), priceGp: item.priceGp }])}>Buy now</button></div></article>;
      })}</div>
      {visibleCatalogCount < filteredCatalog.length && <button className="show-more-button secondary-button" onClick={() => setVisibleCatalogCount((current) => current + 48)}>Show 48 more</button>}
      </ResponsiveDisclosure>
      <form className="custom-item-add" onSubmit={(event) => { event.preventDefault(); addCustom(); }}><div><strong>Custom item</strong><small>Custom purchases use a pocket-sized default until edited in Inventory.</small></div><input aria-label="Custom item name" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Item name" /><input aria-label="Custom item price in GP" type="number" min="0" step="0.005" value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} placeholder="Price in GP" /><input aria-label="Custom item quantity" type="number" min="1" value={customQuantity} onChange={(event) => setCustomQuantity(Math.max(1, Number(event.target.value) || 1))} /><button type="submit">Add to bill</button></form>
      <ResponsiveDisclosure storageKey="shopping-cart" className="shopping-cart-disclosure" title="Shopping List" summary={`${cart.length} item${cart.length === 1 ? "" : "s"} · ${money(cartTotal)}`}>
      <div className="shopping-cart"><h3>Shopping bill</h3>{cart.length === 0 ? <div className="compact-empty">The shopping bill is empty.</div> : cart.map((line) => { const displayName = displayItemName(line.name); return <div className="shopping-line" title="Ctrl-click to post this shopping line to chat" onClick={(event) => { if (event.ctrlKey) sendChatAction({ kind: "item", label: displayName, quantity: line.quantity, valueGp: line.priceGp }); }} key={line.id}><span><strong>{displayName}</strong><small>{line.category} · {money(line.priceGp, "Free")} each</small></span><input aria-label={`${displayName} shopping quantity`} type="number" min="1" value={line.quantity} onChange={(event) => updateCart((current) => current.map((entry) => entry.id === line.id ? { ...entry, quantity: Math.max(1, Number(event.target.value) || 1) } : entry))} /><b>{money(line.priceGp * line.quantity, "Free")}</b><button className="text-button danger-link" onClick={() => updateCart((current) => current.filter((entry) => entry.id !== line.id))}>Remove</button></div>; })}</div>
      <div className="shopping-summary"><div><span>Total bill</span><strong>{money(cartTotal)}</strong></div><label>Split between<input type="number" min="0.5" step="0.5" value={shoppingShares} onChange={(event) => setShoppingShares(Math.max(0.5, Number(event.target.value) || 0.5))} /><small>people or shares</small></label><div><span>Cost each</span><strong>{money(cartTotal / Math.max(0.5, shoppingShares))}</strong></div><button className="shopping-checkout-button" disabled={!cart.length || !hasFunds(paymentTotal, cartTotal)} title={cart.length && !hasFunds(paymentTotal, cartTotal) ? "Not enough staged Payment" : "Complete purchase"} onClick={() => purchaseLines(cart, cart.map((line) => line.id))}>Purchase bill</button></div>
      </ResponsiveDisclosure>
    </section>

    <details className="panel starting-equipment-panel"><summary>Random starting equipment</summary><div className="starting-equipment-body"><div className="starting-equipment-controls"><label>Starting gold (gp)<input type="number" min="0" step="0.005" value={startingGold} onChange={(event) => setStartingGold(Math.max(0, Number(event.target.value) || 0))} /></label><button className="primary-button" onClick={randomStartingEquipment}>Generate equipment</button></div>{startingLoadout.length === 0 ? <div className="compact-empty">Enter starting gold and generate a random assortment.</div> : <><div className="starting-equipment-list"><div className="starting-equipment-line header"><span>Qty</span><span>Item</span><span>Cost</span></div>{startingLoadout.map((line) => <div className="starting-equipment-line" key={line.id}><b>{line.quantity}</b><span>{displayItemName(line.name)}</span><span>{money(line.priceGp * line.quantity)}</span></div>)}</div><div className="starting-equipment-total"><span>Generated: <b>{money(startingGold - startingUnspent)}</b></span><span>Unspent: <b>{money(startingUnspent)}</b></span></div><div className="starting-equipment-actions"><button onClick={() => addLinesToCart(startingLoadout.map((line) => { const catalog = siteCatalog.find((item) => item.id === line.id); return { catalogId: line.id, name: line.name, category: catalog?.category ?? "Starting equipment", quantity: line.quantity, priceGp: line.priceGp }; }))}>Add loadout to bill</button></div></>}</div></details>
  </section>;
}
