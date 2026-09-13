import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureCampaignSchema } from "../../../db/ensure";
import { campaignStates } from "../../../db/schema";
import { emptyCampaign } from "../../types";
import type { CampaignState } from "../../types";
import { validateCombatMutation } from "../../combat-state-validation";
import type { CombatMutationContext } from "../../combat-permissions";
import { validateCampaignAdministration, validateInventoryMutation } from "../../campaign-permissions";
import { applyCampaignOperations, diffCampaignOperations, type CampaignOperation } from "../../campaign-operations.ts";

const MUTATION_LEDGER_LIMIT = 500;
const MAX_WRITE_ATTEMPTS = 8;
const NO_STORE_HEADERS = { "cache-control": "no-store" };

function normalizeCampaignCollections(state: CampaignState): CampaignState {
  return {
    ...state,
    stableNpcs: Array.isArray(state.stableNpcs) ? state.stableNpcs : [],
    discardedStableNpcs: Array.isArray(state.discardedStableNpcs) ? state.discardedStableNpcs : [],
    expeditionNpcIds: Array.isArray(state.expeditionNpcIds) ? state.expeditionNpcIds : [],
    characterFolders: Array.isArray(state.characterFolders) ? state.characterFolders : [],
  };
}

function parseRecentMutationIds(value: unknown) {
  try {
    const parsed = JSON.parse(typeof value === "string" ? value : "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(-MUTATION_LEDGER_LIMIT) : [];
  } catch { return []; }
}

function validOperations(value: CampaignOperation[]) {
  const forbidden = new Set(["__proto__", "prototype", "constructor"]);
  return value.length <= 1000 && value.every((operation) => {
    if (!operation || !Array.isArray(operation.path) || operation.path.length > 16) return false;
    if (!operation.path.every((segment) => typeof segment === "number"
      ? Number.isInteger(segment) && segment >= 0 && segment < 10_000
      : typeof segment === "string"
        ? segment.length > 0 && segment.length <= 160 && !forbidden.has(segment)
        : Boolean(segment) && typeof segment.id === "string" && segment.id.length > 0 && segment.id.length <= 160)) return false;
    if (operation.type === "increment") return Number.isFinite(operation.amount) && Math.abs(operation.amount) <= 1_000_000;
    if (operation.type === "reorder") return Array.isArray(operation.ids) && operation.ids.length <= 10_000;
    return ["set", "delete", "add-value", "remove-value"].includes(operation.type);
  });
}

export async function GET() {
  try {
    await ensureCampaignSchema();
    const db = await getDb();
    const [row] = await db
      .select()
      .from(campaignStates)
      .where(eq(campaignStates.id, 1))
      .limit(1);

    if (!row) return Response.json({ state: emptyCampaign, version: 0 }, { headers: NO_STORE_HEADERS });
    return Response.json({ state: normalizeCampaignCollections(JSON.parse(row.state)), version: row.version }, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      { error: "Could not load the shared campaign record." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await ensureCampaignSchema();
    const payload = (await request.json()) as {
      state?: CampaignState;
      baseState?: CampaignState;
      operations?: CampaignOperation[];
      mutationId?: string;
      expectedVersion?: number;
      combatActor?: CombatMutationContext | null;
    };
    if ((!Array.isArray(payload.operations) && !payload.state) || typeof payload.expectedVersion !== "number") {
      return Response.json({ error: "Campaign operations and version are required." }, { status: 400 });
    }
    if (Array.isArray(payload.operations) && !validOperations(payload.operations)) {
      return Response.json({ error: "Campaign operation payload is invalid." }, { status: 400 });
    }
    if (payload.mutationId && (typeof payload.mutationId !== "string" || payload.mutationId.length > 100)) {
      return Response.json({ error: "Campaign mutation id is invalid." }, { status: 400 });
    }

    const db = await getDb();
    const combatActor = payload.combatActor ?? null;

    // D1 updates are optimistic. Re-read and reapply the same idempotent,
    // field-level operation if another client wins between read and write.
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const [existing] = await db.select().from(campaignStates).where(eq(campaignStates.id, 1)).limit(1);
      if (!existing) {
        if (payload.expectedVersion !== 0) return Response.json({ error: "Campaign record is unavailable." }, { status: 409 });
        const initialState = Array.isArray(payload.operations)
          ? applyCampaignOperations(emptyCampaign, payload.operations)
          : payload.state as CampaignState;
        const initialMutationIds = payload.mutationId ? [payload.mutationId] : [];
        try {
          const [created] = await db.insert(campaignStates).values({ id: 1, state: JSON.stringify(initialState), version: 1, recentMutationIds: JSON.stringify(initialMutationIds) }).returning({ version: campaignStates.version });
          return Response.json({ state: initialState, version: created.version, mutationId: payload.mutationId ?? null });
        } catch {
          continue;
        }
      }

      const previousState = normalizeCampaignCollections(JSON.parse(existing.state) as CampaignState);
      const seenMutationIds = parseRecentMutationIds(existing.recentMutationIds);
      if (payload.mutationId && seenMutationIds.includes(payload.mutationId)) {
        return Response.json({ state: previousState, version: existing.version, mutationId: payload.mutationId });
      }

      // Current clients submit only field/entity operations. The snapshot branch
      // is a short rollout bridge for browsers that were already open; it is
      // converted to the same stable-id operation protocol before validation.
      const operations = Array.isArray(payload.operations)
        ? payload.operations
        : diffCampaignOperations(payload.baseState ?? previousState, payload.state);
      const nextState = applyCampaignOperations(previousState, operations);
      const administrationError = validateCampaignAdministration(previousState, nextState, combatActor);
      if (administrationError) return Response.json({ error: administrationError, state: previousState, version: existing.version }, { status: 403 });
      const inventoryError = validateInventoryMutation(previousState, nextState, combatActor);
      if (inventoryError) return Response.json({ error: inventoryError, state: previousState, version: existing.version }, { status: 403 });
      const validationError = validateCombatMutation(previousState, nextState, combatActor);
      if (validationError) return Response.json({ error: validationError, state: previousState, version: existing.version }, { status: 403 });
      if (import.meta.env.DEV) console.info("campaign mutation", {
        mutationId: payload.mutationId ?? null,
        role: combatActor?.role ?? null,
        changedFields: operations.map((operation) => operation.path),
        baseVersion: payload.expectedVersion,
        serverVersion: existing.version,
        timestamp: new Date().toISOString(),
      });
      const nextMutationIds = payload.mutationId ? [...seenMutationIds, payload.mutationId].slice(-MUTATION_LEDGER_LIMIT) : seenMutationIds;

      const [updated] = await db.update(campaignStates).set({
        state: JSON.stringify(nextState),
        recentMutationIds: JSON.stringify(nextMutationIds),
        version: sql`${campaignStates.version} + 1`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(and(eq(campaignStates.id, 1), eq(campaignStates.version, existing.version))).returning({ version: campaignStates.version });
      if (updated) return Response.json({ state: nextState, version: updated.version, mutationId: payload.mutationId ?? null });
    }

    const [latest] = await db.select().from(campaignStates).where(eq(campaignStates.id, 1)).limit(1);
    return Response.json({ error: "Campaign stayed busy during this save; retrying shortly.", state: latest ? JSON.parse(latest.state) : emptyCampaign, version: latest?.version ?? 0 }, { status: 409 });
  } catch (error) {
    if (import.meta.env.DEV) console.error("campaign save failed", error);
    const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: unknown }).cause : null;
    const developmentMessage = error instanceof Error
      ? `${error.message}${cause instanceof Error ? ` · ${cause.message}` : ""}`
      : "Unknown save error";
    return Response.json(
      { error: import.meta.env.DEV ? `Could not save the shared campaign record: ${developmentMessage}` : "Could not save the shared campaign record." },
      { status: 500 },
    );
  }
}
