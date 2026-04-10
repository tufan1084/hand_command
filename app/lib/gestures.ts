/**
 * Gesture classification utilities.
 *
 * Input: 21 MediaPipe hand landmarks (normalized coords, 0..1).
 * Output: a discrete gesture label + a pointer position (index finger tip).
 *
 * Landmark indices (MediaPipe Hands):
 *   0  WRIST
 *   1..4   THUMB (CMC, MCP, IP, TIP)
 *   5..8   INDEX (MCP, PIP, DIP, TIP)
 *   9..12  MIDDLE
 *   13..16 RING
 *   17..20 PINKY
 */

export type Landmark = { x: number; y: number; z: number };

export type GestureLabel =
  | "none"
  | "pinch"
  | "open_palm"
  | "fist"
  | "point"
  | "swipe_left"
  | "swipe_right";

export type GestureResult = {
  label: GestureLabel;
  pointer: { x: number; y: number } | null;
  confidence: number;
};

const dist = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Returns true if the given finger (by tip index) is extended. */
function isFingerExtended(lm: Landmark[], tipIdx: number): boolean {
  // A finger is "extended" when its tip is further from the wrist than its PIP joint.
  const wrist = lm[0];
  const tip = lm[tipIdx];
  const pip = lm[tipIdx - 2];
  return dist(tip, wrist) > dist(pip, wrist) * 1.05;
}

function isThumbExtended(lm: Landmark[]): boolean {
  // Thumb has a different orientation — use distance from wrist on tip vs IP.
  const wrist = lm[0];
  const tip = lm[4];
  const ip = lm[3];
  return dist(tip, wrist) > dist(ip, wrist) * 1.05;
}

/** Classify a single-frame static gesture. */
export function classifyStatic(lm: Landmark[]): {
  label: GestureLabel;
  pointer: { x: number; y: number };
} {
  const indexTip = lm[8];
  const thumbTip = lm[4];

  const pointer = { x: indexTip.x, y: indexTip.y };

  // Finger extension flags
  const thumb = isThumbExtended(lm);
  const index = isFingerExtended(lm, 8);
  const middle = isFingerExtended(lm, 12);
  const ring = isFingerExtended(lm, 16);
  const pinky = isFingerExtended(lm, 20);

  const extendedCount =
    Number(thumb) + Number(index) + Number(middle) + Number(ring) + Number(pinky);

  // Palm "size" — used to normalize pinch distance.
  const palmSize = dist(lm[0], lm[9]) || 0.0001;
  const pinchDist = dist(indexTip, thumbTip) / palmSize;

  // PINCH: thumb + index tips very close, other fingers may be relaxed.
  if (pinchDist < 0.35 && !middle && !ring && !pinky) {
    return { label: "pinch", pointer };
  }

  // OPEN PALM: all (or 4+) fingers extended.
  if (extendedCount >= 4) {
    return { label: "open_palm", pointer };
  }

  // FIST: no fingers extended.
  if (extendedCount === 0) {
    return { label: "fist", pointer };
  }

  // POINT: only the index finger extended.
  if (index && !middle && !ring && !pinky) {
    return { label: "point", pointer };
  }

  return { label: "none", pointer };
}

/**
 * Swipe detector — tracks pointer history and fires swipe_left/swipe_right
 * when enough horizontal motion happens in a short window.
 */
export class SwipeDetector {
  private history: { x: number; y: number; t: number }[] = [];
  private lastFire = 0;

  push(p: { x: number; y: number }): GestureLabel | null {
    const now = performance.now();
    this.history.push({ x: p.x, y: p.y, t: now });
    // keep only last 400ms
    this.history = this.history.filter((h) => now - h.t < 400);

    if (now - this.lastFire < 700) return null; // cooldown

    if (this.history.length < 5) return null;
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;

    // Must be horizontal, fast, and large enough.
    if (Math.abs(dx) > 0.25 && Math.abs(dx) > Math.abs(dy) * 2) {
      this.lastFire = now;
      this.history = [];
      return dx > 0 ? "swipe_right" : "swipe_left";
    }
    return null;
  }

  reset() {
    this.history = [];
  }
}
