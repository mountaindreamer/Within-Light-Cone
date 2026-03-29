const MODEL_CACHE_MS = 5 * 60 * 1000;
let modelIdCache = { at: 0, list: [] };

function scoreModelId(id) {
  const lower = String(id).toLowerCase();
  let s = 0;
  if (lower.includes("flash")) s += 12;
  if (lower.includes("flash-lite") || lower.includes("lite")) s += 6;
  if (/gemini-3\b/.test(lower)) s += 14;
  if (lower.includes("2.5")) s += 13;
  if (lower.includes("2.0")) s += 11;
  if (lower.includes("1.5")) s += 8;
  if (lower.includes("preview") || lower.includes("exp")) s -= 3;
  return s;
}

function sortModelIds(ids) {
  return [...ids].sort((a, b) => scoreModelId(b) - scoreModelId(a));
}

async function listGenerateContentModelIds(apiKey) {
  const now = Date.now();
  if (modelIdCache.list.length && now - modelIdCache.at < MODEL_CACHE_MS) {
    return modelIdCache.list;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(
      data?.error?.message || "无法列出可用模型，请检查 GEMINI_API_KEY 是否为 AI Studio 密钥",
    );
    err.status = response.status;
    throw err;
  }

  const models = data.models || [];
  const ids = models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => (m.name || "").replace(/^models\//, ""))
    .filter(Boolean);

  modelIdCache = { at: now, list: ids };
  return ids;
}

async function tryGenerate(apiKey, apiVersion, modelId, payload) {
  const base = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(modelId)}:generateContent`;
  const url = `${base}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemInstruction = "" } = req.body || {};
  const apiKey = globalThis.process?.env?.GEMINI_API_KEY;
  const envModel = globalThis.process?.env?.GEMINI_MODEL?.trim();

  if (!apiKey) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
  }

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const fullPayload = {
    contents: [{ parts: [{ text: String(prompt) }] }],
    systemInstruction: { parts: [{ text: String(systemInstruction) }] },
  };

  const payloadNoSystem = {
    contents: [{ parts: [{ text: String(prompt) }] }],
  };

  try {
    const available = await listGenerateContentModelIds(apiKey);
    const sorted = sortModelIds(available).slice(0, 12);

    if (!sorted.length) {
      return res.status(502).json({
        error:
          "当前密钥下没有支持 generateContent 的模型。请到 Google AI Studio 创建新密钥并重试。",
      });
    }

    const modelOrder = envModel
      ? [envModel, ...sorted.filter((id) => id !== envModel)]
      : sorted;

    const versions = ["v1beta", "v1"];
    let last = null;

    for (const modelId of modelOrder) {
      for (const ver of versions) {
        for (const payload of [fullPayload, payloadNoSystem]) {
          const { response, data } = await tryGenerate(apiKey, ver, modelId, payload);
          last = { status: response.status, data, modelId, ver };

          if (response.ok) {
            const text =
              data?.candidates?.[0]?.content?.parts?.[0]?.text || "暂无结果";
            return res.status(200).json({ text });
          }

          if (response.status !== 404 && response.status !== 400) {
            return res.status(response.status).json({
              error: data?.error?.message || "Gemini request failed",
            });
          }
        }
      }
    }

    return res.status(404).json({
      error:
        last?.data?.error?.message ||
        `仍无法调用 Gemini。已尝试模型（含自动探测）仍失败。可选：在 Vercel 设置 GEMINI_MODEL 为下列之一：${sorted.slice(0, 5).join(", ")}`,
    });
  } catch (e) {
    return res.status(e.status || 500).json({
      error: e.message || "Gemini request failed",
    });
  }
}
