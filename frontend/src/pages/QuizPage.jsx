import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import api from "../api/client";
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
  if (d === "easy") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (d === "medium") return "bg-amber-100 text-amber-900 border-amber-200";
  if (d === "hard") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function buildExplanation({ isCorrect, scenarioIsPhishing, indicators, timedOut }) {
  const verdict = scenarioIsPhishing ? "phishing" : "legitimate";
  const base = isCorrect
    ? `Correct — this email is ${verdict}.`
    : `Incorrect — this email is ${verdict}.`;

  const hint = Array.isArray(indicators) && indicators.length
    ? `Key signals: ${indicators.slice(0, 4).join(", ")}.`
    : "";

  const timeoutNote = timedOut ? " (Timed out)" : "";
  return `${base}${timeoutNote}${hint ? " " + hint : ""}`;
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
    fetchScenario();
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
    [scenario, submitting, feedback]
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
  }, [loading, scenario, feedback, timer, submitAnswer]);

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

  if (loading && !payload) return <Loading label="Loading practice scenario…" />;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Practice</h1>
          <p className="mt-1 text-sm text-slate-600">Classify each email in under 30 seconds.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
            {progressLabel}
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-sm font-extrabold ${
              timer <= 10 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {timer}s
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>
      ) : null}

      {!scenario ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-600">No scenario available.</div>
        </div>
      ) : (
        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-500">Email scenario</div>
              <div className="mt-1 truncate text-xl font-extrabold text-slate-900">{scenario.title}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`rounded-full border px-3 py-1 text-sm font-extrabold capitalize ${difficultyPill(difficulty)}`}>
                {difficulty}
              </div>
              <div className="hidden sm:block rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                {payload?.assigned_by === "manual_override" ? "Manual" : "Adaptive"}
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">From</div>
                  <div className="mt-1 break-words font-mono text-sm text-slate-800">{scenario.sender_email}</div>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Subject</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{scenario.subject}</div>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Body</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{scenario.body}</div>
              </div>
            </div>

            {!feedback ? (
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MotionButton
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting}
                  onClick={() => submitAnswer("phishing")}
                  className="rounded-2xl bg-rose-600 px-5 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                >
                  Phishing
                </MotionButton>
                <MotionButton
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting}
                  onClick={() => submitAnswer("legitimate")}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-base font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  Legitimate
                </MotionButton>
              </div>
            ) : (
              <MotionDiv
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-5 rounded-2xl border p-4 ${
                  feedback.isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                }`}
              >
                <div className={`text-sm font-extrabold ${feedback.isCorrect ? "text-emerald-900" : "text-rose-900"}`}>
                  {feedback.isCorrect ? "Correct" : "Wrong"}
                </div>
                <div className={`mt-1 text-sm ${feedback.isCorrect ? "text-emerald-900/80" : "text-rose-900/80"}`}>
                  {feedback.explanation}
                </div>

                {Array.isArray(feedback.raw?.indicators) && feedback.raw.indicators.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {feedback.raw.indicators.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600">
                    Score: <span className="font-extrabold text-slate-900">{score}</span>
                  </div>
                  <MotionButton
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={next}
                    className="rounded-2xl bg-[#1a237e] px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-[#121a5f]"
                  >
                    {questionIndex + 1 >= TOTAL_QUESTIONS ? "View results" : "Next"}
                  </MotionButton>
                </div>
              </MotionDiv>
            )}
          </div>
        </MotionDiv>
      )}
    </MotionDiv>
  );
}
