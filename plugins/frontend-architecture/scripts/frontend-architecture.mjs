#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawnSync } from "node:child_process";

const VALID_APP_FRAMEWORKS = new Set(["nextjs-app-router", "expo-router"]);
const VALID_PACKAGE_MANAGERS = new Set(["pnpm", "npm", "yarn", "bun"]);
const VALID_CODE_QUALITY = new Set(["biome", "none"]);
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".expo", "dist", "build", "coverage", "out", ".turbo"]);

const LAYER_RULES = {
  presentation: new Set(["presentation", "application", "infrastructure", "env"]),
  application: new Set(["application", "infrastructure", "env"]),
  infrastructure: new Set(["infrastructure", "env"]),
  env: new Set(["env"])
};

const BOUNDARY_CHECK_TS = String.raw`#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".expo", "dist", "build", "coverage", "out", ".turbo"]);
const LAYER_RULES: Record<string, Set<string>> = {
  presentation: new Set(["presentation", "application", "infrastructure", "env"]),
  application: new Set(["application", "infrastructure", "env"]),
  infrastructure: new Set(["infrastructure", "env"]),
  env: new Set(["env"]),
};

type ImportEdge = {
  specifier: string;
  line: number;
  column: number;
};

type Violation = {
  file: string;
  line: number;
  column: number;
  specifier: string;
  importerLayer: string;
  importedLayer: string;
  importedFile: string;
};

function parseArgs(argv: string[]) {
  const options = { project: process.cwd(), json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      options.project = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: tsx scripts/boundary-check.ts [--project path] [--json]");
      process.exit(0);
    } else {
      throw new Error("Unknown argument: " + arg);
    }
  }

  if (!options.project) {
    throw new Error("--project requires a path");
  }

  return options;
}

function toPosix(value: string) {
  return value.split(path.sep).join("/");
}

function isSourceFile(filePath: string) {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension)) && !filePath.endsWith(".d.ts");
}

function walkSourceFiles(root: string) {
  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && isSourceFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(root, "src"));
  return files;
}

function layerOf(root: string, filePath: string) {
  const srcRoot = path.join(root, "src");
  const relative = toPosix(path.relative(srcRoot, filePath));
  if (relative.startsWith("..")) return null;
  const [segment] = relative.split("/");
  return LAYER_RULES[segment] ? segment : null;
}

function collectImportEdges(sourceFile: ts.SourceFile): ImportEdge[] {
  const edges: ImportEdge[] = [];

  function push(specifier: string, node: ts.Node) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    edges.push({
      specifier,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (ts.isCallExpression(node)) {
      const [firstArg] = node.arguments;
      if (firstArg && ts.isStringLiteral(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          push(firstArg.text, firstArg);
        }

        if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
          push(firstArg.text, firstArg);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

function resolveFile(candidate: string) {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = candidate + extension;
    if (fs.existsSync(withExtension) && fs.statSync(withExtension).isFile()) {
      return withExtension;
    }
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const indexFile = path.join(candidate, "index" + extension);
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        return indexFile;
      }
    }
  }

  return null;
}

function resolveImport(root: string, importerFile: string, specifier: string) {
  if (specifier.startsWith("@/")) {
    return resolveFile(path.join(root, "src", specifier.slice(2)));
  }

  if (specifier.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(importerFile), specifier));
  }

  return null;
}

function runBoundaryCheck(root: string) {
  const projectRoot = path.resolve(root);
  const violations: Violation[] = [];

  for (const file of walkSourceFiles(projectRoot)) {
    const importerLayer = layerOf(projectRoot, file);
    if (!importerLayer) continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const scriptKind = file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    for (const edge of collectImportEdges(sourceFile)) {
      const importedFile = resolveImport(projectRoot, file, edge.specifier);
      if (!importedFile) continue;

      const importedLayer = layerOf(projectRoot, importedFile);
      if (!importedLayer) continue;

      if (!LAYER_RULES[importerLayer].has(importedLayer)) {
        violations.push({
          file: toPosix(path.relative(projectRoot, file)),
          line: edge.line,
          column: edge.column,
          specifier: edge.specifier,
          importerLayer,
          importedLayer,
          importedFile: toPosix(path.relative(projectRoot, importedFile)),
        });
      }
    }
  }

  return violations;
}

const options = parseArgs(process.argv.slice(2));
const violations = runBoundaryCheck(options.project);

if (options.json) {
  console.log(JSON.stringify({ violations }, null, 2));
}

if (violations.length > 0) {
  if (!options.json) {
    console.error("Architecture boundary violations found:");
    for (const violation of violations) {
      console.error("");
      console.error(violation.file + ":" + violation.line + ":" + violation.column);
      console.error("  forbidden import: " + JSON.stringify(violation.specifier));
      console.error("  " + violation.importerLayer + " cannot import " + violation.importedLayer);
      console.error("  resolved to: " + violation.importedFile);
    }
  }

  process.exit(1);
}

if (!options.json) {
  console.log("Architecture boundaries passed.");
}
`;

