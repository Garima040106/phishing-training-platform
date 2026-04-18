import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import api from "../api/client";
import GlowCard from "../components/GlowCard";
import Loading from "../components/Loading";

const MotionDiv = motion.div;
const MotionSpan = motion.span;
const MotionButton = motion.button;

const TOTAL_QUESTIONS = 10;
const QUESTION_SECONDS = 30;

const INITIAL_MISTAKES = {
  "URL tricks": 0,
  "Urgency language": 0,
  "Sender spoofing": 0,
};

const INDICATOR_TO_CATEGORY = {
  links: "URL tricks",
  urgency: "Urgency language",
  sender: "Sender spoofing",
};

function difficultyPill(difficulty) {
  const normalized = String(difficulty || "").toLowerCase();
  if (normalized === "easy") {
    return "border-emerald-400/55 bg-emerald-500/10 text-emerald-300";
  }
  if (normalized === "medium") {
    return "border-amber-400/55 bg-amber-500/10 text-amber-300";
  }
  if (normalized === "hard") {
    return "border-rose-400/55 bg-rose-500/10 text-rose-300";
  }
  return "border-white/20 bg-white/5 text-text";
}

function timerHue(secondsLeft) {
  const clamped = Math.max(0, Math.min(QUESTION_SECONDS, Number(secondsLeft) || 0));
  const ratio = clamped / QUESTION_SECONDS;
  return Math.round(ratio * 120);
}

function buildExplanation({ isCorrect, scenarioIsPhishing, indicators, timedOut }) {
  const verdict = scenarioIsPhishing ? "phishing" : "legitimate";
  const base = isCorrect
    ? `Correct call. This message is ${verdict}.`
    : `Not quite. This message is ${verdict}.`;

  const hint = Array.isArray(indicators) && indicators.length
    ? `Signals: ${indicators.slice(0, 4).join(", ")}.`
    : "Review sender trust, urgency cues, and link safety.";

  const timeout = timedOut ? " Time expired before submission." : "";
  return `${base}${timeout} ${hint}`.trim();
}

