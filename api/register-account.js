// api/register-account.js

// Petit helper générique pour appeler Upstash KV via REST
async function kvCommand(command, ...args) {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    console.warn(
      "[KV] Missing KV_REST_API_URL or KV_REST_API_TOKEN – skipping storage"
    );
    return null;
  }

  const path = [command, ...args]
    .map((part) => encodeURIComponent(String(part)))
    .join("/");

  const url = `${baseUrl}/${path}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[KV] HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.result;
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

  // Parse du body
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

  // On ne gère jamais d'accountId ici (donnée sensible)
  if (!accountName) {
    console.warn("[register-account] missing accountName", {
      accountName,
      accountCreated,
    });
    res.status(400).json({ error: "Missing accountName" });
    return;
  }

  const now = new Date().toISOString();
  const key = `account:${accountName.toLowerCase()}`;
  const indexKey = "accounts:index";

  try {
    // --- Lecture éventuelle de la fiche existante ---
    let existing = null;
    try {
      const existingJson = await kvCommand("get", key);
      if (existingJson) {
        existing = JSON.parse(existingJson);
      }
    } catch (e) {
      console.warn("[register-account] unable to read existing data from KV", e);
    }

    const previousVisits = existing?.visitsCount
      ? Number(existing.visitsCount)
      : 0;

    const firstSeenAt = existing?.firstSeenAt || now;
    const storedAccountCreated =
      existing?.accountCreated || accountCreated || "";

    const accountData = {
      accountName,
      accountCreated: storedAccountCreated,
      firstSeenAt,
      lastSeenAt: now,
      visitsCount: previousVisits + 1,
    };

    // --- Écriture dans KV (SET + SADD index) ---
    try {
      await kvCommand("set", key, JSON.stringify(accountData));
      await kvCommand("sadd", indexKey, accountName);
    } catch (e) {
      console.error("[register-account] error writing to KV", e);
      // On log quand même, mais on ne casse pas le front
      console.log("New account (KV write failed, log only):", accountData);
      res.status(200).json({ ok: true, stored: false });
      return;
    }

    console.log("New account registered (KV stored):", accountData);

    res.status(200).json({ ok: true, stored: true });
  } catch (err) {
    console.error("[register-account] unexpected error:", err);
    // On évite de bloquer le front : on renvoie quand même 200
    res.status(200).json({ ok: true, stored: false });
  }
}

