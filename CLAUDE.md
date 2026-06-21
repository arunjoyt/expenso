# CLAUDE.MD

## Skills to use
- `frappe-dev`
- `grill-with-docs`

Machine-specific setup (bench path, site name, URL, credentials, and useful commands) lives in `CLAUDE.local.md`.

**Version bump:** increment `__version__` in `expenso/__init__.py` with every commit.

---

## Project State

Implementation is underway. **Do not assume any streak is done or pending from memory — always check GitHub first:**

```bash
gh issue list                     # open = pending streaks; closed = done
gh pr list --state all            # open PRs = in-progress streaks; merged = shipped
git log --oneline -20             # recent commits for context
gh issue view 16                  # overall progress dashboard (📍 Project Roadmap)
```

`docs/IMPLEMENTATION_PLAN.md` is the **ordered** source of truth for phases and streaks. Each streak depends on the ones before it within its phase. Treat `docs/ARCHITECTURE.md` as the source of truth for the data model, screen specs, and file layout. Treat `docs/DEPLOYMENT.md` as the source of truth for production setup and the end-to-end verification checklist. `docs/GLOSSARY.md` is the source of truth for all domain terminology — use it before introducing or renaming any concept.

---

## Branch & PR Workflow

**Every streak of remaining work must follow this workflow without exception.**

### Rules

1. **Never commit directly to `develop` or `main`** for any streak work. Create a dedicated branch first.
2. **Branch naming** — `phase-<N>-streak-<N>-<short-slug>`, e.g. `phase-1-streak-1-doctypes`.
3. **One PR per streak** — open the PR against `develop` as soon as the branch is pushed; keep it open (do not merge) until the user explicitly approves a merge.
4. **Do not merge to `develop`** — create the PR and leave it. The user will review and merge.
5. Always `git push -u origin <branch>` before creating the PR.

### Cross-referencing on GitHub

- **Commit → Issue**: include `Refs #<N>` or `Closes #<N>` in the commit message body when the commit addresses an open issue. `Closes` auto-closes on merge; `Refs` links without closing.
- **PR → Issue**: open the PR body with `Closes #<N>` so the issue appears in the PR sidebar.
- **PR body → Commits**: when writing the PR description, reference key commit SHAs so reviewers can jump to relevant diffs.
- **Issue updates**: when posting a progress comment on an issue, include the branch name and PR URL so the issue thread tells the full story.

### PR body template (always use this)

```
## Summary
- <bullet: what this streak implements>
- <bullet: key design decision or tradeoff>

## Steps completed
- [ ] <step description>
- [ ] <step description>

## Closes / Refs
Closes #<issue>

## Test plan
- [ ] bench migrate runs without errors
- [ ] <streak-specific manual test — e.g. "Family created → default Categories seeded">
- [ ] <frontend test if applicable — e.g. "Feed loads, month nav works">

🤖 Generated with [Claude Code](https://claude.ai/code)
```

---

## Roadmap tracking

A single GitHub issue (`📍 Project Roadmap`) is the live progress dashboard for all three phases. Keep it in sync:

- **When a streak PR is created**: post a comment on the roadmap issue linking to the PR
  (`gh issue comment 16 --body "P<N>-S<N> PR: #<pr-number>"`)
- **When a streak issue is closed**: post a comment on the roadmap issue noting what shipped and the commit SHA.
- **When a phase is fully done**: post a summary comment on the roadmap issue (e.g. "Phase 1 complete — all streaks done, PRs merged") and update the phase heading in the roadmap body to add ✅.

---

## Workflow checklist (per streak)

1. Check GitHub state: `gh issue list` + `gh pr list --state all` + `gh issue view 16`
2. `git checkout -b phase-<N>-streak-<N>-<slug>` from latest `develop`
3. Implement the streak
4. Commit with `Refs #<streak-issue>` or `Closes #<streak-issue>` in each commit message body; bump `__version__`
5. `git push -u origin <branch>`
6. `gh pr create` using the PR body template above
7. Post a comment on the roadmap issue linking to the new PR
8. Leave the PR open — do not merge

