import { useState, useEffect, useCallback } from "react";
import {
  LucideCompass,
  LucideLayers,
  LucidePalette,
  LucideSparkles,
  LucideMessageSquare,
  LucideRefreshCw,
  LucideArrowRight,
  LucideHistory,
  LucideTrash2,
} from "lucide-react";

const STORAGE_KEY = "within-light-cone:v1";

const defaultDrafts = () => ({
  refractor: "",
  prompt: "",
  dialogue: "",
});

const defaultOutputs = () => ({
  refractor: "",
  prompt: "",
  dialogue: "",
});

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      drafts: { ...defaultDrafts(), ...data.drafts },
      outputs: { ...defaultOutputs(), ...data.outputs },
      history: Array.isArray(data.history) ? data.history : [],
    };
  } catch {
    return null;
  }
}

const fetchGemini = async (prompt, systemInstruction = "") => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = result.error || `请求失败（HTTP ${response.status}）`;
    throw new Error(msg);
  }
  return result.text ?? "抱歉，未获取到有效结果。";
};

const tabLabel = (tab) =>
  tab === "refractor" ? "因果折射" : tab === "prompt" ? "提示词进化" : "游离对话";

const App = () => {
  const initial = loadPersisted();
  const [activeTab, setActiveTab] = useState("refractor");
  const [drafts, setDrafts] = useState(initial?.drafts ?? defaultDrafts());
  const [outputs, setOutputs] = useState(initial?.outputs ?? defaultOutputs());
  const [history, setHistory] = useState(initial?.history ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ drafts, outputs, history }),
      );
    } catch {
      /* ignore quota */
    }
  }, [drafts, outputs, history]);

  const input = drafts[activeTab];
  const output = outputs[activeTab];

  const setInputForTab = useCallback((tab, value) => {
    setDrafts((d) => ({
      ...d,
      [tab]: typeof value === "function" ? value(d[tab]) : value,
    }));
  }, []);

  const pushHistory = useCallback((tab, inputText, outputText) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setHistory((h) =>
      [
        {
          id,
          tab,
          input: inputText,
          output: outputText,
          at: new Date().toISOString(),
        },
        ...h,
      ].slice(0, 50),
    );
  }, []);

  const handleRefract = async () => {
    const tab = activeTab;
    const text = drafts[tab];
    if (!text.trim()) return;
    setLoading(true);
    const system =
      "你是一个深邃的思想折射仪。对于用户输入的任何主题，请从：1. 心理疗愈（Healing）、2. 哲学思辨（Philosophy）、3. 商业观察（Business）、4. 投资逻辑（Investment）这四个维度给出一段极其简约、清冷且深刻的洞察。语言风格要符合‘光锥之内’的品牌格调。";
    try {
      const result = await fetchGemini(text, system);
      setOutputs((o) => ({ ...o, [tab]: result }));
      pushHistory(tab, text, result);
    } catch (e) {
      const err = e instanceof Error ? e.message : "请求失败，请稍后重试。";
      setOutputs((o) => ({ ...o, [tab]: err }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefinePrompt = async () => {
    const tab = activeTab;
    const text = drafts[tab];
    if (!text.trim()) return;
    setLoading(true);
    const system =
      "你是一个顶级视觉设计师。用户会给你一个简单的构思，请你将其转化为一段极其专业、充满‘简约的复杂感’的 AI 绘图提示词（Prompt）。关键词：High-key, glass textures, translucent, refracted light, minimalist complexity, 8k, serene. 只需要输出英文 Prompt 内容。";
    try {
      const result = await fetchGemini(`将这个想法优化为视觉提示词：${text}`, system);
      setOutputs((o) => ({ ...o, [tab]: result }));
      pushHistory(tab, text, result);
    } catch (e) {
      const err = e instanceof Error ? e.message : "请求失败，请稍后重试。";
      setOutputs((o) => ({ ...o, [tab]: err }));
    } finally {
      setLoading(false);
    }
  };

  const handleDialogue = async () => {
    const tab = activeTab;
    const text = drafts[tab];
    if (!text.trim()) return;
    setLoading(true);
    const system =
      "你是一位保持客观、克制、清醒距离感的对话者。请围绕用户问题进行哲学与现实的双向分析，语言简洁、不过度煽情，不给绝对结论，而是给可执行的思考路径。";
    try {
      const result = await fetchGemini(text, system);
      setOutputs((o) => ({ ...o, [tab]: result }));
      pushHistory(tab, text, result);
    } catch (e) {
      const err = e instanceof Error ? e.message : "请求失败，请稍后重试。";
      setOutputs((o) => ({ ...o, [tab]: err }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (activeTab === "refractor") return handleRefract();
    if (activeTab === "prompt") return handleRefinePrompt();
    return handleDialogue();
  };

  const restoreHistoryItem = (item) => {
    setActiveTab(item.tab);
    setDrafts((d) => ({ ...d, [item.tab]: item.input }));
    setOutputs((o) => ({ ...o, [item.tab]: item.output }));
  };

  const removeHistoryItem = (id) => {
    setHistory((h) => h.filter((x) => x.id !== id));
  };

  const clearHistory = () => setHistory([]);

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 font-sans text-slate-800 md:p-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 flex flex-col items-start justify-between border-b border-slate-100 pb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-extralight uppercase tracking-[0.2em] text-slate-900">
              Within Light Cone
            </h1>
            <p className="mt-2 text-sm italic tracking-widest text-slate-400">
              光锥之内 · 逻辑的折射与秩序
            </p>
          </div>
          <div className="mt-4 flex items-center space-x-2 rounded-full border border-blue-100 bg-blue-50/50 px-4 py-2 md:mt-0">
            <LucideSparkles className="text-blue-400" size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
              Gemini AI Enhanced
            </span>
          </div>
        </header>

        <section className="group relative mb-20">
          <div className="relative h-[320px] w-full overflow-hidden rounded-[40px] border border-slate-50 bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.05)]">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute left-[-10%] top-[-20%] h-[140%] w-[70%] rotate-[15deg] border-r border-slate-200" />
              <div className="absolute left-1/2 top-1/2 h-[1px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
              <div className="absolute left-1/2 top-1/2 h-[1px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rotate-[-34deg] bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="select-none text-7xl font-thin tracking-[0.5em] text-slate-100/60">CAUSALITY</div>
            </div>
            <div className="absolute bottom-10 right-12 text-right">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">Refracted Logic</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">Order in Chaos</p>
            </div>
          </div>
          <div className="absolute -bottom-12 left-12">
            <div className="h-24 w-24 overflow-hidden rounded-[32px] border border-slate-50 bg-white p-1 shadow-2xl md:h-32 md:w-32">
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-white to-slate-50">
                <div className="flex h-16 w-16 rotate-45 items-center justify-center border-[0.5px] border-slate-300">
                  <div className="h-8 w-8 border-[0.5px] border-slate-400 opacity-40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-8 md:grid-cols-12">
          <div className="space-y-2 md:col-span-3">
            <button
              type="button"
              onClick={() => setActiveTab("refractor")}
              className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-xs uppercase tracking-widest transition-all ${activeTab === "refractor" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <LucideLayers size={14} className="mr-3" /> 因果折射仪
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("prompt")}
              className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-xs uppercase tracking-widest transition-all ${activeTab === "prompt" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <LucidePalette size={14} className="mr-3" /> 提示词进化
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dialogue")}
              className={`flex w-full items-center rounded-2xl px-4 py-3 text-left text-xs uppercase tracking-widest transition-all ${activeTab === "dialogue" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <LucideMessageSquare size={14} className="mr-3" /> 游离对话
            </button>
          </div>

          <div className="flex min-h-[400px] flex-col rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm md:col-span-9">
            <div className="mb-6">
              <h3 className="flex items-center text-lg font-light text-slate-800">
                {activeTab === "refractor" && "✨ 因果折射：从单一事件中提取多维规律"}
                {activeTab === "prompt" && "✨ 视觉进化：将构思精炼为‘简约的复杂’"}
                {activeTab === "dialogue" && "✨ 客观对话：保持适度游离的深度沟通"}
              </h3>
              <p className="mt-2 text-xs font-light text-slate-400">
                {activeTab === "refractor" && "输入一个观察到的商业现象、社会趋势或心理状态。"}
                {activeTab === "prompt" && "输入你想要的画面核心意向，AI 将为你补全极简风格的技术参数。"}
                {activeTab === "dialogue" && "在这里，AI 会以一种‘不在场’的清醒视角与你共同探讨哲学命题。"}
              </p>
              <p className="mt-2 text-[10px] font-light tracking-wide text-slate-300">
                回车执行 · Shift+Enter 换行
              </p>
            </div>

            <div className="flex flex-grow flex-col space-y-4">
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInputForTab(activeTab, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!loading) void handleSubmit();
                    }
                  }}
                  placeholder="在此输入您的思考碎片..."
                  className="h-32 w-full resize-none rounded-[24px] border border-slate-100 bg-slate-50/50 p-6 text-sm font-light transition-all focus:outline-none focus:ring-1 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={loading}
                  className="absolute bottom-4 right-4 flex items-center rounded-xl bg-slate-900 px-6 py-2 text-xs tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? (
                    <LucideRefreshCw className="mr-2 animate-spin" size={14} />
                  ) : (
                    <LucideSparkles className="mr-2" size={14} />
                  )}
                  执行
                </button>
              </div>

              {output && (
                <div className="mt-6 rounded-[28px] border border-blue-50 bg-blue-50/20 p-8 transition-all duration-500">
                  <div className="mb-4 flex items-center text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                    <LucideArrowRight size={10} className="mr-2" /> AI Sublimation
                  </div>
                  <div className="whitespace-pre-wrap text-sm font-light leading-relaxed text-slate-600">{output}</div>
                </div>
              )}

              {!output && !loading && (
                <div className="flex flex-grow items-center justify-center py-20 opacity-20">
                  <div className="text-center">
                    <LucideCompass size={48} className="mx-auto mb-4 stroke-[0.5]" />
                    <p className="text-xs uppercase tracking-widest">Awaiting Input</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-16 rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="flex items-center text-xs font-light uppercase tracking-[0.25em] text-slate-500">
              <LucideHistory size={14} className="mr-2 text-slate-400" />
              历史记录
            </h4>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center text-[10px] uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-600"
              >
                <LucideTrash2 size={12} className="mr-1" />
                清空
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs font-light text-slate-300">成功执行后会自动保存，最多保留 50 条（仅保存在本机浏览器）。</p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-50 bg-slate-50/40 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => restoreHistoryItem(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                      <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-slate-600">
                        {tabLabel(item.tab)}
                      </span>
                      <span>{formatTime(item.at)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs font-light text-slate-600">
                      {item.input.replace(/\s+/g, " ").slice(0, 80)}
                      {item.input.length > 80 ? "…" : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeHistoryItem(item.id)}
                    className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-white hover:text-slate-500 group-hover:opacity-100"
                    aria-label="删除此条"
                  >
                    <LucideTrash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-32 flex flex-col justify-between border-t border-slate-100 pt-12 text-[10px] uppercase tracking-[0.2em] text-slate-300 md:flex-row">
          <div className="mb-4 md:mb-0">© 2026 Within Light Cone · All rights reserved</div>
          <div className="flex space-x-6">
            <span>Visual: Refracted Order</span>
            <span>Intelligence: Gemini Flash</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