function usage() {
  return [
    "Usage: frontend-architecture <command> [options]",
    "",
    "Commands:",
    "  scaffold-project <name>       Create a React project using the layered architecture",
    "  add-feature <name>            Add a presentation feature and application hook",
    "  audit-architecture            Check structure, env, tsconfig, Biome, and boundaries",
    "  boundary-check                Check import directions between src layers",
    "",
    "Common options:",
    "  --project <path>              Project root for add-feature, audit, or boundary-check",
    "  --json                        Print machine-readable output where supported",
    "",
    "Scaffold options:",
    "  --app-framework <value>       nextjs-app-router | expo-router",
    "  --package-manager <value>     pnpm | npm | yarn | bun",
    "  --code-quality <value>        biome | none",
    "  --skip-install                Do not run the package manager install command"
  ].join("\n");
}

function parseOptions(argv, defaults = {}) {
  const options = { ...defaults };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split("=");
      const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

      if (key === "skipInstall" || key === "withApi" || key === "json" || key === "force") {
        options[key] = inlineValue === undefined ? true : inlineValue !== "false";
        continue;
      }

      const value = inlineValue === undefined ? argv[index + 1] : inlineValue;
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`--${rawKey} requires a value`);
      }
      options[key] = value;
      if (inlineValue === undefined) index += 1;
    } else {
      positional.push(arg);
    }
  }

  return { options, positional };
}

function assertAllowed(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label} must be one of: ${[...allowed].join(", ")}`);
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;

  const text = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(stripJsonComments(text));
    } catch {
      return null;
    }
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inString) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        if (text[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error;
}

function installDependencies(projectRoot, packageManager) {
  if (!commandExists(packageManager)) {
    console.warn(`warning: ${packageManager} is not available; dependencies were written to package.json but not installed.`);
    return;
  }

  const result = spawnSync(packageManager, ["install"], {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${packageManager} install failed`);
  }
}

function packageManagerRun(packageManager, scriptName) {
  if (packageManager === "pnpm") return `pnpm ${scriptName}`;
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  if (packageManager === "bun") return `bun run ${scriptName}`;
  if (scriptName === "test") return "npm test";
  return `npm run ${scriptName}`;
}

