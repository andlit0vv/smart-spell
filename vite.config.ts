import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Standalone Vite config (no platform-specific plugins)
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
