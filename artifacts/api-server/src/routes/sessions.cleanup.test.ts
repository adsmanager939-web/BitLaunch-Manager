/**
 * Compensating-cleanup tests: verifies that when a session launch fails after
 * a server has been created, the server is automatically destroyed.
 *
 * Two scenarios are covered:
 *   1. WireGuard registration fails  → server created but WG fails → server destroyed
 *   2. Poll timeout                  → server created but never active → server destroyed
 *
 * Requires SESSION_SECRET, BITLAUNCH_API_KEY, WG_SERVER_HOST, and WG_SERVER_API_KEY
 * to be set in the environment (see test script in package.json).
 * POLL_MAX_ATTEMPTS=2 and POLL_INTERVAL_MS=50 are set here so timeouts
 * happen in milliseconds, not minutes.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import type { Server } from "node:http";

if (!process.env.SESSION_SECRET) {
  throw new Error("sessions.cleanup.test.ts requires SESSION_SECRET");
}
if (!process.env.BITLAUNCH_API_KEY) {
  throw new Error("sessions.cleanup.test.ts requires BITLAUNCH_API_KEY");
}
if (!process.env.WG_SERVER_HOST) {
  throw new Error("sessions.cleanup.test.ts requires WG_SERVER_HOST");
}

// Short poll settings so timeout tests complete in ~200ms instead of 10 minutes
process.env.POLL_MAX_ATTEMPTS = "2";
process.env.POLL_INTERVAL_MS = "50";

// ── Mock fetch ────────────────────────────────────────────────────────────────

interface CallRecord {
  url: string;
  method: string;
  body?: Record<string, unknown>;
}

type MockScenario = "wg_failure" | "poll_timeout";
let scenario: MockScenario = "wg_failure";

const calls: CallRecord[] = [];

const originalFetch = globalThis.fetch;

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
  let body: Record<string, unknown> | undefined;
  if (init?.body && typeof init.body === "string") {
    body = JSON.parse(init.body) as Record<string, unknown>;
  }
  calls.push({ url, method, body });

  const wgHost = process.env.WG_SERVER_HOST ?? "";

  // ── BitLaunch ──────────────────────────────────────────────────────────────
  if (url.includes("api.bitlaunch.io")) {
    if (method === "POST" && url.endsWith("/servers")) {
      return new Response(
        JSON.stringify({ id: "cleanup-srv-001", status: "new", name: "test" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (method === "GET" && url.match(/\/servers\/cleanup-srv-001$/)) {
      if (scenario === "poll_timeout") {
        // Never return active — triggers timeout after POLL_MAX_ATTEMPTS attempts
        return new Response(
          JSON.stringify({ id: "cleanup-srv-001", status: "new" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      // For wg_failure, return active so we reach the WG step
      return new Response(
        JSON.stringify({ id: "cleanup-srv-001", status: "active", ip: "1.2.3.4" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (method === "DELETE" && url.includes("cleanup-srv-001")) {
      return new Response(null, { status: 204 });
    }
  }

  // ── WireGuard server ───────────────────────────────────────────────────────
  if (wgHost && url.startsWith(wgHost)) {
    if (method === "POST" && url.endsWith("/peers")) {
      // Always fail for wg_failure scenario
      return new Response(JSON.stringify({ error: "wg error" }), { status: 500 });
    }
  }

  // Anything else: 404
  return new Response(JSON.stringify({ error: "not mocked" }), { status: 404 });
};

// ── Server setup ──────────────────────────────────────────────────────────────

let server: Server;
let agent: ReturnType<typeof supertest>;
let sessionCookie = "";

before(async () => {
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  agent = supertest(server);

  // Authenticate once
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: process.env.SESSION_SECRET });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  sessionCookie = cookies.find((c) => c.startsWith("sess="))?.split(";")[0] ?? "";
  assert.ok(sessionCookie, "Expected a session cookie after login");
});

after(() => {
  server?.close();
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

// ── Helper: poll session status until terminal ────────────────────────────────

async function waitForTerminal(sessionId: string, timeoutMs = 5_000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await agent
      .get(`/api/sessions/${sessionId}/status`)
      .set("Cookie", sessionCookie);
    const body = res.body as Record<string, unknown>;
    const phase = body.phase as string;
    if (["ready", "done", "error"].includes(phase)) return body;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Session ${sessionId} did not reach a terminal phase within ${timeoutMs}ms`);
}

// ── Test 1: WireGuard failure → server destroyed ──────────────────────────────

test("WireGuard registration failure triggers compensating cleanup (server destroyed)", async () => {
  scenario = "wg_failure";
  calls.length = 0; // reset recorded calls

  const launchRes = await agent
    .post("/api/sessions/launch")
    .set("Cookie", sessionCookie)
    .send({
      snapshotId: "snap-cleanup-wg",
      userId: "user-42",
      serverName: "cleanup-test-wg",
      region: "nyc1",
      plan: "s-1vcpu-2gb",
      provider: "digitalocean",
    });
  assert.equal(launchRes.status, 202, "Launch should return 202");
  const { sessionId } = launchRes.body as { sessionId: string };

  const statusBody = await waitForTerminal(sessionId);
  assert.equal(statusBody.phase, "error", "Session must end in error phase");
  assert.equal(statusBody.serverId, null, "serverId must be null after cleanup");

  const steps = statusBody.steps as string[];
  assert.ok(
    steps.includes("cleanup_server_destroyed"),
    `Expected cleanup_server_destroyed in steps; got: ${steps.join(", ")}`,
  );

  // Verify DELETE /servers/cleanup-srv-001 was actually called
  const deleteCall = calls.find(
    (c) => c.method === "DELETE" && c.url.includes("cleanup-srv-001"),
  );
  assert.ok(deleteCall, "DELETE /servers/cleanup-srv-001 must have been called for cleanup");
});

// ── Test 2: Poll timeout → server destroyed ───────────────────────────────────

test("Poll timeout triggers compensating cleanup (server destroyed)", async () => {
  scenario = "poll_timeout";
  calls.length = 0; // reset recorded calls

  const launchRes = await agent
    .post("/api/sessions/launch")
    .set("Cookie", sessionCookie)
    .send({
      snapshotId: "snap-cleanup-poll",
      userId: "user-43",
      serverName: "cleanup-test-poll",
      region: "nyc1",
      plan: "s-1vcpu-2gb",
      provider: "digitalocean",
    });
  assert.equal(launchRes.status, 202, "Launch should return 202");
  const { sessionId } = launchRes.body as { sessionId: string };

  // Poll max_attempts=2 * interval=50ms + tolerance → terminal within ~1 second
  const statusBody = await waitForTerminal(sessionId, 3_000);
  assert.equal(statusBody.phase, "error", "Session must end in error phase after timeout");
  assert.equal(statusBody.serverId, null, "serverId must be null after cleanup");

  const steps = statusBody.steps as string[];
  assert.ok(
    steps.includes("cleanup_server_destroyed"),
    `Expected cleanup_server_destroyed in steps; got: ${steps.join(", ")}`,
  );

  // Verify DELETE was called for the orphaned server
  const deleteCall = calls.find(
    (c) => c.method === "DELETE" && c.url.includes("cleanup-srv-001"),
  );
  assert.ok(deleteCall, "DELETE /servers/cleanup-srv-001 must have been called for cleanup");
});