function scaffoldProject(argv) {
  const { options, positional } = parseOptions(argv, {
    appFramework: "nextjs-app-router",
    packageManager: "pnpm",
    codeQuality: "biome",
    skipInstall: false,
    force: false
  });

  const projectName = positional[0];
  if (!projectName) {
    throw new Error("scaffold-project requires a project name or path");
  }

  assertAllowed(options.appFramework, VALID_APP_FRAMEWORKS, "appFramework");
  assertAllowed(options.packageManager, VALID_PACKAGE_MANAGERS, "packageManager");
  assertAllowed(options.codeQuality, VALID_CODE_QUALITY, "codeQuality");

  const projectRoot = path.resolve(projectName);
  if (fs.existsSync(projectRoot) && fs.readdirSync(projectRoot).length > 0 && !options.force) {
    throw new Error(`Target directory is not empty: ${projectRoot}`);
  }

  ensureDir(projectRoot);
  createBaseStructure(projectRoot);
  createProjectConfig(projectRoot, options);
  createFrameworkFiles(projectRoot, options.appFramework);
  createEnvFiles(projectRoot, options.appFramework);
  createInfrastructureFiles(projectRoot);
  createHomeFeature(projectRoot, options.appFramework);
  writeText(path.join(projectRoot, "scripts", "boundary-check.ts"), `${BOUNDARY_CHECK_TS}\n`);

  if (!options.skipInstall) {
    installDependencies(projectRoot, options.packageManager);
  }

  console.log(`Created ${options.appFramework} project at ${projectRoot}`);
  console.log(`Run ${packageManagerRun(options.packageManager, "check")} to validate type, code quality, and architecture.`);
}

function createBaseStructure(projectRoot) {
  const dirs = [
    "src/env",
    "src/presentation/components/atoms",
    "src/presentation/components/molecules",
    "src/presentation/components/organisms",
    "src/presentation/features/home/components",
    "src/presentation/providers",
    "src/application/hooks",
    "src/infrastructure/logging",
    "src/infrastructure/network",
    "src/infrastructure/helpers",
    "src/infrastructure/retry",
    "scripts"
  ];

  for (const dir of dirs) ensureDir(path.join(projectRoot, dir));
}

function createProjectConfig(projectRoot, options) {
  writeJson(path.join(projectRoot, ".frontend-architecture.json"), {
    appFramework: options.appFramework,
    packageManager: options.packageManager,
    codeQuality: options.codeQuality,
    architecture: "react-layered-architecture",
    layers: ["presentation", "application", "infrastructure"],
    env: "src/env"
  });

  const packageJson = buildPackageJson(path.basename(projectRoot), options);
  writeJson(path.join(projectRoot, "package.json"), packageJson);
  writeJson(path.join(projectRoot, "tsconfig.json"), buildTsconfig(options.appFramework));

  if (options.codeQuality === "biome") {
    writeJson(path.join(projectRoot, "biome.json"), buildBiomeConfig());
  }
}

function buildPackageJson(projectName, options) {
  const scripts = {
    dev: options.appFramework === "nextjs-app-router" ? "next dev" : "expo start",
    build: options.appFramework === "nextjs-app-router" ? "next build" : "expo export",
    typecheck: "tsc --noEmit",
    "arch:check": "tsx scripts/boundary-check.ts"
  };

  if (options.appFramework === "nextjs-app-router") {
    scripts.start = "next start";
  } else {
    scripts.start = "expo start";
    scripts.android = "expo start --android";
    scripts.ios = "expo start --ios";
    scripts.web = "expo start --web";
  }

  if (options.codeQuality === "biome") {
    Object.assign(scripts, {
      format: "biome format --write .",
      lint: "biome lint .",
      "check:write": "biome check --write .",
      check: "biome check . && tsc --noEmit && tsx scripts/boundary-check.ts"
    });
  } else {
    scripts.check = "tsc --noEmit && tsx scripts/boundary-check.ts";
  }

  const dependencies = options.appFramework === "nextjs-app-router"
    ? {
        next: "latest",
        react: "latest",
        "react-dom": "latest",
        zod: "latest"
      }
    : {
        expo: "latest",
        "expo-router": "latest",
        react: "latest",
        "react-native": "latest",
        zod: "latest"
      };

  const devDependencies = options.appFramework === "nextjs-app-router"
    ? {
        "@types/node": "latest",
        "@types/react": "latest",
        "@types/react-dom": "latest",
        typescript: "latest",
        tsx: "latest"
      }
    : {
        "@types/node": "latest",
        "@types/react": "latest",
        typescript: "latest",
        tsx: "latest"
      };

  if (options.codeQuality === "biome") {
    devDependencies["@biomejs/biome"] = "latest";
  }

  const pkg = {
    name: projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "layered-frontend-app",
    version: "0.1.0",
    private: true,
    scripts,
    dependencies,
    devDependencies
  };

  if (options.appFramework === "expo-router") {
    pkg.main = "expo-router/entry";
  }

  return pkg;
}

