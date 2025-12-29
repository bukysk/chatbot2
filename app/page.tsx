"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function streamCompletion(customMessages: Msg[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: customMessages }),
      });
      if (!res.body) throw new Error("No response body");
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
        copy[copy.length - 1] = { role: "assistant", content: "Error: " + (e.message || "unknown") };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage() {
    if (!input.trim() || loading) return;
    const userMessage: Msg = { role: "user", content: input.trim() };
    const toSend = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    await streamCompletion(toSend);
  }


  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  }

  return (
    <div className="app-container flex flex-col min-h-screen">
      <header className="border-b py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold">Chat Assistant</h1>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 flex flex-col gap-6">
        <div className="flex-1 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 dark:text-zinc-400 py-12">
              <p>Start a conversation by typing a message below.</p>
            </div>
          )}
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
          className="flex flex-col gap-3 sticky bottom-0 bg-white dark:bg-zinc-900 pb-4"
        >
          <textarea
            className="w-full rounded-xl border p-3 text-sm min-h-24 resize-none"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary rounded-full px-6 py-2 text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send"}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Clear chat
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
