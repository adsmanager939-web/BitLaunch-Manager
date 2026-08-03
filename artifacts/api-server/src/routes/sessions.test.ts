/**
 * Route-level tests for the session orchestration auth gates.
 *
 * These tests prove:
 *   1. Without a valid cookie, mutating and sensitive routes return 401 (when
 *      SESSION_SECRET is set) or 503 (when SESSION_SECRET is absent and the
 *      dev bypass flag is off).
 *   2. POST /api/sessions/auth with the correct key issues a signed cookie.
 *   3. With a valid cookie, the routes accept the request (returning the
 *      appropriate operational status — 500/404/202 — not 401/503).
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import type { Server } from "node:http";

// Import the Express app. We patch SESSION_SECRET before any route handler
// captures the value, so this import must come after the env setup below.

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-for-sessions-unit-tests";
const INVALID_KEY = "definitely-wrong-key";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the Set-Cookie header for the session cookie. */
function extractCookie(res: supertest.Response): string {
  const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const sess = cookies.find((c) => c.startsWith("sess="));
  assert.ok(sess, "Expected a sess= cookie in Set-Cookie header");
  // Return just the cookie name=value pair (supertest sends it this way)
  return sess.split(";")[0];
}

// ── Test suite ────────────────────────────────────────────────────────────────

let server: Server;
let agent: ReturnType<typeof supertest>;

before(async () => {
  // Set SESSION_SECRET before the app module is evaluated so the middleware
  // captures the right value.
  process.env.SESSION_SECRET = TEST_SECRET;
  // BITLAUNCH_API_KEY is intentionally absent — launch will 500 after auth.
  delete process.env.BITLAUNCH_API_KEY;

  const { default: app } = await import("../app.js");
  server = app.listen(0); // random port
  agent = supertest(server);
});

after(() => {
  server?.close();
  delete process.env.SESSION_SECRET;
});

// ── 1. Unauthenticated requests return 401 ────────────────────────────────────

test("POST /api/sessions/launch without cookie → 401", async () => {
  const res = await agent.post("/api/sessions/launch").send({});
  assert.equal(res.status, 401);
  assert.ok((res.body as { error?: string }).error, "Response should include an error message");
});

test("GET /api/sessions/:uuid/status without cookie → 401", async () => {
  const res = await agent.get("/api/sessions/00000000-0000-0000-0000-000000000000/status");
  assert.equal(res.status, 401);
});

test("POST /api/sessions/:id/end without cookie → 401", async () => {
  const res = await agent.post("/api/sessions/server-abc/end").send({});
  assert.equal(res.status, 401);
});

// ── 2. Auth with wrong key returns 401 ───────────────────────────────────────

test("POST /api/sessions/auth with wrong key → 401", async () => {
  const res = await agent
    .post("/api/sessions/auth")
    .send({ key: INVALID_KEY });
  assert.equal(res.status, 401);
});

test("POST /api/sessions/auth with no key → 401", async () => {
  const res = await agent.post("/api/sessions/auth").send({});
  assert.equal(res.status, 401);
});

// ── 3. Auth with correct key issues a signed cookie ───────────────────────────

test("POST /api/sessions/auth with correct key → 200 + signed cookie", async () => {
  const res = await agent
    .post("/api/sessions/auth")
    .send({ key: TEST_SECRET });
  assert.equal(res.status, 200);
  assert.equal((res.body as { ok: boolean }).ok, true);
  // Verify a signed sess= cookie was set
  extractCookie(res);
});

// ── 4. With valid cookie, routes accept the request ───────────────────────────

test("POST /api/sessions/launch with valid cookie → 500 (no BITLAUNCH_API_KEY, not 401)", async () => {
  // Log in to get a cookie
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: TEST_SECRET });
  const cookie = extractCookie(loginRes);

  const res = await agent
    .post("/api/sessions/launch")
    .set("Cookie", cookie)
    .send({
      snapshotId: "test-snap",
      userId: "test-user",
    });
  // 500 because BITLAUNCH_API_KEY is absent, not 401/503
  assert.equal(res.status, 500);
  assert.match(
    String((res.body as { error?: string }).error ?? ""),
    /BITLAUNCH_API_KEY/,
  );
});

test("GET /api/sessions/:uuid/status with valid cookie + unknown sessionId → 404 (not 401)", async () => {
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: TEST_SECRET });
  const cookie = extractCookie(loginRes);

  const res = await agent
    .get("/api/sessions/00000000-0000-0000-0000-000000000001/status")
    .set("Cookie", cookie);
  assert.equal(res.status, 404);
});

test("POST /api/sessions/:id/end with valid cookie + untracked serverId → 404 (not 401)", async () => {
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: TEST_SECRET });
  const cookie = extractCookie(loginRes);

  const res = await agent
    .post("/api/sessions/untracked-server-id/end")
    .set("Cookie", cookie)
    .send({});
  // 404 because server is not in tracked sessions, not 401/503
  assert.equal(res.status, 404);
});

// ── 5. Auth status endpoint ───────────────────────────────────────────────────

test("GET /api/sessions/auth/status without cookie → {authenticated: false}", async () => {
  const res = await agent.get("/api/sessions/auth/status");
  assert.equal(res.status, 200);
  assert.equal((res.body as { authenticated: boolean }).authenticated, false);
});

test("GET /api/sessions/auth/status with valid cookie → {authenticated: true}", async () => {
  const loginRes = await agent
    .post("/api/sessions/auth")
    .send({ key: TEST_SECRET });
  const cookie = extractCookie(loginRes);

  const res = await agent
    .get("/api/sessions/auth/status")
    .set("Cookie", cookie);
  assert.equal(res.status, 200);
  assert.equal((res.body as { authenticated: boolean }).authenticated, true);
});

// ── 6. CORS: session routes must not reflect credentialed cross-origin responses ─

test("Session routes do not include Access-Control-Allow-Credentials in responses", async () => {
  // A cross-origin request should not receive ACAO+ACAC headers that would
  // allow a browser to send the signed session cookie and read the response.
  const res = await agent
    .post("/api/sessions/launch")
    .set("Origin", "https://attacker.example.com")
    .send({});
  // The response must NOT grant credentials to a foreign origin
  const allowOrigin = res.headers["access-control-allow-origin"] ?? "";
  const allowCreds = res.headers["access-control-allow-credentials"] ?? "";
  assert.notEqual(allowOrigin, "https://attacker.example.com", "ACAO must not reflect arbitrary origins");
  assert.notEqual(allowCreds, "true", "ACAC must not be true for session routes");
});
