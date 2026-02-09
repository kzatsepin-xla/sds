/**
 * setup-package.js
 *
 * Reads ds.config.json and applies the configured values to:
 *   - package.json  (name, description, repository, publishConfig, files, exports)
 *   - .npmrc        (GitHub Packages auth)
 *   - README.md     (installation & usage docs)
 *
 * Usage: node scripts/setup-package.js
 * No external dependencies — uses only built-in Node.js modules.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

// ── Read config ────────────────────────────────────────────────────────────

const config = JSON.parse(
  readFileSync(join(ROOT, "ds.config.json"), "utf-8"),
);

const fullPackageName = `${config.scope}/${config.packageName}`;
const repoUrl = `https://github.com/${config.repository.owner}/${config.repository.repo}`;

console.log("Configuring package...");
console.log(`  Package: ${fullPackageName}`);
console.log(`  Repository: ${repoUrl}`);

// ═══ Update package.json ═══════════════════════════════════════════════════

console.log("\n  Updating package.json...");
const pkgPath = join(ROOT, "package.json");
const packageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

packageJson.name = fullPackageName;
packageJson.description = config.description;
packageJson.repository = {
  type: "git",
  url: `git+${repoUrl}.git`,
};
packageJson.publishConfig = {
  registry: "https://npm.pkg.github.com",
  [`${config.scope}:registry`]: "https://npm.pkg.github.com",
};

// -- files: what gets included in the published tarball
const requiredFiles = [
  "src/",
  "dist/",
  ".cursorrules",
  "vite.config.ts",
  "tsconfig.json",
  "README.md",
];
if (!packageJson.files) {
  packageJson.files = [];
}
for (const f of requiredFiles) {
  if (!packageJson.files.includes(f)) {
    packageJson.files.push(f);
  }
}

// -- exports map
packageJson.exports = {
  ".": "./dist/index.js",
  "./ui/primitives/*": "./src/ui/primitives/*/index.tsx",
  "./.cursorrules": "./.cursorrules",
};

packageJson.main = "./dist/index.js";
packageJson.types = "./dist/index.d.ts";

// -- remove "private" so npm publish works
delete packageJson.private;

writeFileSync(pkgPath, JSON.stringify(packageJson, null, 2) + "\n", "utf-8");
console.log("  package.json updated");

// ═══ Generate .npmrc ═══════════════════════════════════════════════════════

console.log("  Generating .npmrc...");
const npmrc = `${config.scope}:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}
`;
writeFileSync(join(ROOT, ".npmrc"), npmrc, "utf-8");
console.log("  .npmrc updated");

// ═══ Generate README.md ════════════════════════════════════════════════════

console.log("  Generating README.md...");

const readme = `# ${fullPackageName}

${config.description}

## Quick Start (for forks)

1. Fork this repository
2. Edit \`ds.config.json\`:

\`\`\`json
{
  "scope": "@your-github-username",
  "packageName": "design-system",
  "repository": {
    "owner": "your-github-username",
    "repo": "sds"
  }
}
\`\`\`

3. Run setup:

\`\`\`bash
npm run setup
\`\`\`

4. Commit and push to main branch
5. GitHub Actions will auto-publish to GitHub Packages

## Installation

\`\`\`bash
npm install ${fullPackageName}
\`\`\`

### GitHub Packages Authentication

Create \`.npmrc\` in your project root:

\`\`\`
${config.scope}:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
\`\`\`

Get your token at: https://github.com/settings/tokens (needs \`read:packages\` scope)

## Usage

\`\`\`tsx
import { Button, Input, Dialog } from "${fullPackageName}/ui/primitives";

function App() {
  return (
    <>
      <Button variant="primary">Click me</Button>
      <Input placeholder="Type here..." />
    </>
  );
}
\`\`\`

## Cursor AI Integration

The package includes an auto-generated \`.cursorrules\` file for Cursor AI.

After installation, sync it to your project:

\`\`\`bash
cp node_modules/${fullPackageName}/.cursorrules .
\`\`\`

Or add to your consumer \`package.json\`:

\`\`\`json
{
  "scripts": {
    "sync:cursorrules": "cp node_modules/${fullPackageName}/.cursorrules .",
    "postinstall": "npm run sync:cursorrules"
  }
}
\`\`\`

Now Cursor AI will know about all available components!

## Documentation

See [Storybook](https://${config.repository.owner}.github.io/${config.repository.repo}/storybook) for live component examples.

Browse stories locally:

\`\`\`bash
npm run storybook
\`\`\`

## Development

\`\`\`bash
npm install                     # Install dependencies
npm run app:dev                 # Dev server at localhost:8000
npm run storybook               # Storybook at localhost:6006
npm run generate:cursorrules    # Regenerate .cursorrules
npm run setup                   # Re-apply ds.config.json to all files
\`\`\`

### Versioning

\`\`\`bash
npm run version:patch           # 0.0.1 -> 0.0.2
npm run version:minor           # 0.1.0 -> 0.2.0
npm run version:major           # 1.0.0 -> 2.0.0
\`\`\`

Push to \`main\` triggers auto-publish via GitHub Actions.

## Structure

All components and styles live in [src/ui](./src/ui):

| Directory | Description |
| --- | --- |
| \`src/ui/primitives/\` | Atomic components (Button, Input, Dialog, etc.) |
| \`src/ui/compositions/\` | Complex composed patterns (Cards, Forms, Headers) |
| \`src/ui/layout/\` | Layout primitives (Flex, Section, Grid) |
| \`src/ui/icons/\` | SVG icon components |
| \`src/ui/hooks/\` | Custom React hooks (useMediaQuery) |
| \`src/ui/utils/\` | Utility components and functions |

### Import aliases

Configured in \`vite.config.ts\` and \`tsconfig.json\`:

\`\`\`tsx
import { Button, Input } from "primitives";
import { Flex, Section } from "layout";
import { IconCheck } from "icons";
import { useMediaQuery } from "hooks";
\`\`\`

## Figma Integration

Fully backed by [Figma Code Connect](https://github.com/figma/code-connect).
See [src/figma/](./src/figma) for all Code Connect mappings.

### Figma Auth

1. [Create a Figma API token](https://www.figma.com/developers/api#authentication) with Code Connect, File Read, Dev Resources Write, and Variables scopes
2. Copy \`.env-rename\` to \`.env\`
3. Set \`FIGMA_ACCESS_TOKEN\` and \`FIGMA_FILE_KEY\`

### Scripts

| Command | Description |
| --- | --- |
| \`npm run script:tokens:rest\` | Sync design tokens from Figma |
| \`npm run script:icons:rest\` | Sync icons from Figma |
| \`npm run script:dev-resources\` | Update dev resources |

## Configuration

Edit \`ds.config.json\` to customise the package name, scope, and metadata.
Then run \`npm run setup\` to apply changes to package.json, .npmrc, and README.

## License

MIT
`;

writeFileSync(join(ROOT, "README.md"), readme, "utf-8");
console.log("  README.md updated");

// ═══ Summary ═══════════════════════════════════════════════════════════════

console.log("\nPackage configured successfully!");
console.log(`  Package name: ${fullPackageName}`);
console.log(`  Repository:   ${repoUrl}`);
console.log("");
console.log("Next steps:");
console.log("  1. Review generated files (package.json, .npmrc, README.md)");
console.log("  2. .cursorrules will be regenerated automatically (postsetup)");
console.log("  3. Commit and push to main");
