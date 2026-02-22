import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { sharedPinballPlugin } from "../shared/vite/sharedPinballPlugin";

// https://vite.dev/config/
export default defineConfig({
    base: '/lpl-stats/',
    plugins: [react(), sharedPinballPlugin(__dirname + "/..")],
})
