import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/royaka-2025-fe/' : '/',
  server: {
    host: true,
    port: 5173,
  },
})