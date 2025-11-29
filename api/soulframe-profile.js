// api/soulframe-profile.js

export default async function handler(req, res) {
  // On accepte seulement GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method Not Allowed");
    return;
  }

  // Récupération du playerId depuis la query
  const playerId =
    (req.query && typeof req.query.playerId === "string"
      ? req.query.playerId
      : "") || "";

  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
    return;
  }

  const trimmedId = playerId.trim();

  // URL réelle Soulframe
  const targetUrl = `https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=${encodeURIComponent(
    trimmedId
  )}`;

  // Token PRO cors.lol venu des variables d'env Vercel
  const token = process.env.CORSLOL_TOKEN;
  if (!token) {
    console.error("[soulframe-profile] Missing CORSLOL_TOKEN env var");
    res.status(500).json({ error: "Server misconfigured (no token)" });
    return;
  }

  // On passe par le endpoint PRO cors.lol
  const corsUrl = `https://pro.cors.lol/?url=${encodeURIComponent(
    targetUrl
  )}&token=${token}`;

  try {
    const upstream = await fetch(corsUrl);
    const bodyText = await upstream.text();
    const preview = bodyText.trim().slice(0, 400);

    console.log(
      "[soulframe-profile] upstream status:",
      upstream.status,
      "| preview:",
      preview
    );

    // On forward EXACTEMENT status + body
    res.status(upstream.status).send(bodyText || "");
  } catch (err) {
    console.error("[soulframe-profile] Proxy error:", err);
    res
      .status(500)
      .json({ error: "Proxy error while contacting Soulframe API" });
  }
}
