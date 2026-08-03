#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply pending migrations from the committed migration files.
# drizzle-kit migrate is additive-only and never drops existing data.
pnpm --filter @workspace/db run migrate
