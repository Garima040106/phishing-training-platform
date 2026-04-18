import { useEffect, useMemo, useState } from "react";
import { animate, motion } from "framer-motion";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import * as Progress from "@radix-ui/react-progress";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";

const MotionDiv = motion.div;
const MotionButton = motion.button;

const SKILL_THEME = {
  beginner: {
    label: "Beginner",
    badgeClass: "border-danger/70 bg-danger/15 text-danger",
    glowShadow: "0 0 24px rgba(255,77,109,0.45)",
    progressClass: "bg-danger",
  },
  intermediate: {
    label: "Intermediate",
    badgeClass: "border-warning/70 bg-warning/15 text-warning",
    glowShadow: "0 0 24px rgba(255,179,71,0.45)",
    progressClass: "bg-warning",
  },
  advanced: {
    label: "Advanced",
    badgeClass: "border-success/70 bg-success/15 text-success",
    glowShadow: "0 0 24px rgba(0,212,170,0.45)",
    progressClass: "bg-success",
  },
};

const MODULE_BORDER_CLASS = {
  urgency: "border-danger",
  false_positive: "border-warning",
  over_suspicious: "border-amber-300",
  sender: "border-cyan-300",
  links: "border-sky-300",
  attachments: "border-fuchsia-300",
  grammar: "border-emerald-300",
  default: "border-violet-300",
};

const moduleRailVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const moduleCardVariants = {
  hidden: { opacity: 0, x: 18 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

function normalizePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const pct = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, pct));
}

