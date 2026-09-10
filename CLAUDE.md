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

**Phases 1–5: commit directly to `develop` for every streak — no feature branches, no PRs.** Matches kido and flashcard's workflow.

**Phases 6–7 (the Assistant): commit to the long-lived `phase-6-7` integration branch, not `develop`.** This is a multi-day build spanning two repos; `develop` must stay release-ready the whole time so a hotfix to the currently-deployed app can ship without dragging half-finished Assistant work with it. The `phase-6-7` branch is itself deployable — it may be tagged and tested in prod before it merges back. When Phases 6–7 are complete and verified, merge `phase-6-7` → `develop` and tag.

### Rules

1. Phase 1–5 streak work: on `develop`. Phase 6–7 streak work: on `phase-6-7`.
2. Make sure the working branch is up to date (`git pull`) before starting a streak.
3. Bump `__version__` in every commit (see above).
4. **Hotfixes for the deployed app go on `develop`** (branch `hotfix/<x>` off the last `v*` tag if `develop` has drifted), then get cherry-picked onto `phase-6-7`.

### Releasing

Production deploys on a `v*` tag push (`.github/workflows/notify-deploy.yml` dispatches to the infra repo) — **not** on a push to `develop` or `phase-6-7`. Nothing reaches prod until a tag is cut.

### Cross-referencing on GitHub

- **Commit → Issue**: include `Refs #<N>` or `Closes #<N>` in the commit message body when the commit addresses an open issue. On `develop` (the default branch) `Closes #<N>` auto-closes on push. On `phase-6-7`, `Closes #<N>` only closes the issue when the branch merges to `develop` — until then use `Refs #<N>` for in-progress streaks and let the merge do the closing, or close the issue manually with the commit SHA once the streak is verified.
- **Issue updates**: when posting a progress comment on an issue, include the commit SHA so the issue thread tells the full story.

---

## Workflow checklist (per streak)

1. Check GitHub state: `gh issue list` + `git log --oneline -20`
2. `git checkout <branch> && git pull` — `<branch>` is `phase-6-7` for Phase 6–7 streaks, `develop` otherwise
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
6. Commit with `Refs #<streak-issue>` (or `Closes #<streak-issue>` on `develop`) in each commit message body; bump `__version__`
7. `git push origin <branch>`
8. Once pushed, move on to the next streak per `docs/IMPLEMENTATION_PLAN.md`'s ordering (repeat from step 1), continuing into the next phase when the current one's streaks are all done.

