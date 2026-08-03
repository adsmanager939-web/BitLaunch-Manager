import { pgTable, text, json, timestamp } from "drizzle-orm/pg-core";

export type SessionPhase =
  | "provisioning"
  | "wg_setup"
  | "ready"
  | "ending_wg"
  | "ending_destroy"
  | "done"
  | "error";

/**
 * Persisted session records for the virtual-desktop shift-worker lifecycle.
 *
 * wgConfig may contain a WireGuard private key — it is stored server-side
 * only and never returned to browser clients except through the session
 * status route (which requires a valid operator auth cookie).
 */
export const sessionsTable = pgTable("sessions", {
  sessionId: text("session_id").primaryKey(),
  serverId: text("server_id"),
  userId: text("user_id").notNull(),
  phase: text("phase").$type<SessionPhase>().notNull(),
  steps: json("steps").$type<string[]>().notNull().default([]),
  serverIp: text("server_ip"),
  wgPublicKey: text("wg_public_key"),
  wgConfig: text("wg_config"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
});

export type SessionRow = typeof sessionsTable.$inferSelect;
export type DbSession = typeof sessionsTable.$inferSelect;
export type InsertDbSession = typeof sessionsTable.$inferInsert;
