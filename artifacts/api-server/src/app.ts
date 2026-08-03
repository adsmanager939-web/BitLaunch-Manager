import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// The dashboard and API are both served through the Replit proxy on the same
// origin (same scheme + host + port). Same-origin requests carry cookies
// automatically; no credentialed CORS is required or granted.
//
// Public routes (BitLaunch proxy) use permissive CORS without credentials so
// they are reachable from the mobile app on a different origin.
// Session routes must ONLY be called from the same-origin dashboard — they are
// intentionally excluded from the credentialed CORS allowlist.
app.use(cors());

// Sign cookies with SESSION_SECRET so they can't be forged client-side.
// Passing undefined when SESSION_SECRET is absent means signed cookies are
// never issued (requireSessionAuth returns 503 before any cookie is set).
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
