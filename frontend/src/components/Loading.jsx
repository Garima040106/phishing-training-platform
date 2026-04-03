export default function Loading({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
        {label}
      </div>
    </div>
  );
}
