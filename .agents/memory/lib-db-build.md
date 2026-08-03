---
name: lib/db TypeScript composite build
description: Adding tables to lib/db requires manually rebuilding its type declarations before api-server typecheck passes.
---

**Rule:** Whenever `lib/db/src/schema/` is changed (new table, modified column), run `npx tsc -p lib/db/tsconfig.json` from the workspace root to regenerate `lib/db/dist/*.d.ts` before running `pnpm --filter @workspace/api-server run typecheck`.

**Why:** The api-server tsconfig uses TypeScript project references (`references: [{ path: "../../lib/db" }]`). TS resolves `@workspace/db` imports from `lib/db/dist/` (the compiled declarations), not from source. The dist files are stale until explicitly rebuilt. Without rebuilding, typecheck fails with `Module '"@workspace/db"' has no exported member '<newTable>'`.

**How to apply:** Any time a PR or agent task touches `lib/db/src/schema/`, include `npx tsc -p lib/db/tsconfig.json` in the build/verify steps. The `lib/db/package.json` has no `build` script yet — add one if this becomes a recurring pain.
