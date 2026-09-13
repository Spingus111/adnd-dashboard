import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureChatSchema } from "../../../db/ensure";
import { chatAuthority, chatHands, chatMessages } from "../../../db/schema";

const ACTIVE_ROLE_RESET_MS = 15_000;

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export async function GET(request: Request) {
  try {
    await ensureChatSchema();
    const db = await getDb();
    const messages = await db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt)).limit(200);
    const url = new URL(request.url);
    const viewer = cleanText(url.searchParams.get("viewer"), 80);
    const [authority] = await db.select().from(chatAuthority).where(eq(chatAuthority.id, 1)).limit(1);
    const viewerIsGm = url.searchParams.get("gm") === "1";
    const visible = messages.reverse().filter((message) => {
      const visibility = message.visibility || "public";
      if (visibility === "public") return true;
      if (viewerIsGm) return true;
      if (!viewer) return false;
      if (message.authorClientId === viewer) return true;
      return visibility === "whisper" && message.recipientClientId === viewer;
    });
    const hands = await db.select().from(chatHands);
    return Response.json({
      messages: visible,
      hands: hands.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      roleReset: authority && Date.now() - Date.parse(authority.updatedAt) <= ACTIVE_ROLE_RESET_MS
        ? { id: authority.updatedAt, gmClientId: authority.primaryGmClientId, name: authority.primaryGmName }
        : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load party chat." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = cleanText(payload.action, 24);
    await ensureChatSchema();
    const db = await getDb();
    if (action === "claim-primary-gm") {
      const clientId = cleanText(payload.authorClientId ?? payload.clientId, 80);
      if (!clientId) return Response.json({ error: "A player identity is required." }, { status: 400 });
      const primaryGmName = cleanText(payload.authorName, 80).replace(/\s*\((?:GM|Solo)\)$/, "") || "GM";
      const updatedAt = new Date().toISOString();
      await db.insert(chatAuthority).values({ id: 1, primaryGmClientId: clientId, primaryGmName, updatedAt }).onConflictDoUpdate({
        target: chatAuthority.id,
        set: { primaryGmClientId: clientId, primaryGmName, updatedAt },
      });
      return Response.json({ roleReset: { id: updatedAt, gmClientId: clientId, name: primaryGmName } });
    }
    const requesterClientId = cleanText(payload.requesterClientId ?? payload.authorClientId, 80);
    const requesterIsGm = Boolean(payload.authorIsGm);
    if (action === "raise-hand" || action === "lower-hand") {
      const clientId = cleanText(payload.authorClientId ?? payload.clientId, 80);
      if (!clientId) return Response.json({ error: "A player identity is required." }, { status: 400 });
      if (action === "lower-hand") {
        if (!requesterIsGm && requesterClientId !== clientId) return Response.json({ error: "Only the GM or that player can lower this hand." }, { status: 403 });
        await db.delete(chatHands).where(eq(chatHands.clientId, clientId));
        return Response.json({ lowered: clientId });
      }
      const playerName = cleanText(payload.authorName, 80) || "Player";
      const emoji = cleanText(payload.emoji, 24) || "✋";
      const requestedColor = cleanText(payload.color, 16);
      const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : "#d39b18";
      await db.insert(chatHands).values({ clientId, playerName, emoji, color, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: chatHands.clientId, set: { playerName, emoji, color, createdAt: new Date().toISOString() } });
      return Response.json({ hand: { clientId, playerName, emoji, color } });
    }
    const authorName = cleanText(payload.authorName, 80) || "Player";
    const authorClientId = cleanText(payload.authorClientId, 80) || null;
    const authorIsGm = Boolean(payload.authorIsGm);
    const emoji = cleanText(payload.emoji, 24) || "💬";
    const requestedColor = cleanText(payload.color, 16);
    const color = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : "#667085";
    const content = cleanText(payload.content, 500);
    const rollDetail = cleanText(payload.rollDetail, 500) || null;
    const requestedVisibility = cleanText(payload.visibility, 16);
    const visibility = requestedVisibility === "private" || requestedVisibility === "whisper" ? requestedVisibility : "public";
    const recipientClientId = cleanText(payload.recipientClientId, 80) || null;
    const recipientName = cleanText(payload.recipientName, 80) || null;
    const tone = cleanText(payload.tone, 16) === "hostile" ? "hostile" : null;
    if (!content) return Response.json({ error: "Chat messages cannot be empty." }, { status: 400 });
    if (visibility === "whisper" && (!authorIsGm || !recipientClientId)) return Response.json({ error: "Select a player before sending a GM whisper." }, { status: 400 });

    const [message] = await db.insert(chatMessages).values({
      id: crypto.randomUUID(),
      authorName,
      authorClientId,
      authorIsGm,
      emoji,
      color,
      content,
      rollDetail,
      visibility,
      recipientClientId,
      recipientName,
      tone,
      createdAt: new Date().toISOString(),
    }).returning();
    return Response.json({ message });
  } catch {
    return Response.json({ error: "Could not send the chat message." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await ensureChatSchema();
    const db = await getDb();
    await db.delete(chatMessages);
    await db.delete(chatHands);
    return Response.json({ cleared: true });
  } catch {
    return Response.json({ error: "Could not clear party chat." }, { status: 500 });
  }
}
