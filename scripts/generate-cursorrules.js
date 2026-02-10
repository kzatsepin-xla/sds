import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const primitivesDir = 'src/ui/primitives'
const packageName = '@kzatsepin-xla/components'

const components = readdirSync(primitivesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .filter(d => existsSync(join(primitivesDir, d.name, 'index.tsx')))
  .map(d => d.name)

function findComponentFile(componentDir, name) {
  // Try ComponentName.tsx first (actual file), then index.tsx
  const candidates = [`${name}.tsx`, 'index.tsx']
  for (const c of candidates) {
    const p = join(componentDir, c)
    if (existsSync(p)) return p
  }
  return null
}

function extractProps(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const props = []

  const interfaceRegex = /(?:interface|type)\s+\w*Props\w*\s*(?:extends\s+[^{]+)?\{([^}]*)\}/gs
  let match
  while ((match = interfaceRegex.exec(content)) !== null) {
    const body = match[1]
    const propRegex = /(\w+)(\?)?:\s*([^;\n]+)/g
    let propMatch
    while ((propMatch = propRegex.exec(body)) !== null) {
      props.push({
        name: propMatch[1],
        optional: !!propMatch[2],
        type: propMatch[3].trim()
      })
    }
  }

  const variants = {}
  const literalUnionRegex = /(\w+)\??\s*:\s*((?:["'][^"']+["']\s*\|\s*)+["'][^"']+["'])/g
  let vMatch
  while ((vMatch = literalUnionRegex.exec(content)) !== null) {
    const name = vMatch[1]
    const values = vMatch[2].match(/["']([^"']+)["']/g)?.map(v => v.replace(/["']/g, ''))
    if (values) variants[name] = values
  }

  return { props, variants }
}

const componentDocs = components.map(name => {
  const componentDir = join(primitivesDir, name)
  const filePath = findComponentFile(componentDir, name)
  if (!filePath) return null

  const { props, variants } = extractProps(filePath)

  let doc = `${name}\n`
  doc += `Import: import { ${name} } from '${packageName}/ui/primitives/${name}'\n`

  if (props.length > 0) {
    doc += `Props:\n`
    for (const p of props) {
      const req = p.optional ? 'optional' : 'required'
      doc += `  - ${p.name}${p.optional ? '?' : ''}: ${p.type} (${req})\n`
    }
  }

  if (Object.keys(variants).length > 0) {
    doc += `Variants:\n`
    for (const [key, values] of Object.entries(variants)) {
      doc += `  - ${key}: ${values.map(v => `"${v}"`).join(' | ')}\n`
    }
  }

  return doc
}).filter(Boolean)

const cursorrules = `SDS - Simple Design System

This project uses the SDS component library (${packageName}).
Always import components from this package - never create custom versions of existing components.

Import pattern:

  // Individual component (tree-shakeable):
  import { Button } from '${packageName}/ui/primitives/Button'

  // Or from root (all components):
  import { Button, Input, Dialog } from '${packageName}'

Don't forget styles - add this import once in your root layout:

  import '${packageName}/styles.css'

Available Components (${components.length} primitives):

${componentDocs.join('\n')}

General Rules:
- Use existing components from ${packageName} instead of writing custom HTML
- All components support className prop for additional Tailwind styling
- Use the variant/size props when available - don't override styles manually
- Components follow React Aria patterns for accessibility
- Wrap forms in a <form> tag but use SDS Input, Select, Checkbox etc inside
`

writeFileSync('.cursorrules', cursorrules)
console.log(`Generated .cursorrules with ${components.length} components`)
