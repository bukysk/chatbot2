"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

import { PROMPT_TEMPLATE } from '../lib/config';

const AREAS_EXPERIENCED_OPTIONS = [
  "Programovanie (Python, C, C++)",
  "Algoritmy a dátové štruktúry",
  "Databázové systémy / SQL",
  "Informatika (hardware, IoT, Excel, Office)",
  "Operačné systémy / Linux",
  "Sieťové technológie",
  "Štatistika / dátová analýza / R",
  "Tímové projekty",
  "Iné"
];

const INTEREST_AREAS_OPTIONS = [
  "Business Intelligence",
  "Dátová analytika",
  "AI / fuzzy logika / rozhodovanie",
  "Softvérové inžinierstvo",
  "IS/IT manažment",
  "Procesy / BPM",
  "Cloud / infraštruktúra",
  "UX / návrh aplikácií",
  "Iné"
];

interface FormDataState {
  name: string;
  previousSchoolProgram: string;
  areasExperienced: string[];
  strengths: string;
  weaknesses: string;
  interestAreas: string[];
  topicType: "technical" | "analytical" | "managerial" | "unsure" | "";
  practiceConnection: "yes" | "no" | "neutral" | "";
  preferredSupervisor: string;
  idealTopic: string;
}

export default function ChatPage() {
  const [formData, setFormData] = useState<FormDataState>({
    name: "",
    previousSchoolProgram: "",
    areasExperienced: [],
    strengths: "",
    weaknesses: "",
    interestAreas: [],
    topicType: "",
    practiceConnection: "",
    preferredSupervisor: "",
    idealTopic: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null);
  const [debugRecords, setDebugRecords] = useState<any[] | null>(null);
  const debugPollRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleCheckboxWithLimit(field: "areasExperienced" | "interestAreas", value: string, limit: number) {
    setFormData(prev => {
      const current = prev[field];
      const exists = current.includes(value);
      let next = current;
      if (exists) {
        next = current.filter(v => v !== value);
      } else if (current.length < limit) {
        next = [...current, value];
      }
      return { ...prev, [field]: next } as FormDataState;
    });
  }

  function validateForm(): string | null {
    if (!formData.name.trim()) return "Vyplň meno a priezvisko.";
    if (!formData.previousSchoolProgram.trim()) return "Vyplň školu a odbor.";
    if (formData.areasExperienced.length === 0) return "Vyber aspoň 1 zažitú oblasť.";
    if (!formData.strengths.trim()) return "Vyplň v čom si bol/a najsilnejší/ia.";
    if (!formData.weaknesses.trim()) return "Vyplň slabšie oblasti alebo čomu sa chceš vyhnúť.";
    if (formData.interestAreas.length === 0) return "Vyber aspoň 1 záujmovú oblasť.";
    if (!formData.topicType) return "Vyber typ témy.";
    if (!formData.practiceConnection) return "Vyber prepojenie s praxou.";
    if (!formData.idealTopic.trim()) return "Zadaj ideálnu tému jednou vetou.";
    return null;
  }

  function buildSystemPrompt(): string {
    // Build a compact PROFILE block and inject into the centralized PROMPT_TEMPLATE.
    const profile = `Meno (len interné, nepoužívaj v odpovedi): ${formData.name}\nDoterajšia škola/odbor: ${formData.previousSchoolProgram}\nNajviac zažité oblasti: ${formData.areasExperienced.join(", ")}\nSilné stránky: ${formData.strengths}\nSlabšie / vyhnúť sa: ${formData.weaknesses}\nZáujmové oblasti: ${formData.interestAreas.join(", ")}\nPreferovaný typ témy: ${formData.topicType}\nPrepojenie s praxou / firmou: ${formData.practiceConnection}\nPreferovaný školiteľ / katedra (ak uviedol): ${formData.preferredSupervisor || "neuvedené"}\nIdeálna téma (vetou): ${formData.idealTopic}`;

    return PROMPT_TEMPLATE.replace('{{PROFILE}}', profile);
  }

  async function streamCompletion(customMessages: Msg[], sysPrompt: string) {
    setLoading(true);
    try {
      // Debug: log the exact payload sent to the API to help diagnose missing profile data
      // (This will appear in the browser console.)
      console.log('POST /api/chat payload:', { messages: customMessages, systemPrompt: sysPrompt });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: customMessages, systemPrompt: sysPrompt, debugSessionId }),
      });
      // capture server-generated debug session id (if server created one)
      const headerSession = res.headers.get('x-debug-session');
      if (headerSession && !debugSessionId) {
        setDebugSessionId(headerSession);
      }
      if (!res.body) throw new Error("Žiadne telo odpovede");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: "Chyba: " + (e.message || "neznáma") };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateForm();
    setError(err);
    if (err) return;
    setSubmitted(true);
    const sysPrompt = buildSystemPrompt();
    const initialUserMessage: Msg = {
      role: "user",
      content: "Na základe môjho profilu prosím odporuč vhodné témy záverečnej práce."
    };
    // Add placeholder assistant message for streaming
    setMessages([initialUserMessage, { role: "assistant", content: "" }]);
    await streamCompletion([initialUserMessage], sysPrompt);
  }

  async function sendChatMessage() {
    if (!input.trim() || loading) return;
    const userMessage: Msg = { role: "user", content: input.trim() };
    // Build the messages payload from the current snapshot so we don't rely on async state updates
    const toSend = [...messages, userMessage];
    // Update UI immediately: append the user message and a placeholder assistant message
    setMessages(prev => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    const sysPrompt = buildSystemPrompt();
    await streamCompletion(toSend, sysPrompt);
  }

  // Poll debug session retrievals when debug panel is visible and we have a session id
  useEffect(() => {
    if (!debugVisible) {
      if (debugPollRef.current) {
        clearInterval(debugPollRef.current);
        debugPollRef.current = null;
      }
      return;
    }
    if (!debugSessionId) return;
    // start polling every 1500ms
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/debug/session/${encodeURIComponent(debugSessionId)}`);
        if (!res.ok) return;
        const j = await res.json();
        if (j?.records) setDebugRecords(j.records);
      } catch (e) {
        // ignore
      }
    }, 1500);
    debugPollRef.current = id;
    return () => {
      if (debugPollRef.current) clearInterval(debugPollRef.current);
      debugPollRef.current = null;
    };
  }, [debugVisible, debugSessionId]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  return (
    <div className="app-container flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 flex flex-col gap-8">
        {!submitted && (
          <div className="card p-6 space-y-6">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">Dotazník pre odporúčanie témy</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Vyplň krátke otázky, aby sme vedeli odporučiť relevantné témy záverečnej práce na FHI.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-xs font-medium">1. Meno a priezvisko <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">2. Tvoja doterajšia škola a odbor <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="napr. FHI – Hospodárska informatika"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.previousSchoolProgram}
                  onChange={e => setFormData(prev => ({ ...prev, previousSchoolProgram: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">3. Ktoré oblasti máš NAJVIAC zažité zo štúdia? (max. 3) <span className="text-red-500">*</span></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AREAS_EXPERIENCED_OPTIONS.map(option => (
                    <label key={option} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs bg-white">
                      <input
                        type="checkbox"
                        checked={formData.areasExperienced.includes(option)}
                        onChange={() => toggleCheckboxWithLimit("areasExperienced", option, 3)}
                        className="mt-0.5"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">4. V čom si bol/a najsilnejší/ia? <span className="text-red-500">*</span></label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.strengths}
                  onChange={e => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">5. V čom si slabší/šia alebo čomu sa chceš vyhnúť? <span className="text-red-500">*</span></label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.weaknesses}
                  onChange={e => setFormData(prev => ({ ...prev, weaknesses: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">6. O aké oblasti máš záujem? (max. 3) <span className="text-red-500">*</span></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {INTEREST_AREAS_OPTIONS.map(option => (
                    <label key={option} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs bg-white">
                      <input
                        type="checkbox"
                        checked={formData.interestAreas.includes(option)}
                        onChange={() => toggleCheckboxWithLimit("interestAreas", option, 3)}
                        className="mt-0.5"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">7. Typ témy <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { v: "technical", l: "Skôr technická" },
                    { v: "analytical", l: "Skôr analytická" },
                    { v: "managerial", l: "Skôr manažérska" },
                    { v: "unsure", l: "Neviem" },
                  ].map(opt => (
                    <label key={opt.v} className="flex items-center gap-1 rounded-full border px-3 py-1.5 bg-white">
                      <input
                        type="radio"
                        name="topicType"
                        value={opt.v}
                        checked={formData.topicType === opt.v}
                        onChange={() => setFormData(prev => ({ ...prev, topicType: opt.v as FormDataState["topicType"] }))}
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">8. Prepojenie s praxou / firmou <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { v: "yes", l: "Áno" },
                    { v: "no", l: "Nie" },
                    { v: "neutral", l: "Je mi to jedno" },
                  ].map(opt => (
                    <label key={opt.v} className="flex items-center gap-1 rounded-full border px-3 py-1.5 bg-white">
                      <input
                        type="radio"
                        name="practiceConnection"
                        value={opt.v}
                        checked={formData.practiceConnection === opt.v}
                        onChange={() => setFormData(prev => ({ ...prev, practiceConnection: opt.v as FormDataState["practiceConnection"] }))}
                      />
                      {opt.l}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">9. Preferovaný školiteľ / katedra / téma (nepovinné)</label>
                <input
                  type="text"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.preferredSupervisor}
                  onChange={e => setFormData(prev => ({ ...prev, preferredSupervisor: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">10. Ideálna téma (jednou vetou) <span className="text-red-500">*</span></label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formData.idealTopic}
                  onChange={e => setFormData(prev => ({ ...prev, idealTopic: e.target.value }))}
                />
              </div>
              {error && (
                <p className="text-xs rounded-md border border-red-300 bg-red-100/60 dark:border-red-600 dark:bg-red-900/30 px-3 py-2 text-red-700 dark:text-red-200">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full rounded-full px-6 py-3 text-sm font-medium shadow-sm"
              >
                {loading ? "Odosielam…" : "Odoslať a získať odporúčania"}
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`rounded-2xl px-4 py-2 max-w-[75%] text-sm whitespace-pre-wrap leading-relaxed shadow-sm transition-colors ${
                      m.role === "user" ? "bubble-user" : "bubble-assistant"
                    }`}
                  >
                    {m.content || (m.role === "assistant" && loading ? "..." : null)}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
              <form
              onSubmit={e => {
                e.preventDefault();
                sendChatMessage();
              }}
              className="flex flex-col gap-3"
            >
              <textarea
                className="w-full rounded-xl border p-3 text-sm min-h-24"
                placeholder="Napíš správu..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
              />
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary rounded-full px-6 py-2 text-sm font-medium shadow-sm"
                >
                  {loading ? "Odosielam" : "Odoslať"}
                </button>
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Vyčistiť chat
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      {/* Debug overlay removed (moved to /backend) */}
      {/* rebuild button moved to /backend page */}
      <footer className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {submitted ? "Pokračuj v konverzácii alebo upresni preferencie" : "Vyplň dotazník pre personalizované odporúčania"}
      </footer>
    </div>
  );
}