function OverlayFeedback({ feedback }) {
  if (!feedback) return null;

  const isCorrect = Boolean(feedback.isCorrect);
  const overlayTone = isCorrect
    ? {
        border: "border-emerald-400/75",
        glow: "0 0 0 1px rgba(16,185,129,0.45), 0 0 36px rgba(16,185,129,0.35)",
        iconWrap: "bg-emerald-500/20 text-emerald-200",
        title: "text-emerald-300",
        titleText: "Correct",
      }
    : {
        border: "border-rose-400/75",
        glow: "0 0 0 1px rgba(244,63,94,0.45), 0 0 36px rgba(244,63,94,0.32)",
        iconWrap: "bg-rose-500/20 text-rose-200",
        title: "text-rose-300",
        titleText: "Incorrect",
      };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 ${overlayTone.border} bg-[#090c14]/82 backdrop-blur-sm`}
      style={{ boxShadow: overlayTone.glow }}
    >
      <div className="px-5 text-center">
        <MotionDiv
          initial={{ scale: 0.7, opacity: 0, rotate: isCorrect ? -18 : 18 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 250, damping: 16 }}
          className={`mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full ${overlayTone.iconWrap}`}
        >
          {isCorrect ? <Check className="h-9 w-9" /> : <X className="h-9 w-9" />}
        </MotionDiv>

        <MotionDiv
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className={`text-lg font-extrabold ${overlayTone.title}`}
        >
          {overlayTone.titleText}
        </MotionDiv>

        <MotionDiv
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 max-w-xl text-sm leading-6 text-white/85"
        >
          {feedback.explanation}
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}

export default function Practice() {
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [, setMistakes] = useState(INITIAL_MISTAKES);

  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const startedAtRef = useRef(Date.now());
  const scoreRef = useRef(0);
  const mistakesRef = useRef(INITIAL_MISTAKES);

  const scenario = payload?.scenario || null;

  const fetchScenario = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/practice/");
      setPayload(response.data);
      setFeedback(null);
      setSecondsLeft(QUESTION_SECONDS);
      startedAtRef.current = Date.now();
    } catch (err) {
      const message = err?.response?.data?.error || "Unable to fetch a practice scenario.";
      setPayload(null);
      setError(message);
      toast.error(message);
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

      const elapsedSeconds = timedOut
        ? QUESTION_SECONDS
        : Math.max(1, (Date.now() - startedAtRef.current) / 1000);

      try {
        const response = await api.post("/practice/submit/", {
          scenario_id: scenario.id,
          answer,
          response_time: Math.round(elapsedSeconds * 10) / 10,
        });

        const data = response.data;
        const isCorrect = Boolean(data?.is_correct);

        if (isCorrect) {
          scoreRef.current += 1;
          setScore(scoreRef.current);
        } else {
          const tags = Array.isArray(data?.indicators) ? data.indicators : [];
          setMistakes((previous) => {
            const next = { ...previous };
            for (const tag of tags) {
              const mapped = INDICATOR_TO_CATEGORY[String(tag || "").toLowerCase()];
              if (mapped) next[mapped] = (next[mapped] || 0) + 1;
            }
            mistakesRef.current = next;
            return next;
          });
        }

        setFeedback({
          isCorrect,
          explanation: buildExplanation({
            isCorrect,
            scenarioIsPhishing: Boolean(data?.scenario_is_phishing),
            indicators: data?.indicators,
            timedOut,
          }),
          nextDifficulty: data?.next_difficulty || payload?.difficulty || "medium",
        });

        if (timedOut) {
          toast.success("Time up - auto submitted as Legitimate");
        }
      } catch (err) {
        const message = err?.response?.data?.error || "Could not submit your answer.";
        setError(message);
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [feedback, payload, scenario, submitting]
  );

  useEffect(() => {
    if (!scenario || feedback || loading || submitting) return undefined;

    if (secondsLeft <= 0) {
      void submitAnswer("legitimate", { timedOut: true });
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [feedback, loading, scenario, secondsLeft, submitAnswer, submitting]);

  const goToResults = useCallback(
    (nextDifficulty) => {
      navigate("/results", {
        state: {
          resultData: {
            score: scoreRef.current,
            total_questions: TOTAL_QUESTIONS,
            mistakes_by_category: mistakesRef.current,
            next_difficulty: nextDifficulty || "medium",
          },
        },
      });
    },
    [navigate]
  );

  useEffect(() => {
    if (!feedback) return undefined;

    const timeoutId = window.setTimeout(async () => {
      const nextIndex = questionIndex + 1;

      if (nextIndex >= TOTAL_QUESTIONS) {
        goToResults(feedback.nextDifficulty);
        return;
      }

      setQuestionIndex(nextIndex);
      await fetchScenario();
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [feedback, fetchScenario, goToResults, questionIndex]);

  const progressText = useMemo(() => {
    return `Question ${questionIndex + 1} of ${TOTAL_QUESTIONS}`;
  }, [questionIndex]);

  const hue = timerHue(secondsLeft);
  const timerColor = `hsl(${hue} 85% 58%)`;
  const timerSurface = `hsla(${hue} 85% 58% / 0.16)`;
  const timerBorder = `hsla(${hue} 85% 58% / 0.45)`;

  if (loading && !payload) {
    return <Loading label="Loading practice scenario..." />;
  }

  if (!scenario) {
    return (
      <GlowCard className="mx-auto max-w-4xl border-rose-500/35 bg-rose-500/10 p-6">
        <div className="text-lg font-bold text-rose-200">Unable to load scenario</div>
        <p className="mt-2 text-sm text-rose-100/85">{error || "No practice scenario available right now."}</p>
      </GlowCard>
    );
  }

  const sender = scenario.sender || scenario.sender_email || "Unknown sender";
  const subject = scenario.subject || "(No subject)";
  const body = String(scenario.body || "");
  const clippedBody = body.length > 500 ? `${body.slice(0, 500)}...` : body;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="rounded-2xl border border-white/10 bg-[#0d1019]/85 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">PhishGuard AI Drill</div>
            <div className="mt-1 text-lg font-bold text-white">{progressText}</div>
          </div>

          <div
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold"
            style={{ color: timerColor, borderColor: timerBorder, backgroundColor: timerSurface }}
          >
            <MotionSpan
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.2 }}
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: timerColor }}
            />
            {secondsLeft}s remaining
          </div>
        </div>

        <div className="mt-4 grid grid-cols-10 gap-2">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, index) => {
            const answered = index < questionIndex;
            const current = index === questionIndex;

            if (current) {
              return (
                <MotionSpan
                  key={`progress-${index}`}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.75, 1, 0.75] }}
                  transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.15 }}
                  className="h-2.5 rounded-full bg-cyan-300"
                />
              );
            }

            return (
              <span
                key={`progress-${index}`}
                className={`h-2.5 rounded-full ${answered ? "bg-indigo-300" : "bg-white/10"}`}
              />
            );
          })}
        </div>
      </div>

      {error ? (
        <GlowCard className="border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</GlowCard>
      ) : null}

      <AnimatePresence mode="wait">
        <MotionDiv
          key={scenario.id}
          initial={{ opacity: 0, x: 90 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -80 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative"
        >
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1119]/95 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.5)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400 via-indigo-300 to-teal-300" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">Live Email Scenario</div>
                <h2 className="mt-1 text-xl font-extrabold text-white">Classify this message</h2>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${difficultyPill(payload?.difficulty)}`}>
                {payload?.difficulty || "easy"}
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold tracking-wide text-white/45">FROM:</div>
                <div className="break-all text-sm font-medium text-white">{sender}</div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-xs font-semibold tracking-wide text-white/45">SUBJECT:</div>
                <div className="text-sm font-bold text-white">{subject}</div>
              </div>

              <div className="my-4 h-px w-full bg-white/10" />

              <div className="space-y-2">
                <div className="text-xs font-semibold tracking-wide text-white/45">MESSAGE:</div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-3">
                  <p className="whitespace-pre-wrap font-mono text-sm leading-6 text-white/78">{clippedBody}</p>
                </div>
              </div>
            </div>

            <AnimatePresence>
              <OverlayFeedback key={feedback ? "feedback" : "none"} feedback={feedback} />
            </AnimatePresence>
          </div>
        </MotionDiv>
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MotionButton
          type="button"
          whileHover={{ scale: submitting ? 1 : 1.03 }}
          whileTap={{ scale: submitting ? 1 : 0.96 }}
          onClick={() => submitAnswer("phishing")}
          disabled={submitting || Boolean(feedback) || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/40 bg-gradient-to-r from-rose-600 to-red-500 px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(244,63,94,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {submitting ? "Submitting..." : "Phishing"}
        </MotionButton>

        <MotionButton
          type="button"
          whileTap={{ scale: submitting ? 1 : 0.96 }}
          whileHover={{ scale: submitting ? 1 : 1.03 }}
          onClick={() => submitAnswer("legitimate")}
          disabled={submitting || Boolean(feedback) || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-300/40 bg-gradient-to-r from-teal-600 to-cyan-500 px-5 py-3 text-sm font-extrabold text-white shadow-[0_10px_30px_rgba(20,184,166,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {submitting ? "Submitting..." : "Legitimate"}
        </MotionButton>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0c0f18] px-4 py-3 text-sm text-white/70">
        Score: <span className="font-bold text-white/80">{score}</span> / {TOTAL_QUESTIONS}
      </div>
    </MotionDiv>
  );
}
