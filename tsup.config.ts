import { defineConfig } from 'tsup'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const primitivesDir = 'src/ui/primitives'
const components = readdirSync(primitivesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => join(primitivesDir, d.name, 'index.tsx').replace(/\\/g, '/'))
  .filter(f => existsSync(f))

export default defineConfig({
  entry: ['src/index.ts', ...components],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-aria-components', 'clsx'],
  outDir: 'dist',
  esbuildOptions(options) {
    options.outbase = 'src'
    options.alias = {
      'primitives': './src/ui/primitives',
      'icons': './src/ui/icons',
      'hooks': './src/ui/hooks',
      'layout': './src/ui/layout',
      'utils': './src/ui/utils',
    }
  }
})
