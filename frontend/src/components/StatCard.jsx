import GlowCard from "./GlowCard";

const StatCard = ({ title, children }) => {
  return (
    <GlowCard className="p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </GlowCard>
  );
};

export default StatCard;
