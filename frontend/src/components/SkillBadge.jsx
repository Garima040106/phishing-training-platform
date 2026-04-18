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
        return "border-warning/40 bg-warning/15 text-warning";
      case "intermediate":
        return "border-accent/45 bg-accent/15 text-accent";
      case "advanced":
        return "border-success/40 bg-success/15 text-success";
      default:
        return "border-white/20 bg-white/5 text-text";
    }
  })();

  const attemptsLabel = Math.max(0, Number(attemptsCount || 0));
  const tooltipText = `Based on your last ${attemptsLabel} attempts`;

  return (
    <div className="group relative inline-flex">
      <div
        className={`skill-badge-pulse inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${color}`}
      >
        <span className="capitalize">{label}</span>
        {pct == null ? null : <span className="opacity-90">{pct}%</span>}
      </div>

      <div
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/15 bg-surface px-2 py-1 text-[11px] font-medium text-text opacity-0 shadow-card transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100"
      >
        {tooltipText}
      </div>
    </div>
  );
};

export default SkillBadge;
