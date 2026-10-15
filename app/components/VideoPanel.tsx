"use client";

import { useEffect, useRef } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="pulse-video-panel absolute inset-0 z-30 flex flex-col">
      <div className="relative flex-1">
        <div className="absolute left-5 top-5 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 py-2 text-xs text-white/80 backdrop-blur">
          <span className="pulse-live-indicator" />
          Private call
        </div>
        {/* Remote (full screen) */}
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          aria-label="Stranger's video"
          className="h-full w-full bg-zinc-900 object-cover"
        />
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-300">
            <span className="pulse-prompt-icon" aria-hidden="true">
              <span />
            </span>
            <span>Waiting for their video…</span>
          </div>
        )}
        {/* Local (picture-in-picture) */}
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          aria-label="Your video preview"
          className="pulse-local-video absolute bottom-5 right-5 h-40 w-28 rounded-2xl border border-white/20 bg-zinc-800 object-cover shadow-2xl sm:bottom-7 sm:right-7 sm:h-52 sm:w-36"
        />
      </div>
      <div className="pulse-video-controls flex justify-center p-4">
        <button
          onClick={onEnd}
          className="rounded-full bg-rose-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
        >
          End call
        </button>
      </div>
    </div>
  );
}
