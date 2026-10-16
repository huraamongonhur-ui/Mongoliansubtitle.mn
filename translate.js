api/
// Vercel serverless function: API key зөвхөн энд (серверт) хадгалагдана.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });
  }

  const texts = req.body && req.body.texts;
  const valid =
    Array.isArray(texts) &&
    texts.length > 0 &&
    texts.length <= 10 &&
    texts.every((t) => typeof t === "string" && t.length <= 500);
  if (!valid) {
    return res.status(400).json({ error: "bad input" });
  }

  const prompt =
    "Translate these anime subtitle lines into natural spoken Mongolian (Cyrillic). " +
    "Keep the same order. Keep line breaks (\\n) where they are. " +
    "Keep formatting tags such as <i> and {\\an8} unchanged. Keep character names consistent. " +
    "Return ONLY a JSON array of strings with exactly " + texts.length + " items, no other text.\n\n" +
    JSON.stringify(texts);

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: "upstream unreachable" });
  }
  if (!upstream.ok) {
    return res.status(502).json({ error: "upstream " + upstream.status });
  }

  const data = await upstream.json();
  const raw = (data.content || []).map((c) => (c.type === "text" ? c.text : "")).join("");
  const s = raw.indexOf("[");
  const e = raw.lastIndexOf("]");
  try {
    const arr = JSON.parse(raw.slice(s, e + 1));
    if (Array.isArray(arr) && arr.length === texts.length) {
      return res.status(200).json({ translations: arr.map(String) });
    }
  } catch (_) {}
  return res.status(422).json({ error: "bad model output" });
};
