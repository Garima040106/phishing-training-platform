/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0f",
        surface: "#12121a",
        surfaceHover: "#1a1a28",
        accent: "#6c63ff",
        accentGlow: "rgba(108,99,255,0.3)",
        success: "#00d4aa",
        warning: "#ffb347",
        danger: "#ff4d6d",
        text: "#e8e8f0",
        muted: "#6b7280",
      },
      borderRadius: {
        lg: "12px",
        xl: "18px",
        "2xl": "24px",
      },
      boxShadow: {
        glow: "0 0 20px rgba(108,99,255,0.4)",
        card: "0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};