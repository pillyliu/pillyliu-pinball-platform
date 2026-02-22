import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sharedPinballPlugin } from "../shared/vite/sharedPinballPlugin";

export default defineConfig({
  plugins: [react(), sharedPinballPlugin(__dirname + "/..")],
  base: "/lpl-library/",
});
