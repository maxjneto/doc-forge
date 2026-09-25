import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  // Local preview (scripts/preview): swap Clerk for a stub that hands out a
  // locally-signed dev token. Dev server only — a build must never ship it.
  const devAuth = Boolean(loadEnv(mode, process.cwd(), 'VITE_').VITE_DEV_AUTH_TOKEN)
  if (devAuth && command === 'build') {
    throw new Error('VITE_DEV_AUTH_TOKEN is set — refusing to build with the Clerk dev stub')
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        ...(devAuth ? { '@clerk/clerk-react': resolve(__dirname, './src/dev/clerk-stub.tsx') } : {}),
        '@': resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['mermaid'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            mermaid: ['mermaid'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  }
})
