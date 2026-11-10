# The verb surface

One verb, one primitive, one process. A verb is spawned fresh for every call: it
rebuilds itself from the run directory, does one thing, prints one JSON document
and exits. Nothing is resident between calls, which is why run state lives in
`state.json` and not in anything's memory — and why you can never assume the run
is as you last left it.

Every call has the same shape:

    waves unit <verb> [args] [--project <dir>] [--run <run-id>]

Where this reference writes `waves`, type the command your turn prompt names on its
`verbs:` line — the absolute entry point of the installation that started this run. A
bare `waves` resolves through your shell's PATH, which comes from the operator's
profile and can reach another installation, whose verbs are not the code this run
was started with.

`--project` defaults to the current directory; `--run` to the run your session was
launched for (its run dir is in your environment), and only outside a session to the
project's most recent run — so another run started in the same project never takes
your calls. A `--project` your run does not live under is refused (`invalid-args`)
rather than guessed. Both are accepted before _or_ after the verb name, so
`unit --project X state` and `unit state --project X` are the same call.

**This surface is still being built, so `waves unit --help` is the
authority, not this page.** If a verb is not listed there, it does not exist yet
and calling it gets you an argparse error rather than a JSON envelope. Check
once at the start of a run; plan around what is actually wired.

## The envelope

Success — stdout, exit 0:

```json
{
  "schema_version": 1,
  "ok": true,
  "…": "the verb's own payload"
}
```

Failure — stderr, stdout empty, exit non-zero:

```json
{
  "schema_version": 1,
  "ok": false,
  "kind": "illegal-transition",
  "error": "<story-key>: pending -> committing (allowed: [dev-running, triage-running])"
}
```

`ok` and `schema_version` belong to the envelope and never collide with a
payload field. Route on `kind`; the `error` string is for your reasoning and for
the journal, never for pattern-matching. The closed `kind` vocabulary is in
`error-kinds.md`.

---

# Reading

## `unit state`

No arguments. The whole picture in one document — this is what you open a turn
with.

```json
{
  "run": {
    "run_id": "…",
    "source": "llm",
    "current_epic": null,
    "epic_filter": null,
    "story_filter": null,
    "max_stories": null,
    "paused": false,
    "paused_reason": null,
    "paused_stage": null,
    "paused_story_key": null,
    "finished": false,
    "stopped": false,
    "crashed": false,
    "crash_error": null,
    "target_branch": null
  },
  "tasks": [
    {
      "story_key": "…",
      "epic": 1,
      "phase": "dev-running",
      "attempt": 1,
      "review_cycle": 0,
      "terminal": false,
      "spec_file": "…",
      "commit_sha": null,
      "defer_reason": null,
      "worktree_path": null,
      "branch": null
    }
  ],
  "board": { "<story-key>": "<status>" },
  "attention": ""
}
```

`tasks` is what _this run_ has touched; `board` is the sprint board as it stands
on disk. They answer different questions and can legitimately disagree — a story
can be on the board and absent from `tasks` because nothing has picked it yet.

`paused` is derived: a run is paused exactly when `paused_reason` is set.

A missing or malformed board comes back as `{}` rather than an error, because a
run may legitimately be started before sprint planning and failing here would
hide the run state as well. If `board` is empty and you expected stories, that
is a finding, not a crash — say so in the journal.

**Does not**: touch anything, refresh anything, or tell you what to do next.

## `unit pick [--wave]`

The next actionable story under _this run's own_ filters, skipping every story
this run already has a task for — including one currently in flight, so a story
cannot be picked twice.

```json
{ "story": { "key": "…", "epic": 2, "status": "…" } }
```

or `{"story": null}` when nothing is actionable.

In a `--plan` run the story carries `plan: {wave, front, branch}`, and the answer
respects the plan's waves: a story of a later wave is never offered while the
current wave has a story in flight, a front holds one story at a time, and
`[scm] max_parallel` caps the stories in flight — a `null` then comes with
`wave`, `capacity`, `in_flight` and `waiting`, so "nothing offered" reads as
"wait for a slot" or "the wave is finishing", not "the board is empty".
`--wave` answers the whole current wave instead of one story:

