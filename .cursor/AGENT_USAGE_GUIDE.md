# Agent Usage Guide — Getting the Most from Your Cursor Rules

This guide helps you structure Cursor sessions for maximum agent productivity when working on **Lean Management Platformu**. Following these patterns means fewer iterations per feature, less re-prompting, less drift.

## The Core Workflow

For every meaningful work session:

```
1. Open Cursor on the project
2. Decide what you're building this session
3. Invoke the relevant phase prompt (if applicable): @50-phase-XX-name
4. Open a file representative of your target scope
   (so auto-attached rules load)
5. State your intent clearly in chat
6. Review agent output before accepting
7. Iterate with specific feedback if not right
8. Commit with Conventional Commit format
```

Let's unpack each step.

## Step 1-2: Plan the Session

Before opening Cursor, know what you're building. Vague sessions produce vague code.

**Good session targets:**
- "Implement auth controller with 8 endpoints"
- "Add KTİ revision loop to the workflow"
- "Build S-USER-NEW screen end-to-end"
- "Write integration tests for the permission resolver"

**Bad session targets:**
- "Work on auth"
- "Fix bugs"
- "Improve the UI"

The more precise your goal, the more the agent can help. Vague goals result in sprawling sessions that drift.

## Step 3: Invoke Phase Prompts

If the work matches a phase prompt (`50-XX-phase-*.mdc`), use it.

In the Cursor chat:
```
@52-phase-02-auth-foundation
```

Type `@`, start typing the rule name, Cursor autocompletes. Select the rule and Cursor loads its content — giving agent goal, context, scope, constraints, and done-definition without you typing it all.

Don't type these from scratch every session. The phase prompts exist precisely to save this effort.

### Phase iterations (one chat = one iteration)

Heavy phase files (`50`–`61`) include an **iterasyonlar** section. Treat each iteration as its **own session**:

1. Attach the same rule: e.g. `@52-phase-02-auth-foundation`
2. In your first message, state explicitly: **“Faz 2 — İterasyon 3”** (or whatever the doc calls that slice)
3. Let the agent implement **only** that iteration’s scope, run its tests, and stop for your review
4. After you approve (merge or local sign-off), open a **new chat** for the next iteration

This keeps context small and reviewable. The phase doc is still the single source of truth — you are not maintaining separate rule files per iteration.

### When to Skip Phase Prompts

- Task doesn't match any defined phase
- Quick bug fix or small edit
- Exploratory work (agent helping you understand something)

For these, go straight to your request.

## Step 4: Open a Representative File

Cursor auto-attaches rules based on the **currently open file**. Before starting, open a file in the target scope so correct rules load.

Examples:

| Working on... | Open first |
|---|---|
| Backend auth service | `apps/api/src/auth/auth.service.ts` (even if empty) |
| Frontend UI / styling / design tokens | Any file under `apps/web/src/` **or** `docs/lean-design-system/README.md` (loads `26-lean-design-system` + frontend rules) |
| Frontend user form | `apps/web/src/components/users/UserForm.tsx` |
| New Prisma migration | `apps/api/prisma/schema.prisma` |
| Integration test | Any existing `*.integration.test.ts` |
| Documentation update | The specific doc file |

If the file doesn't exist yet, create an empty one with `touch` or Cursor's file creation — you just need it as context anchor.

## Step 5: State Your Intent Clearly

Compose your prompt with:

1. **Context** — what you're building (if not covered by phase prompt)
2. **Specific deliverable** — what the output should be
3. **Constraints** — things not obvious from rules
4. **Success check** — how you'll verify

Example:

```
I'm implementing the `PermissionResolverService` for the RBAC+ABAC permission 
system. Deliverables:

1. Service class with `getUserPermissions(userId)` returning Set<Permission>
2. Redis cache with 5-minute TTL  
3. Attribute rule evaluator (OR groups + AND conditions)
4. Unit tests covering: direct roles only, attribute rules only, union, 
   empty cases, invalid attributes
5. Cache invalidation triggers registered with NestJS EventEmitter

Constraints:
- Follow the pattern from existing `auth.service.ts` for DI
- Use the Permission enum already in shared-types
- Don't implement cache pre-warming (out of MVP scope)

Verify with: `pnpm test src/roles/permission-resolver.service.test.ts`

Full context: see `docs/04_BACKEND_SPEC.md` Section on PermissionResolverService 
and `docs/02_DATABASE_SCHEMA.md` for attribute_rules table schema.
```