function buildTsconfig(appFramework) {
  if (appFramework === "expo-router") {
    return {
      extends: "expo/tsconfig.base",
      compilerOptions: {
        strict: true,
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"]
        }
      },
      include: ["**/*.ts", "**/*.tsx"]
    };
  }

  return {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"]
      },
      plugins: [
        {
          name: "next"
        }
      ]
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"]
  };
}

function buildBiomeConfig() {
  return {
    $schema: "https://biomejs.dev/schemas/2.0.6/schema.json",
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2
    },
    linter: {
      enabled: true,
      rules: {
        recommended: true
      }
    },
    organizeImports: {
      enabled: true
    },
    files: {
      ignoreUnknown: true
    }
  };
}

function createFrameworkFiles(projectRoot, appFramework) {
  if (appFramework === "nextjs-app-router") {
    writeText(path.join(projectRoot, "next-env.d.ts"), [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      "",
      "// This file is generated by Next.js.",
      ""
    ].join("\n"));

    writeText(path.join(projectRoot, "src", "app", "layout.tsx"), [
      "import type { Metadata } from \"next\";",
      "",
      "export const metadata: Metadata = {",
      "  title: \"Layered Frontend App\",",
      "  description: \"A React app using layered frontend architecture\",",
      "};",
      "",
      "export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {",
      "  return (",
      "    <html lang=\"en\">",
      "      <body>{children}</body>",
      "    </html>",
      "  );",
      "}",
      ""
    ].join("\n"));

    writeText(path.join(projectRoot, "src", "app", "page.tsx"), [
      "import { HomeFeature } from \"@/presentation/features/home\";",
      "",
      "export default function Page() {",
      "  return <HomeFeature />;",
      "}",
      ""
    ].join("\n"));
    return;
  }

  writeJson(path.join(projectRoot, "app.json"), {
    expo: {
      name: "Layered Frontend App",
      slug: "layered-frontend-app",
      scheme: "layered-frontend-app",
      plugins: ["expo-router"]
    }
  });

  writeText(path.join(projectRoot, "app", "_layout.tsx"), [
    "import { Stack } from \"expo-router\";",
    "",
    "export default function RootLayout() {",
    "  return <Stack screenOptions={{ headerShown: false }} />;",
    "}",
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "app", "index.tsx"), [
    "import { HomeFeature } from \"@/presentation/features/home\";",
    "",
    "export default function Index() {",
    "  return <HomeFeature />;",
    "}",
    ""
  ].join("\n"));
}

function createEnvFiles(projectRoot, appFramework) {
  const prefix = appFramework === "nextjs-app-router" ? "NEXT_PUBLIC_" : "EXPO_PUBLIC_";

  writeText(path.join(projectRoot, ".env.example"), [
    `${prefix}APP_ENV=local`,
    `${prefix}API_BASE_URL=http://localhost:3000`,
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "src", "env", "env.schema.ts"), [
    "import { z } from \"zod\";",
    "",
    "export const envSchema = z.object({",
    "  APP_ENV: z.enum([\"local\", \"development\", \"staging\", \"production\"]),",
    "  API_BASE_URL: z.string().url(),",
    "});",
    "",
    "export type Env = z.infer<typeof envSchema>;",
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "src", "env", "env.ts"), [
    "import { envSchema } from \"./env.schema\";",
    "",
    "export const env = envSchema.parse({",
    `  APP_ENV: process.env.${prefix}APP_ENV,`,
    `  API_BASE_URL: process.env.${prefix}API_BASE_URL,`,
    "});",
    ""
  ].join("\n"));
}

