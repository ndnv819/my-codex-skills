#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULTS = {
  failOnBudgetExceeded: true
};

const CONFIG_FILES = [
  ".codex/nextjs-app-router-performance.json",
  "nextjs-app-router-performance.json"
];

const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mdx"];
const APP_ENTRY_FILES = new Set([
  "page",
  "layout",
  "template",
  "loading",
  "error",
  "global-error",
  "not-found",
  "default"
]);

const HEAVY_IMPORT_HINTS = [
  "monaco-editor",
  "@monaco-editor/react",
  "mapbox-gl",
  "maplibre-gl",
  "leaflet",
  "react-leaflet",
  "three",
  "@react-three/fiber",
  "framer-motion",
  "recharts",
  "chart.js",
  "react-chartjs-2",
  "echarts",
  "apexcharts",
  "highcharts",
  "@mui/x-data-grid",
  "@mui/x-date-pickers",
  "antd",
  "react-select",
  "react-markdown",
  "remark-",
  "rehype-",
  "highlight.js",
  "prismjs",
  "shiki",
  "pdfjs-dist",
  "react-pdf",
  "xlsx",
  "lodash",
  "lodash-es",
  "date-fns",
  "moment"
];

const PROVIDER_HINTS = [
  "QueryClientProvider",
  "ApolloProvider",
  "Provider",
  "ReduxProvider",
  "ThemeProvider",
  "SessionProvider",
  "ClerkProvider",
  "WagmiProvider",
  "RainbowKitProvider",
  "TooltipProvider",
  "Toaster"
];

function usage() {
  return `Usage: nextjs-app-router-performance [options]

Options:
  --project <dir>                 Next.js project directory. Defaults to cwd.
  --no-build                      Inspect source and existing .next output without running build.
  --build-command <command>       Override the detected build command.
  --budget-first-load-kb <kb>     Project-defined route First Load JS budget.
  --budget-route-kb <kb>          Project-defined route Size budget.
  --budget-shared-kb <kb>         Project-defined shared First Load JS budget.
  --config <file>                 Project config JSON path.
  --json                          Print machine-readable JSON.
  --help                          Show this help.
`;
}

function parseArgs(argv) {
  const args = {
    project: process.cwd(),
    build: true,
    buildCommand: "",
    json: false,
    config: "",
    overrides: {}
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const nextValue = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[i];
    };

    if (arg === "--project") {
      args.project = nextValue();
    } else if (arg === "--no-build") {
      args.build = false;
    } else if (arg === "--build-command") {
      args.buildCommand = nextValue();
    } else if (arg === "--budget-first-load-kb") {
      args.overrides.firstLoadJsKb = numberArg(arg, nextValue());
    } else if (arg === "--budget-route-kb") {
      args.overrides.routeJsKb = numberArg(arg, nextValue());
    } else if (arg === "--budget-shared-kb") {
      args.overrides.sharedFirstLoadJsKb = numberArg(arg, nextValue());
    } else if (arg === "--config") {
      args.config = nextValue();
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  args.project = path.resolve(args.project);
  if (args.config) {
    args.config = path.resolve(args.config);
  }
  return args;
}

function numberArg(name, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return parsed;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function findConfig(projectRoot, explicitConfig) {
  const candidates = explicitConfig
    ? [explicitConfig]
    : CONFIG_FILES.map((file) => path.join(projectRoot, file));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "";
}

function loadConfig(projectRoot, args) {
  const configPath = findConfig(projectRoot, args.config);
  const fileConfig = configPath ? readJson(configPath) : {};
  return {
    ...fileConfig,
    ...args.overrides,
    failOnBudgetExceeded: fileConfig.failOnBudgetExceeded ?? DEFAULTS.failOnBudgetExceeded,
    routes: {
      ...(fileConfig.routes || {})
    },
    configPath
  };
}

function isNextProject(projectRoot) {
  const packageFile = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packageFile)) {
    return false;
  }

  const pkg = readJson(packageFile);
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  return Boolean(
    deps.next ||
      fs.existsSync(path.join(projectRoot, "next.config.js")) ||
      fs.existsSync(path.join(projectRoot, "next.config.mjs")) ||
      fs.existsSync(path.join(projectRoot, "next.config.ts"))
  );
}

function detectAppRoots(projectRoot) {
  return ["app", path.join("src", "app")]
    .map((relative) => path.join(projectRoot, relative))
    .filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) {
    return ["pnpm", "build"];
  }
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) {
    return ["yarn", "build"];
  }
  if (fs.existsSync(path.join(projectRoot, "bun.lockb")) || fs.existsSync(path.join(projectRoot, "bun.lock"))) {
    return ["bun", "run", "build"];
  }
  return ["npm", "run", "build"];
}

