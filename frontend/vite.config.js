import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Keep warnings meaningful while accommodating the isolated three.js chunk.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("/node_modules/react/")
            || id.includes("/node_modules/react-dom/")
            || id.includes("/node_modules/react-router-dom/")
          ) {
            return "react";
          }

          if (id.includes("/node_modules/framer-motion/")) {
            return "motion";
          }

          if (
            id.includes("/node_modules/recharts/")
            || id.includes("/node_modules/chart.js/")
            || id.includes("/node_modules/react-chartjs-2/")
          ) {
            return "charts";
          }

          if (
            id.includes("/node_modules/three/")
            || id.includes("/node_modules/@react-three/fiber/")
            || id.includes("/node_modules/@react-three/drei/")
          ) {
            return "three";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
