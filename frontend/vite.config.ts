import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/onlyoffice': {
        target: process.env.ONLYOFFICE_URL || 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onlyoffice/, ''),
      },
    },
  },
});
