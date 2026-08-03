/**
 * Session orchestration routes — virtual-desktop shift-worker lifecycle.
 *
 * Launch: create BitLaunch server → poll until active → register WireGuard peer
 * End:    revoke WireGuard peer → destroy server
 *
 * NOTE — file sync (rclone/rsync) is NOT included in this orchestration.
 * Delivering files to the provisioned VM requires SSH access to the new server.
 * SSH key management is tracked as a separate feature (Task #5). Once SSH keys
 * are managed, an scp/rsync step can be inserted here.
 *
 * ── Authorization ────────────────────────────────────────────────────────────
 * All mutating routes (launch, end) and the session status route require the
 * caller to hold a valid session cookie issued by POST /api/sessions/auth.
 *
 * Flow:
 *   1. Operator calls POST /api/sessions/auth { key: "<SESSION_SECRET value>" }
 *   2. Server validates the key and sets a signed HttpOnly cookie.
 *   3. All subsequent session calls carry that cookie automatically.
 *   4. Operator calls DELETE /api/sessions/auth to log out (clears cookie).
 *
 * The raw SESSION_SECRET value is submitted once at login and never sent back
 * to the client. The session cookie is opaque, signed, and HttpOnly — it cannot
 * be read or forged by browser JavaScript.
 *
 * ── Error sanitization ───────────────────────────────────────────────────────
 * Raw upstream error detail (BitLaunch API responses, network messages) is
 * written to the server log only. The session record and API responses contain
 * stable, client-safe strings so internal infrastructure is not leaked.
 *
 * ── Persistence ──────────────────────────────────────────────────────────────
 * Sessions are stored in-memory (does not survive server restarts).
 * Persistence to the database is tracked as Task #9.
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { generateKeyPairSync, randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { db, sessionsTable } from "@workspace/db";
import { and, not, inArray, gte } from "drizzle-orm";

const BITLAUNCH_API_KEY = process.env.BITLAUNCH_API_KEY;
const BITLAUNCH_BASE_URL = "https://api.bitlaunch.io/v1";
const WG_SERVER_HOST = process.env.WG_SERVER_HOST;
const WG_SERVER_API_KEY = process.env.WG_SERVER_API_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET;

// ── Session types ─────────────────────────────────────────────────────────────

export type SessionPhase =
  | "provisioning"
  | "wg_setup"
  | "ready"
  | "ending_wg"
  | "ending_destroy"
  | "done"
  | "error";

export interface Session {
  sessionId: string;
  serverId: string | null;
  userId: string;
  phase: SessionPhase;
  /** Stable, sanitized step keys — no raw upstream data. */
  steps: string[];
  serverIp: string | null;
  wgConfig: string | null;
  wgPublicKey: string | null;
  /** Stable, sanitized error message shown to the client. */
  error: string | null;
  startedAt: string;
}

// In-memory store keyed by sessionId (UUID). Authoritative at runtime.
const sessions = new Map<string, Session>();

// ── DB persistence helpers ────────────────────────────────────────────────────

/**
 * Upsert a session to the database. Fire-and-forget: errors are logged but
 * never thrown so in-memory operation is never blocked by a DB hiccup.
 */
function persistSession(session: Session): void {
  db.insert(sessionsTable)
    .values({
      sessionId:   session.sessionId,
      serverId:    session.serverId,
      userId:      session.userId,
      phase:       session.phase,
      steps:       session.steps,
      serverIp:    session.serverIp,
      wgConfig:    session.wgConfig,
      wgPublicKey: session.wgPublicKey,
      error:       session.error,
      startedAt:   session.startedAt,
      updatedAt:   new Date(),
    })
    .onConflictDoUpdate({
      target: sessionsTable.sessionId,
      set: {
        serverId:    session.serverId,
        phase:       session.phase,
        steps:       session.steps,
        serverIp:    session.serverIp,
        wgConfig:    session.wgConfig,
        wgPublicKey: session.wgPublicKey,
        error:       session.error,
        updatedAt:   new Date(),
      },
    })
    .catch((err: unknown) => {
      logger.error({ err, sessionId: session.sessionId }, "Failed to persist session to DB");
    });
}

/**
 * Load active sessions from the database into the in-memory store.
 * Only restores non-terminal sessions started within the last 24 hours to
 * avoid replaying completed or very stale sessions on restart.
 *
 * Called once at server startup from index.ts.
 */
