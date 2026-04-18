import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import ReactCountUp from "react-countup";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";

const MotionDiv = motion.div;
const MotionLink = motion(Link);
const CountUp = ReactCountUp?.default ?? ReactCountUp;

export default function ResultPage() {
  const location = useLocation();
  const { resultData } = location.state || {};

  const [modules, setModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await api.get("/dashboard/");
        if (!alive) return;
        setModules(Array.isArray(res.data?.recommended_modules) ? res.data.recommended_modules : []);
      } catch {
        if (!alive) return;
        setModules([]);
      } finally {
        if (alive) setLoadingModules(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const mistakeData = useMemo(() => {
    const m = resultData?.mistakes_by_category || {};
    return Object.keys(m).map((name) => ({ name, mistakes: Number(m[name] || 0) }));
  }, [resultData]);

  if (!resultData) {
    return (
      <GlowCard className="mx-auto max-w-3xl space-y-4 p-6">
        <div className="text-xl font-extrabold text-text">No results yet</div>
        <div className="text-sm text-muted">Complete a practice session to see your results.</div>
        <MotionLink
          to="/practice"
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center justify-center rounded-lg border border-accent bg-accent px-5 py-3 text-sm font-extrabold text-white shadow-glow"
        >
          Start practice
        </MotionLink>
      </GlowCard>
    );
  }

  const score = Number(resultData.score || 0);
  const total = Number(resultData.total_questions || 10);
  const nextDifficulty = resultData.next_difficulty || "medium";

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-6xl space-y-8"
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Session Results</h1>
        <p className="mt-1 text-sm text-muted">Summary of your 10-question simulation run.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard className="p-6">
          <div className="text-sm font-semibold text-muted">Score</div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-6xl font-extrabold text-accent">
              <CountUp end={score} duration={1.6} />
            </div>
            <div className="pb-2 text-xl font-extrabold text-text">/ {total}</div>
          </div>

          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-accent">Next difficulty assigned</div>
            <div className="mt-1 text-lg font-extrabold capitalize text-text">{nextDifficulty}</div>
          </div>

          <div className="mt-5 flex gap-3">
            <MotionLink
              to="/practice"
              whileTap={{ scale: 0.96 }}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-accent bg-accent px-5 py-3 text-sm font-extrabold text-white shadow-glow"
            >
              Practice again
            </MotionLink>
            <MotionLink
              to="/dashboard"
              whileTap={{ scale: 0.96 }}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/20 bg-surface px-5 py-3 text-sm font-extrabold text-text transition hover:border-accent/35"
            >
              Back to dashboard
            </MotionLink>
          </div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold text-text">Mistakes by category</div>
            <div className="text-xs font-semibold text-muted">count</div>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mistakeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "#12121a",
                    color: "#e8e8f0",
                  }}
                  formatter={(v) => [Number(v), "Mistakes"]}
                />
                <Bar dataKey="mistakes" fill="#ff4d6d" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      </div>

      <GlowCard className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold text-text">What to improve next</div>
          <div className="text-xs text-muted">from adaptive module recommendations</div>
        </div>

        {loadingModules ? (
          <Loading label="Loading recommendations..." />
        ) : modules.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, idx) => (
              <GlowCard key={`${m.module}-${idx}`} className="border-white/10 bg-background/65 p-4">
                <div className="text-sm font-extrabold text-text">{m.module}</div>
                <div className="mt-1 text-sm text-muted">{m.reason}</div>
              </GlowCard>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted">
            No recommendations yet. Keep practicing to unlock adaptive guidance.
          </div>
        )}
      </GlowCard>
    </MotionDiv>
  );
}
