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
import Loading from "../components/Loading";

const MotionDiv = motion.div;
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
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xl font-extrabold text-slate-900">No results yet</div>
        <div className="text-sm text-slate-600">Complete a practice session to see your results.</div>
        <Link
          to="/practice"
          className="inline-flex items-center justify-center rounded-2xl bg-[#1a237e] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#121a5f]"
        >
          Start practice
        </Link>
      </div>
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
      className="mx-auto max-w-5xl space-y-8"
    >
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Results</h1>
        <p className="mt-1 text-sm text-slate-600">Summary of your 10-question practice session.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionDiv
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="text-sm font-semibold text-slate-600">Score</div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-6xl font-extrabold text-[#1a237e]">
              <CountUp end={score} duration={1.6} />
            </div>
            <div className="pb-2 text-xl font-extrabold text-slate-900">/ {total}</div>
          </div>

          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-indigo-700">Next difficulty assigned</div>
            <div className="mt-1 text-lg font-extrabold capitalize text-indigo-900">{nextDifficulty}</div>
          </div>

          <div className="mt-5 flex gap-3">
            <Link
              to="/practice"
              className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[#1a237e] px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-[#121a5f]"
            >
              Practice again
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Back to dashboard
            </Link>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-extrabold text-slate-900">Mistakes by category</div>
            <div className="text-xs font-semibold text-slate-500">count</div>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mistakeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                  formatter={(v) => [Number(v), "Mistakes"]}
                />
                <Bar dataKey="mistakes" fill="#ef4444" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="text-lg font-extrabold text-slate-900">What to improve</div>
          <div className="text-xs text-slate-500">from recommended modules</div>
        </div>

        {loadingModules ? (
          <Loading label="Loading recommendations…" />
        ) : modules.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m, idx) => (
              <MotionDiv
                key={`${m.module}-${idx}`}
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm"
              >
                <div className="text-sm font-extrabold text-slate-900">{m.module}</div>
                <div className="mt-1 text-sm text-slate-600">{m.reason}</div>
              </MotionDiv>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            No recommendations yet — keep practicing to unlock adaptive guidance.
          </div>
        )}
      </MotionDiv>
    </MotionDiv>
  );
}
