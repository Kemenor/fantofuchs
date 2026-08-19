import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Served from https://fantofuchs.fuchsnest.ch, so assets live at the root.
// `public/CNAME` is what keeps Pages pointed at that domain across deploys —
// a workflow deploy replaces the whole site, so the file has to be in the build.
export default defineConfig({
  plugins: [preact()],
  base: process.env.BASE_PATH ?? '/',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
