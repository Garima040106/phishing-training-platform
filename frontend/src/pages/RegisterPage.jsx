import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-5 text-2xl font-bold">Register</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Username" value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} />
        <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Password" value={form.password1} onChange={(e) => setForm((v) => ({ ...v, password1: e.target.value }))} />
        <input type="password" className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Confirm Password" value={form.password2} onChange={(e) => setForm((v) => ({ ...v, password2: e.target.value }))} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-[#1a237e] py-2 font-semibold text-white disabled:opacity-60">
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account? <Link to="/login" className="font-semibold text-[#1a237e]">Sign in</Link>
      </p>
    </div>
  );
}
