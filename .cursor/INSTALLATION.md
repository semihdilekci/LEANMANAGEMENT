# Cursor Rules Installation

This directory contains a complete `.cursor/rules/` package tailored for the **Lean Management Platformu** project. These rules guide the Cursor AI agent to follow the project's conventions automatically — without you needing to repeat instructions in every chat.

## What You Get

- **40 rule files** organized into 4 categories
- **`INSTALLATION.md`** — this file
- **`AGENT_USAGE_GUIDE.md`** — how to structure your Cursor sessions

## Prerequisites

- **Cursor editor** — version 0.40 or later (`.mdc` rules support)
- **Project already cloned** — this package sits at the repo root

## Installation Steps

### 1. Extract to Project Root

From this ZIP, extract the `.cursor/` directory to your project's root:

```
your-project/
├── .cursor/
│   └── rules/
│       ├── 00-project-identity.mdc
│       ├── 01-coding-philosophy.mdc
│       └── ... (all rules)
├── apps/
├── packages/
├── docs/
└── package.json
```

If your project already has `.cursor/rules/`, merge carefully — don't overwrite existing custom rules.

### 2. Verify Rules Loaded

Open Cursor on the project. In the chat panel:

1. Click the `+` (attach) button
2. You should see rules appearing in the autocomplete list — specifically the agent-requested and manual rules
3. Start a new chat
4. Type a simple test: "What are the always-on rules for this project?"
5. Agent should respond referencing project identity, security baseline, etc.

If agent doesn't reference the rules, check:
- `.cursor/rules/` directory is at repo root (not in subdirectory)
- File extensions are `.mdc` (not `.md`)
- Cursor version is 0.40+
- YAML frontmatter in each `.mdc` is syntactically valid

### 3. Commit Rules to Git

Rules are part of the codebase — commit them:

```bash
git add .cursor/
git commit -m "chore: add cursor rules package for agent guidance"
git push
```

Everyone cloning the repo gets the same agent guidance. Solo or team, consistency matters.

### 4. Gitignore Exclusion (Optional)

If your team has individual customization preferences, you can gitignore individual rule files:

```gitignore
# .gitignore
.cursor/rules/99-my-personal-overrides.mdc
```

But **do commit the shared rules** — that's the whole point.

## What Each Rule Category Does

### Always-On Rules (00-XX)

These load into every chat session. They're the bedrock — security baseline, naming conventions, coding philosophy.

You don't need to do anything; they're always active.

### Auto-Attached Rules (10-XX, 20-XX, 30-XX)

These activate based on which file you're editing or opening. For example:
- Open `apps/api/src/auth/auth.service.ts` → backend auth rules auto-load
- Open `apps/web/src/app/users/new/page.tsx` → frontend forms + screen rules auto-load

You don't need to do anything; they activate automatically.

### Agent-Requested Rules (40-XX)

These contain procedures (e.g., "how to add a new endpoint"). The agent sees their descriptions and pulls them when your task matches.

You don't need to do anything special, but you can help by phrasing your requests clearly:
- "Add a new endpoint for listing user sessions" → likely pulls `40-add-new-endpoint.mdc`
- "Implement S-USER-NEW screen" → likely pulls `47-implement-screen-from-catalog.mdc`

### Manual Phase Prompts (50-XX)

These you invoke explicitly. At the start of a work session:

```
@50-phase-00-monorepo-scaffold
```

Type `@` in Cursor chat, start typing the rule name, autocomplete shows matching rules. Select one and Cursor loads its full content.

Use these at the start of each implementation session to give agent precise kick-off context.

## Troubleshooting

### Agent Not Following Rules

Symptoms: Agent uses wrong patterns, forgets conventions.

Checks:
1. Rules in `.cursor/rules/` at repo root? (Not in `/docs/rules/` or similar.)
2. File extensions `.mdc`? (Not `.md`.)
3. Cursor restarted after adding rules? (Sometimes requires restart.)
4. Current file matches auto-attach globs? (Check frontmatter of rule you expected to activate.)

### Agent Ignores Always-On Rules

Check YAML frontmatter:
```yaml
---
description: ...
alwaysApply: true   # ← this line is critical
---
```

If missing or typo'd, rule won't always-apply.

### Rule Loaded But Agent Doesn't Follow

The rule's content might be:
- Too vague (agent can't apply)
- Too verbose (agent skims and misses key items)
- Contradicting another rule (agent confused)

Check `AGENT_USAGE_GUIDE.md` for patterns to debug this.

### YAML Parse Errors

Cursor silently ignores `.mdc` with broken YAML. Validate:

```bash
# Install yamllint: pip install yamllint
for f in .cursor/rules/*.mdc; do
  # Extract frontmatter between --- delimiters
  awk '/^---$/{c++; next} c==1' "$f" | yamllint -
done
```

Common YAML issues:
- Strings with colons not quoted: `description: Foo: bar` → `description: "Foo: bar"`
- Inconsistent indentation (tabs vs spaces)
- Missing closing `---`

## Updating Rules

As the project evolves, rules need updates:

1. **Doc changes** → regenerate rules (run `cursor-rules-architect` skill again)
2. **New pattern established** → add new rule or extend existing
3. **Rule found wrong** → fix in place, commit

Don't let rules drift from documentation. If rules and docs disagree, that's a bug.

## Support

For issues with this package:
- Check `AGENT_USAGE_GUIDE.md` first
- Review original documentation in `docs/` — rules should match
- Regenerate package if outdated

For Cursor-specific issues:
- Cursor docs: https://docs.cursor.com/
- Cursor forums for `.mdc` format questions

---

**Package generated by `cursor-rules-architect` skill.**  
**Source documentation:** docs/  
**Generated:** Nisan 2026
