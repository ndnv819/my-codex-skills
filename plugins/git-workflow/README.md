# Git Workflow

Git workflow assistant for branch naming, commit and PR conventions, issue key handling, SemVer recommendations, release tags, and changelog guidance.

## Overview

- Treats `main` as the production branch.
- Keeps work on short-lived branches merged through PRs.
- Validates branch names for `feat/**`, `fix/**`, `hotfix/**`, `refactor/**`, `chore/**`, and `docs/**`.
- Detects GitHub issue keys and Jira issue keys from branch names, commit messages, and PR text.
- Generates or validates commit messages using approved prefixes such as `Add:`, `Update:`, `Fix:`, and `Chore:`.
- Auto-inserts confidently detected issue keys without duplicating existing references.
- Generates PR titles and PR bodies that follow the same convention as commit messages.
- Recommends SemVer bump levels, release commit messages, tag names, and changelog sections without applying version changes silently.

## Included Skills

| Skill | Purpose |
| --- | --- |
| `git-workflow` | Apply branch, commit, PR, issue key, SemVer, tag, and changelog conventions. |

## Usage

Use this plugin when creating or validating branches, commit messages, PR titles, PR bodies, version bumps, release tags, or changelog entries.

## Scripts

```bash
${PLUGIN_ROOT}/scripts/git-workflow.sh --project <project-root>
```

Useful flags:

```bash
${PLUGIN_ROOT}/scripts/git-workflow.sh --project <project-root> --json
${PLUGIN_ROOT}/scripts/git-workflow.sh --branch feat/PM-42-user-auth
${PLUGIN_ROOT}/scripts/git-workflow.sh --commit-message "Add: implement user authentication"
```

The script reports branch validity, detected issue keys, commit message warnings, a suggested commit message when issue insertion is safe, version impact hints, and a PR body template.

## Notes

The plugin intentionally distinguishes commit-time behavior from PR-time behavior. Commit-time checks warn and assist unless the format is clearly invalid. PR-time checks should enforce branch naming, PR title format, issue linkage or an explicit waiver, version impact declaration, and documented validation.

This plugin is registered in this repository's `.agents/plugins/marketplace.json`.
