/**
 * generate-cursorrules.js
 *
 * Scans src/ui/primitives/ for React components, extracts exported
 * types/interfaces and component names, then generates a .cursorrules
 * file in the repository root.
 *
 * Usage: node scripts/generate-cursorrules.js
 * No external dependencies — uses only built-in Node.js modules.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";

// ── paths & config ─────────────────────────────────────────────────────────
const ROOT = resolve(import.meta.dirname, "..");
const PRIMITIVES_DIR = join(ROOT, "src", "ui", "primitives");
const OUTPUT_FILE = join(ROOT, ".cursorrules");

const DS_TITLE = "Simple Design System (SDS)";
const DS_PACKAGE = "@simple-ds/components";

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Return immediate subdirectories of `dir` (each is a component folder).
 */
function getComponentDirs(dir) {
  return readdirSync(dir)
    .filter((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory();
    })
    .sort();
}

/**
 * Find all .tsx files inside a component folder.
 */
function getTsxFiles(componentDir) {
  return readdirSync(componentDir).filter((f) => f.endsWith(".tsx"));
}

/**
 * Extract exported type / interface declarations and their bodies from source.
 * Returns an array of { name, kind, body } where `body` is the cleaned-up
 * right-hand side of the type definition.
 */
function extractExportedTypes(source) {
  const results = [];

  // Match: export type FooProps = <body>;
  // and:   export interface FooProps { ... }
  // We need to handle nested braces / generics, so we do a manual scan.

  const typeRegex =
    /export\s+(type|interface)\s+(\w+)(?:<[^>]*>)?\s*(?:=|extends\s+[^{]*)?/g;
  let match;

  while ((match = typeRegex.exec(source)) !== null) {
    const kind = match[1]; // 'type' or 'interface'
    const name = match[2];

    // Walk forward from match end to grab the full body (until balanced ; or })
    const startIdx = match.index + match[0].length;
    const body = extractBalancedBody(source, startIdx, kind === "interface");

    results.push({ name, kind, body: body.trim() });
  }
  return results;
}

/**
 * Starting at `idx` in `source`, grab everything until we hit a balanced
 * closing delimiter.  For `type X = ...;` that means until `;`.
 * For `interface X { ... }` that means balanced `{}`.
 */
function extractBalancedBody(source, idx, isInterface) {
  let depth = 0;
  let started = false;
  let result = "";

  for (let i = idx; i < source.length; i++) {
    const ch = source[i];

    if (ch === "{" || ch === "(") {
      depth++;
      started = true;
    }
    if (ch === "}" || ch === ")") {
      depth--;
    }

    result += ch;

    // For interface — stop after balanced braces
    if (isInterface && started && depth === 0) break;

    // For type alias — stop at top-level semicolon
    if (!isInterface && depth === 0 && ch === ";") break;
  }

  return result;
}

/**
 * Extract exported function / const component names.
 */
function extractExportedComponents(source) {
  const components = [];

  // export function Foo(
  const fnRegex = /export\s+function\s+(\w+)\s*[<(]/g;
  let m;
  while ((m = fnRegex.exec(source)) !== null) {
    components.push(m[1]);
  }

  // export const Foo = ...
  const constRegex = /export\s+const\s+(\w+)\s*=/g;
  while ((m = constRegex.exec(source)) !== null) {
    components.push(m[1]);
  }

  return [...new Set(components)];
}

/**
 * Build a concise human-readable summary of a type's own props (the fields
 * that are NOT inherited from extends / intersection bases).
 *
 * We try to extract the object literal `{ ... }` that belongs directly to
 * the component rather than imported generic types.
 */
function summariseProps(types) {
  const propsTypes = types.filter((t) => t.name.endsWith("Props"));

  return propsTypes.map((t) => {
    const fields = extractOwnFields(t.body);
    return { name: t.name, fields };
  });
}

/**
 * Given the RHS of a type / interface declaration, pull out the first
 * object-literal field list `{ field: type; ... }` and return each field
 * as a simple string.
 */
function extractOwnFields(body) {
  // Find the first `{` ... `}` block that looks like field declarations
  const braceStart = body.indexOf("{");
  if (braceStart === -1) return [];

  let depth = 0;
  let inner = "";
  for (let i = braceStart; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") {
      depth++;
      if (depth === 1) continue; // skip opening brace
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) break;
    }
    if (depth === 1) inner += ch;
  }

  // Split on `;` or newline, clean up
  const lines = inner
    .split(/[;\n]/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !l.startsWith("//") &&
        !l.startsWith("/*") &&
        !l.startsWith("*"),
    );

  return lines;
}

