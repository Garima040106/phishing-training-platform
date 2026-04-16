import React from "react";

const Loading = ({ label }) => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#1a237e]" />
      {label ? <div className="text-sm font-medium text-slate-600">{label}</div> : null}
    </div>
  );
};

export default Loading;
