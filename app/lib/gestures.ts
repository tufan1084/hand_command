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

/**
 * Angle (in degrees) at vertex b, formed by segments (a-b) and (c-b).
 * Using the joint angle — instead of "tip further from wrist than PIP" —
 * is much more robust when the hand is tilted sideways or rotated: the old
 * distance-from-wrist heuristic breaks whenever the finger is sideways to
 * the wrist, but a curled vs straight finger always has a very different
 * interior angle regardless of orientation.
 */
function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 === 0 || n2 === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (n1 * n2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Finger extension via PIP-joint angle. A straight finger has ~180°; a
 * curled finger drops well below 160°. 160° is a reliable threshold across
 * hand sizes and orientations.
 */
function isFingerExtendedAngle(
  lm: Landmark[],
  mcp: number,
  pip: number,
  tip: number
): boolean {
  return angleDeg(lm[mcp], lm[pip], lm[tip]) > 160;
}

/**
 * Thumb is special — its PIP-equivalent angle is less discriminative. The
 * most reliable signal: when the thumb is tucked across the palm (fist),
 * the thumb tip sits very close to the index/middle MCPs. When extended,
 * it's far away. Use tip-to-index-MCP distance, normalized by palm size.
 */
function isThumbExtendedV2(lm: Landmark[], palmSize: number): boolean {
  const tip = lm[4];
  const indexMcp = lm[5];
  return dist(tip, indexMcp) / palmSize > 0.55;
}

/** Classify a single-frame static gesture. */
export function classifyStatic(lm: Landmark[]): {
  label: GestureLabel;
  pointer: { x: number; y: number };
} {
  const indexTip = lm[8];
  const thumbTip = lm[4];

  const pointer = { x: indexTip.x, y: indexTip.y };

  // Palm "size" — wrist to middle-finger MCP. Used to normalize all distances.
  const palmSize = dist(lm[0], lm[9]) || 0.0001;

  // Angle-based extension for the 4 non-thumb fingers.
  const index  = isFingerExtendedAngle(lm, 5, 6, 8);
  const middle = isFingerExtendedAngle(lm, 9, 10, 12);
  const ring   = isFingerExtendedAngle(lm, 13, 14, 16);
  const pinky  = isFingerExtendedAngle(lm, 17, 18, 20);
  const thumb  = isThumbExtendedV2(lm, palmSize);

  // Pinch distance, normalized — scale-independent (works near or far from cam).
  const pinchDist = dist(indexTip, thumbTip) / palmSize;

  // --- PINCH ---
  // Thumb and index tips touching. We REQUIRE the other three fingers to be
  // curled so a relaxed open hand brushing thumb against index doesn't fire.
  // We do NOT require index to be fully extended — a natural pinch bends the
  // index slightly, so the old "index extended" check was too strict.
  if (pinchDist < 0.32 && !middle && !ring && !pinky) {
    return { label: "pinch", pointer };
  }

  // --- OPEN PALM ---
  // All 4 non-thumb fingers extended. We ignore the thumb for this check
  // because its detection is noisier and open-palm naturally has the thumb
  // out anyway — testing the reliable 4 gives the best precision/recall.
  if (index && middle && ring && pinky) {
    return { label: "open_palm", pointer };
  }

  // --- FIST ---
  // All 4 non-thumb fingers curled. Thumb state is ignored: people often
  // rest the thumb on top of a fist or tuck it in, both are fine.
  if (!index && !middle && !ring && !pinky) {
    return { label: "fist", pointer };
  }

  // --- POINT ---
  // Only index extended. Thumb state ignored (some people point with thumb
  // up like a gun, others tuck it — both should count as "point").
  if (index && !middle && !ring && !pinky) {
    return { label: "point", pointer };
  }

  return { label: "none", pointer };
}

/**
 * Swipe detector — tracks pointer history and fires swipe_left/swipe_right
 * when the user has made a deliberate, sustained horizontal motion.
 *
 * Why this is more involved than a naive first-vs-last diff:
 * ---------------------------------------------------------
 * A real human swipe often has a small "wind-up" — the hand drifts a few
 * pixels in the opposite direction before the actual swing. A naive
 * `last.x - first.x` over a fixed window will capture that wind-up as the
 * reference point and report the wrong direction.
 *
 * Instead:
 *  1. We keep a longer history (900ms) so we can see the full motion.
 *  2. For each push, we scan the history and find the sample that is
 *     farthest from the current sample in x. That becomes the reference.
 *     This is the "elbow" of the swipe — it's robust to a little wind-up.
 *  3. We require the motion FROM that reference TO now to take at least
 *     MIN_SWIPE_MS, so flicks / noise don't fire.
 *  4. We require the most recent samples to be moving monotonically in
 *     one direction. This kills false fires from back-and-forth jitter.
 *  5. We require a minimum horizontal travel and a horizontal-dominance
 *     ratio so vertical or diagonal motion doesn't count.
 */
const SWIPE_WINDOW_MS       = 900;   // how far back we look
const MIN_SWIPE_MS          = 220;   // motion must be sustained at least this long
const MIN_DX                = 0.22;  // min normalized horizontal travel
const HV_RATIO              = 1.8;   // horizontal must be 1.8x vertical
const SAME_DIR_COOLDOWN     = 600;   // ms before the SAME direction can fire again
const OPPOSITE_DIR_COOLDOWN = 2000;  // ms before the OPPOSITE direction can fire (kills return strokes)
const MONO_CHECK_LEN        = 4;     // last N samples must be monotonic

export class SwipeDetector {
  private history: { x: number; y: number; t: number }[] = [];
  private lastFire = 0;
  private lastDir: 1 | -1 | 0 = 0;  // direction of the last fired swipe

  push(p: { x: number; y: number }): GestureLabel | null {
    const now = performance.now();

    // --- Cooldown handling ---
    // We use an ASYMMETRIC cooldown: the direction you just swiped in can
    // fire again quickly (repeat forward-advance works), but the OPPOSITE
    // direction is locked out for much longer (kills the return stroke).
    const sinceFire = now - this.lastFire;
    const sameDirBlocked     = sinceFire < SAME_DIR_COOLDOWN;
    const oppositeDirBlocked = sinceFire < OPPOSITE_DIR_COOLDOWN;

    // CRITICAL: during the SAME-direction cooldown, also DROP the incoming
    // sample entirely. Otherwise the return-stroke samples accumulate in
    // history during the lockout, and as soon as the cooldown expires
    // they instantly satisfy the swipe thresholds and fire the opposite
    // direction. Dropping samples here means the buffer is empty when
    // collection resumes, so detection starts from a clean slate.
    if (sameDirBlocked) {
      return null;
    }

    this.history.push({ x: p.x, y: p.y, t: now });
    this.history = this.history.filter((h) => now - h.t < SWIPE_WINDOW_MS);

    if (this.history.length < 6) return null;

    const cur = this.history[this.history.length - 1];

    // Step 1: find the sample in history that is FARTHEST from current
    // in the x direction. That's our reference "start" point.
    let refIdx = 0;
    let maxAbsDx = 0;
    for (let i = 0; i < this.history.length - 1; i++) {
      const d = Math.abs(cur.x - this.history[i].x);
      if (d > maxAbsDx) {
        maxAbsDx = d;
        refIdx = i;
      }
    }
    const ref = this.history[refIdx];
    const dx = cur.x - ref.x;
    const dy = cur.y - ref.y;
    const dt = cur.t - ref.t;

    // Step 2: sustained motion check. Instant flicks shouldn't fire —
    // the user explicitly asked for a brief "think" window before firing.
    if (dt < MIN_SWIPE_MS) return null;

    // Step 3: magnitude + direction dominance.
    if (Math.abs(dx) < MIN_DX) return null;
    if (Math.abs(dx) < Math.abs(dy) * HV_RATIO) return null;

    // Step 4: monotonicity — the last few samples must move consistently
    // in the direction we're about to fire. Kills back-and-forth jitter
    // and ensures we only fire when the user is currently swinging that
    // way, not when they've already reversed.
    const dir = Math.sign(dx);
    const tail = this.history.slice(-MONO_CHECK_LEN);
    if (tail.length < MONO_CHECK_LEN) return null;
    for (let i = 1; i < tail.length; i++) {
      const step = tail[i].x - tail[i - 1].x;
      // Allow tiny wobble (noise) but reject any real step against dir.
      if (Math.sign(step) !== 0 && Math.sign(step) !== dir && Math.abs(step) > 0.004) {
        return null;
      }
    }

    // Opposite-direction lockout: if the previous swipe was in the other
    // direction, this one must wait out the full OPPOSITE_DIR_COOLDOWN.
    // This is the return-stroke guard — swipe right, your hand travels
    // back left, that back-travel gets silently ignored for 2s.
    if (this.lastDir !== 0 && dir !== this.lastDir && oppositeDirBlocked) {
      return null;
    }

    this.lastFire = now;
    this.lastDir = dir as 1 | -1;
    this.history = [];
    return dir > 0 ? "swipe_right" : "swipe_left";
  }

  reset() {
    this.history = [];
    // Keep lastFire / lastDir intact so cooldowns survive brief hand loss.
  }
}
