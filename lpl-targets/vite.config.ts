import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sharedPinballPlugin } from "../shared/vite/sharedPinballPlugin";

export default defineConfig({
  base: '/lpl-targets/',
  plugins: [react(), sharedPinballPlugin(__dirname + "/..")],
})
