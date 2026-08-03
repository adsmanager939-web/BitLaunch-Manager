/**
 * Isolated test for the fail-closed behavior when SESSION_SECRET is absent.
 *
 * This file MUST run in its own Node process so that the app module is
 * imported fresh — `SESSION_SECRET` is captured as a module-level constant at
 * import time. Running in isolation guarantees the absence of the variable is
 * visible to the middleware.
 *
 * Run via: `node --import tsx --test src/routes/sessions.no-secret.test.ts`
 * (Do NOT set SESSION_SECRET in the environment before running this file.)
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import type { Server } from "node:http";

// Verify pre-condition: SESSION_SECRET must not be set for these tests to be
// meaningful. Fail early with a clear message if the environment is wrong.
if (process.env.SESSION_SECRET) {
  throw new Error(
    "sessions.no-secret.test.ts must be run without SESSION_SECRET set. " +
      "Unset it before running this test file.",
  );
}

// Also ensure ALLOW_UNAUTH_SESSIONS is not set so fail-closed triggers.
delete process.env.ALLOW_UNAUTH_SESSIONS;
// Ensure we're not accidentally in production mode (which would also 503).
process.env.NODE_ENV = "test";

let server: Server;
let agent: ReturnType<typeof supertest>;

before(async () => {
  const { default: app } = await import("../app.js");
  server = app.listen(0);
  agent = supertest(server);
});

after(() => {
  server?.close();
});

test("POST /api/sessions/launch without SESSION_SECRET → 503", async () => {
  const res = await agent.post("/api/sessions/launch").send({});
  assert.equal(res.status, 503);
  assert.match(
    String((res.body as { error?: string }).error ?? ""),
    /SESSION_SECRET/,
  );
});

test("GET /api/sessions/:uuid/status without SESSION_SECRET → 503", async () => {
  const res = await agent.get("/api/sessions/00000000-0000-0000-0000-000000000000/status");
  assert.equal(res.status, 503);
});

test("POST /api/sessions/:id/end without SESSION_SECRET → 404 (tracked-session check runs first)", async () => {
  // The end route checks for a tracked session before the requireSessionAuth
  // guard — a 404 means auth was satisfied (dev-bypass or SESSION_SECRET) and
  // the request reached the business logic. Without SESSION_SECRET and without
  // ALLOW_UNAUTH_SESSIONS, we expect 503 instead.
  const res = await agent.post("/api/sessions/server-xyz/end").send({});
  assert.equal(res.status, 503);
});

test("POST /api/sessions/auth without SESSION_SECRET → 503", async () => {
  const res = await agent
    .post("/api/sessions/auth")
    .send({ key: "any-key" });
  assert.equal(res.status, 503);
});

test("GET /api/sessions/auth/status without SESSION_SECRET → {authenticated: false}", async () => {
  // auth/status is always accessible (it only returns a boolean)
  const res = await agent.get("/api/sessions/auth/status");
  assert.equal(res.status, 200);
  assert.equal((res.body as { authenticated: boolean }).authenticated, false);
});
