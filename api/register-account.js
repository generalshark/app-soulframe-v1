// api/register-account.js
export default async function handler(req, res) {
  console.log("[register-account] incoming request", {
    method: req.method,
    contentType: req.headers["content-type"],
  });

  // On n'accepte que le POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Récupération du body (suivant l'environnement Vercel, req.body peut
  // être déjà un objet ou une string JSON)
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

  // ⚠️ On ne prend plus PAS accountId ici
  const { accountName, accountCreated } = body || {};

  // Validation minimale
  if (!accountName) {
    console.warn("[register-account] missing accountName", {
      accountName,
      accountCreated,
    });
    res.status(400).json({ error: "Missing accountName" });
    return;
  }

  // v0 : on log juste dans les logs Vercel (sans ID)
  console.log("New account registered (no ID):", {
    accountName,
    accountCreated,
  });

  // TODO v1 : brancher un vrai stockage (KV / DB) si tu veux
  res.status(200).json({ ok: true });
}
