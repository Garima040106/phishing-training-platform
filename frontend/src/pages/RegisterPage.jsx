import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password1: "", password2: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = new URLSearchParams(form);
      await register(body);
      navigate("/quiz");
    } catch {
      setError("Registration failed. Check username/password rules.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-14">
      <MotionDiv
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-surface/90 p-7 shadow-card backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl border border-accent/40 bg-accent/15 p-2">
            <UserPlus className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Create Account</h1>
            <p className="text-sm text-muted">Start your personalized anti-phishing training journey.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2.5 text-text outline-none transition placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2.5 text-text outline-none transition placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
            placeholder="Password"
            value={form.password1}
            onChange={(e) => setForm((v) => ({ ...v, password1: e.target.value }))}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-white/10 bg-background px-3 py-2.5 text-text outline-none transition placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30"
            placeholder="Confirm Password"
            value={form.password2}
            onChange={(e) => setForm((v) => ({ ...v, password2: e.target.value }))}
          />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <MotionButton
            disabled={loading}
            whileTap={{ scale: 0.96 }}
            className="w-full rounded-lg border border-accent bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </MotionButton>
        </form>

        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-accent hover:text-white">
            Sign in
          </Link>
        </p>
      </MotionDiv>
    </div>
  );
}
