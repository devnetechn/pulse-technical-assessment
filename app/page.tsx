"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import { join, leave, poll, sendSignal } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const disconnectTimer = useRef<number | null>(null);
  const videoRequestTimer = useRef<number | null>(null);
  const pollFailed = useRef(false);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  function sendEnd(peerId: string, failureNotice: string): Promise<void> {
    if (!sessionId || !sessionToken) return Promise.resolve();
    return sendSignal(sessionId, sessionToken, peerId, "end").catch(() =>
      showNotice(failureNotice),
    );
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
    if (videoRequestTimer.current) clearTimeout(videoRequestTimer.current);
    disconnectTimer.current = null;
    videoRequestTimer.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean) {
    if (!sessionId || !sessionToken) return;
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, sessionToken, peerId, type, payload).catch(() =>
          {
            void sendEnd(peerId, "Could not notify the other person that signaling failed.");
            teardown("Signaling failed.");
          },
        );
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "connected" && disconnectTimer.current) {
          clearTimeout(disconnectTimer.current);
          disconnectTimer.current = null;
        } else if (state === "failed") {
          void sendEnd(peerId, "Could not notify the other person that the connection failed.");
          teardown("Connection failed (network).");
        } else if (state === "disconnected" && !disconnectTimer.current) {
          disconnectTimer.current = window.setTimeout(() => {
            disconnectTimer.current = null;
            const current = connRef.current;
            if (
              (current.kind === "connecting" || current.kind === "connected") &&
              current.peerId === peerId
            ) {
              void sendEnd(peerId, "Could not notify the other person that the connection ended.");
              teardown("Connection lost.");
            }
          }, 8_000);
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId });
      },
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          if (videoRequestTimer.current) clearTimeout(videoRequestTimer.current);
          videoRequestTimer.current = null;
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          if (videoRequestTimer.current) clearTimeout(videoRequestTimer.current);
          videoRequestTimer.current = null;
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        if (videoRequestTimer.current) clearTimeout(videoRequestTimer.current);
        videoRequestTimer.current = null;
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (!sessionId || !sessionToken || connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId });
    void sendSignal(sessionId, sessionToken, peerId, "request").catch(() => {
      void sendEnd(peerId, "Could not release the connection request.");
      teardown("Could not send the connection request.");
    });
    requestTimer.current = window.setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendEnd(peerId, "Could not notify the other person that you timed out.");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (sessionId && sessionToken && connRef.current.kind === "requesting") {
      void sendEnd(connRef.current.peerId, "Could not cancel the request on the server.");
    }
    teardown();
  }

  function acceptIncoming() {
    if (!sessionId || !sessionToken || connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    void sendSignal(sessionId, sessionToken, peerId, "accept").catch(() => {
      void sendEnd(peerId, "Could not release the connection request.");
      teardown("Could not accept the connection.");
    });
    setConn({ kind: "connecting", peerId });
  }

  function declineIncoming() {
    if (!sessionId || !sessionToken || connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    void sendSignal(sessionId, sessionToken, peerId, "decline").catch(() => {
      void sendEnd(peerId, "Could not release the connection request.");
      showNotice("Could not decline the request on the server.");
    });
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (
      sessionId &&
      sessionToken &&
      (c.kind === "connecting" || c.kind === "connected")
    ) {
      void sendEnd(c.peerId, "Could not notify the other person that you left.");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
    videoRequestTimer.current = window.setTimeout(() => {
      videoRequestTimer.current = null;
      if (videoRef.current === "requesting") {
        setVideo("none");
        showNotice("No response to your video request.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    if (videoRequestTimer.current) clearTimeout(videoRequestTimer.current);
    videoRequestTimer.current = null;
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        if (connRef.current.kind === "idle") {
          setConn({ kind: "incoming", peerId: sig.fromId });
        } else if (sessionId && sessionToken) {
          void sendSignal(sessionId, sessionToken, sig.fromId, "decline").catch(() =>
            showNotice("Could not decline the incoming request."),
          );
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          ).catch(() => teardown("Could not complete the peer connection."));
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId || !sessionToken) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId, sessionToken);
        if (!active) return;
        if (pollFailed.current) {
          pollFailed.current = false;
          showNotice("Connection restored.");
        }
        setPeers(data.peers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch {
        if (active && !pollFailed.current) {
          pollFailed.current = true;
          showNotice("Connection lost. Retrying…");
        }
      }
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId, sessionToken, showNotice]);

  useEffect(() => {
    if (!sessionId || !sessionToken || phase !== "live") return;
    const onLeave = () => leave(sessionId, sessionToken);
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
    };
  }, [sessionId, sessionToken, phase]);

  async function handleReady(lat: number, lng: number) {
    const session = await join(lat, lng);
    setMyLocation({ lat, lng });
    setSessionId(session.id);
    setSessionToken(session.token);
    setPhase("live");
  }

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  return (
    <main className="pulse-stage fixed inset-0 overflow-hidden text-zinc-100">
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={requestConnection}
        canConnect={conn.kind === "idle"}
      />
      <div className="pulse-map-vignette pointer-events-none absolute inset-0 z-[1]" />

      <header className="pulse-topbar absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="pulse-logo-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">pulse</p>
            <p className="hidden text-[10px] tracking-wide text-zinc-500 sm:block">
              A world of hellos
            </p>
          </div>
        </div>
        <div className="pulse-presence-badge flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium text-zinc-300">
          <span className="pulse-live-indicator" />
          YOUR DOT IS LIVE
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="pulse-notice absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full px-5 py-3 text-sm text-zinc-100 shadow-xl"
        >
          {notice}
        </div>
      )}

      {conn.kind === "requesting" && (
        <div className="pulse-request-pill absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm text-zinc-100">
          <span className="pulse-spinner" aria-hidden="true" />
          <span>Sending a hello…</span>
          <button
            onClick={cancelRequest}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-[2] hidden -translate-x-1/2 items-center gap-3 rounded-full border border-white/[0.08] bg-zinc-950/55 px-5 py-2.5 text-xs text-zinc-300 shadow-lg backdrop-blur-xl sm:flex">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
          {conn.kind === "idle" ? "Explore" : "In a moment"}
        </span>
        <span className="h-3 w-px bg-white/15" />
        <span>
          {conn.kind === "idle"
            ? "Choose a glowing dot to say hello"
            : "Your conversation is just between you two"}
        </span>
      </div>

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="A stranger wants to connect"
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={endConnection}
        />
      )}

      {video === "requesting" && (
        <div className="pulse-notice absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 py-3 text-sm text-zinc-100 shadow-xl">
          Waiting for stranger to accept video…
        </div>
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Start video call?"
          subtitle="The stranger wants to turn on video."
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