```json
{
  "wave": 2,
  "max_parallel": 2,
  "in_flight": ["…"],
  "capacity": 1,
  "fronts": [{ "front": "B", "branch": "e14-b", "stories": ["…"], "in_flight": "…", "next": null, "done": false }],
  "dispatch": [{ "key": "…", "epic": 14, "status": "backlog", "plan": { "wave": 2, "front": "A", "branch": "e14-a" } }],
  "waiting": []
}
```

`dispatch` is what you may open now; `waiting` is dispatchable but over the cap.
`--wave` outside a plan run is `invalid-args`.

`max_parallel` is the cap in force, which is `[scm] max_parallel` only under
`isolation = "worktree"`: in place, stories in flight would share one checkout, so the
cap is 1 and the answer carries `serial` with the reason. Do not work around it by
opening a second story: run the wave serially and journal the reason once, so the
owner reads why the run was slower than the policy asked.

**Does not**: open the story, claim it, change the board, or care whether taking
it is a good idea. `null` means "the board offers nothing", which is a fact, not
an instruction — deciding between finishing the run and looking for another
reason to continue is yours.

Errors: `not-found` when there is no sprint-status file at all (sprint planning
has not run); `state-conflict` when the file exists but cannot be parsed (the
file needs fixing). Two different problems, deliberately two different kinds.

---

# Writing state

## `unit phase <story-key> <target> [--reason TEXT]`

Move one story to `target`. Legal targets are the phase values:
`pending`, `dev-running`, `dev-verify`, `review-running`, `review-verify`,
`committing`, `triage-running`, `triage-verify`, `done`, `deferred`,
`escalated`, `awaiting-operator`.

```json
{ "story_key": "…", "from": "pending", "to": "dev-running" }
```

The refusal is the feature. Whether a move is _coherent_ stays with the
transition table, which is the single source of truth for it; you decide
_whether_ to move a story, never whether the move makes sense. A rejected call
comes back `illegal-transition` and lists the legal targets — read them, then
re-read `unit state`, because a refusal means your model of the story has
drifted from the run's.

The move is journalled as `llm-phase` with `from`, `to` and your `--reason`, and
only _after_ it lands: a refused call did not happen, and the journal records
what did. `--reason` is optional and you should always pass it; a phase move
with no recorded reason is the kind of entry your successor cannot use.

**Does not**: run anything, dispatch anything, or infer the target from context.

## `unit journal <kind> [--field KEY=VALUE ...]`

Append one entry under a kind you choose. `--field` repeats.

```json
{ "kind": "decision", "fields": { "what": "…", "why": "…" } }
```

The kind is free-form on purpose: the dashboard renders any kind generically, so
you are not limited to a vocabulary someone else fixed. This is where the turn
protocol lives — `decision` entries before junctions, a `turn` entry to close.

Four field names are refused with `invalid-args` because the journal writes them
itself: `ts`, `kind`, `log_task`, `log_pos`. Accepting yours would let an entry
lie about when it happened or which log it points at.

**Does not**: validate that your reason is good, or that the entry corresponds
to anything real. The journal records claims; only you can make them true.

## `unit attention <text>`

Overwrite the run's attention banner, which the dashboard surfaces.

```json
{ "attention": "…" }
```

Also journalled as `llm-attention`. Empty text is `invalid-args` — a blank
banner is worse than none, because it shows a human that something wanted their
eyes and then says nothing.

**Does not**: pause, block, or wait for a reply. Nobody may read it for hours.

## `unit notify <title> <message>`

Fire the operator notification the project configured: an appended line in the
attention file, a desktop notification, or nothing at all, depending on that
configuration.

```json
{ "title": "…", "message": "…" }
```

Best-effort by construction — it never raises, so a silent notifier cannot break
a run. That cuts both ways: **a successful call is not proof anybody was
reached.** Never treat a notification as having delivered information.

Unlike the other mutating verbs this one does **not** journal. If the fact that
you notified matters to the record, journal it yourself.

