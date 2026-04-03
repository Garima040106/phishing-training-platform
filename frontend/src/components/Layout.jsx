import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const onLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if logout API fails, clear user and redirect
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-gradient-to-r from-[#1a237e] via-[#2d3fabf2] to-[#3a4fc6] shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link
            to="/dashboard"
            className="text-xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent hover:scale-105 transition-transform duration-200"
          >
            PhishGuard AI
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {user && (
              <>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => `px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white font-semibold border-b-2 border-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/practice"
                  className={({ isActive }) => `px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white font-semibold border-b-2 border-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Practice
                </NavLink>
                <NavLink
                  to="/email-check"
                  className={({ isActive }) => `px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white font-semibold border-b-2 border-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Email Check
                </NavLink>
                <NavLink
                  to="/leaderboard"
                  className={({ isActive }) => `px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white font-semibold border-b-2 border-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Leaderboard
                </NavLink>
                <NavLink
                  to="/methodology"
                  className={({ isActive }) => `px-3 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-white/20 text-white font-semibold border-b-2 border-white"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Methodology
                </NavLink>
                <button
                  onClick={onLogout}
                  disabled={isLoggingOut}
                  className="ml-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:shadow-lg hover:scale-105 disabled:opacity-60 disabled:scale-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
