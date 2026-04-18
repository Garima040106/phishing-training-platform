import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

import api, { initCsrf } from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";

const MotionButton = motion.button;

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
      <GlowCard className="border-danger/35 bg-danger/10 p-5">
        <h2 className="text-xl font-semibold text-danger">Could not load practice</h2>
        <p className="mt-2 text-text/90">{error}</p>
      </GlowCard>
    );
  }

  if (isEmpty) {
    return (
      <GlowCard className="p-5">
        <h2 className="text-2xl font-bold text-text">No scenarios available</h2>
        <p className="mt-2 text-muted">
          The practice scenario database is currently empty. Please run the seed command and try again.
        </p>
      </GlowCard>
    );
  }

  if (!payload?.scenario) return null;

  const { scenario } = payload;
  const senderAddress = scenario.sender || scenario.sender_email || "Unknown sender";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-text">
          Practice • <span className="capitalize text-accent">{payload.difficulty}</span>
        </h1>
        <p className="text-muted">
          Assigned by:{" "}
          <span className="font-semibold capitalize text-accent">
            {(payload.assigned_by || "adaptive_engine").replace("_", " ")}
          </span>
        </p>
      </div>

      <GlowCard className="p-5">
        <div className="mb-4 flex items-center justify-between rounded-lg border border-warning/35 bg-warning/10 px-4 py-3">
          <p className="text-sm font-medium text-warning">Time remaining to classify this email</p>
          <p className={`text-2xl font-bold ${secondsLeft <= 10 ? "text-danger" : "text-warning"}`}>{secondsLeft}s</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-background/60 shadow-card">
          <div className="border-b border-white/10 bg-background/80 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">Inbox message</p>
            <p className="mt-2 text-lg font-semibold text-text">{scenario.subject}</p>
          </div>

          <div className="px-5 py-4 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[72px_1fr] sm:gap-x-3">
              <p className="font-semibold text-muted">From</p>
              <p className="break-all font-mono text-text/90">{senderAddress}</p>

              <p className="font-semibold text-muted">Subject</p>
              <p className="text-text">{scenario.subject}</p>

              <p className="font-semibold text-muted">Body</p>
              <div className="rounded-md border border-white/10 bg-surface p-3">
                <p className="whitespace-pre-wrap leading-relaxed text-text/90">{scenario.body}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <MotionButton
            onClick={() => submit("phishing")}
            whileTap={{ scale: 0.96 }}
            className="flex-1 rounded-lg border border-danger/35 bg-danger px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            Phishing
          </MotionButton>
          <MotionButton
            onClick={() => submit("legitimate")}
            whileTap={{ scale: 0.96 }}
            className="flex-1 rounded-lg border border-success/35 bg-success px-4 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            Legitimate
          </MotionButton>
        </div>
      </GlowCard>
    </div>
  );
}
