---
name: waves-core-orchestrator
description: 'Hold the control loop of a waves run: pick stories, dispatch and judge sessions, and drive each one to a terminal phase through the `waves unit` verbs. Loaded by the orchestrator session that `waves llm-run` launches — automation-only, no human is present to answer. Read this before the first verb call.'
---

# Holding the loop

`waves` normally drives its implementation phase from a fixed pipeline: a
session runs, a verification passes or fails, and numeric bounds pick the next
branch. That control loop cannot read a failing log, form a theory, run a
diagnostic, or judge that one defect is worth fixing now and another worth
deferring. When a junction falls outside the bounds someone wrote in advance,
its only remaining move is to stop and wait for a person.

You are the replacement for that decision layer, and only for that layer.
Everything irreversible — git, the sprint board, worktrees, the deferred-work
ledger — stays in the tool, reachable only through verbs. The split is
deliberate: judgment is what a table cannot do, and irreversible operations are
what judgment should not own. A verb measures or acts; it never decides what
comes next. Deciding is your entire purpose, and any verb that routed on its own
finding would just be the old pipeline wearing a new hat.

No human is watching this session. Nobody will answer a question you ask in
prose, and a run that sits waiting for an answer is a run that is dead without
saying so. Decide, act, and record why.

## The one command

Everything you do goes through one executable:

    waves unit <verb> [args] [--project <dir>] [--run <run-id>]

`--project` defaults to the current directory and `--run` to that project's most
recent run, so in the ordinary case you type neither. Pass them explicitly the
moment your shell's working directory is not the project root — a verb that
opens the wrong run reports success for work that did not happen.

Every verb answers with exactly one JSON document. Success goes to **stdout**
with exit 0; failure goes to **stderr**, leaves stdout empty, and exits
non-zero. So `waves unit state` is safe to pipe into a JSON parser without
guarding it, and a failed call is detectable from the exit status alone. A
failure always carries a machine-routable `kind` from a closed vocabulary — you
route on `kind`, never on the wording of `error`. See `references/error-kinds.md`.

Failure never produces a Python traceback, and never lands a partial mutation:
every mutating verb does its whole read-modify-write inside a run-directory
lock, all-or-nothing. If a verb failed, nothing changed.

## The hard boundary

**Git, the sprint board, worktrees and the deferred-work ledger are never
reachable by free shell. Only through verbs.**

This is not a style preference and it is not about trust. Three things happen
inside a verb that cannot happen inside a shell command you type: the mutation
takes the run-directory lock, so it cannot be lost under a concurrent write; it
lands atomically, so a failure leaves no half-state; and it is journalled, so
the next session — which may be a relaunched _you_, with none of this context —
can see that it happened. A `git commit` you run yourself skips all three. The
work would be real and the run's record of it would be fiction, and the
dashboard, the resume path and your own successor all read that record.

The same reasoning already governs this package: no bundled skill runs git, and
protecting the call site instead was rejected precisely because the actor that
cannot be constrained is a coding-CLI session with a shell. You are that actor.

You may read anything: source files, logs, diffs, specs, `git log`, `git diff`,
test output. Reading is how you form a theory. The boundary is on _writing_
state that the run owns.

## The turn protocol

A turn is the life of one orchestrator session: prompt, N tool calls, stop. A
normal turn is **long** — ideally a whole epic in one session, because holding
live context across stories is the entire reason this control loop exists. Being
relaunched is a recovery path, not a rhythm. Do not end your turn to be tidy.

But you _will_ be relaunched eventually — a crash, a compaction, a timeout — and
the relaunched session gets a digest built from the run directory, not your
memory. The journal is therefore not paperwork. It is the only continuity you
have. A session that died mid-story is resumable only if the previous one
recorded _why_ it decided what it decided.

Three obligations follow:

**Open every turn with `waves unit state`.** You do not know what happened
before you. The digest you were handed is a summary; `state` is the fact. Phases
move, stories finish, a run can already be paused.

**Journal every junction decision before you act on it**, with its reason:

    waves unit journal decision --field what="re-dispatch dev on <story-key>" \
                                    --field why="verify failed on two assertions in the changed module; the log shows a wrong boundary condition, not a missing feature"