**Does not**: pause the run, and does not wait.

## `unit finish <reason>`

Ends the run because its scope is done. Sets the flag the supervisor's loop
watches, so the loop stops without another turn being spent.

The reason is mandatory and journalled, for the same purpose `pause`'s is: "why
did this run end" stays answerable from the file rather than by inference. It is
also the only place a _judgment_ ending is recorded — the deterministic engine
has its own end-of-run summary, and this loop's ending is a decision somebody
made.

Idempotent: finishing an already-finished run reports the first reason and
`already: true` rather than raising, so a caller that lost its turn to a relaunch
can re-assert the ending safely.

**Refuses** a run that is paused (resolve or resume it first — finishing would
erase the question without answering it), a run with any story in a
non-terminal phase, naming them: finishing over live work strands it in a run
nothing will drive again — and, under isolation, a run with a committed story
whose merge-back never landed, naming it: that work lives only on its branch.
`close` it again once its cause is cleared; if only the owner can clear it and
nothing else is left, that is a pause (`judgment.md`, "What never pauses").

**Does not**: decide that the scope is done. It never reads the board. That
judgment is the whole reason you are here.

---

## `unit pause <stage> <reason> [--story STORY-KEY]`

Halt the run. `reason` is mandatory and non-empty, so "why did this run stop" is
always answerable from the file instead of by inference.

`stage` is one of a closed set — `spec-approval`, `epic-boundary`, `escalation`,
`story-gate`, `plan-checkpoint`, `story-checkpoint` — and it is not decoration:
the resume path and the interactive escalation-resolution flow both dispatch on
it. In particular that resolution flow refuses to open a run whose stage is not
`escalation`, so a pause filed under the wrong stage produces a halted run that
nothing knows how to re-arm. When you pause because a human must disambiguate an
ambiguous intent, the stage is `escalation`.

```json
{ "paused": true, "stage": "escalation", "reason": "…", "story_key": "…" }
```

Journalled as `llm-pause`. Pausing an already-paused run is `state-conflict` and
reports the existing pause — the first reason is the true one and must not be
overwritten.

Before calling this, read the closed list of legitimate causes in
`judgment.md`. This verb is the only way you can stop a run, and stopping is
almost always the wrong answer.

**Does not**: notify anyone by itself, clean up, or park a story. Parking a
story is a phase move.

---

# Judgment, the board, the ledger and git

These four exist in the code and are being wired to the command line as this is
written. Their **payloads** below are exact; their **flag spelling** is the
CLI's to fix, so confirm it with `unit <verb> --help` on first use rather than
guessing. Nothing here changes what the verbs mean.

## `unit verify` — modes `dev` | `review` | `commands`

Runs one deterministic gate and reports what it found. `dev` and `review` are
about one story and need its key; `commands` runs the project's configured
verification commands and is about the tree, so it takes no story.

```json
{
  "mode": "dev",
  "story_key": "…",
  "outcome": {
    "ok": false,
    "reason": "…",
    "severity": "",
    "fixable": true,
    "env_fault": false,
    "contradiction": false,
    "retryable": true
  }
}
```

Every discriminator is exposed by name instead of folded into a verdict string,
and that is the design's whole point: `fixable` says a repair pass has concrete
evidence to act on, `env_fault` says the fault is the machine's and must not
charge a story's budget, `contradiction` says a session revoked something the
run had already established. Collapsing these into pass/fail would put the
routing back inside the tool. What each one means for your next move is
`judgment.md`.

The `dev` gate judges on-disk artifacts against what the session _claimed_, so
it reads the most recent session result the task recorded. A verify run before
any session produced a claim is measuring against nothing.

**Does not**: retry, defer, escalate, move a phase, or route anything. It
measures. `ok: false` is a fact, not an instruction.

**A gate can outlast your turn.** Your turn is a session under the same
wall-clock budget as every other (`[limits] session_timeout_min`), and `review`
and `commands` run the project's suite, which on a large project is a real share
of it. Measured on 2026-09-23: a turn spent its whole budget waiting on a review
gate in the foreground and ended with nothing recorded. When a gate may run long,
detach it from your turn — your runtime's own background execution, its JSON
redirected to a file under the run directory — and read the file once it is
complete. A relaunched turn then finds the result instead of starting the gate
over.

