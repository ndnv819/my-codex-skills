#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function parseArgs(argv) {
  const options = {
    project: process.cwd(),
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--project") {
      options.project = argv[index + 1];
      index += 1;
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

  return options;
}

function usage() {
  return [
    "Usage: typescript-vitest.sh [--project path] [--json]",
    "",
    "Inspects a TypeScript project and reports Vitest setup, package manager,",
    "test/typecheck scripts, conflicting runners, and recommended commands."
  ].join("\n");
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
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

function findFirst(root, candidates) {
  return candidates.find((candidate) => exists(root, candidate)) || null;
}

function countTypeScriptFiles(root) {
  const ignored = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    "out",
    ".turbo"
  ]);
  let count = 0;

  function walk(dir, depth) {
    if (depth > 5 || count > 50) return;

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && /\.(ts|tsx|mts|cts)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
        count += 1;
      }
    }
  }

  walk(root, 0);
  return count;
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

function vitestCommand(packageManager) {
  if (packageManager === "pnpm") return "pnpm vitest run";
  if (packageManager === "yarn") return "yarn vitest run";
  if (packageManager === "bun") return "bunx vitest run";
  return "npx vitest run";
}

function tscCommand(packageManager) {
  if (packageManager === "pnpm") return "pnpm tsc --noEmit";
  if (packageManager === "yarn") return "yarn tsc --noEmit";
  if (packageManager === "bun") return "bunx tsc --noEmit";
  return "npx tsc --noEmit";
}

function installVitestCommand(packageManager) {
  if (packageManager === "pnpm") return "pnpm add -D vitest";
  if (packageManager === "yarn") return "yarn add -D vitest";
  if (packageManager === "bun") return "bun add -d vitest";
  return "npm install -D vitest";
}

function detectOtherRunners(root, deps, scripts) {
  const runnerChecks = [
    ["jest", deps.jest || deps["@jest/globals"] || findFirst(root, ["jest.config.js", "jest.config.ts", "jest.config.mjs", "jest.config.cjs"])],
    ["playwright", deps["@playwright/test"] || findFirst(root, ["playwright.config.ts", "playwright.config.js"])],
    ["cypress", deps.cypress || findFirst(root, ["cypress.config.ts", "cypress.config.js"])],
    ["mocha", deps.mocha],
    ["ava", deps.ava]
  ];

  const found = new Set();

  for (const [name, detected] of runnerChecks) {
    if (detected) found.add(name);
  }

  for (const command of Object.values(scripts)) {
    if (typeof command !== "string") continue;
    for (const [name] of runnerChecks) {
      if (command.includes(name)) found.add(name);
    }
  }

  return [...found].sort();
}

function analyzeProject(projectRoot) {
  const root = path.resolve(projectRoot);
  const pkgPath = path.join(root, "package.json");
  const pkg = readJson(pkgPath);
  const deps = mergedDependencies(pkg);
  const scripts = pkg?.scripts || {};
  const packageManager = detectPackageManager(root, pkg);
  const vitestConfig = findFirst(root, [
    "vitest.config.ts",
    "vitest.config.mts",
    "vitest.config.cts",
    "vitest.config.js",
    "vitest.config.mjs",
    "vitest.config.cjs"
  ]);
  const viteConfig = findFirst(root, [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs"
  ]);
  const testScript = findScript(scripts, ["test", "test:unit", "vitest"], "vitest");
  const typecheckScript = findScript(scripts, ["typecheck", "type-check", "check:types", "types"], "tsc");
  const tsFileCount = countTypeScriptFiles(root);
  const hasTypeScript = Boolean(
    exists(root, "tsconfig.json") ||
      deps.typescript ||
      tsFileCount > 0
  );
  const hasVitest = Boolean(deps.vitest || vitestConfig || testScript);
  const otherTestRunners = detectOtherRunners(root, deps, scripts);
  const baseVitest = vitestCommand(packageManager);

  const warnings = [];
  if (!pkg) warnings.push("package.json was not found or could not be parsed.");
  if (!hasTypeScript) warnings.push("No TypeScript signal was detected.");
  if (!hasVitest) warnings.push("Vitest is not installed or configured.");
  if (otherTestRunners.length > 0) {
    warnings.push(`Other test runner signals detected: ${otherTestRunners.join(", ")}.`);
  }

  return {
    projectRoot: root,
    language: hasTypeScript ? "typescript" : "unknown",
    packageManager,
    hasPackageJson: Boolean(pkg),
    hasTypeScript,
    typeScriptFileCount: tsFileCount,
    hasVitest,
    vitestConfig,
    viteConfig,
    testScript,
    typecheckScript,
    otherTestRunners,
    recommendedCommands: {
      installVitest: hasVitest ? null : installVitestCommand(packageManager),
      singleTest: `${baseVitest} <test-file>`,
      allTests: testScript ? scriptCommand(packageManager, testScript.name) : baseVitest,
      typecheck: typecheckScript ? scriptCommand(packageManager, typecheckScript.name) : tscCommand(packageManager)
    },
    warnings
  };
}

function printHuman(report) {
  const lines = [
    `Project: ${report.projectRoot}`,
    `Language: ${report.language}`,
    `Package manager: ${report.packageManager}`,
    `TypeScript files scanned: ${report.typeScriptFileCount}`,
    `Vitest: ${report.hasVitest ? "detected" : "not detected"}`,
    `Vitest config: ${report.vitestConfig || "none"}`,
    `Vite config: ${report.viteConfig || "none"}`,
    `Test script: ${report.testScript ? `${report.testScript.name} = ${report.testScript.command}` : "none"}`,
    `Typecheck script: ${report.typecheckScript ? `${report.typecheckScript.name} = ${report.typecheckScript.command}` : "none"}`,
    `Other test runners: ${report.otherTestRunners.length > 0 ? report.otherTestRunners.join(", ") : "none"}`,
    "",
    "Recommended commands:",
    `  Install Vitest: ${report.recommendedCommands.installVitest || "not needed"}`,
    `  Single test: ${report.recommendedCommands.singleTest}`,
    `  All tests: ${report.recommendedCommands.allTests}`,
    `  Typecheck: ${report.recommendedCommands.typecheck}`
  ];

  if (report.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  console.log(lines.join("\n"));
}

try {
  const options = parseArgs(args);
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
  console.error(error.message);
  console.error("");
  console.error(usage());
  process.exit(1);
}
