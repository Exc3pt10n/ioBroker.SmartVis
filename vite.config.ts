import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Frontend liegt in src-www, Build landet in www/ (wird vom Adapter ausgeliefert)
export default defineConfig({
    root: 'src-www',
    base: './',
    plugins: [react()],
    build: {
        outDir: '../www',
        emptyOutDir: true,
        target: 'es2020',
    },
    server: {
        // Für "npm run dev:www": WebSocket an laufende Adapter-Instanz weiterleiten
        proxy: {
            '/ws': { target: process.env.SMARTVIS_URL || 'http://localhost:8099', ws: true },
        },
    },
});
