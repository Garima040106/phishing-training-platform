import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";

const MotionDiv = motion.div;
const MotionButton = motion.button;

const TOTAL_QUESTIONS = 10;

const INDICATOR_TO_CATEGORY = {
  links: "URL tricks",
  urgency: "Urgency language",
  sender: "Sender spoofing",
};

function difficultyPill(difficulty) {
  const d = String(difficulty || "").toLowerCase();
  if (d === "easy") return "border-success/45 bg-success/15 text-success";
  if (d === "medium") return "border-warning/45 bg-warning/15 text-warning";
  if (d === "hard") return "border-danger/45 bg-danger/15 text-danger";
  return "border-white/20 bg-white/5 text-text";
}

function buildExplanation({ isCorrect, scenarioIsPhishing, indicators, timedOut }) {
  const verdict = scenarioIsPhishing ? "phishing" : "legitimate";
  const base = isCorrect
    ? `Correct. This email is ${verdict}.`
    : `Incorrect. This email is ${verdict}.`;

  const hint = Array.isArray(indicators) && indicators.length
    ? `Key signals: ${indicators.slice(0, 4).join(", ")}.`
    : "";

  const timeoutNote = timedOut ? " (Timed out)" : "";
  return `${base}${timeoutNote}${hint ? ` ${hint}` : ""}`;
}

