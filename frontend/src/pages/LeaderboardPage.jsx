import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Medal, Trophy } from "lucide-react";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
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
      return <Trophy size={16} className="text-warning" aria-label="first place" />;
    }
    if (rank === 2) {
      return <Medal size={16} className="text-slate-300" aria-label="second place" />;
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
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Leaderboard</h1>
        <p className="mt-1 text-sm text-muted">Top performers by accuracy, volume, and response quality.</p>
      </div>

      {yourRank ? (
        <GlowCard className="border-accent/30 bg-accent/10 p-4">
          <div className="text-sm font-bold text-accent">Your Rank: #{yourRank.rank}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-text/90">
            <SkillBadge skill={yourRank.skill_label} attemptsCount={yourRank.total_attempts} />
            <span>Accuracy {yourRank.accuracy}%</span>
            <span>Attempts {yourRank.total_attempts}</span>
            <span>Avg Time {yourRank.avg_response_time}s</span>
          </div>
        </GlowCard>
      ) : null}

      <GlowCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-background/70 text-left text-muted">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Skill</th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("accuracy")}
                    className="inline-flex items-center gap-1 font-semibold text-muted transition hover:text-text"
                  >
                    Accuracy
                    <span className="text-[10px] uppercase tracking-wide text-muted">{sortLabel("accuracy")}</span>
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("total_attempts")}
                    className="inline-flex items-center gap-1 font-semibold text-muted transition hover:text-text"
                  >
                    Attempts
                    <span className="text-[10px] uppercase tracking-wide text-muted">{sortLabel("total_attempts")}</span>
                  </button>
                </th>
                <th className="px-4 py-3">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaders.map((row, index) => (
                <MotionRow
                  key={row.rank}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.24, delay: index * 0.05, ease: "easeOut" }}
                  className={`border-b border-white/8 ${row.is_current_user ? "bg-accent/10" : "bg-transparent"}`}
                >
                  <td className="px-4 py-3 font-semibold text-text">
                    <div className="inline-flex items-center gap-2">
                      {rankIcon(row.rank)}
                      <span>#{row.rank}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text">{row.username}</td>
                  <td className="px-4 py-3">
                    <SkillBadge skill={row.skill_label} attemptsCount={row.total_attempts} />
                  </td>
                  <td className="px-4 py-3 text-text">{row.accuracy}%</td>
                  <td className="px-4 py-3 text-text">{row.total_attempts}</td>
                  <td className="px-4 py-3 text-muted">{row.avg_response_time}s</td>
                </MotionRow>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>
    </div>
  );
}
