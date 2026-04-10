"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Landmark } from "../lib/gestures";

export type HandStatus = "idle" | "loading" | "ready" | "no_hand" | "error";

const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";
const MP_CAM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils";

/**
 * Inject a <script> tag once, resolve when it's loaded. We load MediaPipe
 * from CDN because the npm packages ship a window-assigning UMD bundle that
 * webpack/Turbopack can't reliably interop with.
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("SSR"));
    const existing = document.querySelector(
      `script[data-mp-src="${src}"]`
    ) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-mp-src", src);
    s.onload = () => {
      (s as any)._loaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * useHandTracking
 *
 * Loads MediaPipe Hands + the webcam and exposes:
 *   - status       – React state, changes rarely (loading/ready/no_hand/error)
 *   - videoRef     – attach to a <video> element
 *   - landmarksRef – MUTABLE REF updated per frame, NOT React state.
 *
 * We deliberately do NOT put landmarks in React state. Putting a value that
 * changes 30+ times/sec into state causes a render-per-frame feedback loop
 * and React's "maximum update depth exceeded" guard fires. Consumers should
 * read `landmarksRef.current` from inside their own rAF loop.
 */
export function useHandTracking(): {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  status: HandStatus;
  landmarksRef: MutableRefObject<Landmark[] | null>;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<Landmark[] | null>(null);
  const [status, setStatus] = useState<HandStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    let hands: any = null;
    let camera: any = null;
    let stream: MediaStream | null = null;
    let lostFrames = 0;

    async function init() {
      try {
        setStatus("loading");

        await loadScript(`${MP_CDN}/hands.js`);
        await loadScript(`${MP_CAM_CDN}/camera_utils.js`);
        if (cancelled) return;

        const HandsCtor = (window as any).Hands;
        const CameraCtor = (window as any).Camera;
        if (!HandsCtor) throw new Error("window.Hands missing after CDN load");
        if (!CameraCtor) throw new Error("window.Camera missing after CDN load");

        hands = new HandsCtor({
          locateFile: (file: string) => `${MP_CDN}/${file}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        hands.onResults((results: any) => {
          if (cancelled) return;
          const found =
            results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
          if (found) {
            landmarksRef.current = results.multiHandLandmarks[0] as Landmark[];
            if (lostFrames !== 0) lostFrames = 0;
            // Only transition to "ready" once — setStatus is a no-op when the
            // value matches, so this does NOT render per frame.
            setStatus((s) => (s === "ready" ? s : "ready"));
          } else {
            lostFrames++;
            if (lostFrames > 15) {
              landmarksRef.current = null;
              setStatus((s) => (s === "no_hand" ? s : "no_hand"));
            }
          }
        });

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "navigator.mediaDevices.getUserMedia unavailable (HTTPS or localhost required)"
          );
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        camera = new CameraCtor(videoRef.current!, {
          onFrame: async () => {
            if (videoRef.current && hands) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        camera.start();
      } catch (err: any) {
        console.error(
          "[useHandTracking] init failed:",
          err?.name,
          err?.message,
          err
        );
        if (!cancelled) setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
      try { camera?.stop?.(); } catch {}
      try { hands?.close?.(); } catch {}
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
    };
  }, []);

  return { videoRef, status, landmarksRef };
}
