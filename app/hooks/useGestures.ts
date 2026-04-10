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

// Open palm → Home is triggered by the MOTION of opening the hand, i.e. a
// fist → open_palm transition. A raw open palm (no preceding fist) does
// NOT fire home. This is the window after a fist during which an opening
// motion is valid.
const OPENING_WINDOW_MS = 1200;

// After a swipe fires, ignore static gesture events for this long. Without
// this, swiping with an open hand also fires "open_palm" a few frames later
// and sends you to Home, overriding the screen change.
const POST_SWIPE_LOCKOUT = 1500;

// Static gestures only count while the hand is reasonably still. This is
// the max normalized pointer displacement (per frame) for a pose to be
// considered "steady". Prevents fast-moving hands from accidentally
// classifying as open_palm / fist / pinch mid-swipe.
const STEADY_MAX_DELTA = 0.025;

// Pointer jitter below this threshold (in normalized coords) is ignored for
// display purposes. Prevents a re-render on every tiny finger wiggle.
const POINTER_EPSILON = 0.004;

// EMA smoothing factor for pointer. 0 = no smoothing (raw), 1 = frozen.
// 0.55 gives a noticeably steadier cursor/highlight without adding lag that
// would wreck swipe detection (swipe uses raw samples, not smoothed).
const POINTER_SMOOTH = 0.55;

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
  const smoothPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAtRef = useRef(0);
  const lastRawPointerRef = useRef<{ x: number; y: number } | null>(null);
  // After a swipe, this holds the label that was active at swipe time.
  // That exact label is blocked from firing until the label has transitioned
  // to something else at least once — i.e. the user must ACTIVELY re-form the
  // pose, not just hold their existing open hand still after the swipe.
  const blockedLabelRef = useRef<GestureLabel | null>(null);
  // Timestamp of the last frame we observed a FIST. Used to detect the
  // fist → open_palm "opening" motion that fires home.
  const lastFistAtRef = useRef<number>(0);
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
        smoothPointerRef.current = null;
        lastRawPointerRef.current = null;
        blockedLabelRef.current = null;
        lastFistAtRef.current = 0;

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

      const { label, pointer: rawPointer } = classifyStatic(lm);

      // Pointer smoothing (EMA) — used for display, focus tracking, and
      // the pinch-under-pointer lookup. Swipe detection still gets the RAW
      // pointer so smoothing lag doesn't damp real swipe motion.
      const prev = smoothPointerRef.current;
      const pointer = prev
        ? {
            x: prev.x * POINTER_SMOOTH + rawPointer.x * (1 - POINTER_SMOOTH),
            y: prev.y * POINTER_SMOOTH + rawPointer.y * (1 - POINTER_SMOOTH),
          }
        : rawPointer;
      smoothPointerRef.current = pointer;

      // --- Swipe detection (independent of static label, uses RAW pointer) ---
      const swipe = swipeRef.current.push(rawPointer);
      if (swipe === "swipe_left" || swipe === "swipe_right") {
        lastSwipeAtRef.current = performance.now();
        // Kill any in-progress static hold — otherwise the open hand that
        // just swiped would immediately fire open_palm → goHome.
        holdCountRef.current = 0;
        heldLabelRef.current = "none";
        // Remember which pose the user was holding WHILE swiping (usually
        // open_palm). That exact label is now blocked from firing again
        // until the user's hand visibly changes pose — this prevents the
        // "hand coasts to a stop still in open palm → fires home" bug.
        blockedLabelRef.current = label;
        onEventRef.current?.({ type: swipe });
      }

      // --- Hand-motion guard for static poses ---
      // Fast-moving hands shouldn't count toward a static gesture hold.
      // Compute per-frame displacement from the previous RAW pointer.
      const prevRaw = lastRawPointerRef.current;
      const delta = prevRaw
        ? Math.hypot(rawPointer.x - prevRaw.x, rawPointer.y - prevRaw.y)
        : 0;
      lastRawPointerRef.current = rawPointer;
      const isSteady = delta < STEADY_MAX_DELTA;

      // --- Static gesture hold tracking ---
      // Only accumulate hold frames when (a) the hand is steady and (b) no
      // swipe just fired. Point is exempt from the steadiness requirement —
      // it has its own dwell timer and a pointing finger usually moves.
      const inSwipeLockout =
        performance.now() - lastSwipeAtRef.current < POST_SWIPE_LOCKOUT;

      // If we had blocked a label (usually open_palm after a swipe), clear
      // the block as soon as we observe a DIFFERENT label. That's the user
      // visibly changing their pose — now they can reuse the pose again.
      if (
        blockedLabelRef.current !== null &&
        label !== blockedLabelRef.current
      ) {
        blockedLabelRef.current = null;
      }
      const isBlocked = blockedLabelRef.current === label;

      const canAccumulate =
        label === "point" || (isSteady && !inSwipeLockout && !isBlocked);

      // Track the last time we saw a fist — this is the anchor for the
      // fist → open_palm "opening motion" that triggers home.
      if (label === "fist") {
        lastFistAtRef.current = performance.now();
      }

      if (label === heldLabelRef.current && canAccumulate) {
        holdCountRef.current += 1;
      } else if (label !== heldLabelRef.current) {
        heldLabelRef.current = label;
        holdCountRef.current = canAccumulate ? 1 : 0;
        if (label !== "point") {
          pointStartRef.current = null;
        }
      }

      if (holdCountRef.current === HOLD_FRAMES) {
        if (label === "pinch" || label === "fist" || label === "open_palm") {
          const now = performance.now();
          const lastAt = lastFireRef.current[label] || 0;
          if (now - lastAt > DISCRETE_COOLDOWN && !inSwipeLockout) {
            // Open palm → Home requires the OPENING MOTION: the user's
            // hand must have been in a fist within the last
            // OPENING_WINDOW_MS. A static open palm with no preceding
            // fist is ignored entirely. This matches the user intent:
            // "home" is the act of opening a closed hand.
            let allowFire = true;
            if (label === "open_palm") {
              const fistAge = now - lastFistAtRef.current;
              if (
                lastFistAtRef.current === 0 ||
                fistAge > OPENING_WINDOW_MS
              ) {
                allowFire = false;
                // Consume the hold and wait out a cooldown so we don't
                // spin re-checking this every frame.
                lastFireRef.current[label] = now;
              } else {
                // Consume the fist anchor so one fist → open_palm fires
                // home exactly once. The user has to make a fresh fist
                // before they can trigger home again.
                lastFistAtRef.current = 0;
              }
            }

            if (allowFire) {
              lastFireRef.current[label] = now;
              if (label === "pinch") {
                onEventRef.current?.({ type: "pinch", pointer });
              } else {
                onEventRef.current?.({ type: label } as GestureEvent);
              }
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
