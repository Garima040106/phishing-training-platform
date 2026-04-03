const styles = {
  beginner: "bg-amber-100 text-amber-700 border-amber-200",
  intermediate: "bg-blue-100 text-blue-700 border-blue-200",
  advanced: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function SkillBadge({ skill }) {
  const color = styles[skill] || styles.beginner;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}>
      {skill?.toUpperCase()}
    </span>
  );
}
