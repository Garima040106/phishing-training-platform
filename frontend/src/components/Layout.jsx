import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const MotionButton = motion.button;

const navItems = [
  { to: "/dashboard", label: "Dashboard", match: (path) => path.startsWith("/dashboard") },
  { to: "/practice", label: "Practice", match: (path) => path.startsWith("/practice") || path.startsWith("/quiz") },
  { to: "/leaderboard", label: "Leaderboard", match: (path) => path.startsWith("/leaderboard") },
  { to: "/methodology", label: "Methodology", match: (path) => path.startsWith("/methodology") },
  { to: "/check-email", label: "Email Check", match: (path) => path.startsWith("/check-email") },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-text">
      <nav className="sticky top-0 z-20 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link
              to="/dashboard"
              className="group inline-flex items-center gap-2 text-base font-extrabold tracking-wide text-text transition"
            >
              <Shield className="h-4 w-4 text-accent transition duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(108,99,255,0.8)]" />
              <span className="transition duration-300 group-hover:text-white">PhishGuard AI</span>
            </Link>

            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => {
                const isActive = item.match(location.pathname);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group relative py-2 text-sm font-medium"
                  >
                    <span className={`transition ${isActive ? "text-text" : "text-muted group-hover:text-text"}`}>
                      {item.label}
                    </span>
                    <span
                      className={`absolute bottom-0 left-0 h-[2px] w-full origin-left rounded-full bg-accent transition-transform duration-300 ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="hidden rounded-full border border-white/15 bg-surface px-3 py-1 text-xs font-semibold text-text sm:block">
                @{user.username}
              </div>
            ) : null}
            <MotionButton
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={async () => {
                await logout();
                navigate("/login", { replace: true });
              }}
              className="rounded-lg border border-accent bg-transparent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10 hover:shadow-glow"
            >
              Logout
            </MotionButton>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
