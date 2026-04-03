import { useEffect, useState } from "react";
import api from "../api/client";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState(null);

  useEffect(() => {
    api.get("/leaderboard/").then((res) => setLeaders(res.data.leaders));
  }, []);

  if (!leaders) return <Loading label="Loading leaderboard..." />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Leaderboard</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Rank</th>
              <th className="py-2">User</th>
              <th className="py-2">Skill</th>
              <th className="py-2">Accuracy</th>
              <th className="py-2">Attempts</th>
              <th className="py-2">Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((row) => (
              <tr key={row.rank} className={`border-b border-slate-100 ${row.is_current ? "bg-indigo-50" : ""}`}>
                <td className="py-2 font-semibold">#{row.rank}</td>
                <td className="py-2">{row.username}</td>
                <td className="py-2"><SkillBadge skill={row.skill_level} /></td>
                <td className="py-2">{row.accuracy}%</td>
                <td className="py-2">{row.attempts}</td>
                <td className="py-2">{row.avg_response_time}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
