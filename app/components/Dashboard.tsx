"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import { useHandTracking } from "../hooks/useHandTracking";
import { useGestures, type GestureEvent } from "../hooks/useGestures";
import { useKeyboardFallback } from "../hooks/useKeyboardFallback";

import Home from "./screens/Home";
import Leads from "./screens/Leads";
import Projects from "./screens/Projects";
import Revenue from "./screens/Revenue";
import Team from "./screens/Team";
import { kpis, leads, projects, team, revenue } from "../lib/dummyData";

// Three.js background is client-only.
const ThreeBackground = dynamic(() => import("./ThreeBackground"), { ssr: false });
const HandOverlay = dynamic(() => import("./HandOverlay"), { ssr: false });

const SCREENS = [
  { id: "home",     label: "Home" },
  { id: "leads",    label: "Leads" },
  { id: "projects", label: "Projects" },
  { id: "revenue",  label: "Revenue" },
  { id: "team",     label: "Team / AI" },
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];

/**
 * Resolve a card id (e.g. "kpi-2", "lead-4", "project-1", "rev-total",
 * "team-3") into a title + body suitable for the expanded modal. The id
 * format is set by each screen when it renders data-card-id.
 */
function getCardDetail(
  id: string
): { title: string; subtitle: string; body: React.ReactNode } | null {
  if (id.startsWith("kpi-")) {
    const k = kpis[Number(id.split("-")[1])];
    if (!k) return null;
    return {
      title: k.label,
      subtitle: "KPI · Overview",
      body: (
        <div>
          <div className="text-5xl font-light text-white">{k.value}</div>
          <div
            className={`mt-2 text-sm ${
              k.trend === "up" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {k.delta} vs. last period
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Snapshot of the <span className="text-cyan-300">{k.label}</span>{" "}
            metric. Trending {k.trend === "up" ? "upward" : "downward"} against
            the previous window.
          </p>
        </div>
      ),
    };
  }
  if (id.startsWith("lead-")) {
    const l = leads.find((x) => x.id === Number(id.split("-")[1]));
    if (!l) return null;
    return {
      title: l.name,
      subtitle: `Lead · ${l.stage}`,
      body: (
        <div className="space-y-3 text-sm text-slate-300">
          <Row label="Owner" value={l.owner} />
          <Row label="Stage" value={l.stage} />
          <Row label="Deal value" value={l.value} />
          <Row label="Lead score" value={`${l.score} / 100`} />
        </div>
      ),
    };
  }
  if (id.startsWith("project-")) {
    const p = projects.find((x) => x.id === Number(id.split("-")[1]));
    if (!p) return null;
    return {
      title: p.name,
      subtitle: `Project · ${p.status}`,
      body: (
        <div className="space-y-3 text-sm text-slate-300">
          <Row label="Client" value={p.client} />
          <Row label="Status" value={p.status} />
          <Row label="Progress" value={`${p.progress}%`} />
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-cyan-300"
              style={{ width: `${p.progress}%` }}
            />
          </div>
        </div>
      ),
    };
  }
  if (id.startsWith("team-")) {
    const m = team.find((x) => x.id === Number(id.split("-")[1]));
    if (!m) return null;
    return {
      title: m.name,
      subtitle: `Team · ${m.role}`,
      body: (
        <div className="space-y-3 text-sm text-slate-300">
          <Row label="Role" value={m.role} />
          <Row label="Status" value={m.status} />
          <Row label="Utilization" value={`${m.load}%`} />
        </div>
      ),
    };
  }
  if (id === "rev-total") {
    return {
      title: revenue.total,
      subtitle: "Revenue · Year to date",
      body: (
        <div className="space-y-3 text-sm text-slate-300">
          <Row label="Total" value={revenue.total} />
          <Row label="Target" value={revenue.target} />
          <Row label="Best month" value="Dec · $224K" />
        </div>
      ),
    };
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="text-white">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [screen, setScreen] = useState<ScreenId>("home");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const screenIdx = SCREENS.findIndex((s) => s.id === screen);

  // Navigation helpers. Changing screen ALWAYS clears any stale focus/expand
  // so the new screen starts clean — otherwise a pinch on the next screen
  // could re-open a modal for a card id that no longer exists there.
  const goNext = useCallback(() => {
    setScreen((s) => {
      const i = SCREENS.findIndex((x) => x.id === s);
      return SCREENS[(i + 1) % SCREENS.length].id;
    });
    setExpandedCard(null);
    setFocusedCard(null);
  }, []);

  const goPrev = useCallback(() => {
    setScreen((s) => {
      const i = SCREENS.findIndex((x) => x.id === s);
      return SCREENS[(i - 1 + SCREENS.length) % SCREENS.length].id;
    });
    setExpandedCard(null);
    setFocusedCard(null);
  }, []);

  const goHome = useCallback(() => {
    setScreen("home");
    setExpandedCard(null);
    setFocusedCard(null);
  }, []);

  const closePanel = useCallback(() => setExpandedCard(null), []);

  const selectFocused = useCallback(() => {
    if (focusedCard) setExpandedCard(focusedCard);
  }, [focusedCard]);

  // Hand tracking + gestures. Note: we pass the ref (not a value) into
  // useGestures so that per-frame landmark updates don't trigger renders.
  const { videoRef, status, landmarksRef } = useHandTracking();

  // Helper: given a normalized pointer from MediaPipe (mirrored display),
  // find the <element data-card-id="..."> under the finger, if any.
  const cardIdUnderPointer = useCallback(
    (p: { x: number; y: number }): string | null => {
      const x = (1 - p.x) * window.innerWidth;
      const y = p.y * window.innerHeight;
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const card = el?.closest("[data-card-id]") as HTMLElement | null;
      return card?.getAttribute("data-card-id") ?? null;
    },
    []
  );

  const dismissIntro = useCallback(() => setShowIntro(false), []);

  const onGesture = useCallback(
    (e: GestureEvent) => {
      if (showIntro && e.type !== "point_hold") setShowIntro(false);
      switch (e.type) {
        case "swipe_left":  goNext(); setFlash("Swipe ▶"); break;
        case "swipe_right": goPrev(); setFlash("◀ Swipe"); break;

        case "pinch": {
          // Resolve the card directly from the pointer position on pinch —
          // the user can just point + pinch in one motion, no pre-focus
          // required. Fall back to the existing focusedCard if the pinch
          // landed on empty space (e.g. pointer drifted off the card).
          const idUnder = cardIdUnderPointer(e.pointer);
          const target = idUnder ?? focusedCard;
          if (target) {
            setExpandedCard(target);
            setFocusedCard(target);
            setFlash("Pinch · Expand");
          } else {
            setFlash("Pinch · (no card)");
          }
          break;
        }

        case "fist":      closePanel(); setFlash("Fist · Close"); break;
        case "open_palm": goHome();     setFlash("Palm · Home"); break;

        case "point_hold": {
          // Continuous focus tracking — fired ~10 Hz while the user is
          // holding a point after the initial dwell. Highlight follows the
          // finger across cards.
          const id = cardIdUnderPointer(e.pointer);
          setFocusedCard((prev) => (prev === id ? prev : id));
          break;
        }
      }
    },
    [goNext, goPrev, goHome, closePanel, cardIdUnderPointer, focusedCard, showIntro]
  );

  // Dismiss intro on any keypress too.
  useEffect(() => {
    if (!showIntro) return;
    const onKey = () => setShowIntro(false);
    window.addEventListener("keydown", onKey, { once: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [showIntro]);

  const gesture = useGestures(landmarksRef, onGesture);

  // Keyboard fallback
  useKeyboardFallback({
    onNext: goNext,
    onPrev: goPrev,
    onSelect: selectFocused,
    onClose: closePanel,
    onHome: goHome,
  });

  // Flash toast auto-dismiss
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1100);
    return () => clearTimeout(t);
  }, [flash]);

  // Apply focused attribute to cards so CSS reacts
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>("[data-card-id]");
    nodes.forEach((n) => {
      if (n.getAttribute("data-card-id") === focusedCard) {
        n.setAttribute("data-focused", "true");
      } else {
        n.removeAttribute("data-focused");
      }
    });
  }, [focusedCard, screen]);

  const onExpand = useCallback((id: string) => setExpandedCard(id), []);

  const ScreenComponent = useMemo(() => {
    switch (screen) {
      case "home":     return <Home onExpand={onExpand} />;
      case "leads":    return <Leads onExpand={onExpand} />;
      case "projects": return <Projects onExpand={onExpand} />;
      case "revenue":  return <Revenue onExpand={onExpand} />;
      case "team":     return <Team onExpand={onExpand} />;
    }
  }, [screen, onExpand]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden font-sans text-white">
      <ThreeBackground />

      {/* Top bar */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-8 pt-6">
        <div className="pointer-events-auto">
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/60">HOI</div>
          <div className="text-lg font-light tracking-widest text-white">COMMAND · V1</div>
        </div>
        <nav className="pointer-events-auto flex gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-md">
          {SCREENS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setScreen(s.id); setExpandedCard(null); }}
              className={`rounded-full px-4 py-2 text-xs uppercase tracking-widest transition ${
                i === screenIdx
                  ? "bg-cyan-300/20 text-cyan-200 shadow-[0_0_20px_rgba(90,209,255,0.35)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="pointer-events-auto text-right text-[11px] uppercase tracking-widest text-slate-400">
          <div>{new Date().toLocaleDateString()}</div>
          <div className="text-cyan-300/70">SYSTEM ONLINE</div>
        </div>
      </header>

      {/* Main screen area */}
      <main className="relative z-10 mt-24 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="h-[calc(100vh-7rem)]"
          >
            {ScreenComponent}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* First-load intro / instructions overlay */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl"
            onClick={dismissIntro}
          >
            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[min(720px,92vw)] rounded-3xl border border-cyan-300/30 bg-slate-950/85 p-10 shadow-[0_0_100px_rgba(90,209,255,0.3)]"
            >
              <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">
                Welcome to HOI
              </div>
              <h2 className="mt-2 text-3xl font-light tracking-wide text-white">
                Control this dashboard with your hand
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Allow camera access, then hold your hand ~40 cm from the screen
                in good light. Use the 5 gestures below — or the keyboard.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { g: "Swipe L / R", act: "Change screen", k: "← →" },
                  { g: "Pinch", act: "Select / expand card", k: "Enter" },
                  { g: "Point + Hold", act: "Focus card under finger", k: "Hover" },
                  { g: "Closed Fist", act: "Close panel", k: "Esc" },
                  { g: "Open Palm", act: "Go home", k: "H" },
                ].map((row) => (
                  <div
                    key={row.g}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div>
                      <div className="text-sm text-cyan-200">{row.g}</div>
                      <div className="text-[11px] uppercase tracking-widest text-slate-400">
                        {row.act}
                      </div>
                    </div>
                    <kbd className="rounded bg-white/10 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-300">
                      {row.k}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">
                  Camera status:{" "}
                  <span className="text-cyan-300">{status}</span>
                </div>
                <button
                  onClick={dismissIntro}
                  className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-6 py-2 text-xs uppercase tracking-[0.3em] text-cyan-200 hover:bg-cyan-300/20"
                >
                  Begin
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded card modal */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md"
            onClick={closePanel}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[min(640px,92vw)] rounded-3xl border border-cyan-300/30 bg-slate-950/80 p-10 shadow-[0_0_80px_rgba(90,209,255,0.25)]"
            >
              {(() => {
                const detail = expandedCard ? getCardDetail(expandedCard) : null;
                return (
                  <>
                    <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">
                      {detail?.subtitle ?? "Detail"}
                    </div>
                    <h2 className="mt-2 text-3xl font-light text-white">
                      {detail?.title ?? expandedCard}
                    </h2>
                    <div className="mt-6">
                      {detail?.body ?? (
                        <p className="text-slate-400">No details available.</p>
                      )}
                    </div>
                    <p className="mt-6 text-xs text-slate-500">
                      Press{" "}
                      <kbd className="rounded bg-white/10 px-2 py-0.5 text-[10px]">
                        Esc
                      </kbd>{" "}
                      or make a fist to close.
                    </p>
                  </>
                );
              })()}
              <button
                onClick={closePanel}
                className="mt-6 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-6 py-2 text-sm uppercase tracking-widest text-cyan-200 hover:bg-cyan-300/20"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flash toast */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-cyan-300/30 bg-slate-950/80 px-6 py-2 text-xs uppercase tracking-[0.3em] text-cyan-200 shadow-[0_0_30px_rgba(90,209,255,0.35)] backdrop-blur-md"
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hand overlay (corner cam + pointer) */}
      <HandOverlay
        videoRef={videoRef}
        status={status}
        gesture={gesture.current}
        pointer={gesture.pointer}
      />

      {/* Help strip */}
      <div className="pointer-events-none fixed bottom-6 left-6 z-30 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-[10px] uppercase tracking-widest text-slate-400 backdrop-blur-md">
        <div><span className="text-cyan-300">Swipe</span> · change screen</div>
        <div><span className="text-cyan-300">Pinch</span> · select &nbsp; <span className="text-cyan-300">Fist</span> · close</div>
        <div><span className="text-cyan-300">Palm</span> · home &nbsp; <span className="text-cyan-300">Point+Hold</span> · focus</div>
        <div className="mt-1 text-slate-500">Keys: ← → · Enter · Esc · H</div>
      </div>
    </div>
  );
}
