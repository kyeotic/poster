import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    outDir: '../dist',
    // outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, 'src/index.html'),
    },
  },
  plugins: [solidPlugin()],
})