function createInfrastructureFiles(projectRoot) {
  writeText(path.join(projectRoot, "src", "infrastructure", "logging", "logger.ts"), [
    "export const logger = {",
    "  info(message: string, context?: unknown) {",
    "    console.info(message, context ?? \"\");",
    "  },",
    "  error(message: string, context?: unknown) {",
    "    console.error(message, context ?? \"\");",
    "  },",
    "};",
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "src", "infrastructure", "network", "httpClient.ts"), [
    "import { env } from \"@/env/env\";",
    "",
    "export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {",
    "  const response = await fetch(new URL(path, env.API_BASE_URL), init);",
    "",
    "  if (!response.ok) {",
    "    throw new Error(`Request failed with status ${response.status}`);",
    "  }",
    "",
    "  return response.json() as Promise<T>;",
    "}",
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "src", "infrastructure", "helpers", "assertNever.ts"), [
    "export function assertNever(value: never): never {",
    "  throw new Error(`Unexpected value: ${String(value)}`);",
    "}",
    ""
  ].join("\n"));

  writeText(path.join(projectRoot, "src", "infrastructure", "retry", "retry.ts"), [
    "export async function retry<T>(task: () => Promise<T>, attempts = 2): Promise<T> {",
    "  let lastError: unknown;",
    "",
    "  for (let attempt = 0; attempt <= attempts; attempt += 1) {",
    "    try {",
    "      return await task();",
    "    } catch (error) {",
    "      lastError = error;",
    "    }",
    "  }",
    "",
    "  throw lastError;",
    "}",
    ""
  ].join("\n"));
}

function createHomeFeature(projectRoot, appFramework) {
  writeText(path.join(projectRoot, "src", "application", "hooks", "useHome.ts"), [
    "export function useHome() {",
    "  return {",
    "    title: \"Layered Frontend App\",",
    "  };",
    "}",
    ""
  ].join("\n"));

  if (appFramework === "expo-router") {
    writeText(path.join(projectRoot, "src", "presentation", "features", "home", "index.tsx"), [
      "import { Text, View } from \"react-native\";",
      "import { useHome } from \"@/application/hooks/useHome\";",
      "",
      "export function HomeFeature() {",
      "  const home = useHome();",
      "",
      "  return (",
      "    <View style={{ flex: 1, alignItems: \"center\", justifyContent: \"center\", padding: 24 }}>",
      "      <Text>{home.title}</Text>",
      "    </View>",
      "  );",
      "}",
      ""
    ].join("\n"));
    return;
  }

  writeText(path.join(projectRoot, "src", "presentation", "features", "home", "index.tsx"), [
    "import { useHome } from \"@/application/hooks/useHome\";",
    "",
    "export function HomeFeature() {",
    "  const home = useHome();",
    "",
    "  return (",
    "    <main>",
    "      <h1>{home.title}</h1>",
    "    </main>",
    "  );",
    "}",
    ""
  ].join("\n"));
}