function detectBuildCommand(projectRoot, override) {
  if (override) {
    return splitCommand(override);
  }

  const packageFile = path.join(projectRoot, "package.json");
  const pkg = readJson(packageFile);
  if (pkg.scripts && pkg.scripts.build) {
    return detectPackageManager(projectRoot);
  }

  return ["npx", "next", "build"];
}

function splitCommand(command) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

function runBuild(projectRoot, command) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: process.env.CI || "1"
    }
  });

  return {
    command: command.join(" "),
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    output: `${result.stdout || ""}\n${result.stderr || ""}`
  };
}

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function writeBuildLog(projectRoot, output) {
  const nextDir = path.join(projectRoot, ".next");
  try {
    fs.mkdirSync(nextDir, { recursive: true });
    fs.writeFileSync(path.join(nextDir, "codex-app-router-performance.log"), output);
  } catch {
    // The report still works from the in-memory build output.
  }
}

function parseSizeToKb(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  const normalized = unit.toLowerCase();
  if (normalized === "b") {
    return number / 1024;
  }
  if (normalized === "kb") {
    return number;
  }
  if (normalized === "mb") {
    return number * 1024;
  }
  return null;
}

function cleanRoute(rawRoute) {
  return rawRoute
    .replace(/^[^\w/(.[\]@-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBuildOutput(output) {
  const routes = [];
  let sharedFirstLoadJsKb = null;
  const lines = stripAnsi(output).split(/\r?\n/);

  for (const line of lines) {
    const routeMatch = line.match(/^[\s├┌└─│+○●ƒλ]*([/][^\s]*)\s+([\d.]+)\s*(B|kB|MB)\s+([\d.]+)\s*(B|kB|MB)\s*$/i);
    if (routeMatch) {
      routes.push({
        route: cleanRoute(routeMatch[1]),
        sizeKb: roundKb(parseSizeToKb(routeMatch[2], routeMatch[3])),
        firstLoadJsKb: roundKb(parseSizeToKb(routeMatch[4], routeMatch[5]))
      });
      continue;
    }

    const sharedMatch = line.match(/First Load JS shared by all\s+([\d.]+)\s*(B|kB|MB)/i);
    if (sharedMatch) {
      sharedFirstLoadJsKb = roundKb(parseSizeToKb(sharedMatch[1], sharedMatch[2]));
    }
  }

  return { routes, sharedFirstLoadJsKb };
}

function roundKb(value) {
  if (value == null) {
    return null;
  }
  return Math.round(value * 10) / 10;
}

function loadPreviousBuildOutput(projectRoot) {
  const candidates = [
    path.join(projectRoot, ".next", "codex-app-router-performance.log"),
    path.join(projectRoot, ".next", "codex-build-budget.log"),
    path.join(projectRoot, ".next", "build-output.log"),
    path.join(projectRoot, ".next", "next-build.log")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, "utf8");
    }
  }
  return "";
}

function readManifest(projectRoot, relativePath) {
  const file = path.join(projectRoot, ".next", relativePath);
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function collectManifestHints(projectRoot) {
  const buildManifest = readManifest(projectRoot, "build-manifest.json");
  const appBuildManifest = readManifest(projectRoot, "app-build-manifest.json");
  const pages = new Set();

  if (buildManifest && buildManifest.pages) {
    for (const page of Object.keys(buildManifest.pages)) {
      pages.add(page);
    }
  }

  if (appBuildManifest && appBuildManifest.pages) {
    for (const page of Object.keys(appBuildManifest.pages)) {
      pages.add(page);
    }
  }

  return {
    manifestRoutes: Array.from(pages).sort()
  };
}

function isConfiguredBudget(value) {
  return Number.isFinite(value) && value > 0;
}

function routeBudget(route, config, key) {
  const routeConfig = config.routes?.[route] || {};
  if (isConfiguredBudget(routeConfig[key])) {
    return routeConfig[key];
  }
  if (isConfiguredBudget(config[key])) {
    return config[key];
  }
  return null;
}

function hasConfiguredBudgets(config) {
  if (
    isConfiguredBudget(config.firstLoadJsKb) ||
    isConfiguredBudget(config.routeJsKb) ||
    isConfiguredBudget(config.sharedFirstLoadJsKb)
  ) {
    return true;
  }

  for (const routeConfig of Object.values(config.routes || {})) {
    if (
      isConfiguredBudget(routeConfig.firstLoadJsKb) ||
      isConfiguredBudget(routeConfig.routeJsKb)
    ) {
      return true;
    }
  }

  return false;
}

function evaluateBudgets(parsed, config) {
  const violations = [];
  for (const route of parsed.routes) {
    const firstLoadBudget = routeBudget(route.route, config, "firstLoadJsKb");
    const routeBudgetKb = routeBudget(route.route, config, "routeJsKb");

    if (firstLoadBudget != null && route.firstLoadJsKb != null && route.firstLoadJsKb > firstLoadBudget) {
      violations.push({
        type: "first-load-js",
        route: route.route,
        actualKb: route.firstLoadJsKb,
        budgetKb: firstLoadBudget,
        overByKb: roundKb(route.firstLoadJsKb - firstLoadBudget)
      });
    }

    if (routeBudgetKb != null && route.sizeKb != null && route.sizeKb > routeBudgetKb) {
      violations.push({
        type: "route-js",
        route: route.route,
        actualKb: route.sizeKb,
        budgetKb: routeBudgetKb,
        overByKb: roundKb(route.sizeKb - routeBudgetKb)
      });
    }
  }

  if (
    isConfiguredBudget(config.sharedFirstLoadJsKb) &&
    parsed.sharedFirstLoadJsKb != null &&
    parsed.sharedFirstLoadJsKb > config.sharedFirstLoadJsKb
  ) {
    violations.push({
      type: "shared-first-load-js",
      route: "*",
      actualKb: parsed.sharedFirstLoadJsKb,
      budgetKb: config.sharedFirstLoadJsKb,
      overByKb: roundKb(parsed.sharedFirstLoadJsKb - config.sharedFirstLoadJsKb)
    });
  }

  return violations;
}

function listSourceFiles(root) {
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") {
          continue;
        }
        stack.push(fullPath);
      } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function baseNameWithoutExt(file) {
  return path.basename(file, path.extname(file));
}

function hasUseClientDirective(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    if (trimmed === "\"use client\"" || trimmed === "\"use client\";" || trimmed === "'use client'" || trimmed === "'use client';") {
      return true;
    }
    return false;
  }
  return false;
}

function parseImports(text) {
  const imports = [];
  const lines = text.split(/\r?\n/);
  const importPattern = /^\s*import\s+(?:.+?\s+from\s+)?["']([^"']+)["'];?/;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(importPattern);
    if (match) {
      imports.push({
        line: i + 1,
        source: match[1]
      });
    }
  }

  return imports;
}

