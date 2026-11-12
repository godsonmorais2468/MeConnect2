import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

/** Gives every build its own service-worker cache name (replaces __BUILD_ID__ in dist/sw.js with the build time). */
function stampServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', String(Date.now())))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    stampServiceWorker(),
  ],
})
