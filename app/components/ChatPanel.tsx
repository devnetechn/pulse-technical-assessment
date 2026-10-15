"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

const ICEBREAKERS = [
  "What tiny thing made your day better recently?",
  "If you could teleport anywhere for a weekend, where would you go?",
  "What's a song you can listen to on repeat?",
  "What would your ideal slow morning look like?",
];

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sparkIndex, setSparkIndex] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="pulse-chat-panel absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col text-zinc-100 shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p className="font-semibold tracking-tight">A stranger</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
            <span className={`pulse-live-indicator ${connected ? "" : "pulse-muted"}`} />
            {connected ? "Connected" : "Connecting…"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium transition hover:border-white/30 hover:bg-white/5 disabled:opacity-40"
          >
            Video call
          </button>
          <button
            onClick={onEnd}
            className="rounded-full bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/25"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="pulse-spark-card mt-5 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/80">
                  Conversation spark
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  A gentle first question, just for this chat.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSparkIndex((index) => (index + 1) % ICEBREAKERS.length)
                }
                aria-label="Show another conversation spark"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5"
              >
                Another
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-100">
              “{ICEBREAKERS[sparkIndex]}”
            </p>
            <button
              type="button"
              onClick={() => setDraft(ICEBREAKERS[sparkIndex])}
              disabled={!connected}
              className="mt-4 text-xs font-semibold text-emerald-200 transition hover:text-emerald-100 disabled:opacity-40"
            >
              Use this spark <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.mine
                  ? "bg-emerald-400 text-zinc-950"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message…" : "Connecting…"}
          aria-label="Message"
          maxLength={2000}
          disabled={!connected}
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-emerald-200/50 focus:ring-2 focus:ring-emerald-200/10 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          className="rounded-full bg-emerald-200 px-5 py-2 text-sm font-bold text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
