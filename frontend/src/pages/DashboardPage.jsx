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

  const { profile, recommendations, recent_attempts } = data;

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