function matchesImport(source, hints) {
  return hints.find((hint) => source === hint || source.startsWith(`${hint}/`));
}

function isRootLayout(appRoot, file) {
  return path.relative(appRoot, file).split(path.sep).join("/") === "layout" + path.extname(file);
}

function makeRisk({ rule, severity, file, line, message, importSource = "" }) {
  return {
    rule,
    severity,
    file,
    line,
    import: importSource,
    message
  };
}

function scanInitialLoadRisks(projectRoot) {
  const appRoots = detectAppRoots(projectRoot);
  const risks = [];

  for (const appRoot of appRoots) {
    for (const file of listSourceFiles(appRoot)) {
      const text = fs.readFileSync(file, "utf8");
      const rel = path.relative(projectRoot, file);
      const base = baseNameWithoutExt(file);
      const imports = parseImports(text);
      const useClient = hasUseClientDirective(text);
      const appEntryFile = APP_ENTRY_FILES.has(base);

      if (useClient && (base === "page" || base === "layout" || base === "template")) {
        risks.push(makeRisk({
          rule: "server-first-boundary",
          severity: "high",
          file,
          line: 1,
          message: `${rel} is a ${base} file with 'use client'. Keep App Router route entries server-first and move interactive UI into leaf Client Components.`
        }));
      }

      if (isRootLayout(appRoot, file)) {
        for (let i = 0; i < PROVIDER_HINTS.length; i += 1) {
          const provider = PROVIDER_HINTS[i];
          const index = text.indexOf(provider);
          if (index !== -1) {
            const line = text.slice(0, index).split(/\r?\n/).length;
            risks.push(makeRisk({
              rule: "provider-boundary",
              severity: "medium",
              file,
              line,
              message: `${rel} references ${provider}. Verify this provider is needed for every route; otherwise move it to the smallest subtree that needs it.`
            }));
            break;
          }
        }
      }

      for (const item of imports) {
        const heavyImport = matchesImport(item.source, HEAVY_IMPORT_HINTS);
        if (heavyImport) {
          const severity = useClient || appEntryFile ? "high" : "medium";
          risks.push(makeRisk({
            rule: "heavy-client-import",
            severity,
            file,
            line: item.line,
            importSource: item.source,
            message: `${rel} imports ${item.source}. For initial load, prefer Server Components, next/dynamic for below-the-fold UI, or event-triggered import() when this library is not needed immediately.`
          }));
        }

        if (appEntryFile && (item.source === "@/components" || item.source === "components" || item.source.endsWith("/components"))) {
          risks.push(makeRisk({
            rule: "barrel-import",
            severity: "medium",
            file,
            line: item.line,
            importSource: item.source,
            message: `${rel} imports a broad components barrel. Prefer direct route-local imports so unrelated Client Components do not join the initial graph.`
          }));
        }
      }
    }
  }

  return risks;
}

