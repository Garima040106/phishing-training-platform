import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Loading from "./components/Loading";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LoginPage from "./pages/LoginPage";
import MethodologyPage from "./pages/MethodologyPage";
import PracticePage from "./pages/PracticePage";
import RegisterPage from "./pages/RegisterPage";
import ResultPage from "./pages/ResultPage";
import EmailCheckPage from "./pages/EmailCheckPage";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  
  return <Layout>{children}</Layout>;
}

function BaselineGuard({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading || !user) return children;

  const allowWithoutBaseline = ["/methodology", "/email-check"];
  if (!user.baseline_completed && !allowWithoutBaseline.includes(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const { loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={loading ? <Loading /> : <Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<Protected><BaselineGuard><DashboardPage /></BaselineGuard></Protected>} />
      <Route path="/quiz" element={<Navigate to="/dashboard" replace />} />
      <Route path="/practice" element={<Protected><BaselineGuard><PracticePage /></BaselineGuard></Protected>} />
      <Route path="/email-check" element={<Protected><BaselineGuard><EmailCheckPage /></BaselineGuard></Protected>} />
      <Route path="/result" element={<Protected><BaselineGuard><ResultPage /></BaselineGuard></Protected>} />
      <Route path="/leaderboard" element={<Protected><BaselineGuard><LeaderboardPage /></BaselineGuard></Protected>} />
      <Route path="/methodology" element={<Protected><BaselineGuard><MethodologyPage /></BaselineGuard></Protected>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
