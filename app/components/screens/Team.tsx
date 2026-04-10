"use client";

import { motion } from "framer-motion";
import { team, aiActions } from "../../lib/dummyData";

export default function Team({ onExpand }: { onExpand: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col p-8">
      <div>
        <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">People + AI</h2>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-white">Team & AI Actions</h1>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6 overflow-auto">
        <div className="col-span-7 space-y-3">
          {team.map((m, i) => (
            <motion.button
              key={m.id}
              data-card
              data-card-id={`team-${m.id}`}
              onClick={() => onExpand(`team-${m.id}`)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/60 data-[focused=true]:border-cyan-300/70 data-[focused=true]:shadow-[0_0_50px_rgba(90,209,255,0.35)]"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <div className="text-white">{m.name}</div>
                  <div className="text-xs text-slate-400">{m.role}</div>
                </div>
                <div className="w-40">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Load</span>
                    <span>{m.load}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full ${
                        m.load > 85
                          ? "bg-rose-400"
                          : m.load > 70
                          ? "bg-amber-300"
                          : "bg-cyan-300"
                      }`}
                      style={{ width: `${m.load}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="col-span-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
          <div className="text-[11px] uppercase tracking-widest text-slate-400">
            AI-suggested actions
          </div>
          <ul className="mt-4 space-y-4">
            {aiActions.map((a) => (
              <li key={a.id} className="border-l-2 border-cyan-300/40 pl-4">
                <div className="text-sm text-white">{a.title}</div>
                <div className="text-xs text-slate-400">{a.reason}</div>
                <div
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    a.priority === "high"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {a.priority}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
