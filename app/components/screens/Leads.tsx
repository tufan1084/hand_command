"use client";

import { motion } from "framer-motion";
import { leads } from "../../lib/dummyData";

export default function Leads({ onExpand }: { onExpand: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col p-8">
      <div>
        <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Pipeline</h2>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-white">Active Leads</h1>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 overflow-auto pr-2">
        {leads.map((l, i) => (
          <motion.button
            key={l.id}
            data-card
            data-card-id={`lead-${l.id}`}
            onClick={() => onExpand(`lead-${l.id}`)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.06] hover:shadow-[0_0_40px_rgba(90,209,255,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-300/60 data-[focused=true]:border-cyan-300/70 data-[focused=true]:shadow-[0_0_50px_rgba(90,209,255,0.35)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg text-white">{l.name}</div>
                <div className="text-xs text-slate-400">Owner · {l.owner}</div>
              </div>
              <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
                {l.stage}
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Value</div>
                <div className="text-2xl font-light text-white">{l.value}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-slate-500">Score</div>
                <div className="text-2xl font-light text-cyan-300">{l.score}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
