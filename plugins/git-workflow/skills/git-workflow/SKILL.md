---
name: git-workflow
description: Apply Git workflow conventions for branch names, commit messages, PR titles and bodies, issue key handling, SemVer recommendations, release tags, and changelog entries. Use when creating, reviewing, or validating branches, commits, PRs, releases, version bumps, or changelog text.
---

# Git Workflow

## Purpose

Use this skill to keep Git work consistent across branches, commits, PRs, issue links, version bumps, release tags, and changelog entries.

## Use When

- Creating, naming, or validating a Git branch.
- Generating or validating a commit message.
- Creating or reviewing a PR title, PR body, or PR checklist.
- Detecting GitHub Issue or Jira issue keys from branch names, commit messages, PR text, or metadata.
- Recommending SemVer bump levels, release commit messages, release tags, or changelog entries.

## Core Rules

- Treat `main` as the production branch.
- Do all work on short-lived branches and merge through PRs.
- Do not reuse a branch after it has already been merged.
- Do not silently force ambiguous `Add:` versus `Update:` choices. Recommend a prefix and ask when the intent is unclear.
- Do not automatically select an issue key from search results. Suggest candidates only.
- Do not silently apply version changes, release commits, tags, or changelog updates. Recommend them and get confirmation unless the user explicitly asked for the edit.
- Allow local commits to be flexible, but enforce conventions more strictly at PR creation or PR validation time.

## Workflow

1. Inspect the current branch, status, upstream, recent commits, and issue context before suggesting or applying Git workflow changes.
2. Detect the issue key from the branch, PR metadata, or configured tracker when available.
3. Choose the narrowest valid branch type, commit prefix, PR title, version impact, or changelog section for the requested action.
4. Use the helper script when local Git context needs structured inspection.
5. Validate generated branch names, commit messages, PR text, and release metadata against the conventions below.
6. Report any ambiguity, missing issue key, or version impact that needs confirmation.

## Implementation Guidelines

### Branch Strategy

Use these branch types:

| Branch Type | Purpose |
| --- | --- |
| `feat/**` | New features, follow-up features, feature improvements, and user-facing UI/UX changes. |
| `fix/**` | General bug fixes, UI bug fixes, and design spec mismatch fixes. |
| `hotfix/**` | Urgent production fixes. |
| `refactor/**` | Code structure improvements without behavior changes. |
| `chore/**` | Config, build, deployment, versioning, dependency, tooling, and formatting work. |
| `docs/**` | Documentation-only changes. |

Branch names should use:

```text
<type>/<issue-key>-<short-topic>
```

For small tasks without an issue, omit the issue key:

```text
<type>/<short-topic>
```

Examples:

```text
feat/42-user-auth
feat/PM-42-user-auth
fix/APP-145-mobile-header-layout
hotfix/API-99-login-crash
chore/update-dependencies
docs/update-readme
```

Branch topics should be lowercase kebab-case. Avoid spaces, underscores, punctuation, and reused merged branch names.

### Issue Keys

Use `issue key` as the generic work item identifier.

| Tracker | Commit and PR Format | Branch Format |
| --- | --- | --- |
| GitHub Issues | `#42` | `42` |
| Jira | `PM-42`, `APP-145` | `PM-42`, `APP-145` |

Detection order:

1. Extract the issue key from the current branch name.
2. Extract the issue key from the current PR title or body.
3. Extract linked issue metadata when available.
4. Search the configured issue tracker by branch topic and suggest candidates only.
5. If no issue key is found, ask whether the task has no issue.

When an issue key is confidently detected, append it to generated commit messages and PR titles unless one is already present.

### Commit Messages

Commit messages must use:

```text
<Prefix>: <description> (<issue-key>)
```

Allowed prefixes:

| Prefix | Purpose |
| --- | --- |
| `Add:` | New feature, new file, or additional capability added to an existing feature. |
| `Update:` | Existing feature improvement, UI/UX improvement, or behavior enhancement. |
| `Fix:` | Bug fix, UI bug fix, or design spec mismatch fix. |
| `Remove:` | Remove a feature, code, file, or dependency. |
| `Refactor:` | Code restructuring without behavior change. |
| `Chore:` | Config, build, deployment, versioning, dependencies, tooling, or formatting. |
| `Docs:` | Documentation changes. |
| `Test:` | Test additions or modifications. |
| `Style:` | Code style-only changes such as whitespace, formatting, or semicolons. |
| `Perf:` | Performance improvements. |
| `WIP:` | Temporary work-in-progress commit for local or draft work only. |

Rules:

- Use one approved prefix.
- Add a colon and a space after the prefix.
- Use imperative mood.
- Keep the prefix capitalization exactly as listed.
- Do not add a period at the end of the subject.
- Keep the subject line under 72 characters when possible.
- Reference an issue key when the work is tied to an issue.
- Treat merge commits generated by GitHub as an exception to the prefix rule.

Examples:

```text
Add: support social login (#12)
Update: improve onboarding step layout (PM-23)
Fix: resolve modal scroll lock issue (APP-45)
Chore: update eslint config
```

### Prefix Selection

Use this guide:

