import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-[#1a237e] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="text-lg font-bold">PhishGuard AI</Link>
          <nav className="flex items-center gap-4 text-sm">
            {user && (
              <>
                <NavLink to="/dashboard" className="hover:opacity-90">Dashboard</NavLink>
                <NavLink to="/quiz" className="hover:opacity-90">Quiz</NavLink>
                <NavLink to="/practice" className="hover:opacity-90">Practice</NavLink>
                <NavLink to="/email-check" className="hover:opacity-90">Email Check</NavLink>
                <NavLink to="/leaderboard" className="hover:opacity-90">Leaderboard</NavLink>
                <NavLink to="/methodology" className="hover:opacity-90">Methodology</NavLink>
                <button onClick={onLogout} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Logout</button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
