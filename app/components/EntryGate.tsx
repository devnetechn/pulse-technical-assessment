"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "joining" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    setError("");
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("joining");
        void onReady(pos.coords.latitude, pos.coords.longitude).catch(() => {
          setStatus("error");
          setError("Couldn't join Pulse. Check your connection and try again.");
        });
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="pulse-gate relative flex min-h-dvh flex-col overflow-hidden px-6 text-zinc-100">
      <div className="pulse-gate-grid pointer-events-none absolute inset-0" />
      <div className="pulse-gate-glow pulse-gate-glow-one pointer-events-none absolute" />
      <div className="pulse-gate-glow pulse-gate-glow-two pointer-events-none absolute" />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between py-7">
        <div className="flex items-center gap-3">
          <span className="pulse-logo-mark" aria-hidden="true">
            <span />
          </span>
          <span className="text-lg font-semibold tracking-tight">pulse</span>
        </div>
        <span className="hidden rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400 sm:inline-flex">
          An open world, one hello away
        </span>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center py-8 lg:flex-row lg:items-center lg:gap-20 lg:py-4">
        <section className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-100/15 bg-emerald-100/[0.06] px-3 py-1.5 text-xs text-emerald-100/90">
            <span className="pulse-live-indicator" />
            A little more human, a little less alone
          </div>
          <h1 className="max-w-2xl text-5xl font-medium leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Somewhere in the world,
            <span className="pulse-gradient-text block">someone is here.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            A living map of people who are open to a conversation. Find a dot,
            say hello, and see where it goes.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4">
            <button
              onClick={enter}
              disabled={status === "locating" || status === "joining"}
              className="pulse-enter-button inline-flex min-w-48 items-center justify-center gap-3 rounded-full px-7 py-4 text-sm font-bold text-emerald-950 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            >
              {status === "locating" || status === "joining" ? (
                <>
                  <span className="pulse-spinner" aria-hidden="true" />
                  {status === "locating" ? "Finding your place…" : "Joining…"}
                </>
              ) : (
                <>
                  Step into Pulse <span aria-hidden="true">↗</span>
                </>
              )}
            </button>
            {status === "error" && (
              <p role="alert" className="max-w-sm text-sm text-rose-300">
                {error}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Used only for this session; others see an offset map dot.
            </p>
          </div>
        </section>

        <section
          aria-label="How Pulse protects your privacy"
          className="pulse-entry-card mt-16 w-full max-w-md self-center rounded-[2rem] p-6 sm:p-8 lg:mt-0"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                A quiet kind of connection
              </p>
              <p className="mt-2 text-xl font-medium tracking-tight">
                Here, and only here.
              </p>
            </div>
            <span className="pulse-entry-orbit" aria-hidden="true">
              <span />
            </span>
          </div>
          <div className="mt-7 space-y-5">
            <div className="flex gap-4">
              <span className="pulse-feature-icon" aria-hidden="true">01</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">No profiles. No pressure.</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  No sign-up, names, or follower counts. Just people, right now.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="pulse-feature-icon" aria-hidden="true">02</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">Your location stays yours.</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Your map dot is randomized 1–3 km away from your location.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="pulse-feature-icon" aria-hidden="true">03</span>
              <div>
                <p className="text-sm font-medium text-zinc-100">The moment disappears.</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Chats and calls are peer-to-peer. Leave, and the session ends.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 flex items-center gap-2 border-t border-white/[0.08] pt-5 text-[11px] text-zinc-500">
            <span className="pulse-lock-mark" aria-hidden="true">✳</span>
            Private by design. Present by choice.
          </div>
        </section>
      </main>

      <footer className="relative mx-auto flex w-full max-w-7xl items-center justify-center border-t border-white/[0.07] pb-0 pt-4 text-[11px] leading-none text-zinc-600">
        <span>Pulse · A world of hellos</span>
      </footer>
    </div>
  );
}
