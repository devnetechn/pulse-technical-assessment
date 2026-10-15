"use client";

// Reusable centered prompt for "someone wants to connect" and
// "someone wants to start video".
export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="pulse-prompt-backdrop absolute inset-0 z-20 flex items-center justify-center p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pulse-prompt-title"
        className="pulse-prompt-card w-full max-w-sm rounded-[2rem] p-7 text-center text-zinc-100 sm:p-8"
      >
        <span className="pulse-prompt-icon mx-auto mb-5" aria-hidden="true">
          <span />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/70">
          A new signal
        </p>
        <h2 id="pulse-prompt-title" className="mt-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-sm leading-6 text-zinc-400">{subtitle}</p>}
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
          >
            {declineLabel}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-full bg-emerald-200 px-4 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-100"
          >
            {acceptLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
