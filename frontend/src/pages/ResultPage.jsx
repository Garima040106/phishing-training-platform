import { Link, useLocation, useNavigate } from "react-router-dom";
import SkillBadge from "../components/SkillBadge";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) {
    navigate("/practice");
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className={`text-2xl font-bold ${state.is_correct ? "text-emerald-700" : "text-rose-700"}`}>
          {state.is_correct ? "Correct" : "Incorrect"}
        </h1>
        <p className="mt-2 text-slate-700">
          This scenario is {state.scenario_is_phishing ? "phishing" : "legitimate"}.
        </p>
      </div>

      {state.scenario_is_phishing && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Phishing Indicators</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {state.indicators.map((ind) => (
              <li key={ind}>{ind}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Profile Snapshot</h2>
        <div className="mt-3 flex items-center gap-4">
          <SkillBadge skill={state.profile.skill_level} />
          <p className="text-sm text-slate-700">Accuracy: {state.profile.accuracy}%</p>
        </div>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p>
            Next difficulty: <span className="font-semibold capitalize">{state.next_difficulty || "easy"}</span>
          </p>
          {state.behavioral_record_id && (
            <p>
              Behavioral record created: <span className="font-semibold">#{state.behavioral_record_id}</span>
            </p>
          )}
        </div>
      </div>

      {state.adaptive_feedback && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-sky-900">Adaptive Feedback</h2>
          <p className="mt-2 text-sm text-sky-800">{state.adaptive_feedback}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link to="/practice" className="rounded-lg bg-[#1a237e] px-4 py-2 font-semibold text-white">Next Scenario</Link>
        <Link to="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700">Back to Dashboard</Link>
      </div>
    </div>
  );
}
