"use client";

import { motion } from "framer-motion";
import { projects } from "../../lib/dummyData";

const statusColor: Record<string, string> = {
  "On Track": "text-emerald-300 border-emerald-300/30 bg-emerald-300/10",
  "At Risk":  "text-rose-300 border-rose-300/30 bg-rose-300/10",
  "Planning": "text-amber-300 border-amber-300/30 bg-amber-300/10",
};

export default function Projects({ onExpand }: { onExpand: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col p-8">
      <div>
        <h2 className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Execution</h2>
        <h1 className="mt-1 text-4xl font-light tracking-tight text-white">Projects</h1>
      </div>

      <div className="mt-8 space-y-4 overflow-auto pr-2">
        {projects.map((p, i) => (
          <motion.button
            key={p.id}
            data-card
            data-card-id={`project-${p.id}`}
            onClick={() => onExpand(`project-${p.id}`)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.5 }}
            className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/[0.06] hover:shadow-[0_0_40px_rgba(90,209,255,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-300/60 data-[focused=true]:border-cyan-300/70 data-[focused=true]:shadow-[0_0_50px_rgba(90,209,255,0.35)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg text-white">{p.name}</div>
                <div className="text-xs text-slate-400">{p.client}</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${statusColor[p.status]}`}>
                {p.status}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Progress</span>
                <span>{p.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.progress}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 shadow-[0_0_12px_rgba(90,209,255,0.6)]"
                />
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
