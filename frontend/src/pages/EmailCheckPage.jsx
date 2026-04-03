import { useState } from "react";
import api, { initCsrf } from "../api/client";

export default function EmailCheckPage() {
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const onAnalyze = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      await initCsrf();
      const body = new URLSearchParams({ email_text: emailText });
      const { data } = await api.post("/detect-email/", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setResult(data.result);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to analyze email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Email Authenticity Checker</h1>
      <p className="text-sm text-slate-600">
        Paste a full email (sender text + subject + body). The model will estimate whether it looks phishing or legitimate.
      </p>

      <form onSubmit={onAnalyze} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <textarea
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          placeholder="Paste email content here..."
          className="min-h-[220px] w-full rounded-lg border border-slate-300 p-3 text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={loading}
            className="rounded-lg bg-[#1a237e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Analyzing..." : "Analyze Email"}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
      </form>

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Prediction Result</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Label</p>
              <p className={`mt-1 text-lg font-bold ${result.is_phishing ? "text-rose-700" : "text-emerald-700"}`}>
                {result.label.toUpperCase()}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{(result.confidence * 100).toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Risk Signals</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {result.features.urgency + result.features.links + result.features.attachments + result.features.grammar_noise}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-700">Feature Breakdown</p>
            <ul className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
              <li>Urgency indicators: {result.features.urgency}</li>
              <li>Suspicious links: {result.features.links}</li>
              <li>Attachment signals: {result.features.attachments}</li>
              <li>Grammar noise: {result.features.grammar_noise}</li>
              <li>Caps ratio: {result.features.caps_ratio.toFixed(3)}</li>
              <li>Length: {result.features.length}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
