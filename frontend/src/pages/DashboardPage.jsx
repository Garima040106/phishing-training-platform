import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ReactCountUp from "react-countup";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/client";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";
import StatCard from "../components/StatCard";

const MotionDiv = motion.div;
const MotionButton = motion.button;
const CountUp = ReactCountUp?.default ?? ReactCountUp;

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await api.get("/dashboard/");
        if (!alive) return;
        setData(res.data);
        setSelectedModule(null);
      } catch (err) {
        if (!alive) return;
        setError(err?.response?.status === 401 ? "Please sign in to view your dashboard." : "Failed to load dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, []);

  const trend = useMemo(() => {
    const values = data?.recent_accuracy_trend || [];
    return values.map((accuracy, idx) => ({
      name: `S${idx + 1}`,
      accuracy: Number(accuracy),
    }));
  }, [data]);

  if (loading) return <Loading label="Loading dashboard…" />;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>;
  if (!data) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        No dashboard data received. Try refreshing.
      </div>
    );
  }

  const confidencePct =
    Number(data.confidence_score) <= 1
      ? Math.round(Number(data.confidence_score) * 100)
      : Math.round(Number(data.confidence_score));

  const modules = Array.isArray(data.recommended_modules) ? data.recommended_modules : [];

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Your training progress and adaptive insights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total attempts">
          <div className="text-4xl font-extrabold text-slate-900">
            <CountUp end={Number(data.total_attempts || 0)} duration={1.6} />
          </div>
          <div className="mt-1 text-sm text-slate-500">Practice + baseline attempts recorded</div>
        </StatCard>

        <MotionDiv
          whileHover={{ y: -2 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-600">Skill level</div>
              <div className="mt-2">
                <SkillBadge skill={data.skill_label} confidence={confidencePct} />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confidence</div>
              <div className="text-lg font-extrabold text-slate-900">{confidencePct}%</div>
            </div>
          </div>
        </MotionDiv>

        {data.anomaly_flag ? (
          <MotionDiv
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
          >
            <div className="text-sm font-extrabold text-amber-900">Anomaly warning</div>
            <div className="mt-2 text-sm text-amber-900/90">{data.anomaly_reason || "An unusual behavior pattern was detected."}</div>
            <div className="mt-3 text-xs text-amber-900/70">Tip: slow down and re-check sender + links before answering.</div>
          </MotionDiv>
        ) : (
          <MotionDiv whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-extrabold text-slate-900">All clear</div>
            <div className="mt-2 text-sm text-slate-600">No anomaly signals detected in your recent sessions.</div>
          </MotionDiv>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Accuracy trend (last 5)</h2>
            <div className="text-xs font-semibold text-slate-500">% accuracy</div>
          </div>
          <div className="mt-4 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e2e8f0",
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Accuracy"]}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#1a237e" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Recommended training modules</h2>
            <div className="text-xs text-slate-500">Tap a card to view the reason</div>
          </div>

          {modules.length ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modules.map((m, idx) => (
                <MotionButton
                  key={`${m.module}-${idx}`}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedModule(m)}
                  className="group text-left rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm transition"
                >
                  <div className="text-sm font-extrabold text-slate-900 group-hover:text-[#1a237e]">{m.module}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-slate-600">{m.reason}</div>
                </MotionButton>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No modules yet — complete more sessions to unlock adaptive recommendations.
            </div>
          )}

          {selectedModule ? (
            <MotionDiv
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4"
            >
              <div className="text-sm font-extrabold text-indigo-900">{selectedModule.module}</div>
              <div className="mt-1 text-sm text-indigo-900/80">{selectedModule.reason}</div>
            </MotionDiv>
          ) : null}
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}
