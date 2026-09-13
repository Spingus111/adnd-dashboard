type JsonRecord = Record<string, unknown>;

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

function mergeStringSet(base: string[], local: string[], remote: string[]) {
  const baseSet = new Set(base);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const localOrderChanged = !same(base, local);
  const candidates = [...(localOrderChanged ? local : remote), ...remote, ...local, ...base]
    .filter((id, index, all) => all.indexOf(id) === index);
  return candidates.filter((id) => {
    const inBase = baseSet.has(id);
    const inLocal = localSet.has(id);
    const inRemote = remoteSet.has(id);
    if (inLocal === inBase) return inRemote;
    if (inRemote === inBase) return inLocal;
    return inLocal;
  });
}

function mergeKeyedArray(base: Array<JsonRecord & { id: string }>, local: Array<JsonRecord & { id: string }>, remote: Array<JsonRecord & { id: string }>) {
  const baseById = new Map(base.map((entry) => [entry.id, entry]));
  const localById = new Map(local.map((entry) => [entry.id, entry]));
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  const localOrderChanged = !same(base.map((entry) => entry.id), local.map((entry) => entry.id));
  const primaryOrder = localOrderChanged ? local : remote;
  const ids = [...primaryOrder.map((entry) => entry.id), ...remote.map((entry) => entry.id), ...local.map((entry) => entry.id)]
    .filter((id, index, all) => all.indexOf(id) === index);

  return ids.flatMap((id) => {
    const baseEntry = baseById.get(id);
    const localEntry = localById.get(id);
    const remoteEntry = remoteById.get(id);

    if (!baseEntry) {
      if (localEntry && remoteEntry) return [mergeCampaignValues({}, localEntry, remoteEntry)];
      return localEntry ? [localEntry] : remoteEntry ? [remoteEntry] : [];
    }
    if (!localEntry) return [];
    if (!remoteEntry) return same(localEntry, baseEntry) ? [] : [localEntry];
    return [mergeCampaignValues(baseEntry, localEntry, remoteEntry)];
  });
}

/**
 * Three-way campaign merge. Unchanged local values follow the server, unchanged
 * server values accept the local edit, and simultaneous edits merge recursively.
 * Entity arrays merge by stable id so different characters, combatants, items,
 * containers, effects, and chat-adjacent records can be edited concurrently.
 * A same-field conflict is deliberately last-writer-wins for the submitting client.
 */
export function mergeCampaignValues(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (same(local, remote)) return local;

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (keyedArray(base) && keyedArray(local) && keyedArray(remote)) return mergeKeyedArray(base, local, remote);
    if (uniqueStringArray(base) && uniqueStringArray(local) && uniqueStringArray(remote)) return mergeStringSet(base, local, remote);
    if (base.length === local.length && base.length === remote.length) {
      return base.map((entry, index) => mergeCampaignValues(entry, local[index], remote[index]));
    }
    return local;
  }

  if (record(base) && record(local) && record(remote)) {
    const merged: JsonRecord = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(remote), ...Object.keys(local)]);
    for (const key of keys) {
      const inBase = Object.prototype.hasOwnProperty.call(base, key);
      const inLocal = Object.prototype.hasOwnProperty.call(local, key);
      const inRemote = Object.prototype.hasOwnProperty.call(remote, key);
      if (!inLocal && inBase) continue;
      if (!inRemote && inBase) {
        if (inLocal && !same(local[key], base[key])) merged[key] = local[key];
        continue;
      }
      if (!inBase) {
        if (inLocal && inRemote) merged[key] = mergeCampaignValues(undefined, local[key], remote[key]);
        else if (inLocal) merged[key] = local[key];
        else if (inRemote) merged[key] = remote[key];
        continue;
      }
      merged[key] = mergeCampaignValues(base[key], local[key], remote[key]);
    }
    return merged;
  }

  return local;
}

export function mergeCampaignStates<T>(base: T, local: T, remote: T): T {
  return mergeCampaignValues(base, local, remote) as T;
}
