import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        crx({ manifest }),
    ],
    build: {
        rollupOptions: {
            input: {
                canvas: 'src/canvas/index.html'
            },
            output: {
                manualChunks: {
                    reactflow: ['@xyflow/react'],
                    'react-vendor': ['react', 'react-dom'],
                },
            },
        },
    },
})
