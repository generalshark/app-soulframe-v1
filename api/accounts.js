// s api/accounts.js
function getRedisClient() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn(
      "[redis] Missing URL or token (UPSTASH_REDIS_REST_* or KV_REST_API_*)"
    );
    return null;
  }

  return new Redis({ url, token });
}


export default async function handler(req, res) {
  console.log("[accounts] incoming request", {
    method: req.method,
    query: req.query,
  });

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const redis = getRedisClient();

  if (!redis) {
    // Ici on signale clairement que le stockage n'est pas configuré
    res.status(500).json({ error: "Redis storage not configured" });
    return;
  }

  try {
    // Liste des pseudos
    const names = await redis.smembers("accounts:index");

    if (!names || names.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Récupère les infos pour chaque pseudo
    const accounts = await Promise.all(
      names.map(async (name) => {
        const data = await redis.hgetall(`account:${name.toLowerCase()}`);
        return {
          accountName: data?.name || name,
          accountCreated: data?.accountCreated || null,
          firstSeenAt: data?.firstSeenAt || null,
          lastSeenAt: data?.lastSeenAt || null,
          visitsCount: data?.visitsCount ? Number(data.visitsCount) : 0,
        };
      })
    );

    const format = (req.query?.format || "json").toString().toLowerCase();

    if (format === "csv") {
      const header =
        "accountName,accountCreated,firstSeenAt,lastSeenAt,visitsCount\n";

      const rows = accounts
        .map((a) => {
          const vals = [
            a.accountName,
            a.accountCreated,
            a.firstSeenAt,
            a.lastSeenAt,
            a.visitsCount,
          ].map((v) =>
            `"${String(v ?? "")
              .replace(/"/g, '""')
              .replace(/\r?\n/g, " ")}"`
          );
          return vals.join(",");
        })
        .join("\n");

      const csv = header + rows;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="accounts.csv"'
      );
      res.status(200).send(csv);
    } else {
      res.status(200).json(accounts);
    }
  } catch (err) {
    console.error("[accounts] error while listing accounts:", err);
    res.status(500).json({ error: "Failed to list accounts" });
  }
}
