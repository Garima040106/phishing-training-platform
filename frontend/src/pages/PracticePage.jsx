import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";

export default function PracticePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [start, setStart] = useState(() => Date.now());

  const difficulty = useMemo(() => new URLSearchParams(location.search).get("difficulty"), [location.search]);

  useEffect(() => {
    const endpoint = difficulty ? `/practice/?difficulty=${difficulty}` : "/practice/";
    api
      .get(endpoint)
      .then((res) => {
        setPayload(res.data);
        setStart(Date.now());
      })
      .catch((err) => {
        if (err?.response?.data?.baseline_required) {
          navigate("/quiz", { replace: true });
        }
      });
  }, [difficulty, navigate]);

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
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          Practice • <span className="text-[#1a237e] capitalize">{payload.difficulty}</span>
        </h1>
        <p className="text-slate-600">
          Assigned by: <span className="font-semibold capitalize text-[#1a237e]">{(payload.assigned_by || "adaptive_engine").replace("_", " ")}</span>
        </p>
      </div>

      <div className="card-padded">
        <p className="text-2xl font-bold text-slate-900 mb-4">{scenario.title}</p>
        <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-5 text-sm space-y-3">
          <div>
            <span className="font-semibold text-slate-700">From:</span>
            <p className="text-slate-600 font-mono mt-1">{scenario.sender_email}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Subject:</span>
            <p className="text-slate-600 mt-1">{scenario.subject}</p>
          </div>
          <div className="border-t border-slate-300 pt-3">
            <p className="whitespace-pre-wrap text-slate-700">{scenario.body}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => submit("phishing")}
            className="btn-danger flex-1"
          >
            🚨 Phishing
          </button>
          <button
            onClick={() => submit("legitimate")}
            className="btn-success flex-1"
          >
            ✓ Legitimate
          </button>
        </div>
      </div>
    </div>
  );
}
