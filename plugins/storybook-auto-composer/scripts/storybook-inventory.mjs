#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);
const COMPONENT_EXTENSIONS = new Set([".tsx", ".jsx"]);
const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".storybook-cache",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "storybook-static"
]);
const NEXT_APP_FILES = new Set([
  "default",
  "error",
  "global-error",
  "layout",
  "loading",
  "not-found",
  "page",
  "route",
  "template"
]);

function usage() {
  return [
    "Usage: storybook-inventory.sh [--project path] [--json]",
    "",
    "Inspects a React or Next.js project and reports Storybook setup,",
    "component candidates, existing stories, MSW signals, Next.js App Router",
    "signals, and recommended bring-up commands."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    project: process.cwd(),
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--project") {
      index += 1;
      options.project = argv[index];
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.project) {
    throw new Error("--project requires a path");
  }

  options.project = path.resolve(options.project);
  return options;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function relative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function detectPackageManager(root, pkg) {
  if (exists(root, "pnpm-lock.yaml")) return "pnpm";
  if (exists(root, "yarn.lock")) return "yarn";
  if (exists(root, "bun.lock") || exists(root, "bun.lockb")) return "bun";
  if (exists(root, "package-lock.json") || exists(root, "npm-shrinkwrap.json")) return "npm";

  const declared = typeof pkg?.packageManager === "string" ? pkg.packageManager : "";
  if (declared.startsWith("pnpm@")) return "pnpm";
  if (declared.startsWith("yarn@")) return "yarn";
  if (declared.startsWith("bun@")) return "bun";
  if (declared.startsWith("npm@")) return "npm";

  return "npm";
}

function mergedDependencies(pkg) {
  return {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.peerDependencies || {}),
    ...(pkg?.optionalDependencies || {})
  };
}

function walk(root, visitor) {
  function visit(dir, depth) {
    if (depth > 10) return;

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
      } else if (entry.isFile()) {
        visitor(fullPath);
      }
    }
  }

  visit(root, 0);
}

function findFiles(root, predicate) {
  const files = [];
  walk(root, (filePath) => {
    if (predicate(filePath)) {
      files.push(relative(root, filePath));
    }
  });
  return files.sort();
}

function isStoryFile(filePath) {
  return /\.(stories|story)\.(tsx|ts|jsx|js|mdx)$/.test(filePath);
}

function isTestFile(filePath) {
  return /\.(test|spec)\.(tsx|ts|jsx|js)$/.test(filePath);
}

function isLikelyNextRouteFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return NEXT_APP_FILES.has(base) && /(^|\/)(app|src\/app)\//.test(filePath.split(path.sep).join("/"));
}

