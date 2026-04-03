import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";

export default function QuizPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState(null);
  const [completedMsg, setCompletedMsg] = useState("");
  const [answers, setAnswers] = useState({});
  const [start] = useState(Date.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/quiz/baseline/").then((res) => {
      if (res.data.completed) {
        setCompletedMsg(res.data.message || "Baseline already completed.");
        setScenarios([]);
        return;
      }
      setScenarios(res.data.scenarios);
    });
  }, []);

  const allAnswered = useMemo(() => scenarios?.length === 10 && scenarios.every((s) => answers[s.id]), [scenarios, answers]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!scenarios) return;
    setSaving(true);
    try {
      await initCsrf();
      const elapsed = Math.max(5, (Date.now() - start) / 1000 / scenarios.length);
      const body = new URLSearchParams();
      scenarios.forEach((scenario) => {
        body.append("scenario_ids[]", String(scenario.id));
        body.append(`answer_${scenario.id}`, answers[scenario.id]);
        body.append(`time_${scenario.id}`, String(Math.round(elapsed * 10) / 10));
      });
      const { data } = await api.post("/quiz/submit/", body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      navigate("/dashboard", {
        state: {
          baselineSummary: {
            behavioralRecordId: data.behavioral_record_id,
            adaptiveFeedback: data.adaptive_feedback,
            nextDifficulty: data.next_difficulty,
          },
        },
      });
    } finally {
      setSaving(false);
    }
  };

  if (!scenarios) return <Loading label="Loading baseline quiz..." />;

  if (completedMsg) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Baseline Quiz</h1>
        <div className="card-padded rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 shadow-md">
          <p className="text-lg font-bold text-emerald-900">✓ Quiz Completed</p>
          <p className="mt-3 text-emerald-800">{completedMsg}</p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Baseline Quiz</h1>
        <p className="text-slate-600">
          Phase 1 assessment: complete all 10 questions to generate your behavioral profile for adaptive learning.
        </p>
      </div>

      {scenarios.map((s, idx) => (
        <div key={s.id} className="card-padded">
          <p className="mb-4 text-2xl font-bold text-slate-900">
            <span className="text-[#1a237e]">Q{idx + 1}.</span> {s.title}
          </p>
          <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-5">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold text-slate-700">From:</span>
                <p className="text-slate-600 font-mono">{s.sender_email}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Subject:</span>
                <p className="text-slate-600">{s.subject}</p>
              </div>
              <div className="border-t border-slate-300 pt-3 mt-3">
                <p className="whitespace-pre-wrap text-slate-700">{s.body}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <p className="font-semibold text-slate-700">Is this email phishing or legitimate?</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 cursor-pointer hover:bg-slate-50 hover:border-[#1a237e] transition-all duration-200">
                <input
                  type="radio"
                  name={`ans-${s.id}`}
                  value="phishing"
                  checked={answers[s.id] === "phishing"}
                  onChange={(e) => setAnswers((v) => ({ ...v, [s.id]: e.target.value }))}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <span className="font-semibold text-slate-900">Phishing</span>
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 cursor-pointer hover:bg-slate-50 hover:border-emerald-600 transition-all duration-200">
                <input
                  type="radio"
                  name={`ans-${s.id}`}
                  value="legitimate"
                  checked={answers[s.id] === "legitimate"}
                  onChange={(e) => setAnswers((v) => ({ ...v, [s.id]: e.target.value }))}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-2">
                  <span className="text-lg">✓</span>
                  <span className="font-semibold text-slate-900">Legitimate</span>
                </span>
              </label>
            </div>
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent pt-4 flex gap-3">
        <button disabled={!allAnswered || saving} className="btn-primary">
          {saving ? "Submitting..." : `Submit Quiz (${scenarios?.filter((s) => answers[s.id]).length || 0}/${scenarios?.length || 0} answered)`}
        </button>
      </div>
    </form>
  );
}
