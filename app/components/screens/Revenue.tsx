"use client";

import { motion } from "framer-motion";
import { revenue } from "../../lib/dummyData";

export default function Revenue({ onExpand }: { onExpand: (id: string) => void }) {
  const max = Math.max(...revenue.months.map((m) => m.v));

  return (
    <div className="flex h-full flex-col p-8">
      <div>
        <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Financials</h2>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-white">Revenue</h1>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6">
        <motion.button
          data-card
          data-card-id="rev-total"
          onClick={() => onExpand("rev-total")}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-cyan-300/60 data-[focused=true]:border-cyan-300/70 data-[focused=true]:shadow-[0_0_50px_rgba(90,209,255,0.35)]"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-400">YTD Revenue</div>
          <div className="mt-3 text-5xl font-light text-white">{revenue.total}</div>
          <div className="mt-2 text-sm text-slate-400">Target {revenue.target}</div>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="col-span-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md"
        >
          <div className="text-[11px] uppercase tracking-widest text-slate-400">Monthly trend</div>
          <div className="mt-5 flex h-44 items-end gap-3">
            {revenue.months.map((m, i) => (
              <div key={m.m} className="flex flex-1 flex-col items-center gap-2">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(m.v / max) * 100}%` }}
                  transition={{ delay: i * 0.04, duration: 0.7, ease: "easeOut" }}
                  className="w-full rounded-t bg-gradient-to-t from-cyan-500/30 to-cyan-300 shadow-[0_0_14px_rgba(90,209,255,0.4)]"
                />
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.m}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
