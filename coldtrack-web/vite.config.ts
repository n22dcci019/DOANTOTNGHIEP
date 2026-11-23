import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Keep generated cache owned by the Windows account running Vite.
// Workspace caches can belong to the sandbox account and deny deletion locally.
const checkoutKey = createHash('sha256').update(import.meta.dirname).digest('hex').slice(0, 12)

// https://vite.dev/config/
export default defineConfig({
  cacheDir: join(tmpdir(), 'coldtrack-vite', checkoutKey),
  plugins: [
    tailwindcss(),
    react(),
  ],
})
