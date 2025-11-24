// api/accounts.js

// Même helper que dans register-account.js
async function kvCommand(command, ...args) {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    console.warn(
      "[KV] Missing KV_REST_API_URL or KV_REST_API_TOKEN – storage not configured"
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
  console.log("[accounts] incoming request", {
    method: req.method,
    query: req.query,
  });

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Liste des pseudos (set Redis)
    const names = await kvCommand("smembers", "accounts:index");

    if (!names || names.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Récupération des fiches
    const accounts = await Promise.all(
      names.map(async (name) => {
        let data = null;
        try {
          const json = await kvCommand(
            "get",
            `account:${String(name).toLowerCase()}`
          );
          if (json) data = JSON.parse(json);
        } catch (e) {
          console.warn("[accounts] failed to read/parse account", name, e);
        }

        return {
          accountName: data?.accountName || name,
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

