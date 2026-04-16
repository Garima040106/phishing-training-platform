import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App crashed", error, errorInfo);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{String(error?.stack || error?.message || error)}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: "8px 12px", fontWeight: 700 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
