import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  // MediaPipe ships large wasm assets; don't inline them.
  build: {
    assetsInlineLimit: 0,
  },
});
