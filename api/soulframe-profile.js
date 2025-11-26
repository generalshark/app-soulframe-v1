// api/soulframe-profile.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { playerId } = req.query;

  if (!playerId || typeof playerId !== "string") {
    return res.status(400).json({ error: "Missing or invalid playerId" });
  }

  try {
    const targetUrl =
      "https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=" +
      encodeURIComponent(playerId);

    const response = await fetch(targetUrl, {
      // Node User-Agent
      headers: {
        "User-Agent":
          "Soulframe-Tracker/1.0 (soulframe-app.vercel.app; contact: DontFall)",
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    });

    const raw = await response.text();
    const trimmed = raw.trim();

    // Cas HTTP non OK côté Soulframe
    if (!response.ok) {
      if (/^no account/i.test(trimmed)) {
        // Cas classique "no account" → 404 pour le frontend
        return res.status(404).json({ error: trimmed });
      }

      return res
        .status(response.status || 502)
        .json({ error: `Soulframe API error: ${trimmed || response.status}` });
    }

    // Réponse 200 → on tente le JSON
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      if (/^no account/i.test(trimmed)) {
        return res.status(404).json({ error: trimmed });
      }

      console.error("Soulframe API – unexpected raw response:", trimmed);
      return res.status(502).json({
        error:
          "Unexpected response from Soulframe API (backend proxy). Please try again later.",
        raw: trimmed.slice(0, 500),
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(json);
  } catch (err) {
    console.error("Error while proxying Soulframe API:", err);
    return res.status(502).json({
      error: "Failed to contact Soulframe API from backend.",
    });
  }
}
