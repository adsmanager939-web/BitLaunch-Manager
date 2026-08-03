/**
 * DB-persistence integration tests for session orchestration.
 *
 * These tests verify the three DB-backed behaviors introduced by Task #9:
 *
 *   1. POST /api/sessions/launch writes a session row to PostgreSQL and the
 *      orchestrator keeps it updated throughout the lifecycle.
 *   2. GET /api/sessions/:sessionId/status reads from the database (not
 *      in-memory), so data survives across requests.
 *   3. initSessionStore() marks any session that was mid-flight at restart
 *      as "error" with a descriptive message.
 *
 * The tests run against the real DATABASE_URL (Replit-provisioned PostgreSQL).
 * globalThis.fetch is mocked so no real BitLaunch or WireGuard calls are made.
 *
 * Requires SESSION_SECRET and BITLAUNCH_API_KEY in the environment
 * (see the `test` script in package.json). DATABASE_URL is always available
 * in the Replit environment.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import supertest from "supertest";
import { eq } from "drizzle-orm";
import type { Server } from "node:http";

if (!process.env.SESSION_SECRET) {
  throw new Error("sessions.persistence.test.ts requires SESSION_SECRET");
}
if (!process.env.BITLAUNCH_API_KEY) {
  throw new Error("sessions.persistence.test.ts requires BITLAUNCH_API_KEY");
}
if (!process.env.DATABASE_URL) {
  throw new Error("sessions.persistence.test.ts requires DATABASE_URL");
}

// Short poll so the test completes in milliseconds, not minutes.
process.env.POLL_MAX_ATTEMPTS = "3";
process.env.POLL_INTERVAL_MS = "50";

// ── Mock fetch ────────────────────────────────────────────────────────────────
// Intercept all external HTTP before the app module loads.

const originalFetch = globalThis.fetch;
let mockServerId = "persist-srv-001";

(globalThis as { fetch: typeof fetch }).fetch = async (
  input: URL | string | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.href
        : String(input);
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  if (url.includes("api.bitlaunch.io")) {
    if (method === "POST" && url.endsWith("/servers")) {
      return new Response(
        JSON.stringify({ id: mockServerId, status: "new", name: "persist-test" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (method === "GET" && url.includes("/servers/")) {
      return new Response(
        JSON.stringify({ id: mockServerId, status: "active", ip: "10.0.0.1" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (method === "DELETE" && url.includes("/servers/")) {
      return new Response(null, { status: 204 });
    }
  }

  return new Response(JSON.stringify({ error: "not mocked" }), { status: 404 });
};

// ── Shared state ──────────────────────────────────────────────────────────────

let server: Server;
let agent: ReturnType<typeof supertest>;
let sessionCookie = "";

/** IDs of all sessions created during the test run — cleaned up in after(). */
const createdSessionIds: string[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForTerminal(
  sessionId: string,
  timeoutMs = 8_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await agent
      .get(`/api/sessions/${sessionId}/status`)
      .set("Cookie", sessionCookie);
    const body = res.body as Record<string, unknown>;
    if (["ready", "done", "error"].includes(body.phase as string)) return body;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(`Session ${sessionId} did not reach terminal phase within ${timeoutMs}ms`);
}

// ── Suite setup ───────────────────────────────────────────────────────────────

before(async () => {
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  agent = supertest(server);

  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: process.env.SESSION_SECRET });
  assert.equal(loginRes.status, 200);

  const setCookie = loginRes.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  sessionCookie = cookies.find((c) => c.startsWith("sess="))?.split(";")[0] ?? "";
  assert.ok(sessionCookie, "Expected a session cookie after login");
});

after(async () => {
  server?.close();
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;

  // Clean up all test session rows from the DB.
  if (createdSessionIds.length > 0) {
    const { db, sessionsTable } = await import("@workspace/db");
    for (const id of createdSessionIds) {
      await db.delete(sessionsTable).where(eq(sessionsTable.sessionId, id)).catch(() => {});
    }
  }
});

// ── Test 1: launch writes a row to the DB ─────────────────────────────────────

