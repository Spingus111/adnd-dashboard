import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const campaignStates = sqliteTable("campaign_states", {
  id: integer("id").primaryKey(),
  state: text("state").notNull(),
  version: integer("version").notNull().default(1),
  recentMutationIds: text("recent_mutation_ids").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  authorName: text("author_name").notNull(),
  authorClientId: text("author_client_id"),
  authorIsGm: integer("author_is_gm", { mode: "boolean" }).notNull().default(false),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  content: text("content").notNull(),
  rollDetail: text("roll_detail"),
  visibility: text("visibility").notNull().default("public"),
  recipientClientId: text("recipient_client_id"),
  recipientName: text("recipient_name"),
  tone: text("tone"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chatHands = sqliteTable("chat_hands", {
  clientId: text("client_id").primaryKey(),
  playerName: text("player_name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chatAuthority = sqliteTable("chat_authority", {
  id: integer("id").primaryKey(),
  primaryGmClientId: text("primary_gm_client_id").notNull(),
  primaryGmName: text("primary_gm_name").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
