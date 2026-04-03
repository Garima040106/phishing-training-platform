import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import api from "../api/client";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";
import StatCard from "../components/StatCard";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/").then((res) => setData(res.data));
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

  const { profile, recommendations, recent_attempts, detection_analysis, next_difficulty, anomaly_personalization } = data;

  return (
    <div className="space-y-6">
      {profile.is_anomalous && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Unusual behavior pattern detected. Verify account safety.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accuracy" value={`${profile.accuracy}%`} />
        <StatCard label="Attempts" value={profile.total_attempts} />
        <StatCard label="Avg Response" value={`${profile.avg_response_time}s`} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Skill</p>
          <div className="mt-2"><SkillBadge skill={profile.skill_level} /></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Detection Capability Analysis</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Capability Score" value={`${detection_analysis?.capability_score ?? 0}%`} />
          <StatCard label="Phishing Recall" value={`${detection_analysis?.phishing_recall ?? 0}%`} />
          <StatCard label="Legitimate Accuracy" value={`${detection_analysis?.legitimate_accuracy ?? 0}%`} />
          <StatCard label="False Positive Rate" value={`${detection_analysis?.false_positive_rate ?? 0}%`} />
          <StatCard label="False Negative Rate" value={`${detection_analysis?.false_negative_rate ?? 0}%`} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Adaptive next difficulty recommendation: <span className="font-semibold capitalize">{next_difficulty}</span> based on your recent performance trend.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Anomaly Detection & Personalization</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Random Clicking" value={anomaly_personalization?.random_clicking ? "Detected" : "No"} />
          <StatCard label="Sudden Drop" value={anomaly_personalization?.sudden_drop ? "Detected" : "No"} />
          <StatCard label="Fast Click Ratio" value={`${anomaly_personalization?.fast_click_ratio ?? 0}%`} />
          <StatCard label="Switch Rate" value={`${anomaly_personalization?.answer_switch_rate ?? 0}%`} />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Repeated Weakness Patterns</p>
            {anomaly_personalization?.repeated_weaknesses?.length ? (
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {anomaly_personalization.repeated_weaknesses.map((item) => (
                  <li key={item.type}>{item.type} ({item.count})</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No repeated weakness pattern detected.</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Targeted Training Modules</p>
            {anomaly_personalization?.recommended_modules?.length ? (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {anomaly_personalization.recommended_modules.map((item) => (
                  <li key={item.module}>
                    <p className="font-medium">{item.module}</p>
                    <p className="text-xs text-slate-600">{item.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No targeted module needed right now.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Performance Trend</h2>
          <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 1 } } }} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Recommendations</h2>
          <div className="space-y-3">
            {recommendations.length === 0 && <p className="text-sm text-slate-500">No recommendations yet.</p>}
            {recommendations.map((rec) => (
              <div key={rec.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{rec.weakness_type}</p>
                <p className="mt-1 text-xs text-slate-600">{rec.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Quick Practice</h2>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg bg-emerald-600 px-4 py-2 text-white" to="/practice?difficulty=easy">Easy</Link>
          <Link className="rounded-lg bg-sky-600 px-4 py-2 text-white" to="/practice?difficulty=medium">Medium</Link>
          <Link className="rounded-lg bg-rose-600 px-4 py-2 text-white" to="/practice?difficulty=hard">Hard</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Recent Attempts</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2">Title</th>
                <th className="py-2">Difficulty</th>
                <th className="py-2">Result</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {recent_attempts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2">{a.title}</td>
                  <td className="py-2 capitalize">{a.difficulty}</td>
                  <td className="py-2">{a.is_correct ? "Correct" : "Wrong"}</td>
                  <td className="py-2">{a.response_time}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
