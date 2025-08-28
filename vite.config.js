import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/vllm-calculator/', // Required for GitHub Pages deployment
  plugins: [vue(), tailwindcss()],
  build: {
    target: 'es2018',
    sourcemap: false,
    assetsInlineLimit: 8192,
    minify: 'esbuild',
    cssCodeSplit: true,
    brotliSize: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
