import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Served from https://<user>.github.io/fantofuchs/, so assets need that base.
// A custom domain later just means setting BASE_PATH=/ in the workflow.
export default defineConfig({
  plugins: [preact()],
  base: process.env.BASE_PATH ?? '/fantofuchs/',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
