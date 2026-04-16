import React from "react";

const SkillBadge = ({ skill, confidence }) => {
  const label = String(skill || "unknown");
  const normalized = label.toLowerCase();

  const pct =
    confidence == null
      ? null
      : Number(confidence) <= 1
        ? Math.round(Number(confidence) * 100)
        : Math.round(Number(confidence));

  const color = (() => {
    switch (normalized) {
      case "beginner":
        return "bg-red-500";
      case "intermediate":
        return "bg-yellow-500 text-slate-900";
      case "advanced":
        return "bg-green-500";
      default:
        return "bg-slate-500";
    }
  })();

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${color}`}>
      <span className="capitalize">{label}</span>
      {pct == null ? null : <span className="opacity-90">{pct}%</span>}
    </div>
  );
};

export default SkillBadge;
