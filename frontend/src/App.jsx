import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Loading from "./components/Loading";
import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LoginPage from "./pages/LoginPage";
import MethodologyPage from "./pages/MethodologyPage";
import PracticePage from "./pages/PracticePage";
import QuizPage from "./pages/QuizPage";
import RegisterPage from "./pages/RegisterPage";
import ResultPage from "./pages/ResultPage";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/quiz" element={<Protected><QuizPage /></Protected>} />
      <Route path="/practice" element={<Protected><PracticePage /></Protected>} />
      <Route path="/result" element={<Protected><ResultPage /></Protected>} />
      <Route path="/leaderboard" element={<Protected><LeaderboardPage /></Protected>} />
      <Route path="/methodology" element={<Protected><MethodologyPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
