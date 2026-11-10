# Front discipline — copied VERBATIM into every brief

Shipped by the `waves-core-parallelism` skill. The master COPIES this file into each front's
brief and fills the `<SLOTS>`; it never retypes it, never summarizes it, never drops an item.

MEASURED: a master that retyped this section from memory delivered three of its five items and
dropped the two that mattered — the run then lost a front to exactly one of them. This file
exists so the brief depends on nobody's memory, the same reason the queue is a script rather
than a paragraph about locking.

Slots the master fills: `<WORKTREE>` · `<BRANCH>` · `<LIVENESS FILE>` · `<WAIT SCRIPT>` (absolute) ·
`<TESTS TOOL>` (the literal prefix of every tests command: `uv run <absolute path of tests_memory.py>
--repo <WORKTREE> --lock-root <LOCK DIR>`) · `<INTEGRATION BRANCH>` · `<STORY>` · `<ATDD FILES>` (this
story's wave-0 acceptance files) · `<ATDD SET>` (those files and its `<MEMORY DIR>/atdd/<story>.toml`) ·
`<MEMORY DIR>` · `<GATE LOG>` (the file the gate's output goes to) · `<WAIT BUDGET>` · `<GATE BUDGET>`
(the plan's clock budget for the test rung, in SECONDS: the tool cuts the runner there) ·
`<PROVISION>` (the command that brings your stack up inside your tree, or `none`) · `<TEARDOWN>` (the
command that takes it down, run inside your tree, or `none`) · `<LAUNCH>`.
`<LAUNCH>` is the ONE background mechanism the master measured at pre-flight — see "How you wait"
below; the master writes one of the two forms, never both, never a choice for you to make.

---

## 0. Where you work

`<WORKTREE>` on `<BRANCH>`, cut from `<INTEGRATION BRANCH>`. When the brief gives `<WORKTREE>` as
"your own tree", it is `git rev-parse --show-toplevel` from where you stand. Before your first rung:
`git branch --show-current` is `<BRANCH>` — switch to it, or create it from `<INTEGRATION BRANCH>`
when the brief says the tree is fresh — and your stack is up (`<PROVISION>`, unless it is `none`).
Your work lives on `<BRANCH>`: the tree is the master's to give back after your last story leaves
the run, and whatever is not committed goes with it. Commit before every gate; report commits,
never paths.

## 1. Synchronous — you write the code

You write this story's code yourself. If you dispatch a subagent, you collect its result in the
SAME turn and move on. You are not a process: you exist only while you are emitting tool calls.

## 2. Liveness in a file

Before EVERY rung of the pipeline and of the ladder, overwrite `<WORKTREE>/<LIVENESS FILE>`
with the ISO time and the rung you are entering, and add that name to the worktree's
`.git/info/exclude`. That file is how the master knows you are alive and what you are doing.
It reads that file before it reads git, and before it reads anything the harness says about
you.

## 3. How you wait — the rule that costs fronts

**Ending your turn is not the sin. Ending it with nothing tracking the work is.**

You exist only while you emit tool calls. Prose ends your turn and RETURNS you to the master:
"waiting for the gate" is not a state you are in, it is your last words. There is no process of
you waiting, no timer, nobody to come back.

So there are exactly two legal shapes, and the master has already chosen which one this brief
carries:

- **`<LAUNCH>` tracks the work and the harness re-invokes you when it ends.** Launch the rung
  that way and end the turn — the harness brings you back. This is the preferred shape when the
  harness has it: the tests tool's exit IS the event, because it is the process that writes
  the marker.
- **`<LAUNCH>` does not track it.** Launch the rung in the background and then call
  `sh <WAIT SCRIPT> <GATE LOG> <WAIT BUDGET> <WORKTREE>/<LIVENESS FILE>` in cycles INSIDE your
  own turn. It always returns before the tool's cut, and its exit code is the instruction:
  `0` green · `1` red (the rc and the tail are printed) · `75` still running — call it again,
  same turn · `3` the process writing the log is gone, relaunch it. It writes your liveness file each
  cycle, so waiting in the queue costs you nothing to declare.

And two things you must never do:

- **Never `&` or `nohup`** for a rung you then depend on. An untracked background process emits
  no completion, and a front with nothing to wake it invents a waker.
- **Never delegate your liveness to a log watcher** — a monitor, an event stream, a `tail -f`
  armed over a gate log, any tool whose job is to notify you later. MEASURED: a front armed one
  over its gate log and ended the turn; it was woken ONCE, reported progress, ended the turn
  again, and the run lost it. The wait was a ~25-minute suite behind a 19-minute queue; the
  watcher's default life was 5 minutes. Three properties make that class of tool wrong here:
  its lifetime is a default rather than the length of your wait; it fires on a filter you wrote,
  so a crash, a hang or a line you did not predict is indistinguishable from work in progress;
  and the one wake that does arrive teaches you that ending the turn is safe.

## 4. The test rung is ONE command, and it measures WHAT YOU CHANGED

You do not choose which tests your story is judged by, you do not build a queue for them and you
do not read their result your own way. `<TESTS TOOL> gate` does all three. It takes the test files
your diff created or changed (the ones the project's tests config says are tests) plus
`<ATDD FILES>`, runs each kind of test under its own queue, and writes `.waves/gate/<STORY>.json`
in your worktree. It never runs the whole suite for a story — unless the owner's config says so —
and neither do you: the whole suite runs once, at the close.

**While you work,** run what helps you — through the tool, so it takes its type's slot:
`<TESTS TOOL> run --kind <kind> <files>`. Nothing you run counts at the gate.

**Your acceptance cases.** `<ATDD SET>` are this story's cases from wave 0, recorded RED at the base
before any of your code existed. Take them out of skip before you implement. The gate reads that
record itself and holds you to every case in it: each one must PASS at the gate — `skipped`, missing
or red is one and the same red, class `atdd`, whether or not you named the file with `--atdd`. A case
you cannot turn green is a `failure` or a `blocked` — never an edit to the case that makes it pass
without the behavior, never a case deleted. An acceptance case has no excuse, ever. One case is
not yours to touch even when it is wrong: a case that asserts what the story's own text rules out.
Report `blocked <STORY> <AC> atdd <the case's assertion> vs <the text's>` and stop that story — the
master has the case repaired by someone who is not you, re-recorded, and re-drives you on a rebase.
You never resolve that contradiction yourself, in either direction.

**When your story is done,** commit, then run the gate as a long rung — launched and waited for the
way section 3 says, its whole output in `<GATE LOG>`:

```
<TESTS TOOL> gate --base <INTEGRATION BRANCH> --story <STORY> --atdd <ATDD FILES> --spec <the spec your build rung wrote> --budget <GATE BUDGET> --marker
```

(Leave `--atdd` out altogether when the story has no acceptance file.)

Read only its summary lines and the tail it prints for a red; never read the runner's whole output
(it is in `.waves/gate/logs/`, and it is not your context).

- **`GREEN` or `NO-TESTS`** → report `ready-to-merge`. `NO-TESTS` means your diff created or changed
  no test and you have no acceptance file: say in one line why no test is right for this story (a
  configuration, a rename, a document). If the story changed behavior, write the test instead — the
  close asks an independent session whether a test was owed, and it reads your line.
- **What the gate wrote** (`written:` in its summary, `written` in the report) — the matrix, the
  snapshot or the report your project's tests rewrite, left in your tree as the run left it. It is
  the story's evidence. Commit it on top of the gated commit — one commit, nothing else in it —
  and report THAT commit: the merge accepts exactly that difference. When the project's own rules
  say those files are not versioned, restore them instead. Before running the gate again after a
  fix, commit or restore what the last run wrote: the gate starts on a clean tree.
- **Your stack goes down before `ready-to-merge`**: `<TEARDOWN>` inside your tree (unless `none`),
  with `WAVES_STORY_KEY=<STORY>`, as your last act before the report — the stack is not needed past
  it, and a re-drive runs `<PROVISION>` again. After a `failure` or a `blocked` keep it up: you will
  be re-driven. When the master tells you to take it down and end, that is the whole of that turn.
- **`RED`** → the story is not done, whatever the red is:
  - `atdd` — an acceptance case that does not pass: no exception;
  - `new` — a test that passed before your story and does not now: you broke it;
  - `preexisting` — a test that was ALREADY red on the base, in a file your story touched. It comes back
    to you all the same: fix the test or the code it exercises, and document the fix in the spec
    file your build rung wrote, under the heading the gate's output names for it (the project's own,
    from its tests config) — one line per file, naming it, the cause and the fix. Run the gate again:
    it checks that every file it listed as pre-existing is named there, and refuses the story otherwise;
  - `unattributed` — red here, and the tool could not ask your base whether it was red there too
    (the report's `reason`: the tests read state outside the tree that nothing rebuilds for an
    older commit). Treat it as yours: read its log and fix it. If the log shows it was already red
    before your story, fix it all the same and document it like a `preexisting` one;
  - `deleted` — a test file that existed where you branched is gone from your diff (a moved file is
    not this: the gate follows renames). Deleting the test that would fail is not a fix. Put it back,
    or say which file and why in the spec, under the heading the gate names for it — a different one
    from the pre-existing section. Until that section names the file, the story is not done;
  - `runner` — the test command did not RUN as a test runner: it failed and wrote no report, or the shell
    could not find it. It is the environment's or the command's, not a test's. Read the log it names.
    **Never change the project's dependency, build or configuration files to make it run** — that is
    not your story, and it costs the run more than the story is worth: report
    `blocked <STORY> gate <the last lines of the log>` and stop;
  - a red you cannot fix → `blocked` or `failure` with evidence, never an edit that makes a test pass
    without the behavior.
- **`INCONCLUSIVE`** → the tool cut the runner at `<GATE BUDGET>` (class `clock`: what those units
  would have said is unknown; nothing that did run was red). It is not a failed story and not a
  green one: report `failure <STORY> clock gate <elapsed>/<budget>` and stop there — the master
  re-measures the rung alone, once, and decides; you never re-run it yourself to "make it fit".
- **Do not change the story's files after a green gate.** A rebase is fine; the merge accepts your
  report when the files are the same. Anything else sends you back through the gate: the merge
  refuses when the tip of `<BRANCH>` is not the commit you reported, and it never picks an older
  commit for you.
- **The config is not yours.** Never edit `_waves/tests_memory.toml`, anything under `<MEMORY DIR>`,
  or anything under `.waves/gate/`: the gate reads the config from where you branched, and a story
  that touches them is refused.

A red that the tool reports is yours until you show otherwise; the tool re-runs it on your base only
to tell you what happened, never to excuse it.

## 5. The queue is per TYPE of test

Everything `<TESTS TOOL>` runs — `gate`, `run`, `record` — waits for its kind's slot first, one front
at a time by default and `n` when the owner declared a capacity. You never call a queue script and
you never name a command that "takes the lock": the type of the test decides.

The queue prints `=== queue: waiting …` and, while it waits, a line every minute, so the log you wait
on keeps advancing; you wait for the marker `SUITE-DONE rc=<n>` and for nothing else — not for a
process, not for a screen, not for a feeling that enough time has passed.

After a `RED` you rerun only what the fix touched — `<TESTS TOOL> run --kind <kind> <the test files
your fix touches>`, nothing wider — and the gate ONCE MORE when you are done, not after every edit.
MEASURED: a brief that said "any edit: ladder from the top" made twenty patches cost twenty full
ladders. **You never launch the project's test runner yourself, and never two runs of a type side
by side**: the type's queue is the owner's capacity, and a run outside the tool is invisible to
it — it fights every other front for the machine and counts for nothing at the gate. A deadline
does not change this; a run that will not fit its cap ends at the cap.

**A rung that runs out of time is not a failed story.** Report it as
`failure <story> clock <rung> <elapsed>/<budget>` — the reserved layer — and stop there. It is the
master's to route: it re-measures that rung alone, and what happens next is about the test
infrastructure, not about your code. Never report a rung green because the cases that ran before the
clock cut were green.

## 6. The worktree is yours while you live

`<WORKTREE>` on `<BRANCH>` is yours. The branch changing underneath you means STOP and report —
never continue on a tree someone else moved. When your last story leaves the run the master gives
the tree and its stack back; your work lives on `<BRANCH>`, and only what is committed there
survives the tree.

---

## What you send back

Three lines, per event, and no other. Anything else is not a report: it returns you to the
master with the story unjudged, and the master will re-drive you from the rung your liveness
file names.

- `ready-to-merge <story> <commit>` followed by the AC MATRIX, one line per AC:
  `AC<n> "<the AC's text, quoted>" · <case that ran: <file>::<case name>, as the gate report lists it> · <result>`
- `failure <story> <layer> <reason+evidence>` — one reserved layer, `clock`:
  `failure <story> clock <rung> <elapsed>/<budget>` when a rung ran out of time, which is a
  different event from a case that failed and is routed differently
- `blocked <story> <AC> <missing: route|object|migration|contract|atdd, named>` — `atdd` when the
  acceptance case contradicts the story's text (section 4)
