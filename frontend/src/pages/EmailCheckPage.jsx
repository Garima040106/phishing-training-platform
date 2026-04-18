import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import api, { initCsrf } from "../api/client";
import GlowCard from "../components/GlowCard";

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function EmailCheckPage() {
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const confidencePct = useMemo(() => {
    const c = Number(result?.confidence || 0);
    return c <= 1 ? c * 100 : c;
  }, [result]);

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

      const payload = data?.result ?? data;
      const normalized = {
        is_phishing: Boolean(payload?.is_phishing),
        confidence: Number(payload?.confidence || 0),
        label: payload?.label || (payload?.is_phishing ? "phishing" : "legitimate"),
        features: payload?.features || null,
      };

      setResult(normalized);
      toast.success("Email analyzed successfully");
    } catch (err) {
      const message = err?.response?.data?.error || "Failed to analyze email.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Email Authenticity Scanner</h1>
        <p className="mt-1 text-sm text-muted">
          Paste sender, subject, and body. The model estimates phishing probability in real time.
        </p>
      </div>

      <GlowCard className="p-5">
        <form onSubmit={onAnalyze}>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder="Paste full email content here..."
            className="min-h-[220px] w-full rounded-lg border border-white/10 bg-background p-3 text-sm text-text outline-none placeholder:text-muted focus:border-accent/55 focus:ring-2 focus:ring-accent/30"
          />
          <div className="mt-3 flex items-center gap-3">
            <MotionButton
              disabled={loading || !emailText.trim()}
              whileTap={{ scale: 0.96 }}
              className="rounded-lg border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Analyzing..." : "Analyze Email"}
            </MotionButton>
            {error ? <span className="text-sm font-medium text-danger">{error}</span> : null}
          </div>
        </form>
      </GlowCard>

      {result ? (
        <MotionDiv initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlowCard className="p-5">
            <h2 className="text-lg font-semibold text-text">Prediction Result</h2>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-background/70 p-3">
                <p className="text-xs text-muted">Label</p>
                <p
                  className={`mt-1 flex items-center gap-2 text-lg font-bold ${
                    result.is_phishing ? "text-danger" : "text-success"
                  }`}
                >
                  {result.is_phishing ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {String(result.label || "unknown").toUpperCase()}
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-background/70 p-3">
                <p className="text-xs text-muted">Confidence</p>
                <p className="mt-1 text-lg font-bold text-text">{confidencePct.toFixed(1)}%</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-background/70 p-3">
                <p className="text-xs text-muted">Risk Level</p>
                <p className="mt-1 text-lg font-bold text-text">
                  {result.is_phishing ? "Elevated" : "Low"}
                </p>
              </div>
            </div>

            {result.features ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-background/60 p-3">
                <p className="text-sm font-semibold text-text">Feature Breakdown</p>
                <ul className="mt-2 grid gap-1 text-sm text-muted md:grid-cols-2">
                  <li>Urgency indicators: {Number(result.features.urgency || 0)}</li>
                  <li>Suspicious links: {Number(result.features.links || 0)}</li>
                  <li>Attachment signals: {Number(result.features.attachments || 0)}</li>
                  <li>Grammar noise: {Number(result.features.grammar_noise || 0)}</li>
                  <li>Caps ratio: {Number(result.features.caps_ratio || 0).toFixed(3)}</li>
                  <li>Length: {Number(result.features.length || 0)}</li>
                </ul>
              </div>
            ) : null}
          </GlowCard>
        </MotionDiv>
      ) : null}
    </div>
  );
}
