import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  // Subpath deploy support.
  //   dev  (mode=development) → base='/' so http://localhost:3000 works.
  //   prod (mode=production)  → base='/micro-saas/ai-market-pulse/' matches
  //                              the Nginx location on ai.prospectaccel.com.
  //   VITE_BASE_PATH=/ npm run build → override to root for other deploys.
  const PROD_BASE = '/micro-saas/ai-market-pulse/';
  const base =
    env.VITE_BASE_PATH ||
    process.env.VITE_BASE_PATH ||
    (mode === 'production' ? PROD_BASE : '/');
  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
