import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works both at the GitHub Pages project path
  // (khoroshevskyi.github.io/photoduck/) and at the custom domain root
  // (photoduck.molfar.dev/). All asset paths derive from import.meta.env.BASE_URL.
  base: './',
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