| Situation | Prefix |
| --- | --- |
| Add a new feature or new capability | `Add:` |
| Improve an existing feature, UI, UX, copy, or flow | `Update:` |
| Fix a bug, broken UI, responsive issue, or design spec mismatch | `Fix:` |
| Remove unused or deprecated code, feature, file, or dependency | `Remove:` |
| Improve code structure without behavior change | `Refactor:` |
| Update config, build, deployment, version, dependencies, tooling, or formatting | `Chore:` |
| Change documentation only | `Docs:` |
| Add or update tests only | `Test:` |
| Change only formatting or style syntax | `Style:` |
| Improve performance | `Perf:` |

When both `Add:` and `Update:` are possible, recommend `Add:` for a new capability, new component, new file, or new workflow. Recommend `Update:` for improving existing behavior, UI, UX, copy, or flow. Ask the user when the intent is ambiguous.

### Issue Reference Requirements

| Prefix | Issue Reference |
| --- | --- |
| `Add:`, `Update:`, `Fix:` | Required at PR-time. |
| `Remove:`, `Refactor:`, `Perf:` | Required at PR-time. |
| `Test:`, `Docs:` | Recommended. |
| `Chore:`, `Style:` | Optional. |
| `WIP:` | Recommended. |

At commit time:

- Validate the prefix format.
- Auto-insert a confidently detected issue key.
- Warn when an issue key is missing for work that usually requires one.
- Ask whether there is no issue when no issue key is detected.
- Avoid blocking local commits unless the format is clearly invalid.

At PR time:

- Enforce branch name convention.
- Enforce PR title convention.
- Require issue linkage or an explicit no-issue waiver for prefixes that require an issue.
- Include the related issue key in the PR body when applicable.
- Require version impact declaration when applicable.
- Require tests or validation steps to be documented.

### Auto-Insertion

If the user provides:

```text
Add: implement user profile settings
```

and the detected issue key is `#42`, suggest:

```text
Add: implement user profile settings (#42)
```

Do not duplicate issue keys. If a message already contains `(APP-145)`, do not append another `(APP-145)`.

### PR Convention

PR titles should match commit message format:

```text
<Prefix>: <description> (<issue-key>)
```

Use this PR body structure:

```markdown
## Summary
Brief description of changes (1-3 sentences)

## Related Issue
Closes #<issue-number>
<!-- or -->
Related: <JIRA-KEY>
<!-- or -->
No issue

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows team conventions
- [ ] Branch name follows branch convention
- [ ] Commit messages follow prefix convention
- [ ] Issue key is linked or intentionally omitted
- [ ] Version impact is declared, if applicable
- [ ] VERSION.txt updated, if applicable
- [ ] Documentation updated, if applicable
```

For GitHub Issues, use `Closes #<issue-number>`. For Jira, use `Related: <JIRA-KEY>`. If no issue key is detected and the change type requires one, ask whether the task has no issue before creating the PR. If the user confirms there is no issue, use `No issue`.

### Merge Strategy

Default to squash merge. The squash commit message should use the PR title so the `main` history remains clean while local commits can stay flexible on short-lived branches.

Use merge commits only when preserving branch history is required. Avoid rebase merge unless the team explicitly agrees.

### Version Management

Use Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

Recommend version impact with these defaults:

| Change | Version Impact |
| --- | --- |
| Breaking behavior, API, config, output contract, or workflow change | MAJOR |
| `Add:` new feature or new user-facing capability | MINOR |
| `Update:` existing behavior or UX improvement | PATCH |
| `Update:` capability that behaves like a new user-facing feature | MINOR |
| `Fix:` bug fix | PATCH |
| `Perf:` performance improvement | PATCH |
| `Remove:` compatible internal cleanup | No bump or MINOR |
| `Remove:` public behavior, API, config, or workflow removal | MAJOR |
| `Refactor:`, `Test:`, `Style:`, internal `Chore:`, docs-only `Docs:` | No bump by default |

Version bump commits must use:

```text
Chore: bump version to <version>
```

For single-package repositories, recommend tags like:

```text
v1.2.3
```

For plugin or monorepo repositories, recommend tags like:

```text
<package-name>@<version>
```

### Changelog

Released packages or plugins should maintain a changelog. For independent plugin releases, use:

```text
plugins/<plugin-name>/CHANGELOG.md
```

Generate changelog entries from merged PR titles or release commits using this section mapping:

| Prefix | Changelog Section |
| --- | --- |
| `Add:` | `Added` |
| `Update:`, `Refactor:` | `Changed` |
| `Fix:`, `Perf:` | `Fixed` |
| `Remove:` | `Removed` |
| `Docs:` | `Documentation` |

## Tools And References

Run the helper script when local Git context needs inspection:

```bash
${PLUGIN_ROOT}/scripts/git-workflow.sh --project <project-root> --json
```

Use it to validate the current branch, detect issue keys, validate a commit message, suggest issue insertion, generate a PR body template, and show version impact hints.

## Validation

- Validate branch names against the branch strategy before creating or reviewing PRs.
- Validate commit messages against the approved prefix list, colon spacing, capitalization, subject style, and issue reference rules.
- Validate PR titles and bodies for issue linkage, version impact, and documented test or validation steps.
- Validate release work against the SemVer, tag format, and changelog guidance.

## Reporting

Report:

- branch validity and detected issue key
- commit message validity, warnings, and suggested final message
- PR title and issue link recommendation
- SemVer bump recommendation and tag format when release work is in scope
- any ambiguity that needs user confirmation
