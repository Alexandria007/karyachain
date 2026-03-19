import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Buffer dibutuhkan oleh @shelby-protocol/sdk di browser
      include: ['buffer'],
      globals: {
        Buffer: true,
      },
    }),
  ],
})