function addFeature(argv) {
  const { options, positional } = parseOptions(argv, {
    project: process.cwd(),
    withApi: false,
    force: false
  });

  const rawName = positional[0];
  if (!rawName) {
    throw new Error("add-feature requires a feature name");
  }

  const projectRoot = path.resolve(options.project);
  const config = readJson(path.join(projectRoot, ".frontend-architecture.json")) || readJson(path.join(projectRoot, ".frontend-arch.json")) || {};
  const appFramework = config.appFramework === "expo-router" ? "expo-router" : "nextjs-app-router";
  const featureName = toCamelCase(rawName);
  const pascalName = toPascalCase(featureName);
  const featureRoot = path.join(projectRoot, "src", "presentation", "features", featureName);
  const hookPath = path.join(projectRoot, "src", "application", "hooks", `use${pascalName}.ts`);

  if (fs.existsSync(featureRoot) && !options.force) {
    throw new Error(`Feature already exists: ${toPosix(path.relative(projectRoot, featureRoot))}`);
  }

  ensureDir(path.join(featureRoot, "components"));
  ensureDir(path.dirname(hookPath));

  writeText(hookPath, [
    `export function use${pascalName}() {`,
    "  return {",
    `    name: "${featureName}",`,
    "  };",
    "}",
    ""
  ].join("\n"));

  const view = appFramework === "expo-router"
    ? [
        "import { Text, View } from \"react-native\";",
        `import { use${pascalName} } from "@/application/hooks/use${pascalName}";`,
        "",
        `export function ${pascalName}Feature() {`,
        `  const ${featureName} = use${pascalName}();`,
        "",
        "  return (",
        "    <View>",
        `      <Text>{${featureName}.name}</Text>`,
        "    </View>",
        "  );",
        "}",
        ""
      ]
    : [
        `import { use${pascalName} } from "@/application/hooks/use${pascalName}";`,
        "",
        `export function ${pascalName}Feature() {`,
        `  const ${featureName} = use${pascalName}();`,
        "",
        "  return (",
        "    <section>",
        `      <h2>{${featureName}.name}</h2>`,
        "    </section>",
        "  );",
        "}",
        ""
      ];

  writeText(path.join(featureRoot, "index.tsx"), view.join("\n"));

  if (options.withApi) {
    const apiRoot = path.join(projectRoot, "src", "infrastructure", "network", featureName);
    ensureDir(apiRoot);
    writeText(path.join(apiRoot, `${featureName}.types.ts`), [
      `export type ${pascalName}Dto = {`,
      "  id: string;",
      "  name: string;",
      "};",
      ""
    ].join("\n"));
    writeText(path.join(apiRoot, `${featureName}.api.ts`), [
      "import { requestJson } from \"@/infrastructure/network/httpClient\";",
      `import type { ${pascalName}Dto } from "./${featureName}.types";`,
      "",
      `export function fetch${pascalName}() {`,
      `  return requestJson<${pascalName}Dto>(\"/${featureName}\");`,
      "}",
      ""
    ].join("\n"));
  }

  console.log(`Added feature ${featureName}`);
}

function toCamelCase(value) {
  const parts = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Feature name must contain at least one letter or number");
  }

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : lower[0].toUpperCase() + lower.slice(1);
    })
    .join("");
}

function toPascalCase(value) {
  const camel = toCamelCase(value);
  return camel[0].toUpperCase() + camel.slice(1);
}

function loadTypescript(projectRoot) {
  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  try {
    return requireFromProject("typescript");
  } catch {
    throw new Error("typescript is required for boundary checks. Run the project install command first.");
  }
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension)) && !filePath.endsWith(".d.ts");
}

function walkSourceFiles(root) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && isSourceFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walk(path.join(root, "src"));
  return files;
}

function layerOf(root, filePath) {
  const srcRoot = path.join(root, "src");
  const relative = toPosix(path.relative(srcRoot, filePath));
  if (relative.startsWith("..")) return null;
  const [segment] = relative.split("/");
  return LAYER_RULES[segment] ? segment : null;
}

function collectImportEdges(ts, sourceFile) {
  const edges = [];

  function push(specifier, node) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    edges.push({
      specifier,
      line: position.line + 1,
      column: position.character + 1
    });
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, node.moduleSpecifier);
    }

    if (ts.isCallExpression(node)) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          push(firstArg.text, firstArg);
        }

        if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
          push(firstArg.text, firstArg);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

