import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./components/Layout";
import LoadingScreen from "./components/LoadingScreen";
import PageWrapper from "./components/PageWrapper";
import { useAuth } from "./context/AuthContext";

import DashboardPage from "./pages/DashboardPage";
import EmailCheckPage from "./pages/EmailCheckPage";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import MethodologyPage from "./pages/MethodologyPage";
import Practice from "./pages/Practice";
import Register from "./pages/Register";
import Results from "./pages/Results";

function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function ScrollToTopOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);

  return null;
}

function WrapPage({ children }) {
  return <PageWrapper>{children}</PageWrapper>;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <ScrollToTopOnRouteChange />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<WrapPage><DashboardPage /></WrapPage>} />
            <Route path="practice" element={<WrapPage><Practice /></WrapPage>} />
            <Route path="quiz" element={<WrapPage><Practice /></WrapPage>} />
            <Route path="result" element={<WrapPage><Results /></WrapPage>} />
            <Route path="results" element={<WrapPage><Results /></WrapPage>} />
            <Route path="leaderboard" element={<WrapPage><Leaderboard /></WrapPage>} />
            <Route path="methodology" element={<WrapPage><MethodologyPage /></WrapPage>} />
            <Route path="check-email" element={<WrapPage><EmailCheckPage /></WrapPage>} />
          </Route>

          <Route path="/login" element={<WrapPage><Login /></WrapPage>} />
          <Route path="/register" element={<WrapPage><Register /></WrapPage>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  const { loading } = useAuth();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#12121a",
            color: "#e8e8f0",
            border: "1px solid rgba(108,99,255,0.3)",
          },
          success: {
            style: {
              background: "#0c1d1a",
              color: "#87f3de",
              border: "1px solid rgba(20,184,166,0.45)",
            },
          },
          error: {
            style: {
              background: "#211016",
              color: "#ffb8c4",
              border: "1px solid rgba(239,68,68,0.45)",
            },
          },
        }}
      />
      {loading ? <LoadingScreen /> : <AppRoutes />}
    </>
  );
}
