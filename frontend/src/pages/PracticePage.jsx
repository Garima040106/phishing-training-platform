import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";

export default function PracticePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [start, setStart] = useState(Date.now());

  const difficulty = useMemo(() => new URLSearchParams(location.search).get("difficulty") || "easy", [location.search]);

  useEffect(() => {
    api.get(`/practice/?difficulty=${difficulty}`).then((res) => {
      setPayload(res.data);
      setStart(Date.now());
    });
  }, [difficulty]);

  const submit = async (answer) => {
    if (!payload?.scenario) return;
    await initCsrf();
    const elapsed = Math.max(1, (Date.now() - start) / 1000);
    const body = new URLSearchParams({
      scenario_id: String(payload.scenario.id),
      answer,
      response_time: String(Math.round(elapsed * 10) / 10),
    });
    const { data } = await api.post("/practice/submit/", body, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    navigate("/result", { state: data });
  };

  if (!payload) return <Loading label="Loading practice scenario..." />;

  const { scenario } = payload;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Practice • <span className="capitalize">{payload.difficulty}</span></h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold">{scenario.title}</p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p><span className="font-semibold">From:</span> {scenario.sender_email}</p>
          <p><span className="font-semibold">Subject:</span> {scenario.subject}</p>
          <p className="mt-2 whitespace-pre-wrap">{scenario.body}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={() => submit("phishing")} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Phishing</button>
          <button onClick={() => submit("legitimate")} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Legitimate</button>
        </div>
      </div>
    </div>
  );
}
