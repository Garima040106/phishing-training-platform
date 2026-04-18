const Loading = ({ label }) => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-surfaceHover border-t-accent shadow-glow" />
      {label ? <div className="text-sm font-medium text-muted">{label}</div> : null}
    </div>
  );
};

export default Loading;