test("POST /launch persists session to DB and orchestrator updates it to ready", async () => {
  mockServerId = `persist-srv-${randomUUID().slice(0, 8)}`;

  const launchRes = await agent
    .post("/api/sessions/launch")
    .set("Cookie", sessionCookie)
    .send({
      snapshotId: "snap-persist-test",
      userId: "persist-user-1",
      serverName: "persist-test-server",
      region: "nyc1",
      plan: "s-1vcpu-2gb",
      provider: "digitalocean",
    });
  assert.equal(launchRes.status, 202, "Launch should return 202");

  const { sessionId } = launchRes.body as { sessionId: string };
  assert.ok(sessionId, "Response must include sessionId");
  createdSessionIds.push(sessionId);

  // Poll via HTTP until terminal — this exercises the DB read path.
  const statusBody = await waitForTerminal(sessionId);
  assert.equal(statusBody.phase, "ready", `Expected phase=ready; got ${statusBody.phase}`);
  assert.equal(statusBody.userId, "persist-user-1");
  assert.equal(statusBody.serverIp, "10.0.0.1");

  const steps = statusBody.steps as string[];
  assert.ok(steps.includes("server_created"), "steps must include server_created");
  assert.ok(steps.includes("server_active"), "steps must include server_active");
  assert.ok(steps.includes("session_ready"), "steps must include session_ready");

  // Verify the row exists in the DB directly.
  const { db, sessionsTable } = await import("@workspace/db");
  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, sessionId));

  assert.equal(rows.length, 1, "Exactly one DB row must exist for the session");
  const row = rows[0];
  assert.equal(row.phase, "ready");
  assert.equal(row.userId, "persist-user-1");
  assert.equal(row.serverIp, "10.0.0.1");
  assert.ok(Array.isArray(row.steps), "steps must be an array");
});

// ── Test 2: status reads from DB, not in-memory ───────────────────────────────

test("GET /status returns data for a session inserted directly into the DB", async () => {
  const { db, sessionsTable } = await import("@workspace/db");

  const directSessionId = randomUUID();
  createdSessionIds.push(directSessionId);

  // Insert a row directly — bypassing the launch route — to confirm the status
  // endpoint reads from the DB rather than an in-memory store.
  await db.insert(sessionsTable).values({
    sessionId: directSessionId,
    serverId: "direct-srv-001",
    userId: "direct-user",
    phase: "ready",
    steps: ["server_created", "server_active", "session_ready"],
    serverIp: "192.168.1.1",
    wgPublicKey: null,
    wgConfig: null,
    error: null,
    startedAt: new Date(),
  });

  const res = await agent
    .get(`/api/sessions/${directSessionId}/status`)
    .set("Cookie", sessionCookie);

  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.sessionId, directSessionId);
  assert.equal(body.userId, "direct-user");
  assert.equal(body.phase, "ready");
  assert.equal(body.serverIp, "192.168.1.1");
});

// ── Test 3: initSessionStore marks interrupted sessions as error ───────────────

test("initSessionStore marks in-progress sessions as error on restart", async () => {
  const { db, sessionsTable } = await import("@workspace/db");
  const { initSessionStore } = await import("./sessions.js");

  const interruptedId = randomUUID();
  createdSessionIds.push(interruptedId);

  // Simulate a session that was mid-flight when the server crashed.
  // startedAt must be > 20 minutes ago to be considered stale by initSessionStore.
  const staleStartedAt = new Date(Date.now() - 25 * 60 * 1_000); // 25 min ago
  await db.insert(sessionsTable).values({
    sessionId: interruptedId,
    serverId: "interrupted-srv-999",
    userId: "interrupted-user",
    phase: "wg_setup",
    steps: ["server_created", "server_active"],
    serverIp: "10.1.2.3",
    wgPublicKey: null,
    wgConfig: null,
    error: null,
    startedAt: staleStartedAt,
  });

  await initSessionStore();

  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, interruptedId));

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.phase, "error", "Interrupted session must be marked as error");
  assert.ok(row.error, "error field must be populated");
  assert.ok(
    row.error?.includes("interrupted-srv-999"),
    "error message must mention the serverId so operators can clean it up",
  );
  const steps = row.steps as string[];
  assert.ok(
    steps.includes("interrupted_by_restart"),
    "steps must include interrupted_by_restart marker",
  );
});

// ── Test 5: DB write failure after server creation → server destroyed ─────────

