import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
    watch: {
      ignored: ["**/generated/**", "**/prisma/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react")) return "react-vendor";
          return undefined;
        },
      },
    },
  },
});