export async function initSessionStore(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          not(inArray(sessionsTable.phase, ["done", "error"])),
          gte(sessionsTable.startedAt, cutoff),
        ),
      );
    for (const row of rows) {
      sessions.set(row.sessionId, {
        sessionId:   row.sessionId,
        serverId:    row.serverId ?? null,
        userId:      row.userId,
        phase:       row.phase as SessionPhase,
        steps:       (row.steps as string[]) ?? [],
        serverIp:    row.serverIp ?? null,
        wgConfig:    row.wgConfig ?? null,
        wgPublicKey: row.wgPublicKey ?? null,
        error:       row.error ?? null,
        startedAt:   row.startedAt,
      });
    }
    logger.info({ count: rows.length }, "Session store initialised from database");
  } catch (err) {
    logger.error({ err }, "Failed to load sessions from DB; starting with empty in-memory store");
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

const COOKIE_NAME = "sess";
const COOKIE_VALUE = "ok";
/** 8-hour session, matching a typical operator shift. */
const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1_000;

function setSessionCookie(res: Response): void {
  res.cookie(COOKIE_NAME, COOKIE_VALUE, {
    signed: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE_MS,
    // Require HTTPS in production — the session cookie authorises destructive
    // server operations and returns WireGuard VPN credentials.
    secure: process.env.NODE_ENV === "production",
  });
}

function hasSessionCookie(req: Request): boolean {
  // cookie-parser verifies the HMAC signature using SESSION_SECRET.
  // A forged or tampered cookie will not appear in req.signedCookies.
  return req.signedCookies?.[COOKIE_NAME] === COOKIE_VALUE;
}

/**
 * Middleware: require a valid signed session cookie.
 *
 * Behavior by configuration:
 *   • SESSION_SECRET set → enforce cookie auth (401 if missing/invalid)
 *   • SESSION_SECRET absent + NODE_ENV !== "production" + ALLOW_UNAUTH_SESSIONS === "true"
 *     → explicit dev bypass (must be opted in; never active in production)
 *   • Any other case (SESSION_SECRET absent without the bypass flag, or production
 *     environment without a secret) → 503 Service Unavailable (fail closed)
 *
 * The "allow all by default when no secret is set" pattern is deliberately
 * removed. A misconfigured production deployment must fail visibly rather than
 * silently accepting all requests.
 */
function requireSessionAuth(req: Request, res: Response, next: NextFunction): void {
  if (SESSION_SECRET) {
    // Normal path: session secret is configured; validate the cookie.
    if (!hasSessionCookie(req)) {
      res.status(401).json({
        error: "Unauthorized — authenticate at POST /api/sessions/auth first",
      });
      return;
    }
    next();
    return;
  }

  // SESSION_SECRET is not set.
  const isDevBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNAUTH_SESSIONS === "true";

  if (isDevBypassEnabled) {
    res.setHeader("X-Session-Auth", "dev-bypass");
    next();
    return;
  }

  // Fail closed: no secret and no explicit dev bypass.
  res.status(503).json({
    error:
      "Session operations are not available — SESSION_SECRET is not configured. " +
      "Set SESSION_SECRET to enable session features. " +
      "For local development without a secret, set ALLOW_UNAUTH_SESSIONS=true (non-production only).",
  });
}

// ── Input validation ──────────────────────────────────────────────────────────

/**
 * Validates userId: only alphanumeric, hyphens, underscores, and dots (max 64
 * chars). Prevents path traversal and shell injection for any downstream use.
 */
function validateUserId(userId: string): void {
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(userId)) {
    throw new Error(
      "userId must be 1–64 characters: letters, digits, hyphens, underscores, or dots",
    );
  }
}

// ── BitLaunch helpers ─────────────────────────────────────────────────────────