## `unit sprint advance <story-key> <target>`

The single writer of the sprint board.

```json
{ "story_key": "…", "requested": "done", "status": "done", "committed": "<sha>" }
```

`requested` and `status` are separate fields because the board **never
regresses**: ask for a status behind where the story already is and the request
is declined while the call still succeeds. Read `status` — it is what is on
disk. A caller that assumed `requested` landed would go on making decisions
against a board that never moved.

`not-found` means the board has no entry for that key at all, which is a
different problem from a refused move.

Under isolation the board lives in the checkout every story merges into, so the
write commits itself there (`committed`, a sha) — uncommitted, it is dirt the
next story's merge meets. When it does not (`committed: null`), `commit_skipped`
says why: the run is in place (the story's own commit carries the board), the
file was already dirty before the write (somebody else's change, which the run
will not commit under its name), the checkout is off the target branch, or the
commit itself was refused. The write still happened either way; a skipped
commit is information, not an error, and the owner's edit it names is theirs to
commit or revert.

**Does not**: change the story's phase in the run. The board and the run's task
phases are two records, and moving one does not move the other.

### `awaiting-merge` — the status between a passed review and a landed merge

Under worktree isolation a story's commit lands on its **unit branch**, and the
merge back onto the integration branch happens afterwards, inside `close`. So
there is a window in which the gates have all passed and git still cannot confirm
delivery. Writing `done` in that window is a claim the repository does not back:
measured, on a run whose board called two stories done while the integration
branch contained neither, because a pre-merge guard had refused both merges for
a reason that was not the stories' own. Nobody looking at the board could see it.

`awaiting-merge` is the honest status for that window, and it is ordered between
`review` and `awaiting-operator`. The order below is not a suggestion — `unit
verify review` READS the board, and on an isolated story it expects
`awaiting-merge` and nothing else:

1. The review session finishes → `unit sprint advance <story-key> awaiting-merge`.
   Before the gate, not after. The gate demands the honest board, and once the
   board says `done` you can never walk it back — `advance` never regresses.
2. `unit verify review <story-key>`. On an isolated story the gate passes only
   with the board at `awaiting-merge`; with no worktree it still demands `done`,
   because there `done` already means integrated.
3. `unit close <story-key> <outcome>`.
4. `close`'s answer carries `merged`. **Only when it is `true`** do you advance the
   board to the terminal status.
5. If `close` fails, leave the board at `awaiting-merge`. That is the true state,
   and the story is retryable — it stays committed, its worktree mounted: the
   `git` kind in `references/error-kinds.md` describes calling `close` again with
   the same outcome once the cause is cleared, and who clears which cause. Do not
   walk the board back — `advance` would decline it anyway and report
   `awaiting-merge` as what landed.

`merged` is derived from the story's terminal PHASE, not from a fresh look at git:
it says `close` reached the end of integration without raising, which today means
the merge landed because a refused merge raises the `git` error kind instead. Read
it as "integration was attempted and did not fail", and let the error be your
evidence of the other case — it is not an independent check that the branch is on
the integration branch.

Two limits worth knowing before you use it:

**Only under worktree isolation.** `close` reports `isolated`; when it is `false`
the run commits into the checked-out branch itself, there is no separate target
the work could be missing from, and `done` already means integrated. Parking the
board at `awaiting-merge` there invents a wait that does not exist.

**Only for the outcomes that integrate.** `merged` is `true` only for `done` and
`awaiting-operator`. `defer` and `escalate` keep the branch on purpose, so they
are not waiting on a merge and the board should not say they are.

## `unit boundary <epic> [--step NAME --status running|done|failed]`

Report or read epic-boundary progress. The deterministic engine persists
per-step boundary progress and the dashboard paints it beside the epic's
stories; this verb is your way onto the same channel. Name a step, stamp its
state:

```json
{ "epic": 1, "step": "integration-suite", "status": "done" }
```

With no `--step`, it reads back what was recorded:

```json
{ "epic": 1, "steps": { "integration-suite": "done" } }
```

An empty `steps` is an answer, not an error — it means no boundary work has
been reported yet, which is how you decide the boundary still needs driving.
Statuses are a closed set shared with the dashboard; anything else is
`invalid-args`.

Report the steps you actually drive at a boundary — a sweep, a retrospective,
an integration pass — as you drive them (`running` first, then `done` or
`failed`), so an operator watching the dashboard sees the boundary the way
they would see the engine's.

**Does not**: run the boundary's workflows, decide whether the boundary
passed, or pause the run. `unit pause epic-boundary <reason>` is your routing,
not this verb's finding.

## `unit retro` — modes `start` | `settle`

```
unit retro start <epic> [--run-end]
unit retro settle <epic> --task <task-id>
```

The epic retrospective gate the deterministic engine fires at every epic boundary,
and at run end for the run's last epic. `[gates] retrospective` decides what it does;
you decide when — after the boundary's TEA steps, and before `finish` for the last
epic.

**`start`** answers `{"epic", "mode", "action"}`:

- `never` → `action: "none"`;
- `notify` → `action: "notified"`: the operator got the engine's "retrospective
  suggested" nudge, and nothing was dispatched;
- `auto` → `action: "dispatched"` plus everything `dispatch` returns (`task_id`,
  window, log path, watcher), for one `/bmad-retrospective -H <epic>` session on
  `[adapter.retro]` in the main checkout. Or `action: "skipped"` with the engine's
  `reason` — `already-done`, `board-unreadable`, `stop-requested`, `dirty`,
  `git-error`, `skill-missing` — journaled `retro-auto-skipped`. Every reason but
  `already-done` also tells the operator to run the retrospective by hand.

`--run-end` adds the engine's run-end refusals first (`epic-incomplete`,
`already-done`, `board-unreadable`, journaled `retro-run-end-skipped`): the run's last
epic never crossed a boundary, so the gate fires there only for an epic whose
stories the board reads all `done`.

