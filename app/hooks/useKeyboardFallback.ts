"use client";

import { useEffect } from "react";

/**
 * Keyboard & mouse fallback — MANDATORY for live demos.
 *
 *   ArrowRight / ArrowLeft  → next / previous screen
 *   ArrowUp / ArrowDown     → focus navigation (optional)
 *   Enter / Space           → select (same as pinch)
 *   Escape                  → close panel (same as fist)
 *   H                       → home (same as open palm)
 */
export function useKeyboardFallback(handlers: {
  onNext: () => void;
  onPrev: () => void;
  onSelect: () => void;
  onClose: () => void;
  onHome: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight": handlers.onNext(); break;
        case "ArrowLeft":  handlers.onPrev(); break;
        case "Enter":
        case " ":          handlers.onSelect(); e.preventDefault(); break;
        case "Escape":     handlers.onClose(); break;
        case "h":
        case "H":          handlers.onHome(); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handlers]);
}
