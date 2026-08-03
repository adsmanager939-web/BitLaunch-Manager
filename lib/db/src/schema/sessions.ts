import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Persisted session records for the virtual-desktop shift-worker lifecycle.
 *
 * The in-memory Map in sessions.ts is still the authoritative source at
 * runtime; this table is used to restore active sessions after a server
 * restart (Task #9).
 *
 * wgConfig may contain a WireGuard private key — it is stored server-side
 * only and never returned to browser clients except through the session
 * status route (which requires a valid operator auth cookie).
 */
export const sessionsTable = pgTable("sessions", {
  sessionId:    text("session_id").primaryKey(),
  serverId:     text("server_id"),
  userId:       text("user_id").notNull(),
  phase:        text("phase").notNull(),
  /** JSON array of stable step-key strings */
  steps:        jsonb("steps").notNull().$type<string[]>().default([]),
  serverIp:     text("server_ip"),
  /** WireGuard client config block including private key — server-side only */
  wgConfig:     text("wg_config"),
  wgPublicKey:  text("wg_public_key"),
  error:        text("error"),
  /** ISO-8601 string matching Session.startedAt */
  startedAt:    text("started_at").notNull(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DbSession = typeof sessionsTable.$inferSelect;
export type InsertDbSession = typeof sessionsTable.$inferInsert;
