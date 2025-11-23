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

  const { accountId, accountName, accountCreated } = body || {};

  // Validation minimale
  if (!accountId || !accountName) {
    console.warn("[register-account] missing required fields", {
      accountId,
      accountName,
      accountCreated,
    });
    res.status(400).json({ error: "Missing accountId or accountName" });
    return;
  }

  // v0 : on log juste dans Vercel (c’est ton "fichier" pour l’instant)
  console.log("New account registered:", {
    accountId,
    accountName,
    accountCreated,
  });

  // plus tard : ici on branchera un vrai stockage (KV / DB / etc.)
  res.status(200).json({ ok: true });
}
