import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            // WebSocket для новостей — напрямую к Python-сервису
            '/ws/news': {
                target: 'ws://localhost:5000',
                ws: true,
            },
            '/ws': {
                target: 'ws://localhost:8080',
                ws: true,
            },
        },
    },
})