/**
 * Filter helper-only or internal names (utility functions, non-component exports).
 */
function isComponent(name) {
  return /^[A-Z]/.test(name) && !name.endsWith("Props");
}

// ── main ───────────────────────────────────────────────────────────────────

function analyseComponent(dirName) {
  const componentDir = join(PRIMITIVES_DIR, dirName);
  const tsxFiles = getTsxFiles(componentDir);
  if (tsxFiles.length === 0) return null;

  let allSource = "";
  for (const f of tsxFiles) {
    allSource += readFileSync(join(componentDir, f), "utf-8") + "\n";
  }

  const types = extractExportedTypes(allSource);
  const components = extractExportedComponents(allSource).filter(isComponent);
  const propsSummary = summariseProps(types);

  return { dirName, components, propsSummary };
}

function generateCursorRules(analyses) {
  const lines = [];

  lines.push(`# ${DS_TITLE}`);
  lines.push("");
  lines.push(
    "> Auto-generated by `npm run generate:cursorrules`. Do not edit manually.",
  );
  lines.push("");

  // ── Global rules ───────────────────────────────────────────────────────
  lines.push("## Правила использования");
  lines.push("");
  lines.push(
    '- **ВСЕГДА** импортируй компоненты из алиаса `"primitives"` (определён в `vite.config.ts` и `tsconfig.json`).',
  );
  lines.push(
    "  Пример: `import { Button, Input } from \"primitives\";`",
  );
  lines.push(
    `- **НЕ** импортируй напрямую из \`react-aria-components\`, \`@react-aria/*\` или \`@react-stately/*\` — используй обёртки SDS.`,
  );
  lines.push(
    "- Используй **TypeScript** для типизации всех компонентов и пропсов.",
  );
  lines.push(
    "- Для стилей используй **CSS-переменные** из `src/theme.css` (`var(--sds-color-*)`, `var(--sds-size-space-*)` и т.д.).",
  );
  lines.push(
    '- Для раскладки используй компоненты `Flex`, `Section`, `Grid` из `"layout"`.',
  );
  lines.push(
    '- Для иконок используй компоненты `Icon*` из `"icons"` (например, `import { IconCheck } from "icons"`).',
  );
  lines.push(
    "- Не создавай новые UI-компоненты без необходимости — сначала проверь, есть ли подходящий в библиотеке ниже.",
  );
  lines.push(
    "- Изучай stories в `src/stories/` для примеров использования компонентов.",
  );
  lines.push("");

  // ── Component list ─────────────────────────────────────────────────────
  lines.push("## Доступные компоненты");
  lines.push("");

  for (const a of analyses) {
    if (!a) continue;

    lines.push(`### ${a.dirName}`);
    lines.push("");
    lines.push(
      `**Import:** \`import { ${a.components.join(", ")} } from "primitives";\``,
    );
    lines.push("");

    if (a.propsSummary.length > 0) {
      lines.push("**Props:**");
      lines.push("");
      for (const ps of a.propsSummary) {
        const fieldsStr =
          ps.fields.length > 0
            ? ps.fields.map((f) => `  ${f}`).join("\n")
            : "  (extends base RAC / HTML props)";
        lines.push(`\`${ps.name}\``);
        lines.push("```ts");
        lines.push(fieldsStr);
        lines.push("```");
        lines.push("");
      }
    }

    // usage example
    lines.push("**Пример:**");
    lines.push("");
    lines.push("```tsx");
    lines.push(generateExample(a));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // ── Additional imports ─────────────────────────────────────────────────
  lines.push("## Дополнительные импорты");
  lines.push("");
  lines.push("| Алиас | Путь | Описание |");
  lines.push("| --- | --- | --- |");
  lines.push(
    '| `"primitives"` | `src/ui/primitives` | Все базовые компоненты |',
  );
  lines.push(
    '| `"compositions"` | `src/ui/compositions` | Сложные составные компоненты (Cards, Forms, Headers, Footers) |',
  );
  lines.push(
    '| `"layout"` | `src/ui/layout` | Flex, Section, Grid |',
  );
  lines.push('| `"icons"` | `src/ui/icons` | SVG-иконки (IconCheck, IconX, …) |');
  lines.push(
    '| `"hooks"` | `src/ui/hooks` | useMediaQuery и другие UI-хуки |',
  );
  lines.push('| `"images"` | `src/ui/images` | Изображения-заглушки |');
  lines.push(
    '| `"utils"` | `src/ui/utils` | Утилиты (AnchorOrButton и т.д.) |',
  );
  lines.push(
    '| `"data"` | `src/data` | Контексты, провайдеры, сервисы, хуки данных |',
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a minimal usage example for a component group.
 */
function generateExample(analysis) {
  const { dirName, components } = analysis;

  const examples = {
    Accordion: `<Accordion>
  <AccordionItem title="Section 1">Content 1</AccordionItem>
  <AccordionItem title="Section 2">Content 2</AccordionItem>
</Accordion>`,

    Avatar: `<Avatar src="/photo.jpg" alt="User" size="medium" />
<AvatarButton initials="JD" alt="John Doe" />
<AvatarGroup max={3}>
  <Avatar initials="AB" alt="A" />
  <Avatar initials="CD" alt="C" />
</AvatarGroup>`,

    Button: `<Button variant="primary" size="medium">Click me</Button>
<ButtonDanger variant="danger-primary">Delete</ButtonDanger>
<ButtonGroup align="end">
  <Button variant="subtle">Cancel</Button>
  <Button variant="primary">Save</Button>
</ButtonGroup>`,

    Checkbox: `<CheckboxGroup label="Options">
  <CheckboxField label="Option A" />
  <CheckboxField label="Option B" />
</CheckboxGroup>`,

    Dialog: `<DialogTrigger>
  <Button>Open Dialog</Button>
  <DialogModal isDismissable>
    <Dialog>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description text</DialogDescription>
      <DialogBody>Body content</DialogBody>
    </Dialog>
  </DialogModal>
</DialogTrigger>`,

    Fieldset: `<Form>
  <Fieldset>
    <Legend>Personal Information</Legend>
    <FieldGroup>
      <InputField label="Name" />
      <InputField label="Email" type="email" />
    </FieldGroup>
  </Fieldset>
</Form>`,

    Icon: `<Icon size="24">
  {/* SVG path children */}
</Icon>`,

    IconButton: `<IconButton aria-label="Settings" variant="subtle" size="small">
  <IconSettings />
</IconButton>`,

    Image: `<Image src="/photo.jpg" alt="Description" aspectRatio="16-9" size="medium" />
<Picture>
  <PictureSource srcSet="/photo.webp" type="image/webp" />
  <Image src="/photo.jpg" alt="Fallback" />
</Picture>`,

    Input: `<InputField
  label="Email"
  placeholder="you@example.com"
  description="We'll never share your email."
  errorMessage="Invalid email"
/>`,

    Link: `<Link href="/about">About us</Link>`,

    ListBox: `<ListBox>
  <ListBoxItem>Option 1</ListBoxItem>
  <ListBoxItem>Option 2</ListBoxItem>
</ListBox>`,

    Logo: `<Logo href="/" />`,

    Menu: `<MenuButton label="Actions" variant="subtle">
  <MenuItem>Edit</MenuItem>
  <MenuSeparator />
  <MenuItem>Delete</MenuItem>
</MenuButton>`,

    Navigation: `<Navigation direction="row">
  <NavigationPill isSelected>Dashboard</NavigationPill>
  <NavigationPill>Settings</NavigationPill>
</Navigation>`,

    Notification: `<Notification variant="message" isDismissible>
  Your changes have been saved.
</Notification>`,

    Pagination: `<Pagination>
  <PaginationPrevious href="/page/1" />
  <PaginationList>
    <PaginationPage href="/page/1" current>1</PaginationPage>
    <PaginationPage href="/page/2">2</PaginationPage>
  </PaginationList>
  <PaginationNext href="/page/2" />
</Pagination>`,

    Radio: `<RadioGroup label="Plan">
  <RadioField label="Free" value="free" />
  <RadioField label="Pro" value="pro" />
</RadioGroup>`,

    Search: `<Search placeholder="Search..." onSearch={(q) => console.log(q)} />`,

    Select: `<SelectField label="Country">
  <SelectItem>United States</SelectItem>
  <SelectItem>Germany</SelectItem>
</SelectField>`,

    Slider: `<SliderField label="Volume" minValue={0} maxValue={100} showOutput />`,

    Switch: `<SwitchGroup>
  <SwitchField label="Dark mode" />
  <SwitchField label="Notifications" />
</SwitchGroup>`,

    Tab: `<Tabs>
  <TabList>
    <Tab id="overview">Overview</Tab>
    <Tab id="details">Details</Tab>
  </TabList>
  <TabPanel id="overview">Overview content</TabPanel>
  <TabPanel id="details">Details content</TabPanel>
</Tabs>`,

    Table: `<Table striped>
  <TableHead>
    <TableColumn isRowHeader>Name</TableColumn>
    <TableColumn>Email</TableColumn>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>Alice</TableCell>
      <TableCell>alice@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>`,

    Tag: `<Tag scheme="brand" variant="primary">New</Tag>
<TagButton scheme="positive" href="/promo">Sale</TagButton>
<TagToggleGroup selectionMode="multiple">
  <TagToggleList>
    <TagToggle>React</TagToggle>
    <TagToggle>Vue</TagToggle>
  </TagToggleList>
</TagToggleGroup>`,

    Text: `<TextTitleHero>Hero Title</TextTitleHero>
<TextHeading>Section Heading</TextHeading>
<Text>Body paragraph text.</Text>
<TextSmall>Small caption text.</TextSmall>
<TextPrice currency="$" price="9.99" label="/mo" />`,

    Textarea: `<TextareaField
  label="Message"
  placeholder="Type your message…"
  description="Max 500 characters"
/>`,

    Tooltip: `<DialogTrigger>
  <Button>Hover me</Button>
  <Tooltip>Helpful information</Tooltip>
</DialogTrigger>`,
  };

  return (
    examples[dirName] ||
    `<${components[0] || dirName}>{/* … */}</${components[0] || dirName}>`
  );
}

// ── run ────────────────────────────────────────────────────────────────────

console.log("Scanning components in", PRIMITIVES_DIR, "...\n");

const dirs = getComponentDirs(PRIMITIVES_DIR);
const analyses = dirs.map(analyseComponent).filter(Boolean);

console.log(`Found ${analyses.length} component groups:\n`);
for (const a of analyses) {
  console.log(
    `  ${a.dirName}: ${a.components.join(", ")} (${a.propsSummary.length} prop types)`,
  );
}

const content = generateCursorRules(analyses);
writeFileSync(OUTPUT_FILE, content, "utf-8");

console.log(`\n✔ Generated ${OUTPUT_FILE}`);
console.log(`  Size: ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
