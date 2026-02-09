# @kzatsepin-xla/components

Simple Design System — React components with Figma Code Connect and auto-generated Cursor rules.

## What's included

- **`src/`** — React component source files (TSX + CSS)
- **`figma.config.json`** — Figma Code Connect configuration
- **`.cursorrules`** — Auto-generated coding guidelines for Cursor AI (created at publish time)

## Install

```bash
npm install @kzatsepin-xla/components --registry=https://npm.pkg.github.com
```

Or add to `.npmrc`:

```
@kzatsepin-xla:registry=https://npm.pkg.github.com
```

Then:

```bash
npm install @kzatsepin-xla/components
```

## Usage

Import components directly from source:

```tsx
import { Button } from '@kzatsepin-xla/components/src/Button/Button';
import { Input } from '@kzatsepin-xla/components/src/Input/Input';
```

## Cursor AI Integration

The package includes auto-generated `.cursorrules` with component documentation. After installing, Cursor AI will automatically pick up the rules and use them when suggesting code.

## Figma Code Connect

`figma.config.json` maps Figma components to source code, enabling seamless design-to-code workflow.

## License

See [LICENSE](./LICENSE) for details.