function blHeaders() {
  return {
    Authorization: `Bearer ${BITLAUNCH_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function blFetch(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${BITLAUNCH_BASE_URL}${path}`, {
    method,
    headers: blHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (method === "DELETE" && res.status === 204) return null;
  if (!res.ok) {
    // Log the raw upstream response server-side; never forward it to the client.
    const text = await res.text().catch(() => "(unreadable)");
    logger.error({ path, method, status: res.status, body: text }, "BitLaunch API error");
    throw new Error(`BitLaunch request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function pollUntilActive(serverId: string): Promise<Record<string, unknown>> {
  // Read at call time so tests can override via env without reloading the module.
  const maxAttempts = parseInt(process.env.POLL_MAX_ATTEMPTS ?? "60", 10);
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS ?? "10000", 10);
  for (let i = 0; i < maxAttempts; i++) {
    const data = (await blFetch(`/servers/${serverId}`)) as Record<string, unknown>;
    const status = String(data.status ?? "").toLowerCase();
    if (["active", "ready", "running"].includes(status)) return data;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Server did not become active within the timeout");
}

// ── WireGuard helpers ─────────────────────────────────────────────────────────

/**
 * Generate a Curve25519 keypair using Node's built-in crypto — no wg binary.
 * Compatible with WireGuard key format (raw 32-byte, base64-encoded).
 */
function generateWgKeypair(): { privateKey: string; publicKey: string } {
  const { privateKey: privObj, publicKey: pubObj } = generateKeyPairSync("x25519");
  const privDer = privObj.export({ type: "pkcs8", format: "der" }) as Buffer;
  const pubDer = pubObj.export({ type: "spki", format: "der" }) as Buffer;
  return {
    privateKey: privDer.subarray(-32).toString("base64"),
    publicKey: pubDer.subarray(-32).toString("base64"),
  };
}

function buildWgConfig(
  privateKey: string,
  serverPublicKey: string,
  endpoint: string,
  assignedIp: string,
): string {
  return [
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `Address = ${assignedIp}/32`,
    "",
    "[Peer]",
    `PublicKey = ${serverPublicKey}`,
    `Endpoint = ${endpoint}`,
    "AllowedIPs = 0.0.0.0/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

// ── Launch orchestrator ───────────────────────────────────────────────────────

async function runLaunch(
  session: Session,
  body: z.infer<typeof LaunchBody>,
): Promise<void> {
  try {
    validateUserId(body.userId);

    // 1. Create BitLaunch server
    session.phase = "provisioning";
    const raw = (await blFetch("/servers", "POST", {
      name: body.serverName,
      image: body.snapshotId,
      region: body.region,
      plan: body.plan,
      provider: body.provider,
    })) as Record<string, unknown>;

    session.serverId = String(raw.id ?? "");
    session.steps.push(`server_created`);
    // Persist now: if the server restarts before the session is ready,
    // the serverId must be known so a cleanup (End Session) is possible.
    persistSession(session);

    // 2. Poll until active
    const ready = await pollUntilActive(session.serverId);
    session.serverIp = String(ready.ip ?? ready.ipv4 ?? ready.ip_address ?? "");
    session.steps.push("server_active");

    // 3. WireGuard peer registration (optional — skipped if env vars absent)
    if (WG_SERVER_HOST && WG_SERVER_API_KEY) {
      session.phase = "wg_setup";
      const { privateKey, publicKey } = generateWgKeypair();
      session.wgPublicKey = publicKey;

      const peerRes = await fetch(`${WG_SERVER_HOST}/peers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WG_SERVER_API_KEY}`,
        },
        body: JSON.stringify({ public_key: publicKey, user_id: body.userId }),
      });
      if (!peerRes.ok) {
        const text = await peerRes.text().catch(() => "(unreadable)");
        logger.error({ status: peerRes.status, body: text }, "WireGuard peer registration failed");
        throw new Error("WireGuard peer registration failed");
      }
      const peer = (await peerRes.json()) as Record<string, unknown>;
      session.wgConfig = buildWgConfig(
        privateKey,
        String(peer.server_public_key ?? peer.serverPublicKey ?? ""),
        String(peer.endpoint ?? ""),
        String(peer.assigned_ip ?? peer.assignedIp ?? ""),
      );
      session.steps.push("wg_registered");
    } else {
      session.steps.push("wg_skipped:not_configured");
    }

    // NOTE: File sync to the VM is not performed here.
    // Delivering files to the provisioned BitLaunch VM requires SSH access —
    // see Task #5 (SSH key management). Once SSH is available, add an
    // scp/rsync step here.

    session.phase = "ready";
    session.steps.push("session_ready");
    persistSession(session);
  } catch (err) {
    // Log full error server-side; store only a stable string in the session.
    logger.error({ err, sessionId: session.sessionId }, "Session launch failed");
    session.phase = "error";
    session.steps.push("launch_failed");

    // ── Compensating cleanup ─────────────────────────────────────────────────
    // If a server was already created before the failure, destroy it now so
    // the user is not left with a running VM that has no associated session.
    if (session.serverId) {
      const orphanId = session.serverId;
      try {
        await blFetch(`/servers/${orphanId}`, "DELETE");
        logger.info({ sessionId: session.sessionId, serverId: orphanId }, "Cleanup: orphaned server destroyed");
        session.serverId = null; // Server no longer exists
        session.steps.push("cleanup_server_destroyed");
        session.error = "Session launch failed — orphaned server has been automatically destroyed";
      } catch (cleanupErr) {
        logger.error(
          { cleanupErr, sessionId: session.sessionId, serverId: orphanId },
          "Cleanup failed: could not destroy orphaned server",
        );
        session.steps.push("cleanup_destroy_failed");
        // Keep serverId set so the UI can surface it for manual recovery
        session.error =
          `Session launch failed — server ${orphanId} could not be auto-cleaned. ` +
          "Use End Session from the server detail page to remove it manually.";
      }
    } else {
      session.error = "Session launch failed — check server logs for details";
    }
    persistSession(session);
  }
}

// ── End orchestrator ──────────────────────────────────────────────────────────

async function runEnd(session: Session, serverId: string): Promise<void> {
  try {
    // NOTE: File sync from the VM is not performed here (see Task #5).

    // 1. Revoke WireGuard peer (optional)
    session.phase = "ending_wg";
    if (WG_SERVER_HOST && WG_SERVER_API_KEY && session.wgPublicKey) {
      const encodedKey = encodeURIComponent(session.wgPublicKey);
      const res = await fetch(`${WG_SERVER_HOST}/peers/${encodedKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${WG_SERVER_API_KEY}` },
      });
      if (!res.ok) {
        logger.warn({ status: res.status, sessionId: session.sessionId }, "WireGuard peer revoke failed");
      }
      session.steps.push(res.ok ? "wg_revoked" : "wg_revoke_failed");
    } else {
      session.steps.push("wg_revoke_skipped:not_configured");
    }

    // 2. Destroy BitLaunch server
    session.phase = "ending_destroy";
    await blFetch(`/servers/${serverId}`, "DELETE");
    session.steps.push("server_destroyed");
    session.phase = "done";
    persistSession(session);
  } catch (err) {
    logger.error({ err, sessionId: session.sessionId }, "Session end failed");
    session.phase = "error";
    session.error = "Session teardown failed — check server logs for details";
    session.steps.push("teardown_failed");
    persistSession(session);
  }
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const LaunchBody = z.object({
  snapshotId: z.string().min(1, "snapshotId is required"),
  userId: z.string().regex(
    /^[a-zA-Z0-9._-]{1,64}$/,
    "userId must be 1–64 chars: letters, digits, hyphens, underscores, or dots",
  ),
  serverName: z.string().min(1).default("session-server"),
  region: z.string().min(1).default("nyc1"),
  plan: z.string().min(1).default("s-2vcpu-4gb"),
  provider: z.string().min(1).default("digitalocean"),
});

const SessionIdParams = z.object({ sessionId: z.string().uuid("sessionId must be a UUID") });
const ServerIdParams = z.object({ serverId: z.string().min(1) });

// ── Routes ────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ── Auth sub-routes ───────────────────────────────────────────────────────────

/**
 * POST /api/sessions/auth { key }
 * Validates the provided key against SESSION_SECRET.
 * On success, sets a signed HttpOnly session cookie (8-hour TTL).
 * The key is never echoed back; subsequent calls carry only the cookie.
 */
router.post("/sessions/auth", (req, res): void => {
  const { key } = req.body as { key?: unknown };

  if (!SESSION_SECRET) {
    // No secret configured. Allow login only when the explicit dev bypass is active.
    const isDevBypassEnabled =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_UNAUTH_SESSIONS === "true";
    if (!isDevBypassEnabled) {
      res.status(503).json({
        error:
          "Session operations are not available — SESSION_SECRET is not configured.",
      });
      return;
    }
    // Dev bypass: set a cookie (cookie-parser uses undefined secret, so it won't be
    // signed, but requireSessionAuth also skips signing checks in dev-bypass mode).
    res.cookie(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE_MS,
    });
    res.json({ ok: true, dev: true });
    return;
  }

  if (typeof key !== "string" || key !== SESSION_SECRET) {
    // Don't hint whether the key was close or the format was wrong.
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  setSessionCookie(res);
  res.json({ ok: true });
});

/**
 * GET /api/sessions/auth/status
 * Returns whether the caller holds a valid session cookie.
 * Safe to call unauthenticated — it only reveals boolean auth state.
 */
router.get("/sessions/auth/status", (req, res): void => {
  // Dev bypass is considered "authenticated" so the dashboard UI stays usable
  // during development without a secret.
  const isDevBypassEnabled =
    !SESSION_SECRET &&
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNAUTH_SESSIONS === "true";

  // Authenticated when: dev bypass active, OR SESSION_SECRET is set AND cookie valid.
  // When SESSION_SECRET is absent and bypass is off, returns false (fail-closed).
  const authenticated = isDevBypassEnabled || (!!SESSION_SECRET && hasSessionCookie(req));
  res.json({ authenticated });
});

/**
 * DELETE /api/sessions/auth
 * Clears the session cookie (logout).
 */
router.delete("/sessions/auth", (_req, res): void => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// ── Session operation routes ──────────────────────────────────────────────────

/**
 * POST /api/sessions/launch
 * Requires a valid session cookie (from POST /api/sessions/auth).
 * Starts orchestration asynchronously — returns 202 + { sessionId }.
 * Client polls GET /api/sessions/:sessionId/status for progress.
 */
router.post("/sessions/launch", requireSessionAuth, async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const body = LaunchBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map((i) => i.message).join("; ") });
    return;
  }

  const sessionId = randomUUID();
  const session: Session = {
    sessionId,
    serverId: null,
    userId: body.data.userId,
    phase: "provisioning",
    steps: [],
    serverIp: null,
    wgConfig: null,
    wgPublicKey: null,
    error: null,
    startedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  persistSession(session); // Record immediately so sessionId is durable on restart

  // Fire-and-forget — client polls /status
  runLaunch(session, body.data).catch(() => {});

  res.status(202).json({ sessionId });
});

/**
 * GET /api/sessions/:sessionId/status
 * Requires a valid session cookie — the response may contain a WireGuard
 * private-key config; restrict to authenticated operators.
 * Poll until phase === "ready" | "done" | "error".
 */
router.get("/sessions/:sessionId/status", requireSessionAuth, (req, res): void => {
  const params = SessionIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "sessionId must be a UUID" });
    return;
  }
  const session = sessions.get(params.data.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({
    sessionId: session.sessionId,
    serverId: session.serverId,
    userId: session.userId,
    phase: session.phase,
    steps: session.steps,
    serverIp: session.serverIp,
    wgConfig: session.wgConfig,
    error: session.error,
    startedAt: session.startedAt,
  });
});

/**
 * POST /api/sessions/:serverId/end
 * Requires a valid session cookie.
 * Only ends sessions that were launched through this API — returns 404 for
 * any serverId that is not tracked by an active session. This prevents ad-hoc
 * destruction of arbitrary servers.
 */
router.post("/sessions/:serverId/end", requireSessionAuth, async (req, res): Promise<void> => {
  const params = ServerIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { serverId } = params.data;

  // Require a tracked session — no ad-hoc server IDs allowed.
  // This check runs before the BITLAUNCH_API_KEY guard so that callers
  // get a clear 404 (unknown server) rather than a 500 (misconfiguration)
  // when the session isn't tracked.
  const session = [...sessions.values()].find((s) => s.serverId === serverId);
  if (!session) {
    res.status(404).json({
      error: "No active session found for this server. Only servers launched through Launch Session can be ended here.",
    });
    return;
  }

  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }

  // Idempotency: if already tearing down or done, return the current state
  if (["ending_wg", "ending_destroy", "done"].includes(session.phase)) {
    res.status(202).json({ sessionId: session.sessionId, phase: session.phase });
    return;
  }

  session.phase = "ending_wg";
  runEnd(session, serverId).catch(() => {});

  res.status(202).json({ sessionId: session.sessionId, phase: session.phase });
});

export default router;
