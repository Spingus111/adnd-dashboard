import type { DashboardState } from "./types";

export function baseMarchCapacity(columns: DashboardState["marchColumns"]) {
  return columns === 5 ? 25 : columns === 2 ? 10 : 0;
}

export function visibleMarchCapacity(dashboard: DashboardState) {
  if (dashboard.marchColumns === 1) return dashboard.marchingOrderIds.length;
  const columns = dashboard.marchColumns;
  const lastOccupied = dashboard.marchingOrderSlots.reduce((last, entry, index) => entry ? index : last, -1);
  const occupiedCapacity = lastOccupied < 0 ? 0 : Math.ceil((lastOccupied + 1) / columns) * columns;
  const capacity = Math.max(baseMarchCapacity(columns), occupiedCapacity);
  const full = Array.from({ length: capacity }, (_, index) => dashboard.marchingOrderSlots[index] ?? null).every(Boolean);
  return full ? capacity + columns : capacity;
}