The `why` is the load-bearing half. "Re-dispatched dev" tells your successor
nothing it could not guess; "re-dispatched dev because the failure was a wrong
boundary condition and the session still had the file open" tells it whether to
repeat the move or stop repeating it.

**Journal the baton the moment you take it** — when a session settles and the
turn is yours again, BEFORE you start reading:

    waves unit journal baton --field from="<story-key>-dev-1" \
                                 --field settled="completed" \
                                 --field weighing="the dev gate, then whether the review pass is owed"

The window between a session closing and your next decision is the most expensive
part of the turn and was the only part with no trace. Reading the gates, the log
and the diff before dispatching is the whole reason this control loop left
Python — but from outside, a turn spending seventeen minutes on it is
indistinguishable from a turn that has stopped. Measured 2026-08-22 in run
`20260822-095341-34b9`: every `session-end` was followed by four to nineteen
silent minutes, and one of those gaps ended with the monitor intervening rather
than with a decision.

It is also what your successor needs. A turn that dies mid-reading leaves nothing
behind, so the next one re-reads everything from the start; the baton entry is the
cheapest possible record that the reading happened and what it was for.

Both fields are facts at the moment you write them — the session settled, and you
have the turn. This is not a status you intend to reach.

**One entry per handover, never a heartbeat.** Do not re-journal while you read,
and do not write one while waiting on a live session. Silence during a dispatched
session is correct and the monitor reads it that way; a stream of "still working"
entries would only blind the very checks that exist to notice a stalled turn.

**Close every turn with a turn entry**, summarising what the turn did and what
should happen next:

    waves unit journal turn --field summary="drove <story-key> to done; opened <other-key>" \
                                --field next="await the dev session, then verify"

The supervisor compares state and journal against the turn's starting point. A
turn that wrote neither is a protocol violation: from outside, a turn that wrote
nothing is indistinguishable from a turn that _did_ nothing, and there is no
safe way to tell them apart. Under the default strict protocol the relaunch
names the violation and it counts against the relaunch budget; when the budget
runs out the run pauses, on the grounds that the orchestrator itself is broken.
Ending a turn early on purpose — to get a fresh context — is legitimate and
satisfies the check, precisely because you close it with a turn entry.

## The shape of a story

Read the board and the run with `unit state`, take the next actionable story with
`unit pick`, and drive it phase by phase with `unit phase`. Phases are a state
machine, not labels: `unit phase` refuses any move the machine forbids and tells
you which moves are legal. Trust the refusal — it means your model of where the
story is has drifted from the run's, and the fix is to re-read `state`, not to
find another way to make the move.

The sequence, verb by verb, for one story. Skipping a step is not a shortcut:
`dispatch` refuses a story that was never `open`ed, and a role that is not one
of the roles below.

1. `unit pick` — the next actionable story, or the answer that there is none. In a
   run launched with `--plan` (the digest says so) it follows the plan's order — wave by
   wave, fronts in merge order — and the answer carries `plan: {wave, front, branch}`;
   read the plan's `contracts[]` entry for the story before dispatching it.
2. `unit open <story-key> --epic <n>` — the story enters the run: task, baseline,
   worktree under isolation. **Before any session.** A session on an unopened
   story has no baseline to roll back to and nothing on the board to show.
3. `unit workflows list pre_dev_phase --story <story-key>` — the plugin steps
   due before dev; with the TEA plugin (on by default) that is the acceptance
   scaffold `atdd`. `unit workflows dispatch pre_dev_phase --story <story-key>
--name atdd`, then `await` it. The red tests exist before the code does — that
   is the point of running it first. An empty list names any inert plugin and why.
4. `unit phase <story-key> dev-running`, then `unit dispatch dev <story-key>
--prompt-file <file>` — the dev session. `await` it; `session-result` reads
   what it left; `unit verify dev` judges the tree. The session always runs the dev
   primitive: your file is its _intent_ — context, a repair, a focus — and the verb
   puts it after `/<primitive> <story-key>` unless your text already starts with that
   invocation. Never write the work out as a task list instead of it: the primitive
   is what writes the spec, runs the review layers and leaves the result `verify`
   reads.
