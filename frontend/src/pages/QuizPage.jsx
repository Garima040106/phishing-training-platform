import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";

export default function QuizPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState(null);
  const [answers, setAnswers] = useState({});
  const [start] = useState(Date.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/quiz/baseline/").then((res) => setScenarios(res.data.scenarios));
  }, []);

  const allAnswered = useMemo(() => scenarios?.every((s) => answers[s.id]), [scenarios, answers]);

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
      await api.post("/quiz/submit/", body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  if (!scenarios) return <Loading label="Loading baseline quiz..." />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h1 className="text-2xl font-bold">Baseline Quiz</h1>
      {scenarios.map((s, idx) => (
        <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-lg font-semibold">{idx + 1}. {s.title}</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p><span className="font-semibold">From:</span> {s.sender_email}</p>
            <p><span className="font-semibold">Subject:</span> {s.subject}</p>
            <p className="mt-2 whitespace-pre-wrap">{s.body}</p>
          </div>
          <div className="mt-3 flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name={`ans-${s.id}`} value="phishing" checked={answers[s.id] === "phishing"} onChange={(e) => setAnswers((v) => ({ ...v, [s.id]: e.target.value }))} />
              Phishing
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name={`ans-${s.id}`} value="legitimate" checked={answers[s.id] === "legitimate"} onChange={(e) => setAnswers((v) => ({ ...v, [s.id]: e.target.value }))} />
              Legitimate
            </label>
          </div>
        </div>
      ))}

      <button disabled={!allAnswered || saving} className="rounded-lg bg-[#1a237e] px-5 py-2 font-semibold text-white disabled:opacity-50">
        {saving ? "Submitting..." : "Submit Quiz"}
      </button>
    </form>
  );
}