function resolveFile(candidate) {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = candidate + extension;
    if (fs.existsSync(withExtension) && fs.statSync(withExtension).isFile()) {
      return withExtension;
    }
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    for (const extension of SOURCE_EXTENSIONS) {
      const indexFile = path.join(candidate, "index" + extension);
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        return indexFile;
      }
    }
  }

  return null;
}

function resolveImport(projectRoot, importerFile, specifier) {
  if (specifier.startsWith("@/")) {
    return resolveFile(path.join(projectRoot, "src", specifier.slice(2)));
  }

  if (specifier.startsWith(".")) {
    return resolveFile(path.resolve(path.dirname(importerFile), specifier));
  }

  return null;
}

function runBoundaryCheck(projectRoot) {
  const root = path.resolve(projectRoot);
  const ts = loadTypescript(root);
  const violations = [];

  for (const file of walkSourceFiles(root)) {
    const importerLayer = layerOf(root, file);
    if (!importerLayer) continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const scriptKind = file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    for (const edge of collectImportEdges(ts, sourceFile)) {
      const importedFile = resolveImport(root, file, edge.specifier);
      if (!importedFile) continue;

      const importedLayer = layerOf(root, importedFile);
      if (!importedLayer) continue;

      if (!LAYER_RULES[importerLayer].has(importedLayer)) {
        violations.push({
          file: toPosix(path.relative(root, file)),
          line: edge.line,
          column: edge.column,
          specifier: edge.specifier,
          importerLayer,
          importedLayer,
          importedFile: toPosix(path.relative(root, importedFile))
        });
      }
    }
  }

  return violations;
}

function boundaryCheckCommand(argv) {
  const { options } = parseOptions(argv, {
    project: process.cwd(),
    json: false
  });
  const violations = runBoundaryCheck(options.project);

  if (options.json) {
    console.log(JSON.stringify({ violations }, null, 2));
  }

  if (violations.length > 0) {
    if (!options.json) printBoundaryViolations(violations);
    process.exitCode = 1;
    return violations;
  }

  if (!options.json) console.log("Architecture boundaries passed.");
  return violations;
}

function printBoundaryViolations(violations) {
  console.error("Architecture boundary violations found:");
  for (const violation of violations) {
    console.error("");
    console.error(`${violation.file}:${violation.line}:${violation.column}`);
    console.error(`  forbidden import: ${JSON.stringify(violation.specifier)}`);
    console.error(`  ${violation.importerLayer} cannot import ${violation.importedLayer}`);
    console.error(`  resolved to: ${violation.importedFile}`);
  }
}

