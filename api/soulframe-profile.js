// api/soulframe-profile.js
const SOULFRAME_API_BASE =
  "https://api.soulframe.com/cdn/getProfileViewingData.php?playerId=";

// User-Agent proche de ton Chrome actuel
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

export default async function handler(req, res) {
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
        "User-Agent": BROWSER_UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
        "Referer": "https://www.soulframe.com/",
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

    // On forward EXACTEMENT status + body de Soulframe
    res.status(upstream.status).send(bodyText || "");
  } catch (err) {
    console.error("[SF Proxy] unexpected error:", err);
    res
      .status(500)
      .send(
        "Proxy error while contacting Soulframe API: " +
          (err?.message || String(err))
      );
  }
}
