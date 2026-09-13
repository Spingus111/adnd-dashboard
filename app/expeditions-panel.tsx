"use client";

import type { CampaignState } from "./types";
import { visibleMarchCapacity } from "./marching-order";
import NpcStablePanel from "./npc-stable-panel";

type Props = {
  campaign: CampaignState;
  setCampaign: React.Dispatch<React.SetStateAction<CampaignState>>;
};

export default function ExpeditionsPanel({ campaign, setCampaign }: Props) {
  const expeditionNpcs = campaign.stableNpcs.filter((npc) => npc.campaignId === campaign.activeCharacterCampaignId && campaign.expeditionNpcIds.includes(npc.id));

  function placeNpcInMarch(npcId: string) {
    setCampaign((current) => {
      if (!current.stableNpcs.some((npc) => npc.id === npcId && npc.campaignId === current.activeCharacterCampaignId)) return current;
      const expeditionNpcIds = Array.from(new Set([...current.expeditionNpcIds, npcId]));
      if (current.dashboard.marchColumns === 1) {
        return {
          ...current,
          expeditionNpcIds,
          dashboard: {
            ...current.dashboard,
            marchingOrderIds: Array.from(new Set([...current.dashboard.marchingOrderIds, npcId])),
            scoutingCharacterId: current.dashboard.scoutingCharacterId === npcId ? null : current.dashboard.scoutingCharacterId,
          },
        };
      }
      const columns = current.dashboard.marchColumns;
      let capacity = visibleMarchCapacity(current.dashboard);
      let slots = Array.from({ length: Math.max(25, current.dashboard.marchingOrderSlots.length) }, (_, index) => current.dashboard.marchingOrderSlots[index] ?? null);
      if (slots.length < capacity) slots = [...slots, ...Array.from({ length: capacity - slots.length }, () => null)];
      if (!slots.slice(0, capacity).includes(npcId)) {
        let emptyIndex = slots.slice(0, capacity).indexOf(null);
        if (emptyIndex < 0) {
          emptyIndex = capacity;
          capacity += columns;
          if (slots.length < capacity) slots = [...slots, ...Array.from({ length: capacity - slots.length }, () => null)];
        }
        slots[emptyIndex] = npcId;
      }
      return {
        ...current,
        expeditionNpcIds,
        dashboard: {
          ...current.dashboard,
          marchingOrderSlots: slots,
          marchingOrderIds: slots.filter((entry): entry is string => Boolean(entry)),
          scoutingCharacterId: current.dashboard.scoutingCharacterId === npcId ? null : current.dashboard.scoutingCharacterId,
        },
      };
    });
  }

  return <section className="expeditions-shell">
    <div className="expedition-status-line">
      <span><b>Current expedition</b><small>{expeditionNpcs.length} selected · persistent Stable records remain when removed from an expedition</small></span>
      <div>{expeditionNpcs.length ? expeditionNpcs.map((npc) => <button type="button" onClick={() => placeNpcInMarch(npc.id)} title={`Place ${npc.name} in Marching Order`} key={npc.id}><b>{npc.token}</b><span>{npc.name}</span></button>) : <small>No NPCs selected.</small>}</div>
    </div>
    <NpcStablePanel campaign={campaign} setCampaign={setCampaign} onPlaceNpc={placeNpcInMarch} standalone />
  </section>;
}