function auditArchitecture(argv) {
  const { options } = parseOptions(argv, {
    project: process.cwd(),
    json: false
  });

  const root = path.resolve(options.project);
  const config = readJson(path.join(root, ".frontend-architecture.json")) || readJson(path.join(root, ".frontend-arch.json")) || {};
  const codeQuality = options.codeQuality || config.codeQuality || "biome";
  assertAllowed(codeQuality, VALID_CODE_QUALITY, "codeQuality");

  const findings = [];

  checkRequiredPaths(root, findings);
  checkForbiddenPaths(root, findings);
  checkTsconfig(root, findings);
  checkEnvUsage(root, findings);
  if (codeQuality === "biome") checkBiome(root, findings);

  let boundaryViolations = [];
  try {
    boundaryViolations = runBoundaryCheck(root);
    for (const violation of boundaryViolations) {
      findings.push({
        level: "error",
        code: "boundary.import",
        message: `${violation.file}:${violation.line}:${violation.column} imports ${violation.importedLayer} from ${violation.importerLayer}`,
        detail: violation
      });
    }
  } catch (error) {
    findings.push({
      level: "error",
      code: "boundary.unavailable",
      message: error.message
    });
  }

  const errors = findings.filter((finding) => finding.level === "error");

  if (options.json) {
    console.log(JSON.stringify({ ok: errors.length === 0, findings }, null, 2));
  } else {
    if (findings.length === 0) {
      console.log("Architecture audit passed.");
    } else {
      console.log("Architecture audit findings:");
      for (const finding of findings) {
        console.log(`- [${finding.level}] ${finding.code}: ${finding.message}`);
      }
    }
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

function checkRequiredPaths(root, findings) {
  const required = [
    "src/presentation",
    "src/application",
    "src/infrastructure",
    "src/env",
    ".env.example",
    "src/presentation/components/atoms",
    "src/presentation/components/molecules",
    "src/presentation/components/organisms",
    "src/presentation/features",
    "src/application/hooks",
    "src/infrastructure/logging",
    "src/infrastructure/network",
    "src/infrastructure/helpers",
    "src/infrastructure/retry"
  ];

  for (const relativePath of required) {
    if (!fs.existsSync(path.join(root, relativePath))) {
      findings.push({
        level: "error",
        code: "path.missing",
        message: `${relativePath} is required`
      });
    }
  }
}

function checkForbiddenPaths(root, findings) {
  const forbidden = [
    "src/application/features",
    "src/infrastructure/features",
    "src/infrastructure/data/features"
  ];

  for (const relativePath of forbidden) {
    if (fs.existsSync(path.join(root, relativePath))) {
      findings.push({
        level: "error",
        code: "path.forbidden",
        message: `${relativePath} must not exist`
      });
    }
  }
}

function checkTsconfig(root, findings) {
  const tsconfig = readJson(path.join(root, "tsconfig.json"));
  if (!tsconfig) {
    findings.push({ level: "error", code: "tsconfig.missing", message: "tsconfig.json is required" });
    return;
  }

  if (tsconfig.compilerOptions?.strict !== true) {
    findings.push({ level: "error", code: "tsconfig.strict", message: "compilerOptions.strict must be true" });
  }

  const paths = tsconfig.compilerOptions?.paths || {};
  const aliasValues = paths["@/*"];
  if (!Array.isArray(aliasValues) || !aliasValues.some((value) => value === "./src/*" || value === "src/*")) {
    findings.push({ level: "error", code: "tsconfig.alias", message: "compilerOptions.paths must map @/* to ./src/*" });
  }
}

function checkBiome(root, findings) {
  const biome = readJson(path.join(root, "biome.json"));
  if (!biome) {
    findings.push({ level: "error", code: "biome.missing", message: "biome.json is required when codeQuality is biome" });
    return;
  }

  if (biome.formatter?.enabled !== true) {
    findings.push({ level: "error", code: "biome.formatter", message: "biome formatter must be enabled" });
  }

  if (biome.linter?.enabled !== true) {
    findings.push({ level: "error", code: "biome.linter", message: "biome linter must be enabled" });
  }
}

function checkEnvUsage(root, findings) {
  const ts = safeLoadTypescript(root);
  if (!ts) return;

  for (const file of walkSourceFiles(root)) {
    const layer = layerOf(root, file);
    if (layer === "env") continue;

    const sourceText = fs.readFileSync(file, "utf8");
    const scriptKind = file.endsWith(".tsx") || file.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, scriptKind);

    function visit(node) {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "env" &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "process"
      ) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        findings.push({
          level: "error",
          code: "env.process-env",
          message: `${toPosix(path.relative(root, file))}:${position.line + 1}:${position.character + 1} must import from @/env/env instead of using process.env directly`
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
}

function safeLoadTypescript(root) {
  try {
    return loadTypescript(root);
  } catch {
    return null;
  }
}

function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "scaffold-project" || command === "scaffold") {
    scaffoldProject(rest);
    return;
  }

  if (command === "add-feature") {
    addFeature(rest);
    return;
  }

  if (command === "audit-architecture" || command === "audit") {
    auditArchitecture(rest);
    return;
  }

  if (command === "boundary-check") {
    boundaryCheckCommand(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
