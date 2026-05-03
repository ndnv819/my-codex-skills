#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);

const branchTypes = new Set(["feat", "fix", "hotfix", "refactor", "chore", "docs"]);
const prefixes = new Set([
  "Add",
  "Update",
  "Fix",
  "Remove",
  "Refactor",
  "Chore",
  "Docs",
  "Test",
  "Style",
  "Perf",
  "WIP"
]);
const prRequiredIssuePrefixes = new Set(["Add", "Update", "Fix", "Remove", "Refactor", "Perf"]);
const recommendedIssuePrefixes = new Set(["Test", "Docs", "WIP"]);

function parseArgs(argv) {
  const options = {
    project: process.cwd(),
    branch: null,
    commitMessage: null,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--project") {
      options.project = argv[index + 1];
      index += 1;
    } else if (arg === "--branch") {
      options.branch = argv[index + 1];
      index += 1;
    } else if (arg === "--commit-message") {
      options.commitMessage = argv[index + 1];
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
    "Usage: git-workflow.sh [--project path] [--branch name] [--commit-message message] [--json]",
    "",
    "Reports branch validity, issue key detection, commit message warnings,",
    "suggested issue insertion, PR body template, and version impact hints."
  ].join("\n");
}

function gitCurrentBranch(projectRoot) {
  try {
    const output = execFileSync("git", ["-C", projectRoot, "branch", "--show-current"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function normalizeBranchIssueKey(match) {
  if (match.groups.jiraIssue) {
    return {
      value: match.groups.jiraIssue,
      tracker: "jira",
      branchValue: match.groups.jiraIssue
    };
  }

  if (match.groups.githubIssue) {
    return {
      value: `#${match.groups.githubIssue}`,
      tracker: "github",
      branchValue: match.groups.githubIssue
    };
  }

  return null;
}

function validateBranch(branch) {
  const warnings = [];
  const errors = [];

  if (!branch) {
    errors.push("Current branch could not be detected.");
    return {
      name: branch,
      valid: false,
      type: null,
      topic: null,
      issueKey: null,
      errors,
      warnings
    };
  }

  if (branch === "main") {
    warnings.push("main is the production branch. Create a short-lived branch before doing work.");
    return {
      name: branch,
      valid: true,
      type: "main",
      topic: null,
      issueKey: null,
      errors,
      warnings
    };
  }

  const match = /^(?<type>feat|fix|hotfix|refactor|chore|docs)\/(?:(?<jiraIssue>[A-Z][A-Z0-9]+-\d+)-|(?<githubIssue>\d+)-)?(?<topic>[a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(branch);

  if (!match) {
    errors.push("Branch name must match <type>/<issue-key>-<short-topic> or <type>/<short-topic>.");
    return {
      name: branch,
      valid: false,
      type: null,
      topic: null,
      issueKey: null,
      errors,
      warnings
    };
  }

  const type = match.groups.type;
  if (!branchTypes.has(type)) {
    errors.push(`Unsupported branch type: ${type}.`);
  }

  return {
    name: branch,
    valid: errors.length === 0,
    type,
    topic: match.groups.topic,
    issueKey: normalizeBranchIssueKey(match),
    errors,
    warnings
  };
}

function extractIssueKey(text) {
  if (!text) return null;

  const jira = /\b[A-Z][A-Z0-9]+-\d+\b/.exec(text);
  if (jira) {
    return {
      value: jira[0],
      tracker: "jira"
    };
  }

  const github = /#(\d+)\b/.exec(text);
  if (github) {
    return {
      value: `#${github[1]}`,
      tracker: "github"
    };
  }

  return null;
}

function versionImpact(prefix, subject) {
  const lowerSubject = subject.toLowerCase();

  if (/\bbreaking\b|!:|breaking change/.test(lowerSubject)) {
    return "MAJOR";
  }

  if (prefix === "Add") return "MINOR";
  if (prefix === "Fix" || prefix === "Perf") return "PATCH";
  if (prefix === "Update") return "PATCH or MINOR";
  if (prefix === "Remove") return "MAJOR or MINOR";
  return "No bump by default";
}

function validateCommitMessage(message, detectedIssueKey) {
  if (!message) {
    return null;
  }

  const errors = [];
  const warnings = [];
  const parsed = /^(?<prefix>[A-Za-z]+): (?<subject>.+)$/.exec(message);

  if (!parsed) {
    return {
      message,
      valid: false,
      prefix: null,
      subject: null,
      issueKey: extractIssueKey(message),
      suggestedMessage: null,
      versionImpact: null,
      errors: ["Commit message must match <Prefix>: <description> (<issue-key>)."],
      warnings
    };
  }

  const prefix = parsed.groups.prefix;
  const subject = parsed.groups.subject;
  const existingIssueKey = extractIssueKey(message);

  if (!prefixes.has(prefix)) {
    errors.push(`Unsupported commit prefix: ${prefix}.`);
  }

  if (/[.]$/.test(subject)) {
    warnings.push("Subject should not end with a period.");
  }

  if (message.length > 72) {
    warnings.push("Subject line should stay under 72 characters when possible.");
  }

  if (!existingIssueKey && detectedIssueKey) {
    warnings.push(`Detected ${detectedIssueKey.value}; suggested message appends it.`);
  } else if (existingIssueKey && detectedIssueKey && existingIssueKey.value !== detectedIssueKey.value) {
    warnings.push(`Message issue key ${existingIssueKey.value} differs from detected branch issue key ${detectedIssueKey.value}.`);
  } else if (!existingIssueKey && prRequiredIssuePrefixes.has(prefix)) {
    warnings.push(`${prefix}: requires an issue key at PR-time unless explicitly waived.`);
  } else if (!existingIssueKey && recommendedIssuePrefixes.has(prefix)) {
    warnings.push(`${prefix}: should include an issue key when one exists.`);
  }

  const suggestedMessage = !existingIssueKey && detectedIssueKey
    ? `${message} (${detectedIssueKey.value})`
    : message;

  return {
    message,
    valid: errors.length === 0,
    prefix,
    subject,
    issueKey: existingIssueKey,
    suggestedMessage,
    versionImpact: versionImpact(prefix, subject),
    errors,
    warnings
  };
}

function relatedIssueLine(issueKey) {
  if (!issueKey) return "No issue";
  if (issueKey.tracker === "github") return `Closes ${issueKey.value}`;
  return `Related: ${issueKey.value}`;
}

function prTemplate(issueKey) {
  return [
    "## Summary",
    "Brief description of changes (1-3 sentences)",
    "",
    "## Related Issue",
    relatedIssueLine(issueKey),
    "",
    "## Changes",
    "- Change 1",
    "- Change 2",
    "",
    "## Test Plan",
    "- [ ] Unit tests pass",
    "- [ ] Integration tests pass",
    "- [ ] Manual testing completed",
    "",
    "## Checklist",
    "- [ ] Code follows team conventions",
    "- [ ] Branch name follows branch convention",
    "- [ ] Commit messages follow prefix convention",
    "- [ ] Issue key is linked or intentionally omitted",
    "- [ ] Version impact is declared, if applicable",
    "- [ ] VERSION.txt updated, if applicable",
    "- [ ] Documentation updated, if applicable"
  ].join("\n");
}

function analyze(options) {
  const projectRoot = path.resolve(options.project);
  const branchName = options.branch || gitCurrentBranch(projectRoot);
  const branch = validateBranch(branchName);
  const detectedIssueKey = branch.issueKey;
  const commit = validateCommitMessage(options.commitMessage, detectedIssueKey);
  const issueKey = commit?.issueKey || detectedIssueKey || null;

  return {
    projectRoot,
    branch,
    detectedIssueKey: issueKey,
    commit,
    pr: {
      relatedIssueLine: relatedIssueLine(issueKey),
      bodyTemplate: prTemplate(issueKey)
    }
  };
}

function printHuman(report) {
  const lines = [
    `Project: ${report.projectRoot}`,
    `Branch: ${report.branch.name || "unknown"}`,
    `Branch valid: ${report.branch.valid ? "yes" : "no"}`,
    `Branch type: ${report.branch.type || "unknown"}`,
    `Branch topic: ${report.branch.topic || "none"}`,
    `Issue key: ${report.detectedIssueKey ? report.detectedIssueKey.value : "none"}`
  ];

  if (report.branch.errors.length > 0) {
    lines.push("", "Branch errors:");
    for (const error of report.branch.errors) lines.push(`  - ${error}`);
  }

  if (report.branch.warnings.length > 0) {
    lines.push("", "Branch warnings:");
    for (const warning of report.branch.warnings) lines.push(`  - ${warning}`);
  }

  if (report.commit) {
    lines.push(
      "",
      `Commit message: ${report.commit.message}`,
      `Commit valid: ${report.commit.valid ? "yes" : "no"}`,
      `Commit prefix: ${report.commit.prefix || "unknown"}`,
      `Suggested message: ${report.commit.suggestedMessage || "none"}`,
      `Version impact: ${report.commit.versionImpact || "unknown"}`
    );

    if (report.commit.errors.length > 0) {
      lines.push("", "Commit errors:");
      for (const error of report.commit.errors) lines.push(`  - ${error}`);
    }

    if (report.commit.warnings.length > 0) {
      lines.push("", "Commit warnings:");
      for (const warning of report.commit.warnings) lines.push(`  - ${warning}`);
    }
  }

  lines.push("", "PR related issue:", `  ${report.pr.relatedIssueLine}`, "", "PR body template:", report.pr.bodyTemplate);
  console.log(lines.join("\n"));
}

try {
  const options = parseArgs(args);
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const report = analyze(options);
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
