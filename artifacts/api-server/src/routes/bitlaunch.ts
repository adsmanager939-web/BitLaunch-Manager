import { Router, type IRouter } from "express";
import {
  GetBitlaunchAccountResponse,
  GetBitlaunchSummaryResponse,
  GetBitlaunchServerParams,
  GetBitlaunchServerResponse,
  CreateBitlaunchServerBody,
  CreateBitlaunchServerResponse,
  DestroyBitlaunchServerParams,
  RebootBitlaunchServerParams,
  RebootBitlaunchServerResponse,
  CreateBitlaunchSnapshotParams,
  CreateBitlaunchSnapshotBody,
  CreateBitlaunchSnapshotResponse,
  GetBitlaunchImageParams,
  GetBitlaunchImageResponse,
  ListBitlaunchImagesResponse,
  ListBitlaunchServersResponse,
  ListBitlaunchVolumesResponse,
} from "@workspace/api-zod";

const BITLAUNCH_API_KEY = process.env.BITLAUNCH_API_KEY;
const BASE_URL = "https://api.bitlaunch.io/v1";

function bitlaunchHeaders() {
  return {
    Authorization: `Bearer ${BITLAUNCH_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function bitlaunchRequest(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: bitlaunchHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (method === "DELETE" && res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BitLaunch API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function bitlaunchFetch(path: string): Promise<unknown> {
  return bitlaunchRequest(path, "GET");
}

/** Normalize raw BitLaunch server object to our schema */
function normalizeServer(s: Record<string, unknown>) {
  return {
    id: s.id ?? null,
    name: s.name ?? null,
    status: s.status ?? null,
    ip: s.ip ?? s.ipv4 ?? null,
    region: s.region ?? s.location ?? null,
    size: s.size ?? s.plan ?? null,
    image: s.image ?? s.os ?? null,
    createdAt: s.created_at ?? s.createdAt ?? null,
    costPerHour:
      typeof s.cost_per_hour === "number"
        ? s.cost_per_hour
        : typeof s.hourly_price === "number"
          ? s.hourly_price
          : null,
  };
}

/** Normalize raw BitLaunch image object */
function normalizeImage(img: Record<string, unknown>) {
  return {
    id: img.id ?? null,
    name: img.name ?? null,
    distribution: img.distribution ?? img.distro ?? null,
    type: img.type ?? null,
    status: img.status ?? null,
    sizeGb:
      typeof img.size_gb === "number"
        ? img.size_gb
        : typeof img.size === "number"
          ? img.size
          : null,
  };
}

/** Normalize raw BitLaunch volume object */
function normalizeVolume(v: Record<string, unknown>) {
  return {
    id: v.id ?? null,
    name: v.name ?? null,
    status: v.status ?? null,
    sizeGb:
      typeof v.size_gb === "number"
        ? v.size_gb
        : typeof v.size === "number"
          ? v.size
          : null,
    region: v.region ?? v.location ?? null,
    attachedTo: v.attached_to ?? v.server_id ?? null,
    createdAt: v.created_at ?? v.createdAt ?? null,
  };
}

/** Normalize raw account object */
function normalizeAccount(a: Record<string, unknown>) {
  return {
    email: a.email ?? null,
    balance:
      typeof a.balance === "number"
        ? a.balance
        : typeof a.credit === "number"
          ? a.credit
          : null,
    currency: a.currency ?? null,
    status: a.status ?? null,
  };
}

const router: IRouter = Router();

router.get("/bitlaunch/account", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  try {
    const raw = (await bitlaunchFetch("/account")) as Record<string, unknown>;
    res.json(GetBitlaunchAccountResponse.parse(normalizeAccount(raw)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch account");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/servers", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  try {
    const raw = (await bitlaunchFetch("/servers")) as unknown[];
    const servers = Array.isArray(raw)
      ? raw.map((s) => normalizeServer(s as Record<string, unknown>))
      : [];
    res.json(ListBitlaunchServersResponse.parse(servers));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch servers");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/servers/:id", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const params = GetBitlaunchServerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const raw = (await bitlaunchFetch(
      `/servers/${params.data.id}`,
    )) as Record<string, unknown>;
    res.json(GetBitlaunchServerResponse.parse(normalizeServer(raw)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch server");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/bitlaunch/servers", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const body = CreateBitlaunchServerBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const raw = (await bitlaunchRequest("/servers", "POST", body.data)) as Record<string, unknown>;
    res.status(201).json(CreateBitlaunchServerResponse.parse(normalizeServer(raw)));
  } catch (err) {
    req.log.error({ err }, "Failed to create BitLaunch server");
    res.status(500).json({ error: String(err) });
  }
});

router.delete("/bitlaunch/servers/:id", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const params = DestroyBitlaunchServerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    await bitlaunchRequest(`/servers/${params.data.id}`, "DELETE");
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Failed to destroy BitLaunch server");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/bitlaunch/servers/:id/reboot", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const params = RebootBitlaunchServerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const raw = (await bitlaunchRequest(`/servers/${params.data.id}/reboot`, "POST")) as Record<string, unknown>;
    res.json(RebootBitlaunchServerResponse.parse(normalizeServer(raw ?? {})));
  } catch (err) {
    req.log.error({ err }, "Failed to reboot BitLaunch server");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/bitlaunch/servers/:id/snapshot", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const params = CreateBitlaunchSnapshotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateBitlaunchSnapshotBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    const raw = (await bitlaunchRequest(
      `/servers/${params.data.id}/snapshot`,
      "POST",
      { name: body.data.name },
    )) as Record<string, unknown>;
    res.json(CreateBitlaunchSnapshotResponse.parse(normalizeImage(raw)));
  } catch (err) {
    req.log.error({ err }, "Failed to create BitLaunch snapshot");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/images/:id", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  const params = GetBitlaunchImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const raw = (await bitlaunchFetch(`/images/${params.data.id}`)) as Record<string, unknown>;
    res.json(GetBitlaunchImageResponse.parse(normalizeImage(raw)));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch image");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/images", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  try {
    const raw = (await bitlaunchFetch("/images")) as unknown[];
    const images = Array.isArray(raw)
      ? raw.map((img) => normalizeImage(img as Record<string, unknown>))
      : [];
    res.json(ListBitlaunchImagesResponse.parse(images));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch images");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/volumes", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  try {
    const raw = (await bitlaunchFetch("/volumes")) as unknown[];
    const volumes = Array.isArray(raw)
      ? raw.map((v) => normalizeVolume(v as Record<string, unknown>))
      : [];
    res.json(ListBitlaunchVolumesResponse.parse(volumes));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch volumes");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/bitlaunch/summary", async (req, res): Promise<void> => {
  if (!BITLAUNCH_API_KEY) {
    res.status(500).json({ error: "BITLAUNCH_API_KEY is not configured" });
    return;
  }
  try {
    const [rawAccount, rawServers, rawImages, rawVolumes] = await Promise.all([
      bitlaunchFetch("/account") as Promise<Record<string, unknown>>,
      bitlaunchFetch("/servers") as Promise<unknown[]>,
      bitlaunchFetch("/images") as Promise<unknown[]>,
      bitlaunchFetch("/volumes") as Promise<unknown[]>,
    ]);

    const summary = {
      account: normalizeAccount(rawAccount),
      serverCount: Array.isArray(rawServers) ? rawServers.length : 0,
      imageCount: Array.isArray(rawImages) ? rawImages.length : 0,
      volumeCount: Array.isArray(rawVolumes) ? rawVolumes.length : 0,
    };
    res.json(GetBitlaunchSummaryResponse.parse(summary));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch BitLaunch summary");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
