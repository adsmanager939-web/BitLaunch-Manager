import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initSessionStore } from "./routes/sessions.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Restore active sessions from the database before accepting requests.
// Failures are logged and non-fatal — the server still starts with an
// empty in-memory store in the unlikely event the DB is unreachable.
await initSessionStore();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
