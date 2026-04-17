import React from "react";

const SkillBadge = ({ skill, confidence, attemptsCount }) => {
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
        return "bg-red-500 text-white";
      case "intermediate":
        return "bg-yellow-400 text-slate-900";
      case "advanced":
        return "bg-green-500 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  })();

  const attemptsLabel = Math.max(0, Number(attemptsCount || 0));
  const tooltipText = `Based on your last ${attemptsLabel} attempts`;

  return (
    <div className="group relative inline-flex">
      <div className={`skill-badge-pulse inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${color}`}>
        <span className="capitalize">{label}</span>
        {pct == null ? null : <span className="opacity-90">{pct}%</span>}
      </div>

      <div
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100"
      >
        {tooltipText}
      </div>
    </div>
  );
};

export default SkillBadge;