function printHuman(result) {
  const { projectRoot, command, parsed, config, violations, risks, manifestHints, build, appRouter } = result;
  const configuredBudgets = hasConfiguredBudgets(config);
  console.log("Next.js App Router performance report");
  console.log(`Project: ${projectRoot}`);
  console.log(`App Router: ${appRouter ? "detected" : "not detected"}`);
  if (config.configPath) {
    console.log(`Config: ${config.configPath}`);
  }
  if (command) {
    console.log(`Build: ${command}`);
  }
  if (build && build.status !== 0) {
    console.log(`Build failed with status ${build.status}${build.signal ? ` (${build.signal})` : ""}.`);
    return;
  }
  console.log("");

  if (parsed.routes.length > 0) {
    console.log("Legacy route JS metrics:");
    for (const route of parsed.routes) {
      console.log(`- ${route.route}: Size ${route.sizeKb} kB, First Load JS ${route.firstLoadJsKb} kB`);
    }
    if (parsed.sharedFirstLoadJsKb != null) {
      console.log(`- shared by all: First Load JS ${parsed.sharedFirstLoadJsKb} kB`);
    }
    console.log("");
  } else {
    console.log("No route JS size table was found in the build output.");
    console.log("This is expected for Next.js 16+. Use `next experimental-analyze --output` for bundle composition and import-chain analysis.");
    if (manifestHints.manifestRoutes.length > 0) {
      console.log(`Manifest routes detected: ${manifestHints.manifestRoutes.join(", ")}`);
    }
    console.log("");
  }

  if (!configuredBudgets) {
    console.log("Configured JS budgets: not enforced.");
  } else if (violations.length === 0) {
    console.log("Configured JS budgets: pass.");
  } else {
    console.log("Configured JS budgets: fail.");
    for (const violation of violations) {
      console.log(`- ${violation.route} ${violation.type}: ${violation.actualKb} kB > ${violation.budgetKb} kB (+${violation.overByKb} kB)`);
    }
  }

  console.log("");
  if (risks.length === 0) {
    console.log("Initial-load rules: no high-confidence risks found.");
  } else {
    console.log("Initial-load risks:");
    for (const risk of risks) {
      const relative = path.relative(projectRoot, risk.file);
      const importText = risk.import ? ` imports ${risk.import}` : "";
      console.log(`- [${risk.severity}] ${risk.rule}: ${relative}:${risk.line}${importText}`);
      console.log(`  ${risk.message}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  const projectRoot = args.project;
  if (!isNextProject(projectRoot)) {
    throw new Error(`Not a Next.js project: ${projectRoot}`);
  }

  const appRoots = detectAppRoots(projectRoot);
  const config = loadConfig(projectRoot, args);
  const command = args.build ? detectBuildCommand(projectRoot, args.buildCommand) : null;
  const build = args.build ? runBuild(projectRoot, command) : null;
  if (build) {
    writeBuildLog(projectRoot, build.output);
  }
  const output = build ? build.output : loadPreviousBuildOutput(projectRoot);
  const parsed = parseBuildOutput(output);
  const manifestHints = collectManifestHints(projectRoot);
  const violations = build && build.status !== 0 ? [] : evaluateBudgets(parsed, config);
  const risks = scanInitialLoadRisks(projectRoot);

  const result = {
    projectRoot,
    appRouter: appRoots.length > 0,
    command: command ? command.join(" ") : "",
    config,
    build: build
      ? {
          status: build.status,
          signal: build.signal
        }
      : null,
    parsed,
    manifestHints,
    violations,
    risks
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }

  if (build && build.status !== 0) {
    process.exit(build.status || 1);
  }

  if (config.failOnBudgetExceeded && violations.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`nextjs-app-router-performance: ${error.message}`);
  process.exit(1);
});