export default function QuizPage() {
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState({
    "URL tricks": 0,
    "Urgency language": 0,
    "Sender spoofing": 0,
  });

  const [timer, setTimer] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const startedAtRef = useRef(Date.now());

  const scenario = payload?.scenario;
  const difficulty = payload?.difficulty;

  const progressLabel = useMemo(() => `${questionIndex + 1} / ${TOTAL_QUESTIONS}`, [questionIndex]);

  const fetchScenario = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/practice/");
      setPayload(res.data);
      startedAtRef.current = Date.now();
      setTimer(30);
      setFeedback(null);
    } catch (err) {
      setError(
        err?.response?.status === 401
          ? "Please sign in to continue."
          : err?.response?.data?.error || "Failed to fetch scenario."
      );
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScenario();
  }, [fetchScenario]);

  const submitAnswer = useCallback(
    async (answer, { timedOut = false } = {}) => {
      if (!scenario || submitting || feedback) return;
      setSubmitting(true);
      setError("");

      const elapsedSec = Math.max(1, (Date.now() - startedAtRef.current) / 1000);

      try {
        const res = await api.post("/practice/submit/", {
          scenario_id: scenario.id,
          answer,
          response_time: Math.round(elapsedSec * 10) / 10,
        });

        const fb = res.data;
        const isCorrect = Boolean(fb.is_correct);

        if (isCorrect) {
          setScore((s) => s + 1);
        } else {
          const indicators = Array.isArray(fb.indicators) ? fb.indicators : [];
          setMistakes((prev) => {
            const next = { ...prev };
            for (const ind of indicators) {
              const cat = INDICATOR_TO_CATEGORY[ind];
              if (cat) next[cat] = (next[cat] || 0) + 1;
            }
            return next;
          });
        }

        setFeedback({
          isCorrect,
          explanation: buildExplanation({
            isCorrect,
            scenarioIsPhishing: Boolean(fb.scenario_is_phishing),
            indicators: fb.indicators,
            timedOut,
          }),
          raw: fb,
        });
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to submit answer.");
      } finally {
        setSubmitting(false);
      }
    },
    [feedback, scenario, submitting]
  );

  useEffect(() => {
    if (loading) return;
    if (!scenario) return;
    if (feedback) return;

    if (timer <= 0) {
      void submitAnswer("legitimate", { timedOut: true });
      return;
    }

    const id = window.setInterval(() => setTimer((t) => t - 1), 1000);
    return () => window.clearInterval(id);
  }, [feedback, loading, scenario, submitAnswer, timer]);

  const next = async () => {
    const nextIndex = questionIndex + 1;
    if (nextIndex >= TOTAL_QUESTIONS) {
      const nextDifficulty = feedback?.raw?.next_difficulty || "medium";
      navigate("/result", {
        state: {
          resultData: {
            score,
            total_questions: TOTAL_QUESTIONS,
            mistakes_by_category: mistakes,
            next_difficulty: nextDifficulty,
          },
        },
      });
      return;
    }

    setQuestionIndex(nextIndex);
    await fetchScenario();
  };

  if (loading && !payload) return <Loading label="Loading practice scenario..." />;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-text">Live Phishing Simulation</h1>
          <p className="mt-1 text-sm text-muted">Classify each email in under 30 seconds.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/15 bg-surface px-3 py-1 text-sm font-semibold text-text">
            {progressLabel}
          </div>
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-extrabold ${
              timer <= 10
                ? "border-danger/45 bg-danger/15 text-danger"
                : "border-accent/35 bg-accent/10 text-accent"
            }`}
          >
            <Clock3 className="h-3.5 w-3.5" />
            {timer}s
          </div>
        </div>
      </div>

      {error ? (
        <GlowCard className="border-danger/35 bg-danger/10 p-4 text-danger">{error}</GlowCard>
      ) : null}

      {!scenario ? (
        <GlowCard className="p-6 text-sm text-muted">No scenario available.</GlowCard>
      ) : (
        <GlowCard className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-background/50 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-muted">Email scenario</div>
              <div className="mt-1 truncate text-xl font-extrabold text-text">{scenario.title}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`rounded-full border px-3 py-1 text-sm font-extrabold capitalize ${difficultyPill(difficulty)}`}>
                {difficulty}
              </div>
              <div className="hidden rounded-full border border-white/15 bg-surface px-3 py-1 text-xs font-semibold text-muted sm:block">
                {payload?.assigned_by === "manual_override" ? "Manual" : "Adaptive"}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-xl border border-white/10 bg-background/65 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-muted">From</div>
                  <div className="mt-1 break-words font-mono text-sm text-text">{scenario.sender_email}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-muted">Subject</div>
                  <div className="mt-1 text-sm font-semibold text-text">{scenario.subject}</div>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">Body</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text/90">{scenario.body}</div>
              </div>
            </div>

            {!feedback ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MotionButton
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  onClick={() => submitAnswer("phishing")}
                  className="rounded-xl border border-danger/40 bg-danger/85 px-5 py-3 text-base font-extrabold text-white transition hover:bg-danger disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Phishing
                  </span>
                </MotionButton>
                <MotionButton
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={submitting}
                  onClick={() => submitAnswer("legitimate")}
                  className="rounded-xl border border-success/40 bg-success/85 px-5 py-3 text-base font-extrabold text-background transition hover:bg-success disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Legitimate
                  </span>
                </MotionButton>
              </div>
            ) : (
              <MotionDiv
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-5 rounded-xl border p-4 ${
                  feedback.isCorrect
                    ? "border-success/40 bg-success/12"
                    : "border-danger/40 bg-danger/12"
                }`}
              >
                <div className={`text-sm font-extrabold ${feedback.isCorrect ? "text-success" : "text-danger"}`}>
                  {feedback.isCorrect ? "Correct" : "Incorrect"}
                </div>
                <div className="mt-1 text-sm text-text/90">{feedback.explanation}</div>

                {Array.isArray(feedback.raw?.indicators) && feedback.raw.indicators.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {feedback.raw.indicators.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/15 bg-surface px-2.5 py-1 text-xs font-semibold text-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted">
                    Score: <span className="font-extrabold text-text">{score}</span>
                  </div>
                  <MotionButton
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={next}
                    className="rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-extrabold text-white shadow-glow"
                  >
                    {questionIndex + 1 >= TOTAL_QUESTIONS ? "View results" : "Next"}
                  </MotionButton>
                </div>
              </MotionDiv>
            )}
          </div>
        </GlowCard>
      )}
    </MotionDiv>
  );
}
