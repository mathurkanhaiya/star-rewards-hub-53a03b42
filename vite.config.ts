import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

// Plugin: compile server/index.ts → dist/index.cjs after every Vite build
function buildServerPlugin() {
  return {
    name: "build-server",
    closeBundle() {
      try {
        console.log("[build-server] Compiling Express server...");
        execSync(
          "npx esbuild server/index.ts --bundle --platform=node --format=cjs --outfile=dist/index.cjs --log-level=warning",
          { stdio: "inherit" }
        );
        console.log("[build-server] dist/index.cjs ready ✓");
      } catch (e) {
        console.error("[build-server] esbuild failed:", e);
      }
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), buildServerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
