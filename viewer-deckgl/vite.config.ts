import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        // Rewrite cookies to work with localhost
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/tiles': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/debug': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
