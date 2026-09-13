type JsonRecord = Record<string, unknown>;

export type CampaignPathSegment = string | number | { id: string };

export type CampaignOperation =
  | { type: "set"; path: CampaignPathSegment[]; value: unknown }
  | { type: "delete"; path: CampaignPathSegment[] }
  | { type: "increment"; path: CampaignPathSegment[]; amount: number; minimum?: number; maximum?: number }
  | { type: "reorder"; path: CampaignPathSegment[]; ids: string[] }
  | { type: "add-value"; path: CampaignPathSegment[]; value: string }
  | { type: "remove-value"; path: CampaignPathSegment[]; value: string };

function same(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try { return JSON.stringify(left) === JSON.stringify(right); } catch { return false; }
}

function record(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function keyedArray(value: unknown[]): value is Array<JsonRecord & { id: string }> {
  const ids = new Set<string>();
  return value.every((entry) => {
    if (!record(entry) || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) return false;
    ids.add(entry.id);
    return true;
  });
}

function uniqueStringArray(value: unknown[]): value is string[] {
  return value.every((entry) => typeof entry === "string") && new Set(value).size === value.length;
}

/** Converts a local edit into narrow operations addressed by stable entity id. */
export function diffCampaignOperations(base: unknown, next: unknown, path: CampaignPathSegment[] = []): CampaignOperation[] {
  if (same(base, next)) return [];
  if (Array.isArray(base) && Array.isArray(next)) {
    if (keyedArray(base) && keyedArray(next)) {
      const beforeById = new Map(base.map((entry) => [entry.id, entry]));
      const afterById = new Map(next.map((entry) => [entry.id, entry]));
      const operations: CampaignOperation[] = [];
      for (const entry of base) if (!afterById.has(entry.id)) operations.push({ type: "delete", path: [...path, { id: entry.id }] });
      for (const entry of next) {
        const prior = beforeById.get(entry.id);
        operations.push(...(prior
          ? diffCampaignOperations(prior, entry, [...path, { id: entry.id }])
          : [{ type: "set" as const, path: [...path, { id: entry.id }], value: entry }]));
      }
      const beforeOrder = base.map((entry) => entry.id);
      const afterOrder = next.map((entry) => entry.id);
      if (!same(beforeOrder, afterOrder)) operations.push({ type: "reorder", path, ids: afterOrder });
      return operations;
    }
    if (uniqueStringArray(base) && uniqueStringArray(next)) {
      const before = new Set(base);
      const after = new Set(next);
      return [
        ...base.filter((value) => !after.has(value)).map((value): CampaignOperation => ({ type: "remove-value", path, value })),
        ...next.filter((value) => !before.has(value)).map((value): CampaignOperation => ({ type: "add-value", path, value })),
      ];
    }
    if (base.length === next.length) return next.flatMap((entry, index) => diffCampaignOperations(base[index], entry, [...path, index]));
    return [{ type: "set", path, value: next }];
  }
  if (record(base) && record(next)) {
    const operations: CampaignOperation[] = [];
    const keys = new Set([...Object.keys(base), ...Object.keys(next)]);
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(next, key)) operations.push({ type: "delete", path: [...path, key] });
      else if (!Object.prototype.hasOwnProperty.call(base, key)) operations.push({ type: "set", path: [...path, key], value: next[key] });
      else operations.push(...diffCampaignOperations(base[key], next[key], [...path, key]));
    }
    return operations;
  }
  return [{ type: "set", path, value: next }];
}

function containerFor(nextSegment: CampaignPathSegment | undefined) {
  return typeof nextSegment === "number" || (nextSegment && typeof nextSegment === "object") ? [] : {};
}

