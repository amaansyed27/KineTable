import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { parseBackendConfig } from "./src/backend/backendConfig";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const config = parseBackendConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return {
    plugins: [react(), tailwindcss()],
    // Explicit allowlist: invalid or privileged keys never enter browser output.
    envPrefix: [],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(config.cloudConfigured ? config.url : ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(config.cloudConfigured ? config.publishableKey : ""),
      "import.meta.env.VITE_BACKEND_CONFIG_INVALID": JSON.stringify(!config.cloudConfigured && config.reason === "invalid" ? "true" : "false"),
    },
  };
});
