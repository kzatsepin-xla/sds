import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const primitivesDir = 'src/ui/primitives'
const layoutDir = 'src/ui/layout'
const compositionsDir = 'src/ui/compositions'
const packageName = '@kzatsepin-xla/components'

// ---------------------------------------------------------------------------
// Primitives: list component directories (existing logic)
// ---------------------------------------------------------------------------

const primitiveNames = readdirSync(primitivesDir, { withFileTypes: true })
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

// ---------------------------------------------------------------------------
// Props extraction (reused for all modules)
// ---------------------------------------------------------------------------

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

/**
 * Targeted props extraction — only looks for `<ComponentName>Props` type/interface.
 * Falls back to extractProps() when the file has a single component.
 */
function extractComponentProps(filePath, componentName) {
  const content = readFileSync(filePath, 'utf-8')
  const props = []
  const propsTypeName = `${componentName}Props`

  // Match "type XProps = ... & { ... }" or "interface XProps extends ... { ... }"
  const regex = new RegExp(
    `(?:interface|type)\\s+${propsTypeName}\\b[^{]*\\{([^}]*)\\}`, 'gs'
  )

  let match
  while ((match = regex.exec(content)) !== null) {
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

  // Literal-union variants — only keep those whose name matches a found prop
  const variants = {}
  const literalUnionRegex = /(\w+)\??\s*:\s*((?:["'][^"']+["']\s*\|\s*)+["'][^"']+["'])/g
  let vMatch
  while ((vMatch = literalUnionRegex.exec(content)) !== null) {
    if (props.some(p => p.name === vMatch[1])) {
      const values = vMatch[2].match(/["']([^"']+)["']/g)?.map(v => v.replace(/["']/g, ''))
      if (values) variants[vMatch[1]] = values
    }
  }

  return { props, variants }
}

// ---------------------------------------------------------------------------
// Primitives documentation (existing logic, unchanged)
// ---------------------------------------------------------------------------

const primitiveDocs = primitiveNames.map(name => {
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

// ---------------------------------------------------------------------------
// Generic helpers for layout / compositions scanning
// ---------------------------------------------------------------------------

/** Recursively find all .tsx files inside a directory */
function findTsxFiles(dir) {
  const results = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findTsxFiles(fullPath))
    } else if (entry.name.endsWith('.tsx')) {
      results.push(fullPath)
    }
  }
  return results
}

/** Extract names of all `export function Foo` declarations */
function extractExportedFunctions(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const names = []
  const regex = /export\s+function\s+(\w+)/g
  let match
  while ((match = regex.exec(content)) !== null) {
    names.push(match[1])
  }
  return names
}

/**
 * Scan a module directory:
 *  1. Find every .tsx file (recursive)
 *  2. Extract exported component functions
 *  3. Pull per-component props via extractComponentProps
 */
function scanModule(dir) {
  const tsxFiles = findTsxFiles(dir)
  const components = []

  for (const file of tsxFiles) {
    const names = extractExportedFunctions(file)
    for (const name of names) {
      const { props, variants } = extractComponentProps(file, name)
      components.push({ name, props, variants })
    }
  }

  return components
}

/** Format a single component entry for the .cursorrules doc */
function formatComponentDoc(comp) {
  let doc = `${comp.name}\n`

  if (comp.props.length > 0) {
    doc += `Props:\n`
    for (const p of comp.props) {
      const req = p.optional ? 'optional' : 'required'
      doc += `  - ${p.name}${p.optional ? '?' : ''}: ${p.type} (${req})\n`
    }
  }

  if (Object.keys(comp.variants).length > 0) {
    doc += `Variants:\n`
    for (const [key, values] of Object.entries(comp.variants)) {
      doc += `  - ${key}: ${values.map(v => `"${v}"`).join(' | ')}\n`
    }
  }

  return doc
}

// ---------------------------------------------------------------------------
// Scan layout & compositions
// ---------------------------------------------------------------------------

const layoutComponents = scanModule(layoutDir)
const compositionComponents = scanModule(compositionsDir)

const layoutExportNames = layoutComponents.map(c => c.name).join(', ')
const compositionExportNames = compositionComponents.map(c => c.name).join(', ')

const layoutDocs = layoutComponents.map(formatComponentDoc).join('\n')
const compositionDocs = compositionComponents.map(formatComponentDoc).join('\n')

// ---------------------------------------------------------------------------
// Generate .cursorrules
// ---------------------------------------------------------------------------

const cursorrules = `SDS - Simple Design System

This project uses the SDS component library (${packageName}).
Always import components from this package - never create custom versions of existing components.

## STRICT SDS MODE — обязательные правила генерации

### ЗАПРЕЩЕНО
- inline style prop (style={{ ... }}) на любых элементах
- кастомные CSS переменные начинающиеся с --sds-* в пользовательском коде
- переопределение body font-family / color / background в globals.css или любом другом CSS
- теги <style> с переопределениями темы или токенов
- создание собственных CSS классов для визуальных свойств (цвета, бордеры, радиусы, тени, шрифты)
- прямое использование HEX/RGB/HSL значений цветов вместо SDS токенов

### ОБЯЗАТЕЛЬНО
- только SDS примитивы для контролов и типографики: import из ${packageName}/ui/primitives/*
- управление внешним видом только через props компонентов: variant, size, scheme, className
- import '${packageName}/styles.css' только один раз в корневом layout.tsx
- для layout использовать SDS layout компоненты: Flex, FlexItem, Section
- для карточек: Card с variant/direction/padding props
- для секций страницы: Section или Hero
- для сеток: Flex с container и wrap props, или Panel
- Tailwind классы допустимы ТОЛЬКО для мелких корректировок (mt-2, hidden, text-center)
- темная тема только через классы .sds-light / .sds-dark на контейнере, без ручных переопределений токенов

### ШАБЛОН СТРАНИЦЫ
При генерации новой страницы используй такую структуру:
- обёртка: Section или div.sds-light
- контейнер: Flex container direction="column" gap="800"
- сетки: Flex container wrap или Panel
- карточки: Card variant="stroke" с padding="600"
- контролы: SDS примитивы с props (variant/size/scheme)
- типографика: Text, TextHeading, TextSubheading, TextSmall из SDS

### SSR СОВМЕСТИМОСТЬ
- Все страницы с SDS компонентами ОБЯЗАТЕЛЬНО начинаются с 'use client'
- ОБЯЗАТЕЛЬНО оборачивать рендер в mounted-guard (useState + useEffect) для обхода SSR проблем с react-aria

Import pattern:

  // Individual component (tree-shakeable):
  import { Button } from '${packageName}/ui/primitives/Button'

  // Layout / composition (tree-shakeable):
  import { Flex, FlexItem, Section } from '${packageName}/ui/layout'
  import { Card, Hero, Panel } from '${packageName}/ui/compositions'

  // Or from root (all components):
  import { Button, Input, Dialog, Flex, Card } from '${packageName}'

Don't forget styles - add this import once in your root layout:

  import '${packageName}/styles.css'

## Primitive Components (${primitiveNames.length} primitives)

${primitiveDocs.join('\n')}

## Layout Components (${layoutComponents.length} components)
Import: import { ${layoutExportNames} } from '${packageName}'

${layoutDocs}

## Composition Components (${compositionComponents.length} components)
Import: import { ${compositionExportNames} } from '${packageName}'

${compositionDocs}

General Rules:
- Use existing components from ${packageName} instead of writing custom HTML
- All components support className prop for additional Tailwind styling
- Use the variant/size props when available - don't override styles manually
- Components follow React Aria patterns for accessibility
- Wrap forms in a <form> tag but use SDS Input, Select, Checkbox etc inside
`

writeFileSync('.cursorrules', cursorrules)
console.log(`Generated .cursorrules with ${primitiveNames.length} primitives, ${layoutComponents.length} layout, ${compositionComponents.length} composition components`)
