// api/soulframe-profile.js
const SOULFRAME_API_BASE =
  "https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=";

export default async function handler(req, res) {
  // Autoriser uniquement GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).send("Method Not Allowed");
    return;
  }

  const playerId =
    (req.query && typeof req.query.playerId === "string"
      ? req.query.playerId
      : "") || "";

  if (!playerId) {
    res.status(400).send("Missing playerId query parameter");
    return;
  }

  const trimmedId = playerId.trim();
  const targetUrl = SOULFRAME_API_BASE + encodeURIComponent(trimmedId);

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "SoulframeTracker/1.0 (soulframe-app.vercel.app)",
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    const bodyText = await upstream.text();
    const preview = bodyText.trim().slice(0, 400);

    console.log(
      "[SF Proxy] upstream status:",
      upstream.status,
      "| preview:",
      preview
    );

    // Forward EXACTEMENT le status + le body de Soulframe
    res.status(upstream.status).send(bodyText || "");
  } catch (err) {
    console.error("[SF Proxy] unexpected error:", err);
    res
      .status(500)
      .send("Proxy error while contacting Soulframe API: " + (err?.message || String(err)));
  }
}
