// api/register-account.js
import { Redis } from "@upstash/redis";

// Petit helper pour créer le client Redis seulement si les env sont là
function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
    return null;
  }

  return new Redis({ url, token });
}

export default async function handler(req, res) {
  console.log("[register-account] incoming request", {
    method: req.method,
    contentType: req.headers["content-type"],
  });

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Récupération / parsing du body
  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = body ? JSON.parse(body) : {};
    } catch (e) {
      console.error("[register-account] invalid JSON body", e);
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { accountName, accountCreated } = body || {};

  // On ne stocke jamais d'accountId ici
  if (!accountName) {
    console.warn("[register-account] missing accountName", {
      accountName,
      accountCreated,
    });
    res.status(400).json({ error: "Missing accountName" });
    return;
  }

  // Essaie de créer un client Redis
  const redis = getRedisClient();

  // Si pas de Redis configuré → on log seulement, pas d'erreur 500
  if (!redis) {
    console.log("New account registered (no Redis configured, log only):", {
      accountName,
      accountCreated,
    });
    res.status(200).json({ ok: true, stored: false });
    return;
  }

  try {
    const now = new Date().toISOString();
    const key = `account:${accountName.toLowerCase()}`;
    const indexKey = "accounts:index";

    // On récupère les données existantes s'il y en a
    const existing = await redis.hgetall(key); // objet ou null

    const previousVisits = existing?.visitsCount
      ? Number(existing.visitsCount)
      : 0;

    const firstSeenAt = existing?.firstSeenAt || now;
    const storedAccountCreated =
      existing?.accountCreated || accountCreated || "";

    // Mise à jour du hash pour ce compte
    await redis.hset(key, {
      name: existing?.name || accountName,
      accountCreated: storedAccountCreated,
      firstSeenAt,
      lastSeenAt: now,
      visitsCount: previousVisits + 1,
    });

    // Ajoute ce pseudo dans le set d'index
    await redis.sadd(indexKey, accountName);

    console.log("New account registered (Redis stored):", {
      accountName,
      accountCreated: storedAccountCreated,
      firstSeenAt,
      lastSeenAt: now,
      visitsCount: previousVisits + 1,
    });

    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error("[register-account] error writing to Redis:", err);
    // fallback : on log quand même le passage du joueur
    console.log("New account registered (Redis error, log only):", {
      accountName,
      accountCreated,
    });
    res.status(200).json({ ok: true, stored: false });
  }
}
