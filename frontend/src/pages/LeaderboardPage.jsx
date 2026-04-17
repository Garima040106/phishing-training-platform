import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Medal, Trophy } from "lucide-react";
import api from "../api/client";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";

const MotionRow = motion.tr;

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState(null);
  const [yourRank, setYourRank] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "desc" });

  useEffect(() => {
    let active = true;

    api.get("/leaderboard/").then((res) => {
      if (!active) return;
      setLeaders(Array.isArray(res.data?.leaders) ? res.data.leaders : []);
      setYourRank(res.data?.your_rank || null);
    });

    return () => {
      active = false;
    };
  }, []);

  const sortedLeaders = useMemo(() => {
    if (!Array.isArray(leaders)) return [];
    if (!sortConfig.key) return leaders;

    const multiplier = sortConfig.direction === "asc" ? 1 : -1;
    return [...leaders].sort((a, b) => {
      const aValue = Number(a?.[sortConfig.key] || 0);
      const bValue = Number(b?.[sortConfig.key] || 0);
      return (aValue - bValue) * multiplier;
    });
  }, [leaders, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const rankIcon = (rank) => {
    if (rank === 1) {
      return <Trophy size={16} className="text-amber-500" aria-label="first place" />;
    }
    if (rank === 2) {
      return <Medal size={16} className="text-slate-400" aria-label="second place" />;
    }
    if (rank === 3) {
      return <Medal size={16} className="text-amber-700" aria-label="third place" />;
    }
    return null;
  };

  const sortLabel = (key) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? "asc" : "desc";
  };

  if (!leaders) return <Loading label="Loading leaderboard..." />;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">Leaderboard</h1>

      {yourRank ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <div className="text-sm font-bold text-sky-900">Your Rank: #{yourRank.rank}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-sky-900/90">
            <SkillBadge skill={yourRank.skill_label} attemptsCount={yourRank.total_attempts} />
            <span>Accuracy {yourRank.accuracy}%</span>
            <span>Attempts {yourRank.total_attempts}</span>
            <span>Avg Time {yourRank.avg_response_time}s</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2">Rank</th>
              <th className="py-2">User</th>
              <th className="py-2">Skill</th>
              <th className="py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("accuracy")}
                  className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Accuracy
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{sortLabel("accuracy")}</span>
                </button>
              </th>
              <th className="py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("total_attempts")}
                  className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Attempts
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">{sortLabel("total_attempts")}</span>
                </button>
              </th>
              <th className="py-2">Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaders.map((row, index) => (
              <MotionRow
                key={row.rank}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, delay: index * 0.05, ease: "easeOut" }}
                className={`border-b border-slate-100 ${row.is_current_user ? "bg-sky-50/60" : ""}`}
              >
                <td className="py-2 font-semibold">
                  <div className="inline-flex items-center gap-2">
                    {rankIcon(row.rank)}
                    <span>#{row.rank}</span>
                  </div>
                </td>
                <td className="py-2">{row.username}</td>
                <td className="py-2"><SkillBadge skill={row.skill_label} attemptsCount={row.total_attempts} /></td>
                <td className="py-2">{row.accuracy}%</td>
                <td className="py-2">{row.total_attempts}</td>
                <td className="py-2">{row.avg_response_time}s</td>
              </MotionRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
