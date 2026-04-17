import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, { initCsrf } from "../api/client";
import Loading from "../components/Loading";

export default function PracticePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEmpty, setIsEmpty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [start, setStart] = useState(() => Date.now());

  const difficulty = useMemo(() => new URLSearchParams(location.search).get("difficulty"), [location.search]);

  const fetchScenario = useCallback(async () => {
    const endpoint = difficulty ? `/practice/?difficulty=${difficulty}` : "/practice/";
    setIsLoading(true);
    setError("");
    setIsEmpty(false);

    try {
      const res = await api.get(endpoint);
      setPayload(res.data);
      setStart(Date.now());
      setSecondsLeft(30);
    } catch (err) {
      if (err?.response?.data?.baseline_required) {
        navigate("/quiz", { replace: true });
        return;
      }

      if (err?.response?.status === 404) {
        setIsEmpty(true);
        setPayload(null);
        return;
      }

      setError("Unable to load a practice scenario right now. Please try again.");
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [difficulty, navigate]);

  useEffect(() => {
    void fetchScenario();
  }, [fetchScenario]);

  const submit = useCallback(async (answer, timedOut = false) => {
    if (!payload?.scenario || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await initCsrf();
      const elapsed = timedOut ? 30 : Math.max(1, (Date.now() - start) / 1000);
      const body = new URLSearchParams({
        scenario_id: String(payload.scenario.id),
        answer,
        response_time: String(Math.round(elapsed * 10) / 10),
      });
      const { data } = await api.post("/practice/submit/", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (timedOut) {
        data.timed_out = true;
      }

      navigate("/result", { state: data });
    } catch {
      setError("Failed to submit your answer. Please retry.");
      setIsSubmitting(false);
    }
  }, [isSubmitting, navigate, payload, start]);

  useEffect(() => {
    if (!payload?.scenario || isSubmitting) return undefined;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void submit("legitimate", true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isSubmitting, payload?.scenario, submit]);

  if (isLoading) return <Loading label="Loading practice scenario..." />;

  if (error) {
    return (
      <div className="card-padded border border-red-200 bg-red-50">
        <h2 className="text-xl font-semibold text-red-800">Could not load practice</h2>
        <p className="mt-2 text-red-700">{error}</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="card-padded">
        <h2 className="text-2xl font-bold text-slate-900">No scenarios available</h2>
        <p className="mt-2 text-slate-600">
          The practice scenario database is currently empty. Please run the seed command and try again.
        </p>
      </div>
    );
  }

  if (!payload?.scenario) return null;

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
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">Time remaining to classify this email</p>
          <p className={`text-2xl font-bold ${secondsLeft <= 10 ? "text-red-700" : "text-amber-900"}`}>{secondsLeft}s</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Inbox message</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{scenario.subject}</p>
          </div>

          <div className="px-5 py-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr] sm:gap-x-3">
              <p className="font-semibold text-slate-600">From</p>
              <p className="font-mono text-slate-700 break-all">{scenario.sender}</p>

              <p className="font-semibold text-slate-600">Subject</p>
              <p className="text-slate-800">{scenario.subject}</p>

              <p className="font-semibold text-slate-600">Body</p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{scenario.body}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => submit("phishing")}
            className="btn-danger flex-1 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            🚨 Phishing
          </button>
          <button
            onClick={() => submit("legitimate")}
            className="btn-success flex-1 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            ✓ Legitimate
          </button>
        </div>
      </div>
    </div>
  );
}
