export default function MethodologyPage() {
  const architecture = [
    { layer: "Frontend", implementation: "React (Vite), React Router, Axios client, protected routes" },
    { layer: "Backend", implementation: "Django views + JSON APIs with session authentication" },
    { layer: "Database", implementation: "Django ORM models for scenarios, attempts, profile, recommendations" },
    { layer: "ML Engine", implementation: "scikit-learn RandomForest + IsolationForest + email detector" },
  ];

  const featureVector = [
    "urgency",
    "links",
    "attachments",
    "grammar_noise",
    "caps_ratio",
    "length",
    "avg_word_length",
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">PhishGuard AI Methodology</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          This page documents how the platform is engineered end-to-end: ingestion of phishing/legitimate email data,
          model training, user-skill adaptation, anomaly detection, and the runtime API flow used by the React UI.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">1) System Architecture</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4">Layer</th>
                <th className="py-2">Implementation</th>
              </tr>
            </thead>
            <tbody>
              {architecture.map((row) => (
                <tr key={row.layer} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{row.layer}</td>
                  <td className="py-2 text-slate-700">{row.implementation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">2) Data and Model Training</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
          <p>
            Training uses two datasets: a phishing corpus and the Enron email corpus for legitimate samples.
            Text is transformed into engineered indicators and then used to train an email detector classifier.
          </p>
          <p>
            The training pipeline persists artifacts in <span className="font-semibold">ml_engine/saved_models</span>:
            skill classifier, anomaly detector, dedicated email detector, and a structured training report.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Email Detector Feature Vector</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            {featureVector.map((feature) => (
              <div key={feature} className="rounded border border-slate-200 bg-white px-3 py-1.5">{feature}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">3) Adaptive Learning Logic</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>User answers are saved as attempt records with correctness and response time.</li>
          <li>Profile aggregates are updated: total attempts, correct answers, running average response time.</li>
          <li>
            The skill classifier predicts one of three levels: <span className="font-semibold">beginner</span>,{" "}
            <span className="font-semibold">intermediate</span>, or <span className="font-semibold">advanced</span>.
          </li>
          <li>The anomaly detector flags unusual behavior patterns from performance consistency signals.</li>
          <li>Recommendation logic generates targeted remediation tips from recent weak areas.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">4) Runtime API Flow</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
          <p>
            The frontend authenticates with Django sessions and calls API routes under <span className="font-semibold">/api</span>.
            Core flow endpoints include quiz fetch/submit, practice fetch/submit, dashboard telemetry, and leaderboard.
          </p>
          <p>
            The email checker posts raw email text to <span className="font-semibold">POST /api/detect-email/</span>, where
            the backend extracts features, runs the email detector, and returns label, confidence, and feature values.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">5) Why This Design</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>Session-based auth keeps API and web integration simple in a single Django deployment.</li>
          <li>Feature-engineered models provide interpretable risk signals for user education.</li>
          <li>Separate models for skill, anomaly, and email classification keep concerns isolated.</li>
          <li>Persisted artifacts and reports support repeatable retraining and transparent quality tracking.</li>
        </ul>
      </section>
    </div>
  );
}
