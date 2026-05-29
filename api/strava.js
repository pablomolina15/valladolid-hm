export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "https://valladolid-hm-zuqu.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action, code, access_token } = req.method === "POST"
    ? req.body
    : req.query;

  const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
  const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

  // --- Intercambiar code por token ---
  if (action === "token") {
    try {
      const r = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Refrescar token ---
  if (action === "refresh") {
    const { refresh_token } = req.method === "POST" ? req.body : req.query;
    try {
      const r = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token,
          grant_type: "refresh_token",
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Obtener actividades ---
  if (action === "activities") {
    try {
      // Actividades desde 1 junio 2026
      const after = Math.floor(new Date("2026-06-01").getTime() / 1000);
      const r = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: "Acción no válida" });
}
