import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hostnames the dev server will answer to. `true` accepts any Host header,
// which disables the check that exists to prevent DNS-rebinding attacks —
// and this server advertises itself on every network interface. Add your
// ngrok/tunnel domain here (or via VITE_ALLOWED_HOSTS, comma-separated)
// rather than reopening it to everything.
const allowedHosts = [
    'localhost',
    '127.0.0.1',
    ...(process.env.VITE_ALLOWED_HOSTS || '')
        .split(',')
        .map(h => h.trim())
        .filter(Boolean),
]

const backend = process.env.VITE_PROXY_BACKEND || 'http://localhost:8080'
const worker = process.env.VITE_PROXY_WORKER || 'ws://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            output: {
                // The landing page and the session view have very different
                // dependency needs; splitting keeps the initial payload down.
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    livekit: ['livekit-client'],
                    motion: ['framer-motion'],
                },
            },
        },
    },
    server: {
        port: 5173,
        host: true,
        allowedHosts,
        proxy: {
            '/token': { target: backend, changeOrigin: true, secure: false },
            '/health': { target: backend, changeOrigin: true, secure: false },
            '/api': { target: backend, changeOrigin: true, secure: false },
            '/ws': {
                target: worker,
                ws: true,
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/ws/, '/ws'),
            },
        },
    },
})