function formatDifficulty(value) {
  const label = String(value || "easy").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function skillThemeFor(label) {
  const key = String(label || "beginner").toLowerCase();
  return SKILL_THEME[key] || SKILL_THEME.beginner;
}

function inferModuleType(moduleName, reasonText) {
  const signal = `${moduleName || ""} ${reasonText || ""}`.toLowerCase();

  if (signal.includes("urgency") || signal.includes("urgent")) return "urgency";
  if (signal.includes("false_positive") || signal.includes("false positive")) return "false_positive";
  if (signal.includes("over_suspicious") || signal.includes("over suspicious")) return "over_suspicious";
  if (signal.includes("sender")) return "sender";
  if (signal.includes("link") || signal.includes("url")) return "links";
  if (signal.includes("attachment")) return "attachments";
  if (signal.includes("grammar") || signal.includes("language")) return "grammar";

  return "default";
}

function AnimatedCounter({ value }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Number.isFinite(Number(value)) ? Number(value) : 0;
    const controls = animate(0, target, {
      duration: 1.25,
      ease: "easeOut",
      onUpdate(latest) {
        setDisplay(Math.round(latest));
      },
    });

    return () => {
      controls.stop();
    };
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

function ConfidenceBar({ value, barClass }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <Progress.Root
      value={safeValue}
      className="relative h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-black/35"
      aria-label="Confidence"
    >
      <Progress.Indicator asChild>
        <MotionDiv
          initial={{ scaleX: 0 }}
          animate={{ scaleX: safeValue / 100 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
          className={`h-full w-full origin-left rounded-full ${barClass}`}
        />
      </Progress.Indicator>
    </Progress.Root>
  );
}

function TrendDot(props) {
  const { cx, cy } = props;
  if (typeof cx !== "number" || typeof cy !== "number") return null;

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="rgba(108,99,255,0.24)" />
      <circle cx={cx} cy={cy} r={4.2} fill="#6c63ff" stroke="#b6afff" strokeWidth={1.2} />
    </g>
  );
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  const accuracy = Number(payload[0]?.value || 0);

  return (
    <div className="min-w-[148px] rounded-xl border border-white/15 bg-black/55 px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{point?.sessionLabel || label}</div>
      <div className="mt-1 text-sm font-bold text-text">{accuracy.toFixed(2)}% accuracy</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const response = await api.get("/dashboard/");
        if (!alive) return;
        setData(response.data);
        setError("");
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

  const trendData = useMemo(() => {
    const points = Array.isArray(data?.recent_accuracy_points) ? data.recent_accuracy_points : [];
    if (points.length) {
      return points.map((point, idx) => {
        const sessionNumber = Number(point?.session_number) || idx + 1;
        return {
          id: `session-${sessionNumber}`,
          sessionLabel: `Session ${sessionNumber}`,
          xLabel: `S${sessionNumber}`,
          accuracy: normalizePercent(point?.accuracy_pct),
        };
      });
    }

    const trendValues = Array.isArray(data?.recent_accuracy_trend) ? data.recent_accuracy_trend : [];
    return trendValues.map((accuracy, idx) => ({
      id: `session-${idx + 1}`,
      sessionLabel: `Session ${idx + 1}`,
      xLabel: `S${idx + 1}`,
      accuracy: normalizePercent(accuracy),
    }));
  }, [data]);

  const averageAccuracy = useMemo(() => {
    if (!trendData.length) return null;
    const total = trendData.reduce((sum, item) => sum + item.accuracy, 0);
    return total / trendData.length;
  }, [trendData]);

  if (loading) return <Loading label="Loading dashboard..." />;
  if (error) return <div className="rounded-xl border border-danger/35 bg-danger/10 p-4 text-danger">{error}</div>;
  if (!data) {
    return (
      <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-warning">
        No dashboard data received. Try refreshing.
      </div>
    );
  }

  const confidenceRaw = data?.confidence_score ?? data?.confidence ?? 0;
  const confidencePct = Math.round(normalizePercent(confidenceRaw));
  const skillTheme = skillThemeFor(data?.skill_label);
  const moduleList = Array.isArray(data?.recommended_modules) ? data.recommended_modules : [];
  const nextDifficulty = formatDifficulty(data?.next_difficulty || data?.adaptive_engine?.current_difficulty);

  const onDownloadReport = async () => {
    if (downloadingReport) return;

    setDownloadingReport(true);
    try {
      const response = await api.get("/report/generate/", { responseType: "blob" });

      const disposition = String(response.headers?.["content-disposition"] || "");
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || "phishguard_report.pdf";

      const blob = new Blob([response.data], { type: "application/pdf" });
      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
      toast.success("Report downloaded successfully");
    } catch {
      toast.error("Unable to download report. Please try again.");
    } finally {
      setDownloadingReport(false);
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="space-y-8"
    >
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-text">PhishGuard AI Command Dashboard</h1>
        <p className="text-sm text-muted">Real-time readiness, behavior risk intelligence, and adaptive progression.</p>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <GlowCard className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Total Attempts</p>
          <div className="mt-3 text-4xl font-black text-text sm:text-5xl">
            <AnimatedCounter value={Number(data?.total_attempts || 0)} />
          </div>
          <p className="mt-2 text-sm text-muted">Practice + Baseline</p>
        </GlowCard>

        <GlowCard className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-black/30 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Skill Level</p>
          <div
            className={`mt-3 inline-flex rounded-full border px-4 py-1.5 text-sm font-bold ${skillTheme.badgeClass}`}
            style={{ boxShadow: skillTheme.glowShadow }}
          >
            {skillTheme.label}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Confidence</span>
              <span className="font-semibold text-text">{confidencePct}%</span>
            </div>
            <ConfidenceBar value={confidencePct} barClass={skillTheme.progressClass} />
          </div>
        </GlowCard>

        <GlowCard className={`relative overflow-hidden p-6 ${data?.anomaly_flag ? "border-danger/40" : "border-success/40"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Status</p>
          <div className="mt-3 flex items-center gap-2">
            {data?.anomaly_flag ? (
              <AlertTriangle className="h-5 w-5 text-danger" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            <span className={`text-lg font-extrabold ${data?.anomaly_flag ? "text-danger" : "text-success"}`}>
              {data?.anomaly_flag ? "Anomaly Detected" : "All Clear"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {data?.anomaly_flag ? data?.anomaly_reason || "Behavioral risk signal detected in recent responses." : "No anomaly signals across your latest attempts."}
          </p>
        </GlowCard>
      </section>

      <section>
        <GlowCard className="overflow-hidden p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-text">Accuracy Trend</h2>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Recent Sessions</span>
          </div>

          {trendData.length ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6c63ff" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6c63ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="rgba(148,163,184,0.14)" strokeDasharray="3 4" />
                  <XAxis dataKey="xLabel" stroke="#9ca3af" tickLine={false} axisLine={{ stroke: "rgba(156,163,175,0.35)" }} />
                  <YAxis
                    stroke="#9ca3af"
                    tickLine={false}
                    axisLine={{ stroke: "rgba(156,163,175,0.35)" }}
                    domain={[
                      (dataMin) => Math.max(0, Math.floor((Number(dataMin) - 5) / 5) * 5),
                      (dataMax) => Math.min(100, Math.ceil((Number(dataMax) + 5) / 5) * 5),
                    ]}
                  />

                  <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(108,99,255,0.45)", strokeWidth: 1 }} />

                  {averageAccuracy == null ? null : (
                    <ReferenceLine
                      y={averageAccuracy}
                      stroke="#b7b4ff"
                      strokeDasharray="6 6"
                      strokeWidth={1.2}
                      label={{
                        value: `Avg ${averageAccuracy.toFixed(2)}%`,
                        fill: "#cbd5e1",
                        fontSize: 11,
                        position: "insideTopRight",
                      }}
                    />
                  )}

                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#6c63ff"
                    strokeWidth={2.6}
                    fill="url(#accuracyGradient)"
                    dot={<TrendDot />}
                    activeDot={{ r: 5, stroke: "#e2e1ff", strokeWidth: 1.5, fill: "#6c63ff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted">
              Not enough session data yet to render the trend chart.
            </div>
          )}
        </GlowCard>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-text">Recommended Modules</h2>
          <span className="text-xs uppercase tracking-wide text-muted">Adaptive Priorities</span>
        </div>

        {moduleList.length ? (
          <MotionDiv
            variants={moduleRailVariants}
            initial="hidden"
            animate="visible"
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          >
            {moduleList.map((item, index) => {
              const moduleName = String(item?.module || "General Defense Module");
              const reasonText = String(item?.reason || item?.why_recommended || "Recommended based on recent weaknesses.");
              const moduleType = inferModuleType(moduleName, reasonText);
              const borderClass = MODULE_BORDER_CLASS[moduleType] || MODULE_BORDER_CLASS.default;

              return (
                <MotionDiv
                  key={`${moduleName}-${index}`}
                  variants={moduleCardVariants}
                  className={`min-w-[290px] snap-start rounded-2xl border border-white/10 border-l-4 ${borderClass} bg-surface/90 p-4 shadow-card`}
                >
                  <div className="text-base font-bold text-white">{moduleName}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{reasonText}</p>
                </MotionDiv>
              );
            })}
          </MotionDiv>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted">
            No recommendations yet. Complete more sessions to unlock personalized modules.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-muted">Next Difficulty</span>
          <span className="inline-flex rounded-full border border-accent/45 bg-accent/15 px-3 py-1 text-sm font-bold text-accent">
            {nextDifficulty}
          </span>
        </div>

        <MotionButton
          type="button"
          onClick={() => {
            void onDownloadReport();
          }}
          disabled={downloadingReport}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/45 bg-accent/15 px-4 py-2 text-sm font-semibold text-text transition hover:border-accent hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloadingReport ? "Downloading..." : "Download Report"}
        </MotionButton>
      </section>
    </MotionDiv>
  );
}