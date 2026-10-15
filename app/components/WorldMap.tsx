"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "";

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        // Open centered on the user if we know where they are, else world view.
        center: me ? [me.lng, me.lat] : [0, 20],
        zoom: me ? 4 : 1.4,
        attributionControl: true,
      });
      map.on("load", () => {
        if (!cancelled) {
          setMapError(false);
          setReady(true);
        }
      });
      map.on("error", () => {
        if (!cancelled) setMapError(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
      setMapError(false);
    };
    // `me` is only read for the initial center; we don't want to re-init on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You are here";
        el.innerHTML = `<span class="pulse-me-label">Me</span>📍`;
        // anchor "bottom" → the pin's tip sits on the exact coordinate.
        meMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "pulse-dot";
          el.style.background = dotColor(peer.id);
          el.setAttribute("aria-label", "Connect with a stranger");
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        const element = marker.getElement() as HTMLButtonElement;
        element.disabled = peer.busy || !canConnect;
        element.title = peer.busy
          ? "Already connecting"
          : canConnect
            ? "Tap to connect"
            : "Finish your current chat first";
        element.style.opacity = peer.busy ? "0.35" : "1";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canConnect, peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-zinc-900" />

      {(!TOKEN || mapError) && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-2xl border border-white/10 bg-zinc-950/90 p-5 text-sm text-zinc-200 shadow-2xl backdrop-blur">
            {TOKEN
              ? "The map could not load. Check your Mapbox token and connection."
              : "Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment to load the map."}
          </p>
        </div>
      )}

      <div className="pulse-online-count absolute bottom-5 left-5 z-[2] flex items-center gap-2 rounded-full px-4 py-2 text-xs text-zinc-200">
        <span className="pulse-live-indicator" />
        <span>{peers.length + (me ? 1 : 0)} online</span>
      </div>
    </div>
  );
}
