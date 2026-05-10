import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/video-compression-tool/',
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/core'],
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
}))
