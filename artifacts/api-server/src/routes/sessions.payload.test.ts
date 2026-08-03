/**
 * Integration test for the BitLaunch server-creation payload.
 *
 * Verifies that POST /api/sessions/launch sends the correct field names to the
 * BitLaunch API (`image`, not `snapshotId`) by intercepting globalThis.fetch
 * before the app module is loaded so the module-level constants are correct.
 *
 * Requires SESSION_SECRET and BITLAUNCH_API_KEY to be set in the environment
 * before Node starts (see the `test` script in package.json).
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import type { Server } from "node:http";

if (!process.env.SESSION_SECRET) {
  throw new Error("sessions.payload.test.ts requires SESSION_SECRET to be set");
}
if (!process.env.BITLAUNCH_API_KEY) {
  throw new Error("sessions.payload.test.ts requires BITLAUNCH_API_KEY to be set");
}

// ── Mock fetch ────────────────────────────────────────────────────────────────
// Intercept BitLaunch API calls before the app module loads so the module-level
// `BITLAUNCH_API_KEY` constant is in place and the routes actually call fetch.

interface CapturedCall {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

let capturedCalls: CapturedCall[] = [];

// Deferred promise that resolves when the POST /servers call is intercepted.
let resolveServerCreated!: (call: CapturedCall) => void;
const serverCreated = new Promise<CapturedCall>((resolve) => {
  resolveServerCreated = resolve;
});

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
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  let body: Record<string, unknown> | null = null;
  if (init?.body && typeof init.body === "string") {
    body = JSON.parse(init.body) as Record<string, unknown>;
  }

  const call: CapturedCall = { url, method, body };
  capturedCalls.push(call);

  if (url.includes("api.bitlaunch.io")) {
    // POST /servers — server creation
    if (method === "POST" && url.endsWith("/servers")) {
      resolveServerCreated(call);
      return new Response(
        JSON.stringify({ id: "mocked-srv-001", status: "new", name: "test-server" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // GET /servers/:id — poll for active status (return active immediately to avoid 10s wait)
    if (method === "GET" && url.match(/\/servers\/[^/]+$/)) {
      return new Response(
        JSON.stringify({ id: "mocked-srv-001", status: "active", ip: "1.2.3.4" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Fallback: 404 so the orchestration fails fast for unknown endpoints
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }

  // Non-BitLaunch requests (e.g. WireGuard host) — skip; env vars are absent
  return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
};

// ── Server setup ──────────────────────────────────────────────────────────────

let server: Server;
let agent: ReturnType<typeof supertest>;

before(async () => {
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  agent = supertest(server);
});

after(() => {
  server?.close();
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("POST /api/sessions/launch sends image (not snapshotId) in the BitLaunch server creation payload", async () => {
  // Authenticate
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: process.env.SESSION_SECRET });
  assert.equal(loginRes.status, 200, "Login should succeed");
  const setCookie = loginRes.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith("sess="))?.split(";")[0] ?? "";
  assert.ok(cookie, "Expected a session cookie after login");

  // Launch a session
  const launchRes = await agent
    .post("/api/sessions/launch")
    .set("Cookie", cookie)
    .send({
      snapshotId: "snap-98765",
      userId: "user-42",
      serverName: "payload-test-server",
      region: "ams3",
      plan: "s-1vcpu-2gb",
      provider: "digitalocean",
    });
  assert.equal(launchRes.status, 202, "Launch should be accepted (202)");
  assert.ok(launchRes.body.sessionId, "Response should include a sessionId");

  // Wait for the async BitLaunch POST /servers call (max 5 seconds)
  const creationCall = await Promise.race([
    serverCreated,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for BitLaunch API call")), 5_000),
    ),
  ]);

  // ── Payload assertions ────────────────────────────────────────────────────
  assert.ok(creationCall.url.endsWith("/servers"), `Expected call to /servers, got ${creationCall.url}`);
  assert.equal(creationCall.method, "POST");
  assert.ok(creationCall.body, "Expected a request body");

  // The field must be `image`, not `snapshotId` — this matches the BitLaunch API contract.
  assert.equal(
    creationCall.body.image,
    "snap-98765",
    "image field must equal the provided snapshotId",
  );
  assert.equal(creationCall.body.name, "payload-test-server");
  assert.equal(creationCall.body.region, "ams3");
  assert.equal(creationCall.body.plan, "s-1vcpu-2gb");
  assert.equal(creationCall.body.provider, "digitalocean");

  // `snapshotId` must NOT appear as a field name in the outgoing payload
  assert.equal(
    creationCall.body.snapshotId,
    undefined,
    "snapshotId must not be forwarded as-is — BitLaunch uses 'image'",
  );
});
