#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MARKETPLACE="$REPO_ROOT/.agents/plugins/marketplace.json"

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required to validate plugin manifests" >&2
  exit 1
fi

node - "$REPO_ROOT" "$MARKETPLACE" <<'NODE'
const fs = require("fs");
const path = require("path");

const [repoRoot, marketplacePath] = process.argv.slice(2);
const errors = [];
const warnings = [];

const rel = (target) => path.relative(repoRoot, target) || ".";
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    addError(`${label} is missing: ${rel(filePath)}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    addError(`${label} is not valid JSON: ${rel(filePath)} (${error.message})`);
    return null;
  }
}

function assertOnlyPluginJson(codexPluginDir) {
  if (!fs.existsSync(codexPluginDir)) {
    addError(`missing .codex-plugin directory: ${rel(codexPluginDir)}`);
    return;
  }

  for (const entry of fs.readdirSync(codexPluginDir, { withFileTypes: true })) {
    if (entry.name !== "plugin.json") {
      addError(`only plugin.json belongs in .codex-plugin: ${rel(path.join(codexPluginDir, entry.name))}`);
    }
  }
}

const marketplace = readJson(marketplacePath, "marketplace index");
const pluginsRoot = path.join(repoRoot, "plugins");
const marketplaceEntriesByName = new Map();
const validatedNames = new Set();

if (!marketplace || !isObject(marketplace)) {
  addError("marketplace index must be a JSON object");
} else if (!Array.isArray(marketplace.plugins)) {
  addError("marketplace index must include a plugins array");
} else {
  for (const [index, entry] of marketplace.plugins.entries()) {
    const label = `marketplace plugins[${index}]`;

    if (!isObject(entry)) {
      addError(`${label} must be an object`);
      continue;
    }

    if (typeof entry.name !== "string" || entry.name.length === 0) {
      addError(`${label}.name must be a non-empty string`);
      continue;
    }

    if (marketplaceEntriesByName.has(entry.name)) {
      addError(`duplicate marketplace plugin name: ${entry.name}`);
    }
    marketplaceEntriesByName.set(entry.name, entry);

    if (!isObject(entry.source)) {
      addError(`${label}.source must be an object`);
      continue;
    }

    if (entry.source.source !== "local") {
      addError(`${entry.name}: source.source must be "local"`);
    }

    if (typeof entry.source.path !== "string" || !entry.source.path.startsWith("./plugins/")) {
      addError(`${entry.name}: source.path must start with ./plugins/`);
      continue;
    }

    const pluginRoot = path.resolve(repoRoot, entry.source.path);
    const expectedPluginsRoot = path.resolve(repoRoot, "plugins");
    if (!pluginRoot.startsWith(`${expectedPluginsRoot}${path.sep}`)) {
      addError(`${entry.name}: source.path must resolve inside plugins/: ${entry.source.path}`);
      continue;
    }

    if (!fs.existsSync(pluginRoot) || !fs.statSync(pluginRoot).isDirectory()) {
      addError(`${entry.name}: plugin directory is missing: ${entry.source.path}`);
      continue;
    }

    const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
    const manifest = readJson(manifestPath, `${entry.name} manifest`);
    assertOnlyPluginJson(path.join(pluginRoot, ".codex-plugin"));

    if (!manifest || !isObject(manifest)) {
      addError(`${entry.name}: manifest must be a JSON object`);
      continue;
    }

    if (manifest.name !== entry.name) {
      addError(`${entry.name}: manifest name must match marketplace name, found ${JSON.stringify(manifest.name)}`);
    }

    if (manifest.name !== path.basename(pluginRoot)) {
      addError(`${entry.name}: manifest name must match plugin directory name ${path.basename(pluginRoot)}`);
    }

    if (typeof manifest.skills === "string") {
      const skillsPath = path.resolve(pluginRoot, manifest.skills);
      if (!fs.existsSync(skillsPath)) {
        addError(`${entry.name}: manifest skills path is missing: ${manifest.skills}`);
      }
    }

    validatedNames.add(entry.name);
  }
}

if (!fs.existsSync(pluginsRoot) || !fs.statSync(pluginsRoot).isDirectory()) {
  addError(`plugins directory is missing: ${rel(pluginsRoot)}`);
} else {
  for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const pluginName = entry.name;
    const pluginRoot = path.join(pluginsRoot, pluginName);
    const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
    const manifest = readJson(manifestPath, `${pluginName} manifest`);
    assertOnlyPluginJson(path.join(pluginRoot, ".codex-plugin"));

    if (!manifest || !isObject(manifest)) {
      continue;
    }

    if (manifest.name !== pluginName) {
      addError(`${pluginName}: manifest name must match plugin directory name, found ${JSON.stringify(manifest.name)}`);
    }

    const marketplaceEntry = marketplaceEntriesByName.get(pluginName);
    if (!marketplaceEntry) {
      addError(`${pluginName}: missing marketplace entry`);
      continue;
    }

    const expectedSourcePath = `./plugins/${pluginName}`;
    if (marketplaceEntry.source?.path !== expectedSourcePath) {
      addError(`${pluginName}: marketplace source.path must be ${expectedSourcePath}`);
    }
  }
}

for (const name of marketplaceEntriesByName.keys()) {
  if (!validatedNames.has(name)) {
    addWarning(`${name}: marketplace entry was not fully validated because earlier errors stopped checks`);
  }
}

if (warnings.length > 0) {
  console.warn("Warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const count = marketplaceEntriesByName.size;
console.log(`Validated ${count} plugin${count === 1 ? "" : "s"} from ${rel(marketplacePath)}.`);
NODE