The `auto` gate needs a clean tree, so commit or ledger what the boundary steps
wrote before calling it. A `dirty` skip is the gate refusing, not a failure of
yours, and it has already told the operator.

**`settle`** judges the session once it has settled (`await` it first), the way the
engine does, on disk and never from prose:

- the session completed;
- its `result.json` says `done`;
- the board reads `epic-<n>-retrospective: done`;
- an `epic-<n>-retro-*.md` doc exists.

Then it commits exactly the board and the retro docs
(`chore(retro): epic <n> retrospective`) and reports what is left:

```json
{
  "epic": 1,
  "task_id": "epic-1-retrospective-retro-1",
  "passed": true,
  "docs": ["epic-1-retro-<date>.md"],
  "verdict": "accepted",
  "committed": "<sha>",
  "dirty": []
}
```

`passed: false` carries `errors`; the operator was told to run it by hand, and the
run goes on. `verdict` is the doc's own (`accepted`, `accepted-with-open-items`,
`rejected`, or `unknown`); a `rejected` one is surfaced to the operator, never
gated. A non-empty `dirty` comes with a `pause_reason`. That is the engine's
epic-boundary pause, and routing it is yours: `unit pause epic-boundary` with that
reason.

**Refuses** an unknown mode or a non-positive epic, `--task` on `start` or
`--run-end` on `settle` (`invalid-args`); a `--task` that is not this epic's
retrospective session (`invalid-args`); and a session that has not settled
(`state-conflict`).

## `unit workflows` — modes `list` | `dispatch`

```
unit workflows list pre_dev_phase --story <story-key>
unit workflows dispatch pre_dev_phase --story <story-key> --name atdd
unit workflows list post_epic_boundary --epic <n>
unit workflows dispatch post_epic_boundary --epic <n> --name epic_td
```

