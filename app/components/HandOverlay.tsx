"use client";

import type { MutableRefObject } from "react";
import type { GestureLabel } from "../lib/gestures";

type Props = {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  status: "idle" | "loading" | "ready" | "no_hand" | "error";
  gesture: GestureLabel;
  pointer: { x: number; y: number } | null;
};

const statusText: Record<Props["status"], string> = {
  idle: "Starting…",
  loading: "Loading tracker…",
  ready: "Hand detected",
  no_hand: "Show your hand",
  error: "Camera unavailable — use keyboard",
};

const statusColor: Record<Props["status"], string> = {
  idle: "text-slate-400",
  loading: "text-slate-400",
  ready: "text-cyan-300",
  no_hand: "text-amber-300",
  error: "text-rose-400",
};

export default function HandOverlay({ videoRef, status, gesture, pointer }: Props) {
  return (
    <>
      {/* Corner webcam preview */}
      <div className="fixed bottom-6 right-6 z-30 w-56 overflow-hidden rounded-xl border border-cyan-400/20 bg-slate-950/60 backdrop-blur-md shadow-[0_0_30px_rgba(90,209,255,0.15)]">
        <div className="relative aspect-[4/3] w-full">
          <video
            ref={videoRef as React.RefObject<HTMLVideoElement>}
            playsInline
            muted
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-90"
          />
          {pointer && (
            <div
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(90,209,255,0.9)]"
              style={{
                // mirror x because video is mirrored
                left: `${(1 - pointer.x) * 100}%`,
                top: `${pointer.y * 100}%`,
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider">
          <span className={statusColor[status]}>● {statusText[status]}</span>
          <span className="text-slate-300">{gesture}</span>
        </div>
      </div>

      {/* Global pointer (big) — visible on the full screen when pointing */}
      {pointer && (
        <div
          className="pointer-events-none fixed z-40 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300/80 shadow-[0_0_30px_6px_rgba(90,209,255,0.45)] transition-transform"
          style={{
            left: `${(1 - pointer.x) * 100}%`,
            top: `${pointer.y * 100}%`,
          }}
        />
      )}
    </>
  );
}