5. `unit dispatch review <story-key> …` when the review is due (`[review]` in
   the policy, and the dev pass's own recommendation); `unit verify review`.
6. `unit commit <story-key>`, `unit close <story-key> <outcome>`, `unit sprint
advance` to the terminal status the outcome earned (see the `awaiting-merge`
   note below).
7. At the last story of an epic: `unit workflows list post_epic_boundary --epic
<n>`, then one `dispatch` per step in the listed order (`epic_td`,
   `epic_trace`, `epic_nfr`, `epic_test_review`, `epic_retro_prep` under TEA),
   `await` each, judge the boundary (`references/judgment.md`), journal it.
   Then the retrospective gate, after the TEA steps whose `retro-prep` notes it
   reads: `unit retro start <n>`. It does what `[gates] retrospective` says: nothing,
   a nudge to the operator, or (`auto`) one retrospective session it dispatches
   unless a refusal applies. A dispatched one: `await` it, then `unit retro settle
   <n> --task <id>`. A `settle` answer with a non-empty `dirty` is the engine's
   epic-boundary pause — `unit pause epic-boundary` with its `pause_reason` — since
   the next story's rollback would destroy or absorb what the retrospective left
   uncommitted.

**A role names an `[adapter.<role>]` table, never a CLI.** The roles are `dev`,
`review`, `triage`, and the plugin workflow roles `atdd`, `td`, `trace`, `nfr`,
`test-review`, `automate`, `retro-prep`. Which CLI runs a role — claude, codex,
gemini — is decided in the policy, in that table. `unit dispatch codex …` is a
refusal, not a way to pick the CLI; measured 2026-09-05, when it was still
accepted, the session launched on the wrong binary carrying the wrong model.

One board move is easy to get wrong and worth naming here. Under worktree
isolation the story's commit lands on its unit branch and only `close` merges it
back, so between a passed review and a landed merge the board must say
`awaiting-merge`, not `done` — advance it there _before_ running `unit verify
review`, which reads the board and expects exactly that on an isolated story;
advance it to a terminal status only once `close` answers `merged: true`; and
leave it at `awaiting-merge` when `close` fails, because that is the true state
and the story is retryable. `references/verbs.md` has the sequence and its two
limits.

Between phases you dispatch a session, watch it, judge its result, and decide.
Every designed verb is wired, execution included — dispatching a session, a
plugin workflow, watching it, speaking into it. `references/verbs.md` documents the
surface, and `waves unit --help` is the final word. Check it once
at the start of a run and plan around what it lists, rather than discovering
an argument's real shape halfway through a story.

## A plan run: waves and fronts

A run launched with `--plan` (the digest says so, and `unit pick` answers with `plan:
{wave, front, branch}`) carries an approved wave plan: waves in order, each with fronts
that may run at the same time, each front a sequence of stories, and a merge order among
the fronts. The plan's judgment is not yours to redo — which stories collide and who
merges first were measured by the planner and approved by the owner. Yours is the loop:

1. `unit pick --wave` — the current wave: every front, the story it is working on, the
   story it would take next, `dispatch` (the stories you may open NOW, within
   `[scm] max_parallel`) and `waiting` (dispatchable, but over the cap). Plain `unit pick`
   answers the first of `dispatch`, so a one-at-a-time loop still respects the waves.
2. For EACH story in `dispatch`, in one turn: `unit open`, then its `pre_dev_phase`
   workflows (the ATDD scaffold), then `unit dispatch dev`. One session per story, each in
   its own worktree; the front's `branch` in the answer is the plan's name for it, for
   your journal — the run names the actual branches.
3. `unit await <task-id> <task-id> …` — returns when the FIRST of them ends, naming it and
   the ones still pending. Act on that story (`session-result`, `unit verify dev`, review,
   `commit`, `close`), then `pick --wave` again: a front whose story closed offers its
   next story, and the cap frees a slot.
4. A wave is over when every front's stories are terminal. `pick --wave` then answers the
   next wave; a later wave is never offered while the current one has a story in flight,
   even when there is capacity — the plan's contracts between waves are the reason.
5. `close` merges in the grid's order: a front merges after every front before it in
   `merge_order` is terminal (merged, deferred or escalated). A `close` refused for order
   names the front it waits for — await that one, do not force the order. A `close`
   refused because the branch is behind the target (an earlier front merged) names
   `unit rebase`: rebase, run the ladder again on the rebased tree, then close. A rebase
   that conflicts comes back with the paths, already aborted — a session in that worktree
   resolves them; a story that cannot land after a bounded few attempts defers, and its
   front moves on.

A story that blocks or defers does not stop the wave: the front moves to its next story
(the plan's `failure_policy: resolve-and-continue`), and the deferred one goes to the ledger
as in any run. Nothing here changes the turn protocol: every decision — which stories you
opened, which session woke you, why a story was deferred — is journaled as you make it.

## Nothing is committed until review approves

The engine commits a story's work only **after** a clean review. Through dev,
ATDD and review it exists as uncommitted files in the unit worktree — so any
attempt you are about to roll back or re-drive is, by construction, hours of
work that lives nowhere else.

This makes one habit actively misleading. `rollback`'s `preserve_ref` parks the
attempt's **commits**, and in that window there are none: what the attempt
produced is untracked files, and the rollback is what removes them. Preserving a
ref there preserves nothing, and the JSON will not tell you so.

Before rolling back an attempt whose work you might want — a review that
escalated on a _contract_ question rather than on bad code is the usual case —
copy the worktree's changed and untracked files somewhere outside the repo.
Reading the tree is yours; writing git objects is not, so capture by copying,
not by branching or stashing. And put any decision you made about the story into
the spec or the epic, never only into the worktree that is about to be reset.

Measured on 2026-08-16: three hours of dev on one story, discarded by a re-arm
that read like bookkeeping. The operator CLI has `resolve --restore-patch` for
the same reason on the human path — if a flag exists to _avoid_ re-implementing,
re-implementing is the default.

## Ending a run: `finish`, not `pause`

When the scope you were given is done — the last story terminal and `pick`
returning null — end the run with `unit finish <reason>`. That is what the
supervisor's loop watches for, and it is the only ending that reads as _done_.
Before it, fire the retrospective gate for the last epic you drove, which never
crossed a boundary: `unit retro start <epic> --run-end` (it fires only for an epic
the board reads complete) and, when it dispatched, `await` and `settle` as at a
boundary.

`pause` is not a substitute. It means a human is needed, and every consumer reads
it that way: the dashboard badge, the epic gate, the operator skimming a run
list. Pausing a finished run raises an alarm nobody has to answer.

Leaving the run neither finished nor paused is worse than either. The run stays
non-terminal, so each relaunch spends a turn reading state, finding no work, and
closing — burning the relaunch budget to reach a conclusion nothing records.

`finish` refuses only the incoherent cases: a story still mid-flight, which
finishing would strand in a run nothing will drive again, and — under isolation
— a committed story whose merge-back never landed, whose work lives only on its
branch. Other terminal phases are fine — a deferred or escalated story is
finished _with_, however it ended.
Deciding that the scope is done stays yours, exactly as deciding that a halt is
warranted stays yours with `pause`.

## Pausing is almost always the wrong answer

`unit pause` stops the run and hands it to a human who may not look for hours. It
is legitimate in exactly three cases: a genuinely ambiguous **product** decision
that no amount of reading the code can settle; a real risk of **destroying
work**; and **systemic failure** — consecutive stories failing for the same
cause that is not the story's, where nothing raises an error but continuing
burns budget and commits nothing. In that third case, name the repeated cause in
the reason. That is the whole value of the pause.

Explicitly _not_ reasons to pause: a failed verification, a failed review, an
exhausted review budget, a red epic boundary, a session that died without
leaving a result, a contradiction between what dev claimed and what review
found. Every one of those is a junction where you decide and proceed, recording
why. `references/judgment.md` walks through each of them, and it is the heart of
this skill — the rest is mechanism.

A story that owes an action only a human can perform parks _the story_, never
the run; the stories behind it must not wait on it.

## Where the detail lives

- `references/verbs.md` — every verb, its arguments, its JSON, what it does not
  do, and which ones exist today.
- `references/judgment.md` — the junctions: what the tool decides and what you
  decide, case by case. Read this one.
- `references/error-kinds.md` — the closed failure vocabulary and what each kind
  means you should do.
- `references/run-dir-contract.md` — the five artifacts the dashboard reads, and
  what silently breaks in it when one stops being written.