This level of prompt detail takes 2 minutes to write. It saves 20 minutes of iteration.

### Prompt Anti-Patterns

**Too vague:**
> "Make the permission stuff work"

Agent doesn't know where to start.

**Too narrow:**
> "Add `export async function foo() { return 1; }` to file x.ts"

You're writing code in prose; just write it directly.

**Too scattered:**
> "Build auth and also fix that notification bug and update the dashboard widget..."

Pick one thing per session.

## Step 6: Review Agent Output

**Don't accept uncritically.** Vibe coding's biggest failure mode is blindly accepting agent output.

For every change agent proposes:

- [ ] Does it match the patterns in the auto-attached rules?
- [ ] Does it use shared-schemas / shared-types correctly?
- [ ] Security baseline items present (permission decorator, Zod validation, audit)?
- [ ] Tests added or updated?
- [ ] No hallucinated imports or APIs?
- [ ] No "TODO: fix later" comments?

If anything fails, don't accept. Iterate.

### Reviewing Large Changes

For 200+ line changes:
- Scroll through the whole diff
- Pay attention to files you didn't explicitly mention (agent may have touched too much)
- Check test coverage for new code
- Verify imports (agent sometimes invents module paths)

## Step 7: Iterate Specifically

When output isn't right, specify what's wrong:

**Bad iteration:**
> "Not quite right, try again"

Agent guesses at what to fix.

**Good iteration:**
> "The `create` method is missing the transaction wrapper. Wrap the 
> `prisma.users.create` and the subsequent `user_roles.create` in 
> `prisma.$transaction`. Also, the return type should be `UserResponse` 
> (the serialized DTO) not the raw `User` Prisma entity."

Agent fixes the specific issues.

### When Iterations Go in Circles

If you're on iteration 4+ and still getting it wrong:

1. **Stop and read what rules loaded.** Type in chat: "What auto-attached rules are active right now?" If the relevant rule isn't loading, check globs.

2. **Start a new chat.** Context may be polluted from earlier iterations.

3. **Simplify the request.** Break the ask into smaller pieces.

4. **Verify your mental model.** Maybe the rule or doc is wrong, not the agent. Re-read source docs.

## Step 8: Commit

Use Conventional Commits format:

```
feat(auth): implement refresh token rotation with family tracking
fix(users): handle manager cycle detection in deep hierarchies
refactor(processes): extract KTİ workflow into ProcessTypeRegistry
test(permissions): add integration tests for attribute rule matching
```

Agent can help write commit messages, but verify they match your actual changes.

## Recognizing When Agent Is Missing Context

Signs the agent doesn't have what it needs:

| Symptom | Likely cause |
|---|---|
| Agent uses a framework you don't use (e.g., Express instead of NestJS) | Project-identity rule not loading |
| Agent invents field names that don't exist in schema | Schema docs not in context |
| Agent skips permission decorator on controller | Security baseline not loading (check frontmatter) |
| Agent uses old pattern from prior iterations | Start fresh chat |
| Agent writes Turkish/English mixed inconsistently | Language rule missing or not loading |

When you see these, add context explicitly. The rules should handle most of this automatically, but sometimes you need to attach a specific doc.

## Debugging Context Drift

For long sessions (30+ minutes), context can drift. Symptoms:

- Agent forgets an earlier decision ("Oh, I was using X pattern now I'm using Y")
- Agent re-asks questions you already answered
- Agent produces code style inconsistent with earlier output

Mitigation:

1. **End sessions at natural boundaries.** After a feature is done, start fresh.

2. **Summarize key decisions.** If mid-session, ask agent: "Summarize the key decisions we've made in this session so far." Paste the summary back if context seems lost.

3. **Reference output files.** When agent has generated files, reference them explicitly: "Following the pattern in `auth.service.ts` that we just wrote..."

4. **Attach relevant sections.** If a specific doc section matters, attach it explicitly even if a rule references it.

## Session Workflow Patterns

### Pattern 1: Greenfield Feature

New feature from scratch (a new screen, new endpoint, new module):

```
1. @XX-phase-YY-session-ZZ (relevant phase prompt)
2. Open target file (empty if new)
3. State intent with deliverables, constraints, success check
4. Let agent generate in one pass
5. Review diff
6. Iterate on specifics
7. Run tests, commit
```

### Pattern 2: Bug Fix

```
1. Open the file with the bug
2. State: "Bug: X happens when Y. Expected: Z. Fix this."
3. Agent identifies root cause and fixes
4. Verify fix doesn't break other tests
5. Add regression test
6. Commit as `fix(scope): ...`
```

