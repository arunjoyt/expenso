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
git log --oneline -20             # recent commits for context — this is now the source of in-progress/shipped state, not open PRs
```

`docs/IMPLEMENTATION_PLAN.md` is the **ordered** source of truth for phases and streaks. Each streak depends on the ones before it within its phase. Treat `docs/ARCHITECTURE.md` as the source of truth for the data model, screen specs, and file layout. Treat `docs/DEPLOYMENT.md` as the source of truth for production setup and the end-to-end verification checklist. `docs/GLOSSARY.md` is the source of truth for all domain terminology — use it before introducing or renaming any concept. **`docs/TEST_PLAN.md` is the source of truth for all tests** — every streak has a numbered test table there; implement every test in that streak's section alongside the feature code.

---

## Commit Workflow

**Commit directly to `develop` for every streak — no feature branches, no PRs.** Matches kido and flashcard's workflow.

### Rules

1. Work directly on `develop`; do not create a branch for streak work.
2. Make sure `develop` is up to date (`git pull`) before starting a streak.
3. Bump `__version__` in every commit (see above).

### Cross-referencing on GitHub

- **Commit → Issue**: include `Refs #<N>` or `Closes #<N>` in the commit message body when the commit addresses an open issue. Since `develop` is this repo's default branch, `Closes #<N>` auto-closes the issue as soon as the commit is pushed — no PR needed. `Refs` links without closing.
- **Issue updates**: when posting a progress comment on an issue, include the commit SHA so the issue thread tells the full story.

---

## Workflow checklist (per streak)

1. Check GitHub state: `gh issue list` + `git log --oneline -20`
2. `git checkout develop && git pull`
3. Implement the streak **and** write all tests listed for it in `docs/TEST_PLAN.md`
4. Run tests: `bench --site expenso1.test run-tests --app expenso`
5. Run linter (auto-fixes in place, then re-run to confirm clean):
   ```bash
   /Users/arunjoyt/Desktop/Work/venv/fb/bin/pre-commit run --all-files
   ```
   > **Note:** pre-commit only covers ruff/prettier/eslint. The CI also runs Semgrep
   > (`frappe-semgrep-rules`) which has no local equivalent. Key Semgrep rule to remember:
   > all user-facing strings in `frappe.throw(...)` / `frappe.msgprint(...)` must be
   > wrapped in `_("...")` (Frappe's translate function), e.g. `frappe.throw(_("msg"), exc)`.
   > Always add `from frappe import _` to any file that calls `frappe.throw/msgprint`
   > (ruff also flags `_` as undefined without the explicit import).
6. Commit with `Refs #<streak-issue>` or `Closes #<streak-issue>` in each commit message body; bump `__version__`
7. `git push origin develop`
8. Once pushed, move on to the next streak per `docs/IMPLEMENTATION_PLAN.md`'s ordering (repeat from step 1), continuing into the next phase when the current one's streaks are all done.

