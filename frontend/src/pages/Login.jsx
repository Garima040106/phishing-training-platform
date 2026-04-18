import { useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Mail, Lock, Shield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import ShieldScene from "../components/ShieldScene";
import { useAuth } from "../context/AuthContext";

const MotionDiv = motion.div;
const MotionButton = motion.button;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = new URLSearchParams({
        username: form.identifier.trim(),
        password: form.password,
      });

      await login(payload);
      toast.success("Signed in successfully");
      const to = location.state?.from?.pathname || "/dashboard";
      navigate(to, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const apiError = err?.response?.data?.error;

      let message = "Invalid credentials.";
      if (typeof apiError === "string" && apiError.trim()) {
        message = apiError;
      } else if (status === 404) {
        message = "Authentication service is unavailable right now. Please try again shortly.";
      } else if (status >= 500) {
        message = "Server error while signing in. Please try again shortly.";
      } else if (!status) {
        message = "Unable to reach the authentication server. Check your connection and try again.";
      }

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05050b] text-text">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(108,99,255,0.2),transparent_30%),radial-gradient(circle_at_82%_82%,rgba(108,99,255,0.1),transparent_40%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:px-10 lg:py-8">
        <section className="order-1 h-44 w-full sm:h-56 lg:order-2 lg:h-auto lg:w-1/2 lg:pl-6">
          <ShieldScene />
        </section>

        <section className="order-2 flex w-full items-center justify-center py-8 lg:order-1 lg:w-1/2 lg:py-0 lg:pr-6">
          <MotionDiv
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0d16]/95 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-8"
          >
            <div className="mb-7 flex items-start gap-3">
              <div className="rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/15 p-2.5">
                <Shield className="h-5 w-5 text-[#918aff]" />
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight text-transparent bg-gradient-to-r from-[#b8b1ff] via-[#8f86ff] to-[#6c63ff] bg-clip-text">
                  PhishGuard AI
                </h1>
                <p className="mt-1 text-sm text-slate-300">Train your instincts. Defend the perimeter.</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Username or Email</span>
                <div className="group flex items-center gap-2 rounded-xl border border-white/10 bg-[#111120] px-3 py-2.5 transition focus-within:border-[#8f86ff]/60 focus-within:ring-2 focus-within:ring-[#6c63ff]/35">
                  <Mail className="h-4 w-4 text-slate-400 transition group-focus-within:text-[#9c95ff]" />
                  <input
                    type="text"
                    required
                    placeholder="username or you@company.com"
                    value={form.identifier}
                    onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
                    className="w-full border-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Password</span>
                <div className="group flex items-center gap-2 rounded-xl border border-white/10 bg-[#111120] px-3 py-2.5 transition focus-within:border-[#8f86ff]/60 focus-within:ring-2 focus-within:ring-[#6c63ff]/35">
                  <Lock className="h-4 w-4 text-slate-400 transition group-focus-within:text-[#9c95ff]" />
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full border-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
              </label>

              {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

              <MotionButton
                type="submit"
                disabled={loading}
                whileHover={{ y: -1, boxShadow: "0 0 28px rgba(108,99,255,0.45)" }}
                whileTap={{ scale: 0.96 }}
                className="relative mt-1 flex w-full items-center justify-center overflow-hidden rounded-xl border border-[#938bff]/50 bg-gradient-to-r from-[#5d55ef] via-[#6c63ff] to-[#827bff] px-4 py-3 text-sm font-bold tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <motion.span
                  aria-hidden="true"
                  initial={{ x: "-180%" }}
                  whileHover={{ x: "250%" }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                />
                <span className="relative z-10">{loading ? "Signing in..." : "Secure Sign In"}</span>
              </MotionButton>
            </form>

            <p className="mt-6 text-sm text-slate-400">
              New operator?{" "}
              <Link to="/register" className="font-semibold text-[#9d96ff] transition hover:text-white">
                Create account
              </Link>
            </p>
          </MotionDiv>
        </section>
      </div>
    </div>
  );
}