test("DB failure after server creation triggers compensating cleanup and server is destroyed", async () => {
  const { db } = await import("@workspace/db");
  mockServerId = `persist-fail-${randomUUID().slice(0, 8)}`;

  // Track BitLaunch calls so we can verify the DELETE was issued.
  const blCalls: { method: string; url: string }[] = [];
  const prevFetch = (globalThis as { fetch: typeof fetch }).fetch;
  (globalThis as { fetch: typeof fetch }).fetch = async (
    input: URL | string | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("api.bitlaunch.io")) blCalls.push({ method, url });
    return prevFetch(input as string, init);
  };

  // Make the 2nd+ DB insert/upsert fail, simulating the DB going down after
  // the session row is initially created.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const origInsert = dbAny.insert.bind(db);
  let insertCallCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbAny.insert = (table: any) => {
    insertCallCount++;
    const builder = origInsert(table);
    if (insertCallCount > 2) {
      // Allow: (1) insertSession in launch route, (2) first saveSession in
      // runLaunch (provisioning phase).  Fail from the 3rd call onward —
      // which covers the save after `session.serverId` is assigned — so the
      // orchestrator has a server ID in hand when persistence starts failing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      builder.values = (..._args: any[]) => {
        throw new Error("simulated DB failure after server creation");
      };
    }
    return builder;
  };

  try {
    const launchRes = await agent
      .post("/api/sessions/launch")
      .set("Cookie", sessionCookie)
      .send({
        snapshotId: "snap-db-fail-after-create",
        userId: "db-fail-user-2",
        serverName: "db-fail-server-2",
        region: "nyc1",
        plan: "s-1vcpu-2gb",
        provider: "digitalocean",
      });

    assert.equal(launchRes.status, 202, "Launch should return 202 (initial DB insert succeeded)");
    createdSessionIds.push((launchRes.body as { sessionId: string }).sessionId);

    // Give the orchestrator time to attempt provisioning, hit the DB failure,
    // and run compensating cleanup (with retries × 500ms delay each = ~1.5s).
    await new Promise((r) => setTimeout(r, 6_000));

    // Verify the server was destroyed even though later DB writes failed.
    const deleteCall = blCalls.find(
      (c) => c.method === "DELETE" && c.url.includes(mockServerId),
    );
    assert.ok(
      deleteCall,
      `Expected DELETE /servers/${mockServerId} for compensating cleanup; got: ${JSON.stringify(blCalls)}`,
    );
  } finally {
    dbAny.insert = origInsert;
    (globalThis as { fetch: typeof fetch }).fetch = prevFetch;
  }
});

// ── Test 6: initSessionStore marks ALL non-terminal sessions, including recent ones ──

test("initSessionStore marks recently started non-terminal sessions as error", async () => {
  const { db, sessionsTable } = await import("@workspace/db");
  const { initSessionStore } = await import("./sessions.js");

  const recentId = randomUUID();
  createdSessionIds.push(recentId);

  // Insert a session that started 2 minutes ago. When this process starts, it
  // has no orchestrator running for it — so it is orphaned regardless of age.
  const recentStartedAt = new Date(Date.now() - 2 * 60 * 1_000);
  await db.insert(sessionsTable).values({
    sessionId: recentId,
    serverId: "recent-srv-002",
    userId: "recent-user-2",
    phase: "provisioning",
    steps: [],
    serverIp: null,
    wgPublicKey: null,
    wgConfig: null,
    error: null,
    startedAt: recentStartedAt,
  });

  await initSessionStore();

  const rows = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sessionId, recentId));

  assert.equal(rows.length, 1);
  // Any non-terminal session is orphaned on startup; it must be marked as error.
  assert.equal(
    rows[0].phase,
    "error",
    "A recently started non-terminal session must be marked as error by initSessionStore",
  );
  assert.ok(rows[0].error, "error field must be populated");
  const steps = rows[0].steps as string[];
  assert.ok(steps.includes("interrupted_by_restart"), "steps must include interrupted_by_restart");
});

// ── Test 4: DB unavailable on launch → 500, no server provisioned ─────────────

test("launch route returns 500 and does not fire provisioning if DB insert fails", async () => {
  const { db } = await import("@workspace/db");

  // Temporarily sabotage the DB by overriding the insert method.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbAny = db as any;
  const origInsert = dbAny.insert.bind(db);
  let insertCalled = false;
  let fetchCalled = false;
  const fetchInterceptor = async (
    input: URL | string | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
    if (url.includes("api.bitlaunch.io") && (init?.method ?? "GET").toUpperCase() === "POST") {
      fetchCalled = true;
    }
    return (globalThis as { fetch: typeof fetch }).fetch(input as string, init);
  };

  // Use `any` to bypass the generic constraint — intentional in test code.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dbAny.insert = (table: any) => {
    insertCalled = true;
    const builder = origInsert(table);
    // Override values() to throw, simulating a DB failure.
    const origValues = builder.values.bind(builder);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    builder.values = (...args: any[]) => {
      origValues(...args);
      throw new Error("simulated DB failure");
    };
    return builder;
  };

  // Intercept fetch to detect if provisioning was attempted.
  const prevFetch = (globalThis as { fetch: typeof fetch }).fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fetchInterceptor;

  try {
    const res = await agent
      .post("/api/sessions/launch")
      .set("Cookie", sessionCookie)
      .send({
        snapshotId: "snap-db-fail",
        userId: "db-fail-user",
        serverName: "db-fail-server",
        region: "nyc1",
        plan: "s-1vcpu-2gb",
        provider: "digitalocean",
      });

    assert.equal(res.status, 500, "Should return 500 when DB insert fails");
    assert.ok(insertCalled, "DB insert must have been attempted");
    // Wait a bit to ensure no fire-and-forget provisioning was started.
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(fetchCalled, false, "BitLaunch provisioning must not be attempted when DB insert fails");
  } finally {
    // Restore originals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert = origInsert;
    (globalThis as { fetch: typeof fetch }).fetch = prevFetch;
  }
});
