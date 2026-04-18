import GlowCard from "../components/GlowCard";

export default function MethodologyPage() {
  const phaseRows = [
    {
      phase: "Phase 1: Baseline + Behavioral Dataset",
      details:
        "User registration, fixed 10-question baseline quiz, response capture (accuracy/time/mistakes/difficulty), behavioral dataset record generation.",
    },
    {
      phase: "Phase 2: User Profiling (Random Forest)",
      details:
        "Extracted performance features feed a Random Forest classifier that labels users as beginner/intermediate/advanced and stores profile skill level.",
    },
    {
      phase: "Phase 3: Adaptive Learning Engine",
      details:
        "Scenario difficulty is assigned from skill + trend/streak logic and continuously updated after each submission.",
    },
    {
      phase: "Phase 4: Anomaly Detection + Personalization",
      details:
        "Isolation Forest and behavior rules detect random clicking/sudden drops/repeated weaknesses and trigger targeted training modules.",
    },
  ];

  const profileFeatures = [
    "accuracy",
    "avg_response_time",
    "total_attempts",
    "hard_accuracy",
    "medium_accuracy",
    "false_positive_rate",
    "false_negative_rate",
    "baseline_accuracy",
    "practice_accuracy",
  ];

  const anomalySignals = [
    "Isolation Forest anomaly score",
    "Fast-click ratio",
    "Answer-switch rate",
    "Recent vs previous accuracy delta",
    "Repeated mistake-type frequency",
  ];

  return (
    <div className="space-y-6">
      <GlowCard className="p-6">
        <h1 className="text-2xl font-bold text-text">Methodology Documentation</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This document explains the final production pipeline used by PhishGuard AI for assessment,
          skill profiling, adaptive difficulty control, anomaly detection, and personalized training.
        </p>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">1) End-to-End Pipeline</h2>
        <div className="mt-4 rounded-lg border border-white/10 bg-background/70 p-4">
          <pre className="overflow-x-auto whitespace-pre text-sm leading-6 text-text/85">
{`User Login/Register
  -> Baseline Quiz (10 questions)
  -> Capture Attempts (accuracy + time + mistake types + difficulty)
  -> Behavioral Dataset Record
  -> Random Forest Skill Profiling
  -> Skill Level Stored in UserProfile
  -> Adaptive Engine Assigns Next Difficulty
  -> Practice Attempt Loop
  -> Isolation Forest + Pattern Analysis
  -> Personalized Module Recommendations
  -> Dashboard Feedback + Continuous Improvement`}
          </pre>
        </div>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">2) Phase Breakdown</h2>
        <div className="mt-4 space-y-3">
          {phaseRows.map((row) => (
            <div key={row.phase} className="rounded-lg border border-white/10 bg-background/60 p-4">
              <p className="text-sm font-semibold text-text">{row.phase}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{row.details}</p>
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">3) User Profiling Features (Phase 2)</h2>
        <div className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
          {profileFeatures.map((feature) => (
            <div key={feature} className="rounded border border-white/10 bg-background/60 px-3 py-2">
              {feature}
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">4) Adaptive Learning Controls (Phase 3)</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Base difficulty starts from skill level (beginner/easy, intermediate/medium, advanced/hard).</li>
          <li>Trend status (`improving`, `stable`, `declining`) is computed from rolling attempt windows.</li>
          <li>Correct and incorrect streaks push difficulty up or down.</li>
          <li>Each submission updates feedback text and next recommended difficulty.</li>
        </ul>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">5) Anomaly + Personalization (Phase 4)</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Isolation Forest is combined with behavioral rules to identify abnormal interaction patterns and generate
          targeted training module recommendations.
        </p>
        <div className="mt-3 grid gap-2 text-sm text-muted md:grid-cols-2">
          {anomalySignals.map((signal) => (
            <div key={signal} className="rounded border border-white/10 bg-background/60 px-3 py-2">
              {signal}
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard className="p-6">
        <h2 className="text-lg font-semibold text-text">6) Continuous Feedback Loop</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Every baseline/practice submit updates profile metrics and adaptive state.</li>
          <li>Recommendations are regenerated from latest behavior and weakness patterns.</li>
          <li>Dashboard reflects capability metrics, anomaly insights, trend state, and next difficulty.</li>
          <li>This loop repeats for each attempt to progressively reduce phishing susceptibility.</li>
        </ul>
      </GlowCard>
    </div>
  );
}