function hasJsx(text) {
  return /return\s*(?:\(|<)/.test(text) || /<[A-Za-z][A-Za-z0-9.:-]*(\s|>|\/)/.test(text);
}

function hasComponentExport(text) {
  return /export\s+(default\s+)?function\s+[A-Z][A-Za-z0-9]*/.test(text) ||
    /export\s+const\s+[A-Z][A-Za-z0-9]*\s*=/.test(text) ||
    /export\s*\{\s*[A-Z][A-Za-z0-9]*/.test(text);
}

function isLikelyComponent(root, relativePath) {
  const ext = path.extname(relativePath);
  if (!COMPONENT_EXTENSIONS.has(ext)) return false;
  if (isStoryFile(relativePath) || isTestFile(relativePath)) return false;
  if (/\/(__tests__|test|tests|mocks|fixtures)\//.test(relativePath)) return false;
  if (isLikelyNextRouteFile(relativePath)) return false;

  const base = path.basename(relativePath, ext);
  const inComponentArea = /(^|\/)(components|ui|shared|features|app|src|packages)\//.test(relativePath);
  const pascalName = /^[A-Z][A-Za-z0-9]*$/.test(base) || base === "index";
  if (!inComponentArea && !pascalName) return false;

  const text = readText(path.join(root, relativePath));
  return hasJsx(text) && (hasComponentExport(text) || pascalName);
}

function detectStorybookConfig(root) {
  const configDir = path.join(root, ".storybook");
  if (!statSafe(configDir)?.isDirectory()) {
    return {
      configDir: null,
      files: [],
      framework: null,
      addons: [],
      staticDirs: []
    };
  }

  const files = findFiles(configDir, () => true).map((file) => `.storybook/${file}`);
  const mainFile = files.find((file) => /^\.storybook\/main\.(ts|js|mts|mjs|cts|cjs)$/.test(file));
  const mainText = mainFile ? readText(path.join(root, mainFile)) : "";
  const frameworkMatch = mainText.match(/framework\s*:\s*(?:\{\s*name\s*:\s*)?["']([^"']+)["']/);
  const addonMatches = [...mainText.matchAll(/["'](@storybook\/addon-[^"']+|@chromatic-com\/storybook|storybook-addon-[^"']+)["']/g)];

  return {
    configDir: ".storybook",
    files,
    framework: frameworkMatch?.[1] || null,
    addons: [...new Set(addonMatches.map((match) => match[1]))].sort(),
    staticDirs: mainText.includes("staticDirs") ? ["configured"] : []
  };
}

function findScript(scripts, names, contains) {
  for (const name of names) {
    if (typeof scripts[name] === "string" && (!contains || scripts[name].includes(contains))) {
      return { name, command: scripts[name] };
    }
  }

  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command === "string" && (!contains || command.includes(contains))) {
      return { name, command };
    }
  }

  return null;
}

function scriptCommand(packageManager, scriptName) {
  if (!scriptName) return null;
  if (packageManager === "pnpm") return `pnpm ${scriptName}`;
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  if (packageManager === "bun") return `bun run ${scriptName}`;
  if (scriptName === "test") return "npm test";
  return `npm run ${scriptName}`;
}

function createStorybookCommand(packageManager, type) {
  const typeFlag = type ? ` --type ${type}` : "";
  if (packageManager === "pnpm") return `pnpm create storybook@latest${typeFlag}`;
  if (packageManager === "yarn") return `yarn create storybook${typeFlag}`;
  if (packageManager === "bun") return `bun create storybook@latest${typeFlag}`;
  return type ? `npm create storybook@latest --${typeFlag}` : "npm create storybook@latest";
}

function detectMsw(root, deps) {
  const handlerFiles = findFiles(root, (filePath) => {
    const rel = relative(root, filePath);
    return SOURCE_EXTENSIONS.has(path.extname(filePath)) &&
      /(^|\/)(mocks?|__mocks__|fixtures?)\//.test(rel) &&
      /(handler|handlers|msw|server|worker)\.(ts|tsx|js|jsx)$/.test(path.basename(filePath));
  });

  const publicWorker = exists(root, "public/mockServiceWorker.js");

  return {
    hasMsw: Boolean(deps.msw || publicWorker || handlerFiles.length > 0),
    hasStorybookAddon: Boolean(deps["msw-storybook-addon"]),
    publicWorker,
    handlerFiles: handlerFiles.slice(0, 50)
  };
}

function analyzeComponent(root, relativePath, storiesByBase) {
  const text = readText(path.join(root, relativePath));
  const ext = path.extname(relativePath);
  const base = path.basename(relativePath, ext);
  const storyKey = base === "index" ? path.basename(path.dirname(relativePath)) : base;
  const storyCandidates = storiesByBase.get(storyKey.toLowerCase()) || [];

  return {
    path: relativePath,
    name: storyKey,
    hasStory: storyCandidates.length > 0,
    storyFiles: storyCandidates,
    signals: {
      nextNavigation: /from\s+["']next\/navigation["']/.test(text),
      nextImage: /from\s+["']next\/image["']/.test(text),
      nextFont: /from\s+["']next\/font\/(google|local)["']/.test(text),
      network: /\b(fetch|axios|graphql|urql|ApolloClient|useQuery|useMutation)\b/.test(text),
      form: /\b(form|input|textarea|select|button|submit)\b/i.test(text),
      overlay: /\b(dialog|modal|popover|dropdown|menu|tooltip|sheet)\b/i.test(text)
    }
  };
}

function summarizeComponents(components) {
  return {
    total: components.length,
    withStories: components.filter((component) => component.hasStory).length,
    missingStories: components.filter((component) => !component.hasStory).length,
    nextRuntimeSensitive: components.filter((component) =>
      component.signals.nextNavigation || component.signals.nextImage || component.signals.nextFont
    ).length,
    networkSensitive: components.filter((component) => component.signals.network).length,
    interactionCandidates: components.filter((component) => component.signals.form || component.signals.overlay).length
  };
}

function analyzeProject(projectRoot) {
  const root = path.resolve(projectRoot);
  const pkg = readJson(path.join(root, "package.json"));
  const deps = mergedDependencies(pkg);
  const scripts = pkg?.scripts || {};
  const packageManager = detectPackageManager(root, pkg);
  const storybookConfig = detectStorybookConfig(root);
  const storyFiles = findFiles(root, (filePath) => isStoryFile(relative(root, filePath)));
  const storiesByBase = new Map();

  for (const story of storyFiles) {
    const basename = path.basename(story).replace(/\.(stories|story)\.(tsx|ts|jsx|js|mdx)$/, "");
    const key = basename.toLowerCase();
    if (!storiesByBase.has(key)) storiesByBase.set(key, []);
    storiesByBase.get(key).push(story);
  }

  const componentPaths = findFiles(root, (filePath) => {
    const rel = relative(root, filePath);
    return isLikelyComponent(root, rel);
  });
  const components = componentPaths.map((componentPath) => analyzeComponent(root, componentPath, storiesByBase));
  const storybookScript = findScript(scripts, ["storybook", "dev:storybook"], "storybook");
  const buildScript = findScript(scripts, ["build-storybook", "storybook:build", "build:storybook"], "storybook");
  const testStorybookScript = findScript(scripts, ["test-storybook", "storybook:test", "test:storybook"], "storybook");
  const typecheckScript = findScript(scripts, ["typecheck", "type-check", "check:types"], "tsc");
  const lintScript = findScript(scripts, ["lint"], null);
  const hasStorybookDeps = Object.keys(deps).some((dep) => dep === "storybook" || dep.startsWith("@storybook/"));
  const isNext = Boolean(deps.next || exists(root, "next.config.js") || exists(root, "next.config.mjs") || exists(root, "next.config.ts"));
  const isReact = Boolean(deps.react || deps["react-dom"]);
  const hasTypeScript = Boolean(deps.typescript || exists(root, "tsconfig.json"));
  const hasAppDir = exists(root, "app") || exists(root, "src/app");
  const hasPagesDir = exists(root, "pages") || exists(root, "src/pages");
  const hasPlaywright = Boolean(deps["@playwright/test"] || deps.playwright || exists(root, "playwright.config.ts") || exists(root, "playwright.config.js"));
  const hasChromatic = Boolean(deps.chromatic || deps["@chromatic-com/storybook"]);
  const msw = detectMsw(root, deps);
  const setupType = isNext ? "nextjs" : isReact ? "react" : null;

  return {
    projectRoot: root,
    packageManager,
    framework: {
      react: isReact,
      nextjs: isNext,
      appRouter: hasAppDir,
      pagesRouter: hasPagesDir,
      typescript: hasTypeScript
    },
    storybook: {
      installed: Boolean(hasStorybookDeps || storybookConfig.configDir || storybookScript),
      dependencies: Object.keys(deps).filter((dep) => dep === "storybook" || dep.startsWith("@storybook/")).sort(),
      config: storybookConfig,
      scripts: {
        dev: storybookScript,
        build: buildScript,
        test: testStorybookScript
      }
    },
    msw,
    visualTesting: {
      hasPlaywright,
      hasChromatic
    },
    scripts: {
      typecheck: typecheckScript,
      lint: lintScript
    },
    stories: {
      total: storyFiles.length,
      files: storyFiles.slice(0, 100)
    },
    components: {
      summary: summarizeComponents(components),
      candidates: components.slice(0, 200),
      missingStories: components.filter((component) => !component.hasStory).slice(0, 100)
    },
    recommendedCommands: {
      bootstrap: createStorybookCommand(packageManager, setupType),
      runStorybook: scriptCommand(packageManager, storybookScript?.name || "storybook"),
      buildStorybook: scriptCommand(packageManager, buildScript?.name || "build-storybook"),
      testStorybook: testStorybookScript ? scriptCommand(packageManager, testStorybookScript.name) : null,
      typecheck: typecheckScript ? scriptCommand(packageManager, typecheckScript.name) : null,
      lint: lintScript ? scriptCommand(packageManager, lintScript.name) : null
    }
  };
}

function printHuman(report) {
  const lines = [];
  lines.push(`Project: ${report.projectRoot}`);
  lines.push(`Package manager: ${report.packageManager}`);
  lines.push(`Framework: React=${report.framework.react ? "yes" : "no"}, Next.js=${report.framework.nextjs ? "yes" : "no"}, App Router=${report.framework.appRouter ? "yes" : "no"}, TypeScript=${report.framework.typescript ? "yes" : "no"}`);
  lines.push(`Storybook installed: ${report.storybook.installed ? "yes" : "no"}`);
  lines.push(`Storybook framework: ${report.storybook.config.framework || "unknown"}`);
  lines.push(`Stories: ${report.stories.total}`);
  lines.push(`Components: ${report.components.summary.total} candidates, ${report.components.summary.missingStories} likely missing stories`);
  lines.push(`Next runtime-sensitive components: ${report.components.summary.nextRuntimeSensitive}`);
  lines.push(`Network-sensitive components: ${report.components.summary.networkSensitive}`);
  lines.push(`Interaction candidates: ${report.components.summary.interactionCandidates}`);
  lines.push(`MSW: ${report.msw.hasMsw ? "detected" : "not detected"}, Storybook addon=${report.msw.hasStorybookAddon ? "yes" : "no"}, worker=${report.msw.publicWorker ? "yes" : "no"}`);
  lines.push(`Visual testing: Playwright=${report.visualTesting.hasPlaywright ? "yes" : "no"}, Chromatic=${report.visualTesting.hasChromatic ? "yes" : "no"}`);
  lines.push("");
  lines.push("Recommended commands:");
  for (const [name, command] of Object.entries(report.recommendedCommands)) {
    if (command) lines.push(`- ${name}: ${command}`);
  }
  if (report.components.missingStories.length > 0) {
    lines.push("");
    lines.push("Likely missing stories:");
    for (const component of report.components.missingStories.slice(0, 25)) {
      lines.push(`- ${component.path}`);
    }
  }
  console.log(lines.join("\n"));
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const report = analyzeProject(options.project);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
