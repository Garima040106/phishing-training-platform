import { AnimatePresence, motion } from "framer-motion";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const MotionDiv = motion.div;

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-lg font-extrabold tracking-tight text-slate-900">
              PhishGuard AI
            </Link>
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                to="/dashboard"
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                  location.pathname.startsWith("/dashboard")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/practice"
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                  location.pathname.startsWith("/practice") || location.pathname.startsWith("/quiz")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Practice
              </Link>
              <Link
                to="/leaderboard"
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                  location.pathname.startsWith("/leaderboard")
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Leaderboard
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="hidden sm:block text-sm font-semibold text-slate-700">@{user.username}</div>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </MotionDiv>
        </AnimatePresence>
      </main>
    </div>
  );
}
