// api/register-account.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body = null;
  try {
    body = req.body ?? JSON.parse(req.body);
  } catch (e) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { accountId, accountName, accountCreated } = body || {};

  if (!accountId || !accountName) {
    res.status(400).json({ error: "Missing accountId or accountName" });
    return;
  }

  // 🔹 v0 : on log juste dans les logs Vercel (déjà utile pour toi)
  console.log("New account registered:", {
    accountId,
    accountName,
    accountCreated,
  });

  // 🔹 TODO v1 : ici tu brancheras un vrai stockage (Vercel KV, DB…)
  // ex: await kv.hset(`account:${accountId}`, { accountName, accountCreated });

  res.status(200).json({ ok: true });
}
