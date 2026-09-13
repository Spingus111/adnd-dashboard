let schemaPromise: Promise<unknown> | null = null;
let chatSchemaPromise: Promise<unknown> | null = null;

export async function ensureCampaignSchema() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Campaign storage is unavailable.");
  schemaPromise ??= env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS campaign_states (
      id INTEGER PRIMARY KEY NOT NULL,
      state TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      recent_mutation_ids TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  return await schemaPromise;
}

export async function ensureChatSchema() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Chat storage is unavailable.");
  chatSchemaPromise ??= (async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        author_name TEXT NOT NULL,
        author_client_id TEXT,
        author_is_gm INTEGER NOT NULL DEFAULT 0,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        content TEXT NOT NULL,
        roll_detail TEXT,
        visibility TEXT NOT NULL DEFAULT 'public',
        recipient_client_id TEXT,
        recipient_name TEXT,
        tone TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    const tableInfo = await env.DB.prepare("PRAGMA table_info(chat_messages)").all<{ name: string }>();
    const columns = new Set((tableInfo.results ?? []).map((column) => column.name));
    const additions = [
      ["author_client_id", "ALTER TABLE chat_messages ADD COLUMN author_client_id TEXT"],
      ["author_is_gm", "ALTER TABLE chat_messages ADD COLUMN author_is_gm INTEGER NOT NULL DEFAULT 0"],
      ["visibility", "ALTER TABLE chat_messages ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'"],
      ["recipient_client_id", "ALTER TABLE chat_messages ADD COLUMN recipient_client_id TEXT"],
      ["recipient_name", "ALTER TABLE chat_messages ADD COLUMN recipient_name TEXT"],
      ["tone", "ALTER TABLE chat_messages ADD COLUMN tone TEXT"],
    ] as const;
    for (const [column, statement] of additions) if (!columns.has(column)) await env.DB.prepare(statement).run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages (created_at)").run();
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS chat_hands (
        client_id TEXT PRIMARY KEY NOT NULL,
        player_name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  })();
  return await chatSchemaPromise;
}
