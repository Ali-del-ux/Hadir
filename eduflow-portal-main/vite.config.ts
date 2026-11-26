import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mockServerPlugin } from "./mockServerPlugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const useMock = (process.env.VITE_USE_MOCK ?? env.VITE_USE_MOCK) !== "false";
  const apiTarget =
    process.env.VITE_API_TARGET || env.VITE_API_TARGET || "http://localhost:3000";

  return {
    server: {
      host: true,
      port: 8091,
      strictPort: false,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 8091,
      strictPort: false,
    },
    plugins: [react(), ...(useMock ? [mockServerPlugin()] : [])],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
