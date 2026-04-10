"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  classifyStatic,
  SwipeDetector,
  type GestureLabel,
  type Landmark,
} from "../lib/gestures";

/**
 * useGestures
 *
 * Turns a stream of hand landmarks (READ FROM A REF, not from props) into
 * stable, debounced gesture events + lightly-throttled display state.
 *
 * Architecture — WHY a rAF loop, not a useEffect on landmarks:
 * ----------------------------------------------------------
 * MediaPipe fires ~30 times/sec. If we put landmarks into React state and
 * depended on it, every frame would trigger a render → effect → setState →
 * render chain that React's scheduler treats as "Maximum update depth
 * exceeded". Instead, we run our own rAF loop here, read `landmarksRef` with
 * no render cost, and only call setState when the *displayed* gesture label
 * or pointer actually changes.
 *
 * Debounce rules:
 *  - Static gestures (pinch/fist/open_palm) must be held HOLD_FRAMES in a row.
 *  - Each discrete event has a DISCRETE_COOLDOWN cooldown.
 *  - "point" must dwell POINT_HOLD_MS before firing point_hold.
 *  - Swipes come from the SwipeDetector (horizontal motion over time).
 */

export type GestureEvent =
  | { type: "pinch"; pointer: { x: number; y: number } }
  | { type: "fist" }
  | { type: "open_palm" }
  | { type: "swipe_left" }
  | { type: "swipe_right" }
  | { type: "point_hold"; pointer: { x: number; y: number } };

export type GestureState = {
  current: GestureLabel;
  pointer: { x: number; y: number } | null;
  pointing: boolean;
};

const HOLD_FRAMES = 5;
const DISCRETE_COOLDOWN = 900;
const POINT_HOLD_MS = 650;

// Pointer jitter below this threshold (in normalized coords) is ignored for
// display purposes. Prevents a re-render on every tiny finger wiggle.
const POINTER_EPSILON = 0.004;

export function useGestures(
  landmarksRef: MutableRefObject<Landmark[] | null>,
  onEvent?: (e: GestureEvent) => void
): GestureState {
  const [display, setDisplay] = useState<GestureState>({
    current: "none",
    pointer: null,
    pointing: false,
  });

  // All internal gesture state lives in refs so the rAF loop never triggers
  // a render unless the DISPLAY state actually changes.
  const holdCountRef = useRef(0);
  const heldLabelRef = useRef<GestureLabel>("none");
  const lastFireRef = useRef<Record<string, number>>({});
  const pointStartRef = useRef<number | null>(null);
  const swipeRef = useRef(new SwipeDetector());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Last values we *set* on React state — used for bailout comparisons.
  const lastDisplayRef = useRef<GestureState>({
    current: "none",
    pointer: null,
    pointing: false,
  });

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const lm = landmarksRef.current;

      if (!lm) {
        // Reset internal gesture state.
        holdCountRef.current = 0;
        heldLabelRef.current = "none";
        pointStartRef.current = null;
        swipeRef.current.reset();

        const last = lastDisplayRef.current;
        if (last.current !== "none" || last.pointer !== null) {
          const next: GestureState = {
            current: "none",
            pointer: null,
            pointing: false,
          };
          lastDisplayRef.current = next;
          setDisplay(next);
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      const { label, pointer } = classifyStatic(lm);

      // --- Swipe detection (independent of static label) ---
      const swipe = swipeRef.current.push(pointer);
      if (swipe === "swipe_left" || swipe === "swipe_right") {
        onEventRef.current?.({ type: swipe });
      }

      // --- Static gesture hold tracking ---
      if (label === heldLabelRef.current) {
        holdCountRef.current += 1;
      } else {
        heldLabelRef.current = label;
        holdCountRef.current = 1;
        if (label !== "point") {
          pointStartRef.current = null;
        }
      }

      if (holdCountRef.current === HOLD_FRAMES) {
        if (label === "pinch" || label === "fist" || label === "open_palm") {
          const now = performance.now();
          const lastAt = lastFireRef.current[label] || 0;
          if (now - lastAt > DISCRETE_COOLDOWN) {
            lastFireRef.current[label] = now;
            // Pinch carries the pointer so the consumer can resolve the card
            // under the finger directly — no "focus first, then pinch" dance.
            if (label === "pinch") {
              onEventRef.current?.({ type: "pinch", pointer });
            } else {
              onEventRef.current?.({ type: label } as GestureEvent);
            }
          }
        }
      }

      // Point + hold — fires once after initial dwell, then CONTINUOUSLY
      // (throttled to ~10 Hz) so focus tracks the pointer as it moves across
      // cards. The brief says "Point + Hold → Focus / Highlight" — hold to
      // enter focus mode, then your finger drags the highlight.
      if (label === "point") {
        if (pointStartRef.current === null) {
          pointStartRef.current = performance.now();
        }
        const dwellMet =
          performance.now() - pointStartRef.current > POINT_HOLD_MS;
        if (dwellMet) {
          const now = performance.now();
          const lastFocusFire = lastFireRef.current["point_hold"] || 0;
          if (now - lastFocusFire > 100) {
            lastFireRef.current["point_hold"] = now;
            onEventRef.current?.({ type: "point_hold", pointer });
          }
        }
      } else {
        // Reset focus-fire throttle when not pointing.
        lastFireRef.current["point_hold"] = 0;
      }

      // --- Display state update — only when it meaningfully changed ---
      const last = lastDisplayRef.current;
      const labelChanged = last.current !== label;
      const pointerChanged =
        !last.pointer ||
        Math.abs(last.pointer.x - pointer.x) > POINTER_EPSILON ||
        Math.abs(last.pointer.y - pointer.y) > POINTER_EPSILON;

      if (labelChanged || pointerChanged) {
        const next: GestureState = {
          current: label,
          pointer,
          pointing: label === "point",
        };
        lastDisplayRef.current = next;
        setDisplay(next);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // landmarksRef is a stable ref object — no deps needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return display;
}
