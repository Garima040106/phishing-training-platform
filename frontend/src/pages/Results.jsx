import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import ReactCountUp from "react-countup";
import {
  AlertTriangle,
  ArrowUpRight,
  Gauge,
  Link2Off,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/client";
import GlowCard from "../components/GlowCard";

const MotionDiv = motion.div;
const MotionLink = motion(Link);
const CountUp = ReactCountUp?.default ?? ReactCountUp;

const MISTAKE_META = {
  urgency: {
    label: "Urgency",
    color: "#ff5d73",
    module: "Urgency Resistance Module",
    description: "Practice slowing down and validating urgency before acting.",
    icon: AlertTriangle,
  },
  false_positive: {
    label: "False Positive",
    color: "#f59e0b",
    module: "Decision Calibration Module",
    description: "Improve confidence calibration for legitimate messages.",
    icon: Gauge,
  },
  over_suspicious: {
    label: "Over Suspicious",
    color: "#60a5fa",
    module: "Trust Calibration Module",
    description: "Balance caution with objective evidence checks.",
    icon: ShieldCheck,
  },
  url_tricks: {
    label: "URL Tricks",
    color: "#14b8a6",
    module: "Safe Link Inspection Module",
    description: "Spot deceptive links and mismatched domains faster.",
    icon: Link2Off,
  },
};

function scoreTone(percent) {
  if (percent < 50) {
    return {
      ring: "#ef4444",
      glow: "rgba(239,68,68,0.35)",
      badge: "border-red-400/40 bg-red-500/10 text-red-300",
      grade: "Needs Recovery",
    };
  }
  if (percent < 80) {
    return {
      ring: "#f59e0b",
      glow: "rgba(245,158,11,0.35)",
      badge: "border-amber-400/40 bg-amber-500/10 text-amber-300",
      grade: "Solid Progress",
    };
  }
  return {
    ring: "#14b8a6",
    glow: "rgba(20,184,166,0.35)",
    badge: "border-teal-400/40 bg-teal-500/10 text-teal-300",
    grade: "Elite Signal Sense",
  };
}

function normalizeMistakes(rawMistakes) {
  const normalized = {
    urgency: 0,
    false_positive: 0,
    over_suspicious: 0,
    url_tricks: 0,
  };

  for (const [rawKey, rawValue] of Object.entries(rawMistakes || {})) {
    const value = Number(rawValue || 0);
    const key = String(rawKey || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (key.includes("urgent") || key.includes("urgency")) {
      normalized.urgency += value;
      continue;
    }
    if (key.includes("false") && key.includes("positive")) {
      normalized.false_positive += value;
      continue;
    }
    if (key.includes("over") && key.includes("suspicious")) {
      normalized.over_suspicious += value;
      continue;
    }
    if (key.includes("url") || key.includes("link")) {
      normalized.url_tricks += value;
      continue;
    }
  }

  return normalized;
}

function moduleVisuals(moduleName) {
  const text = String(moduleName || "").toLowerCase();

  if (text.includes("urgency")) {
    return {
      Icon: AlertTriangle,
      iconTone: "text-rose-300",
      iconBg: "bg-rose-500/15 border-rose-400/30",
    };
  }
  if (text.includes("link") || text.includes("url")) {
    return {
      Icon: Link2Off,
      iconTone: "text-teal-300",
      iconBg: "bg-teal-500/15 border-teal-400/30",
    };
  }
  if (text.includes("sender") || text.includes("verification")) {
    return {
      Icon: MailCheck,
      iconTone: "text-sky-300",
      iconBg: "bg-sky-500/15 border-sky-400/30",
    };
  }

  return {
    Icon: ShieldCheck,
    iconTone: "text-violet-300",
    iconBg: "bg-violet-500/15 border-violet-400/30",
  };
}

function toDifficultyIndex(level) {
  if (level === "easy") return 0;
  if (level === "medium") return 1;
  if (level === "hard") return 2;
  return -1;
}

function MistakeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl border border-white/15 bg-[#0f1422]/95 px-3 py-2 text-xs text-white shadow-[0_10px_25px_rgba(0,0,0,0.45)]">
      <div className="font-semibold text-white/85">{point.label}</div>
      <div className="mt-1 text-white/75">Mistakes: {point.count}</div>
    </div>
  );
}

export default function Results() {
  const location = useLocation();
  const routeState = location.state || {};
  const resultData = routeState.resultData || routeState;

  const score = Number(resultData?.score || 0);
  const total = Math.max(1, Number(resultData?.total_questions || 10));
  const scorePercent = Math.max(0, Math.min(100, (score / total) * 100));
  const tone = scoreTone(scorePercent);

  const normalizedMistakes = useMemo(
    () => normalizeMistakes(resultData?.mistakes_by_category || {}),
    [resultData?.mistakes_by_category]
  );

  const mistakeData = useMemo(() => {
    return Object.entries(MISTAKE_META).map(([key, meta]) => ({
      key,
      label: meta.label,
      count: Number(normalizedMistakes[key] || 0),
      color: meta.color,
    }));
  }, [normalizedMistakes]);

  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [modules, setModules] = useState(() => {
    return Array.isArray(resultData?.recommended_modules) ? resultData.recommended_modules : [];
  });
  const [loadingModules, setLoadingModules] = useState(
    !Array.isArray(resultData?.recommended_modules)
  );

  const fetchModules = useCallback(async () => {
    if (Array.isArray(resultData?.recommended_modules)) {
      setModules(resultData.recommended_modules);
      setLoadingModules(false);
      return;
    }

    setLoadingModules(true);
    try {
      const res = await api.get("/dashboard/");
      setModules(Array.isArray(res.data?.recommended_modules) ? res.data.recommended_modules : []);
    } catch {
      setModules([]);
    } finally {
      setLoadingModules(false);
    }
  }, [resultData]);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  useEffect(() => {
    let raf = 0;
    let startedAt = 0;
    const durationMs = 1200;

    const animate = (timestamp) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min((timestamp - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPercent(Number((scorePercent * eased).toFixed(2)));
      if (progress < 1) {
        raf = window.requestAnimationFrame(animate);
      }
    };

    setAnimatedPercent(0);
    raf = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(raf);
  }, [scorePercent]);

  const improvementModules = useMemo(() => {
    if (modules.length) {
      return modules.slice(0, 4).map((item, idx) => {
        const moduleName = item?.module || `Adaptive Module ${idx + 1}`;
        const description = String(item?.reason || item?.why_recommended || "Targeted practice based on your latest signals.")
          .replace(/\s+/g, " ")
          .trim();

        return {
          module: moduleName,
          description,
          ...moduleVisuals(moduleName),
        };
      });
    }

    const fallback = Object.entries(normalizedMistakes)
      .filter(([, count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 4)
      .map(([key]) => {
        const meta = MISTAKE_META[key];
        return {
          module: meta.module,
          description: meta.description,
          Icon: meta.icon,
          iconTone: "text-violet-300",
          iconBg: "bg-violet-500/15 border-violet-400/30",
        };
      });

    if (fallback.length) return fallback;

    return [
      {
        module: "Foundations Reinforcement Module",
        description: "Keep momentum with mixed medium-difficulty simulations.",
        Icon: ShieldCheck,
        iconTone: "text-violet-300",
        iconBg: "bg-violet-500/15 border-violet-400/30",
      },
      {
        module: "Sender Verification Module",
        description: "Double-check sender trust patterns before classifying.",
        Icon: MailCheck,
        iconTone: "text-sky-300",
        iconBg: "bg-sky-500/15 border-sky-400/30",
      },
    ];
  }, [modules, normalizedMistakes]);

  const nextDifficulty = String(resultData?.next_difficulty || "medium").toLowerCase();
  const previousDifficulty = String(
    resultData?.previous_difficulty || resultData?.current_difficulty || resultData?.assigned_difficulty || ""
  ).toLowerCase();
  const hasIncreaseContext = toDifficultyIndex(previousDifficulty) >= 0;
  const increased = hasIncreaseContext && toDifficultyIndex(nextDifficulty) > toDifficultyIndex(previousDifficulty);

  if (!resultData || typeof resultData !== "object" || resultData.score == null) {
    return (
      <GlowCard className="mx-auto max-w-3xl border border-white/10 bg-[#0d1220]/90 p-8 text-center">
        <h1 className="text-2xl font-black text-white">No result snapshot found</h1>
        <p className="mt-2 text-sm text-white/65">Complete a full quiz run to unlock your analytics panel.</p>
        <MotionLink
          to="/practice"
          whileTap={{ scale: 0.96 }}
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-violet-400/45 bg-violet-500/85 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-400"
        >
          Practice Again
        </MotionLink>
      </GlowCard>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto max-w-7xl space-y-7"
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,28,0.96),rgba(19,24,39,0.95),rgba(11,18,35,0.96))] p-6 shadow-[0_25px_70px_rgba(0,0,0,0.45)] sm:p-8">
        <div className="pointer-events-none absolute -left-16 top-0 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-200/80">Post-Quiz Assessment</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Threat Analysis Results</h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Your signal-recognition score and targeted recovery modules for the next training block.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white backdrop-blur-sm">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${tone.badge}`}>
                {tone.grade}
              </span>
              <span className="text-white/70">{Math.round(scorePercent)}% accuracy</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Next difficulty</span>
              <span
                className="inline-flex items-center gap-2 rounded-full border border-violet-300/45 bg-violet-500/15 px-4 py-2 text-sm font-extrabold capitalize text-violet-200 shadow-[0_0_22px_rgba(124,58,237,0.35)]"
              >
                {nextDifficulty}
                {increased ? <ArrowUpRight className="h-4 w-4" aria-label="difficulty increased" /> : null}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <MotionLink
                to="/practice"
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-center rounded-xl border border-violet-300/45 bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-500"
              >
                Practice Again
              </MotionLink>
              <MotionLink
                to="/dashboard"
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-center rounded-xl border border-violet-300/45 bg-transparent px-5 py-2.5 text-sm font-bold text-violet-200 transition hover:bg-violet-500/10"
              >
                View Dashboard
              </MotionLink>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div
              className="relative h-[280px] w-[280px] rounded-full border border-white/8 bg-[#090f1b]/80"
              style={{ boxShadow: `0 0 40px ${tone.glow}` }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={[{ name: "score", value: animatedPercent }]}
                  innerRadius="72%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={18}
                    fill={tone.ring}
                    background={{ fill: "rgba(148,163,184,0.16)" }}
                    isAnimationActive={false}
                  />
                </RadialBarChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-5xl font-black tracking-tight text-white sm:text-6xl">
                  <CountUp end={score} duration={1.25} />
                  <span className="text-2xl text-white/65">/{total}</span>
                </div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Score</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlowCard className="overflow-hidden border border-white/10 bg-[#0d1423]/85 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">Mistakes Breakdown</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Per Category</span>
          </div>

          <div className="mt-5 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mistakeData} margin={{ top: 18, right: 14, left: -8, bottom: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                <XAxis dataKey="label" stroke="#9ca3af" tick={{ fill: "#c5d0e0", fontSize: 12 }} />
                <YAxis allowDecimals={false} stroke="#9ca3af" tick={{ fill: "#c5d0e0", fontSize: 12 }} />
                <Tooltip content={<MistakeTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {mistakeData.map((entry) => (
                    <Cell key={`mistake-cell-${entry.key}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fill: "#e5ecf8", fontWeight: 700, fontSize: 12 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        <GlowCard className="border border-white/10 bg-[#0d1423]/85 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">What to Improve</h2>
            <span className="text-xs font-semibold uppercase tracking-wider text-white/45">Adaptive Modules</span>
          </div>

          {loadingModules ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
              Loading recommendations...
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {improvementModules.slice(0, 4).map((item, index) => {
                const Icon = item.Icon;
                return (
                  <MotionDiv
                    key={`${item.module}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.26, delay: index * 0.08 }}
                    className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(19,24,37,0.92),rgba(11,17,30,0.92))] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${item.iconBg}`}>
                        <Icon className={`h-5 w-5 ${item.iconTone}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-white">{item.module}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{item.description}</p>
                      </div>
                    </div>
                  </MotionDiv>
                );
              })}
            </div>
          )}
        </GlowCard>
      </div>
    </MotionDiv>
  );
}
