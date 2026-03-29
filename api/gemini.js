export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemInstruction = "" } = req.body || {};
  const apiKey = globalThis.process?.env?.GEMINI_API_KEY;
  const modelName = "gemini-1.5-flash";

  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: String(prompt) }] }],
    systemInstruction: { parts: [{ text: String(systemInstruction) }] },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Gemini request failed" });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "暂无结果";
    return res.status(200).json({ text });
  } catch {
    return res.status(500).json({ error: "Gemini request failed" });
  }
}
