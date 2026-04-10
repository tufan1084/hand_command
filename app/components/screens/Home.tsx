"use client";

import { motion } from "framer-motion";
import { kpis, aiActions } from "../../lib/dummyData";

export default function Home({ onExpand }: { onExpand: (id: string) => void }) {
  return (
    <div className="grid h-full grid-cols-12 gap-6 p-8">
      <div className="col-span-12">
        <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">HOI Neural · Overview</h2>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-white">
          Welcome to <span className="text-cyan-300">Highon Innovation</span>
        </h1>
      </div>

      {kpis.map((k, i) => (
        <motion.button
          key={k.label}
          data-card
          data-card-id={`kpi-${i}`}
          onClick={() => onExpand(`kpi-${i}`)}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.5, ease: "easeOut" }}
          className="col-span-3 group rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.06] hover:shadow-[0_0_40px_rgba(90,209,255,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-300/60 data-[focused=true]:border-cyan-300/70 data-[focused=true]:shadow-[0_0_50px_rgba(90,209,255,0.35)]"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-400">
            {k.label}
          </div>
          <div className="mt-3 text-3xl font-light text-white">{k.value}</div>
          <div
            className={`mt-2 text-sm ${
              k.trend === "up" ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {k.delta}
          </div>
        </motion.button>
      ))}

      <div className="col-span-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div className="text-[11px] uppercase tracking-widest text-slate-400">
          Activity pulse
        </div>
        <div className="mt-4 flex h-40 items-end gap-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-cyan-500/20 to-cyan-300/80"
              style={{ height: `${30 + Math.abs(Math.sin(i * 0.6)) * 70}%` }}
            />
          ))}
        </div>
      </div>

      <div className="col-span-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
        <div className="text-[11px] uppercase tracking-widest text-slate-400">
          AI actions queued
        </div>
        <ul className="mt-4 space-y-3">
          {aiActions.slice(0, 3).map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  a.priority === "high" ? "bg-rose-400" : "bg-amber-300"
                } shadow-[0_0_10px_currentColor]`}
              />
              <div>
                <div className="text-sm text-white">{a.title}</div>
                <div className="text-xs text-slate-400">{a.reason}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