### Pattern 3: Refactor

```
1. Open file(s) targeted
2. State current pattern and target pattern
3. Agent proposes refactor plan first
4. Review plan
5. Agent executes refactor
6. Verify all tests still pass
7. Commit as `refactor(scope): ...`
```

### Pattern 4: Debugging

```
1. Open file with failing code
2. Share error message, stack trace, input that triggers
3. Ask agent for root cause hypothesis
4. Agent investigates, asks clarifying questions
5. Agree on fix approach
6. Agent implements
7. Verify fix
```

### Pattern 5: Documentation

```
1. Open the doc file
2. State what section needs updating and why
3. Agent proposes draft
4. Review, iterate
5. Commit as `docs(scope): ...`
```

## Productive Habits

### Habit 1: Write Prompts Before Sessions

Spend 5 minutes before Cursor composing your prompt. The quality of your prompt determines the quality of your session.

### Habit 2: One Session, One Feature

Context pollution increases with session length. Shorter, focused sessions compound to more productivity than long, sprawling ones.

### Habit 3: Review Every Diff

Never `accept all` without reading. You're the last line of defense.

### Habit 4: Update Rules When You Find Drift

If you catch agent doing something the rules should have prevented, update the rule. Rules improve iteratively.

### Habit 5: Commit Often

Smaller commits are easier to review, revert, and understand later. Every logical unit of work is a commit.

### Habit 6: Track What Worked

Keep a note of prompts that worked well. Over time, you build a personal library of effective patterns.

## Red Flags to Watch For

**Red flag 1:** Agent keeps generating the same wrong code after multiple iterations.  
→ Likely rule conflict or missing context. Start fresh chat.

**Red flag 2:** Agent's code uses a library you don't have installed.  
→ Hallucination. Check the generated imports. Don't `pnpm install` what you don't need.

**Red flag 3:** Agent skips tests "because we can add them later."  
→ Push back. Test coverage is non-negotiable.

**Red flag 4:** Agent says "this is the simpler approach" when you asked for the correct approach.  
→ Rules likely under-weighted. Re-state your constraint.

**Red flag 5:** You find yourself accepting code you don't fully understand.  
→ Slow down. Ask agent to explain. If still not clear, don't accept.

## Tips for Specific Scenarios

### "Agent writes too much boilerplate I don't need"

Add explicit "don'ts" to your prompt:
> "Do not add JSDoc comments. Do not add example usage in the file."

Or update the relevant rule to discourage boilerplate.

### "Agent uses pattern X when I want Y"

Check which rule mandates X. Either:
- The rule is correct and you should use X (update your mental model)
- The rule is out of date (update the rule)
- The rule is context-dependent (add context to your prompt)

### "Agent keeps saying 'you're right, I'll fix that' but not fixing"

End the session. Start fresh. Context is poisoned.

### "Agent gets stuck in perfectionism loops"

Say: "Commit what we have. We'll iterate in follow-up PR."

Sometimes agent's pursuit of correctness blocks progress.

## Working with Multiple Files

When agent needs to modify multiple files:

- Ask agent to list the files first: "Which files do you need to modify?"
- Review the list before agent edits
- Prefer smaller, focused changes over sweeping ones
- Commit after each logical unit (not just at end of session)

## When to Break Glass

Some situations warrant skipping the normal workflow:

**Critical production bug:**
- Fix first, document later
- Test manually, add test after
- Commit with `fix(hotfix): ...` and push

**Prototype/spike:**
- Relax rules temporarily (you're exploring, not committing)
- Don't persist hacky code — spike is disposable

**Framework learning:**
- Use agent for Q&A, not code generation
- Verify agent's framework claims against official docs

## Staying Up to Date

As the project evolves:

- **New rule needed?** Add it, commit, push. Team gets updated guidance.
- **Rule obsolete?** Remove or update. Don't let stale rules mislead agent.
- **Doc updated?** Regenerate rules if significant. Keep in sync.

Rules are living documentation — treat them like code.

## Measuring Your Effectiveness

After each week, reflect:

- How many features completed?
- How many iterations per feature on average?
- What patterns caused friction?
- What could go into rules or phase prompts?

Track this lightly. Improvement compounds.

---

**The goal:** agent becomes a force multiplier, not a bottleneck. The rules and phase prompts exist to make that happen. Use them consistently; iterate on them when they fail; and build the habits that let you trust the output without verifying every line.

Good vibe coding to you.