function mutateAt(current: unknown, path: CampaignPathSegment[], mutate: (value: unknown) => unknown, depth = 0): unknown {
  if (depth === path.length) return mutate(current);
  const segment = path[depth];
  const nextSegment = path[depth + 1];
  if (typeof segment === "object") {
    const list = Array.isArray(current) ? current : [];
    const index = list.findIndex((entry) => record(entry) && entry.id === segment.id);
    if (depth === path.length - 1) {
      const changed = mutate(index >= 0 ? list[index] : undefined);
      if (changed === undefined) return index < 0 ? list : [...list.slice(0, index), ...list.slice(index + 1)];
      if (index < 0) return [...list, changed];
      if (Object.is(changed, list[index])) return list;
      const copy = [...list]; copy[index] = changed; return copy;
    }
    if (index < 0) return list;
    const changed = mutateAt(list[index], path, mutate, depth + 1);
    if (Object.is(changed, list[index])) return list;
    const copy = [...list]; copy[index] = changed; return copy;
  }
  const parent = Array.isArray(current) ? current : record(current) ? current : containerFor(segment);
  const child = (parent as JsonRecord)[segment as string];
  const changed = mutateAt(child ?? containerFor(nextSegment), path, mutate, depth + 1);
  if (Object.is(changed, child)) return parent;
  if (Array.isArray(parent)) {
    const copy = [...parent];
    if (changed === undefined) copy.splice(segment as number, 1); else copy[segment as number] = changed;
    return copy;
  }
  const copy = { ...parent } as JsonRecord;
  if (changed === undefined) delete copy[segment as string]; else copy[segment as string] = changed;
  return copy;
}

export function applyCampaignOperation<T>(state: T, operation: CampaignOperation): T {
  if (operation.type === "set") return mutateAt(state, operation.path, () => operation.value) as T;
  if (operation.type === "delete") return mutateAt(state, operation.path, () => undefined) as T;
  if (operation.type === "increment") return mutateAt(state, operation.path, (value) => {
    const requested = (Number(value) || 0) + operation.amount;
    return Math.min(operation.maximum ?? Number.POSITIVE_INFINITY, Math.max(operation.minimum ?? Number.NEGATIVE_INFINITY, requested));
  }) as T;
  if (operation.type === "add-value") return mutateAt(state, operation.path, (value) => {
    const list = Array.isArray(value) ? value : [];
    return list.includes(operation.value) ? list : [...list, operation.value];
  }) as T;
  if (operation.type === "remove-value") return mutateAt(state, operation.path, (value) => Array.isArray(value) ? value.filter((entry) => entry !== operation.value) : value) as T;
  return mutateAt(state, operation.path, (value) => {
    if (!Array.isArray(value)) return value;
    const byId = new Map(value.filter(record).filter((entry) => typeof entry.id === "string").map((entry) => [entry.id as string, entry]));
    const ordered = operation.ids.flatMap((id) => byId.has(id) ? [byId.get(id)] : []);
    const included = new Set(operation.ids);
    return [...ordered, ...value.filter((entry) => !record(entry) || typeof entry.id !== "string" || !included.has(entry.id))];
  }) as T;
}

export function applyCampaignOperations<T>(state: T, operations: CampaignOperation[]): T {
  return operations.reduce((current, operation) => applyCampaignOperation(current, operation), state);
}

export function campaignOperationPathKey(path: CampaignPathSegment[]) {
  return path.map((segment) => typeof segment === "object" ? `id:${segment.id}` : `${typeof segment}:${segment}`).join("/");
}

function valueAtPath(state: unknown, path: CampaignPathSegment[]) {
  return path.reduce<unknown>((current, segment) => {
    if (typeof segment === "object") return Array.isArray(current) ? current.find((entry) => record(entry) && entry.id === segment.id) : undefined;
    if (Array.isArray(current) || record(current)) return (current as JsonRecord)[segment as string];
    return undefined;
  }, state);
}

/** Quantities represent shared resources; persist their local delta atomically. */
export function promoteAtomicCampaignOperations(operations: CampaignOperation[], base: unknown) {
  return operations.map((operation): CampaignOperation => {
    const [root, collection, entity, field] = operation.path;
    const inventoryQuantity = operation.type === "set"
      && root === "inventoryManagement"
      && collection === "stacks"
      && typeof entity === "object"
      && field === "quantity"
      && typeof operation.value === "number";
    if (!inventoryQuantity) return operation;
    const prior = valueAtPath(base, operation.path);
    if (typeof prior !== "number") return operation;
    return { type: "increment", path: operation.path, amount: operation.value - prior, minimum: 0 };
  });
}

export function replaceGeneratedOperations(generated: CampaignOperation[], explicit: CampaignOperation[]) {
  const explicitPaths = explicit.map((operation) => campaignOperationPathKey(operation.path));
  return [...generated.filter((operation) => {
    const generatedPath = campaignOperationPathKey(operation.path);
    return !explicitPaths.some((explicitPath) => explicitPath === generatedPath
      || explicitPath.startsWith(`${generatedPath}/`)
      || generatedPath.startsWith(`${explicitPath}/`));
  }), ...explicit];
}
