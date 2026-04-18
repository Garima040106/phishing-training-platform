import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Medal, Trophy } from "lucide-react";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";
import SkillBadge from "../components/SkillBadge";

const MotionDiv = motion.div;
const MotionRow = motion.tr;

const PODIUM_STYLE = {
  1: {
    glow: "shadow-[0_0_35px_rgba(245,158,11,0.4)] border-amber-300/40",
    pedestal: "h-28 bg-gradient-to-b from-amber-300/65 to-amber-500/40",
    badge: "text-amber-200 bg-amber-500/15 border-amber-300/35",
    label: "#1",
  },
  2: {
    glow: "shadow-[0_0_30px_rgba(209,213,219,0.32)] border-slate-300/35",
    pedestal: "h-20 bg-gradient-to-b from-slate-200/60 to-slate-400/35",
    badge: "text-slate-100 bg-slate-400/12 border-slate-300/30",
    label: "#2",
  },
  3: {
    glow: "shadow-[0_0_30px_rgba(180,83,9,0.3)] border-amber-700/45",
    pedestal: "h-16 bg-gradient-to-b from-amber-600/60 to-amber-800/35",
    badge: "text-amber-300 bg-amber-700/12 border-amber-700/35",
    label: "#3",
  },
};

function podiumIcon(rank) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-amber-300" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-200" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />;
  return null;
}

function SortButton({ label, active, direction, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-semibold text-white/70 transition hover:text-white"
    >
      {label}
      {active ? (
        direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <span className="text-[10px] uppercase tracking-wide text-white/40">Sort</span>
      )}
    </button>
  );
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState(null);
  const [yourRank, setYourRank] = useState(null);
  const [fetchError, setFetchError] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "desc" });

  useEffect(() => {
    let alive = true;

    api
      .get("/leaderboard/")
      .then((res) => {
        if (!alive) return;
        setLeaders(Array.isArray(res.data?.leaders) ? res.data.leaders : []);
        setYourRank(res.data?.your_rank || null);
      })
      .catch(() => {
        if (!alive) return;
        setLeaders([]);
        setYourRank(null);
        setFetchError("Unable to load leaderboard right now.");
      });

    return () => {
      alive = false;
    };
  }, []);

  const podium = useMemo(() => {
    if (!Array.isArray(leaders)) return [];
    const byRank = new Map(leaders.map((entry) => [entry.rank, entry]));
    return [2, 1, 3].map((rank) => byRank.get(rank)).filter(Boolean);
  }, [leaders]);

  const mergedRows = useMemo(() => {
    if (!Array.isArray(leaders)) return [];

    const next = [...leaders];
    if (yourRank && !next.some((row) => row.rank === yourRank.rank)) {
      next.push(yourRank);
    }
    return next;
  }, [leaders, yourRank]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) {
      return [...mergedRows].sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
    }

    const direction = sortConfig.direction === "asc" ? 1 : -1;
    return [...mergedRows].sort((a, b) => {
      const aValue = Number(a?.[sortConfig.key] || 0);
      const bValue = Number(b?.[sortConfig.key] || 0);
      return (aValue - bValue) * direction;
    });
  }, [mergedRows, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "desc" };
    });
  };

  if (leaders === null) {
    return <Loading label="Loading leaderboard..." />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(13,17,32,0.95),rgba(18,24,42,0.95),rgba(9,13,24,0.95))] p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-12 top-0 h-48 w-48 rounded-full bg-violet-500/18 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-cyan-400/16 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/35 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-rose-200">
              <Flame className="h-3.5 w-3.5" />
              Weekly Standings
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Leaderboard</h1>
            <p className="mt-2 text-sm text-white/70">Top performers this week</p>
          </div>
        </div>
      </div>

      {podium.length ? (
        <GlowCard className="overflow-hidden border border-white/10 bg-[#0d1423]/85 p-6">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-white/50">Top 3 Podium</div>

          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            {podium.map((entry, index) => {
              const rank = Number(entry.rank || 0);
              const style = PODIUM_STYLE[rank] || PODIUM_STYLE[3];
              const spotlight = rank === 1;

              return (
                <MotionDiv
                  key={`${entry.username}-${entry.rank}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: index * 0.12 }}
                  className={`rounded-2xl border bg-[linear-gradient(155deg,rgba(23,30,50,0.95),rgba(12,18,32,0.95))] p-4 ${style.glow} ${spotlight ? "md:-translate-y-3" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${style.badge}`}>{style.label}</span>
                    {podiumIcon(rank)}
                  </div>

                  <div className="mt-4">
                    <div className="truncate text-lg font-black text-white">{entry.username}</div>
                    <div className="mt-2">
                      <SkillBadge skill={entry.skill_label} attemptsCount={entry.total_attempts} />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-white/75">Accuracy {entry.accuracy}%</div>
                  </div>

                  <div className={`mt-4 w-full rounded-xl ${style.pedestal}`} />
                </MotionDiv>
              );
            })}
          </div>
        </GlowCard>
      ) : null}

      <GlowCard className="overflow-hidden border border-white/10 bg-[#0d1423]/85 p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-black/20 text-left text-white/65">
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Skill</th>
                <th className="px-4 py-3 font-semibold">
                  <SortButton
                    label="Accuracy"
                    active={sortConfig.key === "accuracy"}
                    direction={sortConfig.direction}
                    onClick={() => toggleSort("accuracy")}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">
                  <SortButton
                    label="Attempts"
                    active={sortConfig.key === "total_attempts"}
                    direction={sortConfig.direction}
                    onClick={() => toggleSort("total_attempts")}
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Avg Time</th>
              </tr>
            </thead>

            <tbody>
              {sortedRows.map((row, index) => {
                const isCurrentUser = Boolean(row.is_current_user);
                return (
                  <MotionRow
                    key={`${row.rank}-${row.username}-${index}`}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.24, delay: index * 0.06 }}
                    className={`border-b border-white/8 ${isCurrentUser ? "bg-violet-500/16" : "bg-transparent"}`}
                  >
                    <td className="px-4 py-3 font-bold text-white">#{row.rank}</td>
                    <td className="px-4 py-3 text-white/90">{row.username}</td>
                    <td className="px-4 py-3">
                      <SkillBadge skill={row.skill_label} attemptsCount={row.total_attempts} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-white/90">{row.accuracy}%</td>
                    <td className="px-4 py-3 text-white/80">{row.total_attempts}</td>
                    <td className="px-4 py-3 text-white/70">{row.avg_response_time}s</td>
                  </MotionRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlowCard>

      {fetchError ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {fetchError}
        </div>
      ) : null}
    </div>
  );
}
