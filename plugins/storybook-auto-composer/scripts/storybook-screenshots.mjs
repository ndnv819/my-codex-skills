#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

function usage() {
  return [
    "Usage: storybook-screenshots.sh --url http://127.0.0.1:6006 [options]",
    "",
    "Options:",
    "  --project <dir>      Project directory. Defaults to cwd.",
    "  --url <url>          Running Storybook URL. Defaults to http://127.0.0.1:6006.",
    "  --out <dir>          Output directory relative to project or absolute. Defaults to .storybook/visual-baselines.",
    "  --limit <n>          Maximum number of stories to capture.",
    "  --include <text>     Capture only story ids containing this text. Can be repeated.",
    "  --viewport <WxH>     Viewport size. Defaults to 1440x1000.",
    "  --wait-ms <n>        Extra wait after story load. Defaults to 300.",
    "  --json               Print machine-readable JSON.",
    "  --help               Show this help."
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    project: process.cwd(),
    url: "http://127.0.0.1:6006",
    out: ".storybook/visual-baselines",
    limit: 0,
    include: [],
    viewport: { width: 1440, height: 1000 },
    waitMs: 300,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--project") {
      options.project = nextValue();
    } else if (arg === "--url") {
      options.url = nextValue();
    } else if (arg === "--out") {
      options.out = nextValue();
    } else if (arg === "--limit") {
      options.limit = Number(nextValue());
      if (!Number.isInteger(options.limit) || options.limit < 0) {
        throw new Error("--limit must be a non-negative integer");
      }
    } else if (arg === "--include") {
      options.include.push(nextValue());
    } else if (arg === "--viewport") {
      const value = nextValue();
      const match = value.match(/^(\d+)x(\d+)$/);
      if (!match) throw new Error("--viewport must use WIDTHxHEIGHT, for example 1440x1000");
      options.viewport = { width: Number(match[1]), height: Number(match[2]) };
    } else if (arg === "--wait-ms") {
      options.waitMs = Number(nextValue());
      if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
        throw new Error("--wait-ms must be a non-negative number");
      }
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.project = path.resolve(options.project);
  options.out = path.isAbsolute(options.out) ? options.out : path.join(options.project, options.out);
  options.url = options.url.replace(/\/$/, "");
  return options;
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchStoryIndex(baseUrl) {
  try {
    return await fetchJson(`${baseUrl}/index.json`);
  } catch {
    return fetchJson(`${baseUrl}/stories.json`);
  }
}

function extractStories(index) {
  const entries = index.entries || index.stories || {};
  return Object.values(entries)
    .filter((entry) => entry && (entry.type === "story" || entry.kind || entry.name))
    .map((entry) => ({
      id: entry.id,
      title: entry.title || entry.kind || "",
      name: entry.name || ""
    }))
    .filter((entry) => entry.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function filterStories(stories, options) {
  let filtered = stories;
  if (options.include.length > 0) {
    filtered = filtered.filter((story) =>
      options.include.some((needle) => story.id.includes(needle) || story.title.includes(needle))
    );
  }
  if (options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }
  return filtered;
}

async function capture(options) {
  let playwright;
  try {
    const requireFromProject = createRequire(path.join(options.project, "package.json"));
    playwright = requireFromProject("playwright");
  } catch {
    try {
      playwright = await import("playwright");
    } catch {
      throw new Error("Playwright is not available. Install it in the target project before generating screenshot baselines.");
    }
  }

  const storyIndex = await fetchStoryIndex(options.url);
  const stories = filterStories(extractStories(storyIndex), options);
  fs.mkdirSync(options.out, { recursive: true });

  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: options.viewport });
  const captured = [];
  const failed = [];

  for (const story of stories) {
    const filePath = path.join(options.out, `${safeName(story.id)}.png`);
    const storyUrl = `${options.url}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;

    try {
      await page.goto(storyUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(options.waitMs);
      await page.screenshot({ path: filePath, fullPage: true });
      captured.push({
        id: story.id,
        title: story.title,
        name: story.name,
        file: path.relative(options.project, filePath).split(path.sep).join("/")
      });
    } catch (error) {
      failed.push({
        id: story.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await browser.close();

  return {
    storybookUrl: options.url,
    outputDirectory: path.relative(options.project, options.out).split(path.sep).join("/"),
    viewport: options.viewport,
    totalStories: stories.length,
    captured,
    failed
  };
}

function printHuman(report) {
  const lines = [];
  lines.push(`Storybook URL: ${report.storybookUrl}`);
  lines.push(`Output directory: ${report.outputDirectory}`);
  lines.push(`Viewport: ${report.viewport.width}x${report.viewport.height}`);
  lines.push(`Captured: ${report.captured.length}/${report.totalStories}`);
  if (report.failed.length > 0) {
    lines.push("");
    lines.push("Failed stories:");
    for (const failure of report.failed) {
      lines.push(`- ${failure.id}: ${failure.error}`);
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

  const report = await capture(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
  if (report.failed.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
