// api/soulframe-profile.js
const SOULFRAME_API_BASE =
  "https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=";

export default async function handler(req, res) {
  try {
    // On accepte uniquement GET
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const playerId =
      (req.query && typeof req.query.playerId === "string"
        ? req.query.playerId
        : "") || "";

    if (!playerId) {
      res.status(400).json({ error: "Missing playerId query parameter" });
      return;
    }

    const trimmedId = playerId.trim();
    const targetUrl = SOULFRAME_API_BASE + encodeURIComponent(trimmedId);

    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "SoulframeTracker/1.0 (soulframe-app.vercel.app)",
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    const bodyText = await upstream.text();
    const trimmed = bodyText.trim();

    // Cas typique "no account"
    if (upstream.status === 404 || /^no account/i.test(trimmed)) {
      res.status(404).send(trimmed);
      return;
    }

    // Autres erreurs côté Soulframe
    if (!upstream.ok) {
      res
        .status(502)
        .send(
          `Upstream Soulframe API error (HTTP ${
            upstream.status
          }): ${trimmed.slice(0, 200)}`
        );
      return;
    }

    // OK → on renvoie le JSON brut
    res.setHeader("Content-Type", "application/json");
    res.status(200).send(bodyText);
  } catch (err) {
    console.error("Unexpected error in /api/soulframe-profile:", err);
    res
      .status(502)
      .json({ error: "Internal proxy error while contacting Soulframe API" });
  }
}