The plugin workflows due at a stage — what the deterministic engine injects on
its own and you have to ask for. With the bundled TEA plugin on (the default),
`pre_dev_phase` holds the acceptance scaffold `atdd`, which writes the failing
tests the dev session is about to turn green, and `post_epic_boundary` holds the
Test Architect's analyses — `epic_td`, `epic_trace`, `epic_nfr`,
`epic_test_review`, `epic_retro_prep` — in the order the engine runs them. The
other stages (`post_dev_phase`, `post_review_result`, `pre_commit_gate`) hold
steps a project may have turned on; `list` is how you find out.

**`list`** answers `workflows`, one row per step — `plugin`, `name`, `label`
(`<plugin>.<name>`, the task id's middle segment), `role`, `blocking`, and
`status`: `pending`, `running`, `done` or `failed`, from this run's own record —
plus `inert`, the enabled plugins that said they have nothing to do in this
project, with the reason. An empty `workflows` with a non-empty `inert` is the
normal shape of a project without TEA installed: nothing to run, and the answer
says why. Ask before the first dev dispatch of a story, and again at a boundary
before driving it.

**`dispatch`** launches one step exactly as the engine would — the manifest's
prompt rendered for the scope, the step's own role and adapter, the label, the
`workflow-start` entry, and at a boundary the step stamped `running` for the
dashboard — and returns like `dispatch` does: task id, window, log path,
watcher. Wait on it with `await`, read it with `session-result`. The watcher
writes `workflow-end` and stamps a boundary step `done` or `failed`, so you never
call `unit boundary --step` for a step you dispatched here; `boundary` is for
work you drove some other way (a sweep, say). The retrospective has its own
verb, `unit retro`.

**What its outcome means is yours.** `blocking` is reported, never enforced: a
boundary cannot block, and a `pre_dev_phase` scaffold never does. A failed
`atdd` is a story starting without its red tests — dispatch dev anyway and say
so in the journal, or re-dispatch the step with `--seq 2`. A failed boundary
step is a red boundary (`references/judgment.md`), which is a judgment, not a
pause.

**Does not** run the plugin's in-process hooks — artifact attribution, the
commit-time gates and the boundary's own commit stay the engine's for now. What
a boundary step writes into the tree is yours to read, commit or ledger.

**Refuses** an unknown stage or mode, a story stage without `--story`, a
boundary without `--epic` (`invalid-args`); a story the run has not `open`ed
(`not-found`); and a `--name` nothing provides at that stage (`not-found`,
naming what IS due and any inert plugin's reason). Every refusal names the
repair.

## `unit ledger` — modes `add` | `close` | `list`

The deferred-work ledger: how the run converges without pretending. Residue from
a decision gets an id and stays findable, instead of being dropped or holding
the run open.

`list` returns `{"mode": "list", "entries": [{"id", "title", "status"}]}`, and
an absent ledger is an empty list rather than an error — nothing has been
deferred yet.

`add` needs a title and a reason, both non-empty, and returns the new entry's id
as `dw_id` — plus `committed` / `commit_skipped`, exactly as `sprint advance`
reports them (`close` too). Entries you file are stamped with an origin that marks them as the
orchestrator's. The reason is the part that matters: an entry saying "cleanup"
is noise, and an entry naming what is wrong, where, and why it was not fixed now
is work someone can pick up.

`close` needs an id and takes an optional note. Closing an id that is missing or
already done is `state-conflict` — a deliberate refusal, because silently
succeeding would let you believe you closed something you did not.

**Does not**: decide what deserves deferring. Filing residue you should have
fixed is how a run converges on paper and not in the code.

## `unit rollback <story-key>`

Undo a failed attempt, reverting the story's tree to the baseline recorded when
it was opened. Optionally parks the attempt's commits under a preserve ref
first — the engine's own `attempt-preserve/<run>-<tip8>` branch, one per parked tip,
so each attempt you preserve stays recoverable by name beside the others. Only
commits are parked: uncommitted edits are reset with the rest.

```json
{ "story_key": "…", "baseline": "<sha>", "preserve_ref": null }
```

Git stays behind this verb and not for tidiness. These resets run around
disposable coding-CLI sessions that stage and commit on their own initiative, so
the rollback has to be the thing that knows what _this attempt_ created. It
reverts to the recorded baseline and removes only what the attempt added — never
a blanket clean, which would delete untracked files that were already there
before the run started.

Refuses with `state-conflict` when the story has no recorded baseline: there is
nothing to roll back _to_, and guessing one would be the destroy-work case.

Also refuses with `state-conflict` when the reset would land on the **shared
checkout** — the story has no unit worktree — and `scm.rollback_on_failure` is
off. The deterministic engine never touches the main working tree without that
opt-in; it pauses for manual recovery instead, and this verb is not a door past
the same policy. Treat that refusal the same way: leave the tree for the
operator. A worktree rollback needs no opt-in — it resets only its disposable
copy.

Every reset carries the BMAD artifact folders through it. The board and the
specs record the whole run's progress, not one attempt's dirt, so rolling one
story back cannot erase another story's recorded `done`.

Preserve the commits whenever the attempt produced anything you might want to
read later — a rollback is cheap, and reconstructing a deleted attempt is not.

**`preserve_ref` parks commits, and through dev, ATDD and review there are
none.** The engine commits a story only after a clean review, so an attempt that
escalated or failed before that point exists purely as uncommitted files — which
is exactly what this verb removes. Setting `preserve_ref` there preserves
nothing and reports no problem. When the attempt holds work you might want,
copy the worktree's changed and untracked files outside the repo before rolling
back. Measured on 2026-08-16: three hours of dev discarded this way.

**Does not**: decide that an attempt deserves discarding.

---

## `unit rebase <story-key>`

Rebase the story's unit branch onto the current target, inside its own worktree —
the rebase-and-reverify path of a `--plan` run. When an earlier front of the wave
merged, a later front's branch is behind the target, and `close` refuses to
merge it as it stands (`state-conflict`, naming this verb): a merge of two
diverged branches whose union nothing verified is how a green ladder lands red
code.

```json
{ "story_key": "…", "attempt": 1, "rebased": true, "onto": "<sha>", "conflicts": [] }
```

`rebased: true` — the branch now sits on the target; run the verify ladder again
(`unit verify commands`, then whatever the story's phase asks) before `close`.
`rebased: false` — the paths in `conflicts` collided; the rebase is ALREADY
aborted, the tree is clean and the branch untouched. Resolving them is judgment:
dispatch a session into the worktree with the conflicting paths and the target's
name, let it rebase and resolve, then call this verb again (it answers
`rebased: true` at once when the branch is already current) and re-verify.
`attempt` counts the rebases this story has paid; how many is too many is yours —
the plan's `failure_policy: resolve-and-continue` says a story that cannot land
defers rather than holding its wave.

Refuses with `state-conflict` for a story already settled — merged, or closed to
an outcome that will not land (a DONE story whose worktree is still mounted is
NOT settled: `commit` moved it to DONE, `close` has not landed it, and that is the
story this verb serves) — and for a story without a unit worktree (nothing to
rebase on the shared checkout); `git` when git itself failed past the conflict
case.

**`close` in a plan run** also refuses, before moving the phase, a story whose
front comes AFTER a front still in flight in the wave's `merge_order` — the answer
names the front and the story to await. A deferred or escalated earlier front
counts as terminal: the order waits for decisions, never for stories that will
not land.

# The session and lifecycle verbs

Every designed verb exists. Nine of them — `open`, `close`, `commit`,
`dispatch`, `await`, `tail`, `nudge`, `kill`, `session-result` — do not have
reference sections here yet; `unit <verb> --help` is their interface truth,
and `unit --help` at the start of a run costs one call and removes the guess.

| Verb             | Job                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `open`           | open a story: create its task, snapshot the baseline, mount a worktree                                        |
| `close`          | close a story to a terminal outcome and merge back (a plan run: in the grid's order, current with the target) |
| `commit`         | finalize a story's commit                                                                                     |
| `dispatch`       | launch an executor session in its own window and return its ids                                               |
| `workflows`      | list or dispatch the plugin workflows due at a stage (see above)                                              |
| `await`          | block until a condition you choose, and report which one woke you; several ids: the FIRST to end              |
| `tail`           | read the running session's pane log from an offset                                                            |
| `nudge`          | speak into a running session                                                                                  |
| `kill`           | end a running session                                                                                         |
| `session-result` | read the result an executor session left on disk                                                              |

Three carry design detail worth knowing in advance, because it shapes how you
will use them.

**`dispatch` forks; it does not block.** The parent returns the task id, window
id and log path immediately. A detached child holds the real waiting — the
stall-nudge budget, the mid-session token guard, spec-status sampling,
environment-fault classification, post-kill reconciliation — all of which live
in memory and would be destroyed by a launch-and-exit. That child writes the
session result when the session ends, which is what lets `await` be pure
observation instead of a second, worse implementation of the same logic.

**`dispatch` takes a ROLE, and a story you have `open`ed.** The role is one of
`dev`, `review`, `triage`, or a plugin workflow role — `atdd`, `td`, `trace`,
`nfr`, `test-review`, `automate`, `retro-prep`. It names the `[adapter.<role>]`
table the session runs on; the CLI (claude, codex, gemini) is chosen in that
table, never spelled as the role. `unit dispatch codex …` is `invalid-args`,
listing the roles that exist — it used to be accepted, resolve to the base table,
and launch the wrong binary. A story the run has not opened is `not-found`,
naming the `unit open` that was owed: a session on an unopened story has no
baseline to roll back to and nothing on the board for the dashboard to show.

**A `dev` or `review` session always runs the dev primitive.** The verb owns
the slash command, as the deterministic engine's prompt builders do: your
`--prompt-file` becomes the primitive's intent, `/<primitive> <story-key> — <your
text>`, unless its first word already is `/<primitive>` (a repair that resumes the
spec at a named path, for instance), which goes through unchanged. The primitive is
the one the session's own skill tree resolves. MEASURED 2026-10-03: a dev dispatched
with a free-form "add the function, run the tests" got the code with no spec, no
review and no result, idled out its whole stall grace, and `unit verify dev` refused
the tree — one wasted session. A resume (`--resume-session`) is exempt: it continues
the conversation the primitive already holds. `triage` and the plugin workflow roles
keep their own prompts.

**Every `dev` or `review` session that launches is charged to its story**, as the
engine charges its own: a dev session adds one to `attempt`, a review session one to
`review_cycle` (resumes included; triage, workflow sessions and a launch that never
happened charge nothing). `unit state` reads them back: `attempt` is the count the
engine's `[limits] max_dev_attempts` bounds — for you a signal, not a verdict (see
`judgment.md`). A re-armed story starts again from zero.

**`await` blocks on a condition _you_ wrote** and returns the reason it woke:
session end, a regex match, a quiet period, a stale heartbeat, a token
threshold, a vanished session, or a timeout. Its honest limitation is not the
transport's: you only think between tool calls, and no background thread watches
the log on your behalf. The granularity of your attention is exactly the
condition you chose, so waiting only for session end is choosing to be blind for
the whole session — sometimes right, but a choice, not a default.

**A repair should resume the session, not replace it.**
`unit dispatch <role> <story-key> --prompt-file <repair> --resume-session
<task-id> --seq <n+1>` reattaches to the named task's CLI _conversation_ by its
native session id, so a repair pass does not pay for a full context re-read.
The window is long dead — the adapter kills it on every path, deliberately —
but the conversation is not. Preconditions are reported, never assumed: the
policy flag off, no settled session result, no recorded native session id, or
an adapter with no declared resume path all come back as
`{"resumable": false, "reason": …}` with nothing launched, and a fresh
dispatch stays one call away. What cannot be prechecked is the CLI refusing
the id at launch — that presents in the session itself, so read the pane log
before trusting a repair. Behind `[llm] session_resume`, which ships off.

## What no verb will ever do

No verb picks the next step. No verb decides that a failure is fixable, that a
review's objection outweighs a dev's sign-off, that an epic is good enough to
close, or that a run should keep going. Those are the junctions, and the
junctions are yours — see `judgment.md`.
