// api/soulframe-profile.js
module.exports = async (req, res) => {
  // On ne permet que GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  // Récupération du playerId depuis la query
  const playerId =
    (req.query && (req.query.playerId || req.query.id)) || "";

  if (!playerId || typeof playerId !== "string") {
    res.status(400).json({ error: "Missing playerId query parameter" });
    return;
  }

  const trimmedId = playerId.trim();

  // Petit check basique : 24 caractères hex (format MongoId de Soulframe)
  if (!/^[0-9a-f]{24}$/i.test(trimmedId)) {
    res.status(400).json({ error: "Invalid playerId format" });
    return;
  }

  const upstreamUrl =
    "https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=" +
    encodeURIComponent(trimmedId);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "User-Agent": "SoulframeTracker/1.0 (soulframe-app.vercel.app)",
        "Accept": "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    const text = await upstreamRes.text();
    const trimmed = text.trim();

    // Cas typique "No account found" en texte
    if (upstreamRes.status === 404 || /^no account/i.test(trimmed)) {
      res.status(404).json({ error: "No account found for given playerId" });
      return;
    }

    if (!upstreamRes.ok) {
      res
        .status(502)
        .json({
          error: `Upstream Soulframe API error (HTTP ${upstreamRes.status})`,
        });
      return;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("Soulframe API invalid JSON:", err);
      res
        .status(502)
        .json({ error: "Soulframe API returned invalid JSON" });
      return;
    }

    // CORS permissif pour que l'on puisses appeler depuis n'importe où si besoin
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Petit cache côté edge
    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=120"
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Error calling Soulframe API:", error);
    res.status(502).json({ error: "Failed to contact Soulframe API" });
  }
};
