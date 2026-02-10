import { readdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const primitivesDir = 'src/ui/primitives'
const components = readdirSync(primitivesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .filter(d => existsSync(join(primitivesDir, d.name, 'index.tsx')))
  .map(d => d.name)

let content = '// Auto-generated - do not edit manually\n\n'

for (const name of components) {
  content += `export * from './ui/primitives/${name}'\n`
}

if (existsSync('src/ui/compositions/index.ts')) {
  content += `\nexport * from './ui/compositions'\n`
}

if (existsSync('src/ui/hooks/index.ts')) {
  content += `export * from './ui/hooks'\n`
}

if (existsSync('src/ui/icons/index.ts')) {
  content += `export * from './ui/icons'\n`
}

if (existsSync('src/ui/layout/index.ts')) {
  content += `export * from './ui/layout'\n`
}

if (existsSync('src/ui/utils/index.ts')) {
  content += `export * from './ui/utils'\n`
}

writeFileSync('src/index.ts', content)
console.log(`Generated src/index.ts with ${components.length} components`)
