import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [baselineScenarios, setBaselineScenarios] = useState([]);
  const [baselineAnswers, setBaselineAnswers] = useState({});
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineStart, setBaselineStart] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const { data: dashboardData } = await api.get("/dashboard/");
      setData(dashboardData);

      if (!dashboardData.baseline_completed) {
        const { data: baselineData } = await api.get("/quiz/baseline/");
        if (!baselineData.completed) {
          setBaselineScenarios(baselineData.scenarios || []);
          setBaselineAnswers({});
          setBaselineStart(Date.now());
        }
      } else {
        setBaselineScenarios([]);
      }
    };

    load();
  }, []);

  const chartData = useMemo(() => {
    const series = data?.correct_series || [];
    return {
      labels: series.map((_, i) => `#${i + 1}`),
      datasets: [
        {
          label: "Correct",
          data: series,
          borderColor: "#1a237e",
          backgroundColor: "rgba(26,35,126,0.18)",
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [data]);

  if (!data) return <Loading label="Loading dashboard..." />;

  const baselineAllAnswered = baselineScenarios.length === 10 && baselineScenarios.every((scenario) => baselineAnswers[scenario.id]);

  const onSubmitBaseline = async (event) => {
    event.preventDefault();
    if (!baselineAllAnswered) return;

    setBaselineSaving(true);
    try {
      await initCsrf();
      const elapsed = Math.max(5, (Date.now() - baselineStart) / 1000 / baselineScenarios.length);
      const body = new URLSearchParams();
      baselineScenarios.forEach((scenario) => {
        body.append("scenario_ids[]", String(scenario.id));
        body.append(`answer_${scenario.id}`, baselineAnswers[scenario.id]);
        body.append(`time_${scenario.id}`, String(Math.round(elapsed * 10) / 10));
      });

      const { data: submitData } = await api.post("/quiz/submit/", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      await refreshUser();
      const { data: refreshedDashboard } = await api.get("/dashboard/");
      setData(refreshedDashboard);
      setBaselineScenarios([]);
      setBaselineAnswers({});

      navigate("/dashboard", {
        replace: true,
        state: {
          baselineSummary: {
            behavioralRecordId: submitData.behavioral_record_id,
            adaptiveFeedback: submitData.adaptive_feedback,
            nextDifficulty: submitData.next_difficulty,
          },
        },
      });
    } finally {
      setBaselineSaving(false);
    }
  };

  const onResetProgress = async () => {
    const confirmed = window.confirm("Reset all progress and restart baseline on this dashboard?");
    if (!confirmed) return;

    setResetting(true);
    try {
      await initCsrf();
      await api.post("/progress/reset/");
      await refreshUser();
      const { data: dashboardData } = await api.get("/dashboard/");
      setData(dashboardData);
      const { data: baselineData } = await api.get("/quiz/baseline/");
      setBaselineScenarios(baselineData.scenarios || []);
      setBaselineAnswers({});
      setBaselineStart(Date.now());
      navigate("/dashboard", { replace: true });
    } finally {
      setResetting(false);
    }
  };

  const { profile, recommendations, recent_attempts, detection_analysis, next_difficulty, anomaly_personalization, adaptive_engine } = data;
  const baselineSummary = location.state?.baselineSummary;

  return (
    <div className="space-y-8">
      {baselineSummary && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 p-6 text-emerald-900 shadow-md">
          <p className="text-lg font-bold">✓ Baseline Complete</p>
          <p className="mt-2 text-sm">Record #{baselineSummary.behavioralRecordId} created • Next difficulty: <span className="capitalize font-semibold">{baselineSummary.nextDifficulty}</span></p>
          {baselineSummary.adaptiveFeedback && <p className="mt-2 text-sm">{baselineSummary.adaptiveFeedback}</p>}
        </div>
      )}

      {profile.is_anomalous && (
        <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-amber-100 p-6 text-amber-900 shadow-md">
          <p className="font-bold">⚠ Unusual Behavior Pattern Detected</p>
          <p className="mt-1 text-sm">Please verify your account safety.</p>
        </div>
      )}

      {!data.baseline_completed && baselineScenarios.length > 0 && (
        <form onSubmit={onSubmitBaseline} className="card-padded border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
          <h2 className="text-2xl font-bold text-slate-900">Initial Baseline Quiz (10 Scenarios)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Complete this baseline to start adaptive difficulty and personalized training.
          </p>

          <div className="mt-5 space-y-4">
            {baselineScenarios.map((scenario, idx) => (
              <div key={scenario.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-lg font-semibold text-slate-900">Q{idx + 1}. {scenario.title}</p>
                <div className="mt-2 text-sm text-slate-700">
                  <p><span className="font-semibold">From:</span> {scenario.sender_email}</p>
                  <p><span className="font-semibold">Subject:</span> {scenario.subject}</p>
                  <p className="mt-2 whitespace-pre-wrap">{scenario.body}</p>
                </div>
                <div className="mt-3 flex gap-6 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`baseline-${scenario.id}`}
                      value="phishing"
                      checked={baselineAnswers[scenario.id] === "phishing"}
                      onChange={(e) => setBaselineAnswers((prev) => ({ ...prev, [scenario.id]: e.target.value }))}
                    />
                    Phishing
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`baseline-${scenario.id}`}
                      value="legitimate"
                      checked={baselineAnswers[scenario.id] === "legitimate"}
                      onChange={(e) => setBaselineAnswers((prev) => ({ ...prev, [scenario.id]: e.target.value }))}
                    />
                    Legitimate
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button disabled={!baselineAllAnswered || baselineSaving} className="btn-primary mt-5">
            {baselineSaving ? "Submitting Baseline..." : `Submit Baseline (${Object.keys(baselineAnswers).length}/10)`}
          </button>
        </form>
      )}

      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900">Performance Dashboard</h2>
        <p className="text-slate-600">Track your learning progress and adaptive recommendations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accuracy" value={`${profile.accuracy}%`} />
        <StatCard label="Attempts" value={profile.total_attempts} />
        <StatCard label="Avg Response" value={`${profile.avg_response_time}s`} />
        <div className="card-padded group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Skill Level</p>
            <div className="mt-3"><SkillBadge skill={profile.skill_level} /></div>
          </div>
        </div>
      </div>

      <div className="card-padded">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Detection Capability Analysis</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Capability Score" value={`${detection_analysis?.capability_score ?? 0}%`} />
          <StatCard label="Phishing Recall" value={`${detection_analysis?.phishing_recall ?? 0}%`} />
          <StatCard label="Legitimate Accuracy" value={`${detection_analysis?.legitimate_accuracy ?? 0}%`} />
          <StatCard label="False Positive Rate" value={`${detection_analysis?.false_positive_rate ?? 0}%`} />
          <StatCard label="False Negative Rate" value={`${detection_analysis?.false_negative_rate ?? 0}%`} />
        </div>
        <p className="mt-6 text-sm text-slate-600 bg-sky-50 rounded-lg p-3 border border-sky-200">
          <span className="font-semibold text-sky-900">Adaptive Recommendation:</span> Next difficulty should be <span className="font-semibold capitalize text-sky-900">{next_difficulty}</span> based on your recent performance trend.
        </p>
      </div>

      <div className="card-padded">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Adaptive Engine State (Phase 3)</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Current Difficulty" value={(adaptive_engine?.current_difficulty || next_difficulty || "easy").toUpperCase()} />
          <StatCard label="Trend" value={(adaptive_engine?.trend_status || "stable").toUpperCase()} />
          <StatCard label="Correct Streak" value={adaptive_engine?.correct_streak ?? 0} />
          <StatCard label="Incorrect Streak" value={adaptive_engine?.incorrect_streak ?? 0} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <StatCard label="Accuracy Delta" value={`${adaptive_engine?.accuracy_delta ?? 0}%`} />
          <StatCard label="Response Delta" value={`${adaptive_engine?.response_time_delta ?? 0}s`} />
        </div>
        {adaptive_engine?.feedback && (
          <p className="mt-6 text-sm text-slate-600 bg-indigo-50 rounded-lg p-3 border border-indigo-200">{adaptive_engine.feedback}</p>
        )}
      </div>

      <div className="card-padded">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Anomaly Detection & Personalization</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Random Clicking" value={anomaly_personalization?.random_clicking ? "Detected" : "No"} />
          <StatCard label="Sudden Drop" value={anomaly_personalization?.sudden_drop ? "Detected" : "No"} />
          <StatCard label="Fast Click Ratio" value={`${anomaly_personalization?.fast_click_ratio ?? 0}%`} />
          <StatCard label="Switch Rate" value={`${anomaly_personalization?.answer_switch_rate ?? 0}%`} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card rounded-lg p-4 bg-slate-50">
            <p className="font-bold text-slate-800">Repeated Weakness Patterns</p>
            {anomaly_personalization?.repeated_weaknesses?.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {anomaly_personalization.repeated_weaknesses.map((item) => (
                  <li key={item.type} className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-rose-500 rounded-full"></span>
                    {item.type} ({item.count})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No repeated weakness pattern detected.</p>
            )}
          </div>
          <div className="card rounded-lg p-4 bg-slate-50">
            <p className="font-bold text-slate-800">Targeted Training Modules</p>
            {anomaly_personalization?.recommended_modules?.length ? (
              <ul className="mt-3 space-y-3 text-sm text-slate-700">
                {anomaly_personalization.recommended_modules.map((item) => (
                  <li key={item.module}>
                    <p className="font-semibold text-slate-800">{item.module}</p>
                    <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No targeted module needed right now.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-padded lg:col-span-2">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Performance Trend</h2>
          <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 1 } } }} />
        </div>
        <div className="card-padded">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Recommendations</h2>
          <div className="space-y-3">
            {recommendations.length === 0 && <p className="text-sm text-slate-500">No recommendations yet.</p>}
            {recommendations.map((rec) => (
              <div key={rec.id} className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">{rec.weakness_type}</p>
                <p className="mt-1 text-xs text-amber-800">{rec.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-padded">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Quick Practice</h2>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-success" to="/practice?difficulty=easy">Easy</Link>
          <Link className="btn-primary" to="/practice?difficulty=medium">Medium</Link>
          <Link className="btn-danger" to="/practice?difficulty=hard">Hard</Link>
          <button
            onClick={onResetProgress}
            disabled={resetting}
            className="btn-secondary"
          >
            {resetting ? "Resetting..." : "Reset Progress"}
          </button>
        </div>
      </div>

      <div className="card-padded">
        <h2 className="mb-6 text-2xl font-bold text-slate-900">Recent Attempts</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Title</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Difficulty</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Result</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Time</th>
              </tr>
            </thead>
            <tbody>
              {recent_attempts.map((a) => (
                <tr key={a.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-4 py-3">{a.title}</td>
                  <td className="px-4 py-3 capitalize">
                    <span className={`badge-base ${
                      a.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                      a.difficulty === 'medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {a.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-base ${a.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {a.is_correct ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{a.response_time}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
