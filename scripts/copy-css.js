import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Читаем все CSS файлы и объединяем в один
const cssFiles = ['reset.css', 'theme.css', 'index.css', 'icons.css', 'responsive.css']
const srcDir = 'src'
const distDir = 'dist'

let combined = ''
for (const file of cssFiles) {
  const path = join(srcDir, file)
  if (existsSync(path)) {
    combined += `/* ${file} */\n`
    combined += readFileSync(path, 'utf-8')
    combined += '\n\n'
  }
}

// Читаем CSS который tsup уже сгенерировал из компонентов
const tsupCss = join(distDir, 'index.css')
if (existsSync(tsupCss)) {
  const componentCss = readFileSync(tsupCss, 'utf-8')
  // Объединяем: сначала токены/тема, потом компоненты
  combined += '/* Component styles */\n'
  combined += componentCss
}

writeFileSync(tsupCss, combined)
console.log('Combined CSS written to dist/index.css')
