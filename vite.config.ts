import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['vmsg'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    commonjsOptions: {
      include: [/vmsg/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'vmsg'],
        },
      },
    },
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
