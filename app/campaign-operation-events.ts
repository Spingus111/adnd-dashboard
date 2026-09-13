import type { CampaignOperation } from "./campaign-operations.ts";

export const CAMPAIGN_OPERATION_EVENT = "adnd-campaign-operation";

export function announceCampaignOperations(operations: CampaignOperation[]) {
  if (typeof window !== "undefined" && operations.length) {
    window.dispatchEvent(new CustomEvent<CampaignOperation[]>(CAMPAIGN_OPERATION_EVENT, { detail: operations }));
  }
}
