import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.PINPROF_ADMIN_API_ORIGIN ?? "http://localhost:8787";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      "/api": API_TARGET,
      "/pinball": API_TARGET,
    },
  },
  preview: {
    port: 4177,
  },
});
