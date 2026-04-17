import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import ReactCountUp from "react-countup";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

const normalizeAccuracy = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const percent = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, percent));
};

const friendlyDifficulty = (value) => {
  const label = String(value || "easy").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedModuleKey, setExpandedModuleKey] = useState(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await api.get("/dashboard/");
        if (!alive) return;
        setData(res.data);
        setExpandedModuleKey(null);
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
    const points = Array.isArray(data?.recent_accuracy_points) ? data.recent_accuracy_points : [];
    if (points.length) {
      return points.map((point, idx) => {
        const sessionNumber = Number(point?.session_number) || idx + 1;
        return {
          key: `session-${sessionNumber}`,
          sessionNumber,
          label: `S${sessionNumber}`,
          accuracy: normalizeAccuracy(point?.accuracy_pct),
        };
      });
    }

    const values = Array.isArray(data?.recent_accuracy_trend) ? data.recent_accuracy_trend : [];
    return values.map((accuracy, idx) => ({
      key: `session-${idx + 1}`,
      sessionNumber: idx + 1,
      label: `S${idx + 1}`,
      accuracy: normalizeAccuracy(accuracy),
    }));
  }, [data]);

  const averageAccuracy = useMemo(() => {
    if (!trend.length) return null;
    const total = trend.reduce((sum, point) => sum + point.accuracy, 0);
    return total / trend.length;
  }, [trend]);

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
  const attemptsForBadge = Number(data.recent_attempt_window || Math.min(Number(data.total_attempts || 0), 20));
  const nextDifficulty = friendlyDifficulty(data?.adaptive_engine?.current_difficulty || data?.next_difficulty);

  const moduleWhyText = (module) => {
    return (
      module?.why_recommended ||
      module?.weakness_pattern ||
      data?.weakness_pattern ||
      data?.anomaly_reason ||
      module?.reason ||
      "Recommended from your recent performance pattern."
    );
  };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">Your training progress and adaptive insights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
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
                <SkillBadge skill={data.skill_label} confidence={confidencePct} attemptsCount={attemptsForBadge} />
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

        <MotionDiv whileHover={{ y: -2 }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-extrabold text-slate-900">Next difficulty</div>
          <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-800">
            {nextDifficulty}
          </div>
          <div className="mt-2 text-sm text-slate-600">Adaptive engine setting for your next practice session.</div>
        </MotionDiv>
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
          {trend.length ? (
            <div className="mt-4 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" />
                  <YAxis
                    stroke="#64748b"
                    domain={[
                      (dataMin) => Math.max(0, Math.floor((Number(dataMin) - 5) / 5) * 5),
                      (dataMax) => Math.min(100, Math.ceil((Number(dataMax) + 5) / 5) * 5),
                    ]}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#e2e8f0",
                    }}
                    labelFormatter={(_label, payload) => {
                      const point = payload?.[0]?.payload;
                      return `Session ${point?.sessionNumber ?? "-"}`;
                    }}
                    formatter={(value) => [`${Number(value).toFixed(2)}%`, "Accuracy"]}
                  />

                  {averageAccuracy == null ? null : (
                    <ReferenceLine
                      y={averageAccuracy}
                      stroke="#334155"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Avg ${averageAccuracy.toFixed(2)}%`,
                        fill: "#475569",
                        fontSize: 12,
                        position: "insideTopRight",
                      }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#1a237e"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              Not enough session data yet to draw a trend.
            </div>
          )}
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">Recommended training modules</h2>
            <div className="text-xs text-slate-500">Click a card to expand the reason</div>
          </div>

          {modules.length ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modules.map((m, idx) => (
                (() => {
                  const moduleKey = `${m.module}-${idx}`;
                  const isExpanded = expandedModuleKey === moduleKey;
                  const summary = m.reason || "Targeted module selected from your recent behavior patterns.";

                  return (
                    <MotionButton
                      key={moduleKey}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setExpandedModuleKey((prev) => (prev === moduleKey ? null : moduleKey))}
                      className="group text-left rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm transition"
                    >
                      <div className="text-sm font-extrabold text-slate-900 group-hover:text-[#1a237e]">{m.module}</div>
                      <div className="mt-1 text-sm text-slate-600">{summary}</div>

                      <MotionDiv
                        initial={false}
                        animate={{
                          height: isExpanded ? "auto" : 0,
                          opacity: isExpanded ? 1 : 0,
                          marginTop: isExpanded ? 10 : 0,
                        }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                            Why this is recommended
                          </div>
                          <div className="mt-1 text-sm text-indigo-900/80">{moduleWhyText(m)}</div>
                        </div>
                      </MotionDiv>
                    </MotionButton>
                  );
                })()
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No modules yet — complete more sessions to unlock adaptive recommendations.
            </div>
          )}
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}
