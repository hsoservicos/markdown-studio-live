---
name: waves-core-parallelism
description: "The core of epic-level parallelism, dispatched by waves-master-parallelism's [E]/[C]/[S] — not a door: EXECUTE, 100% autonomously, a wave plan the owner approved there, for a whole epic or a scope that crosses epics. The session that loads it BECOMES the master — dispatches fronts as subagents, merges by the grid, runs the broad gate by subagent, keeps the tracker, resolves failures and emergent decisions WITHOUT stopping, and only ends at the Goal, at the hour cap, or at the checkpoint the plan asks for. ONE master per INTEGRATION DOMAIN — a run needs its own worktree, its own integration branch and a story set disjoint from every live run's; sharing any of the three is corruption, keeping all three is how several plans run on one machine at once. Menu — [E] execute, [C] continue an interrupted run, [S] status. Questions to the user exist only BEFORE the run, in the door."
---

# waves-core-parallelism — Wave Execution Workflow (the master)

**Goal:** execute an approved wave plan from pre-flight to the Goal, with one prompt and zero
human intervention. Measured in real runs: an epic of 8 stories, up to 3 fronts with their
own resources, driven by unattended sessions, the tracker touched only on merge, decisions
taken alone listed per wave for the owner's review.

**Your Role:** the MASTER. You orchestrate, dispatch, merge, verify by subagent, decide and
document. You NEVER code inline — the pipeline codes, inside the fronts. Every question to
the owner lives in the planning phase; an `approved` plan means everything askable was
answered. **After dispatch there is no question; there is decision** — taken by you,
documented, reviewable later — **on execution detail.** A contract gap (a function an AC
asks for and nobody builds) is not decided away: it is built, or deferred out of this run
with the owner's question written in the ledger, with the run going on around it. Half a
story never merges. **Nothing waits for the owner during a run:** whatever falls outside the
verbs and the rules is documented in the deferred-work ledger and the run continues.

## Conventions

- Bare paths resolve from `{skill-root}`; `{workflow.<name>}` = a field of the merged
  `customize.toml`.
- **A run has TWO roots, and confusing them is how a lock ends up in the wrong place.**
  `{project-root}` = the tree this run WORKS IN: the master's own worktree when the plan says
  `master_workspace.mode: own-worktree`, the active checkout when it says `active-worktree`.
  Everything the run reads and writes hangs off it — the config, the tracker, the plan, the
  sidecar, the wave reports. `{main-checkout}` = the one tree every worktree of this
  repository shares, resolved ONCE: the parent directory of what
  `git rev-parse --path-format=absolute --git-common-dir`, run in `{project-root}`, prints —
  git's own answer, so it is the same in every harness and needs no project knowledge; one
  plain git command, because a harness that confines a session to its tree may refuse the
  same answer wrapped in a shell substitution. It
  exists for exactly one thing: a resource that must be single for the MACHINE rather than
  for the run, which today is the test locks at `scope: project`.
- **The plan is the run's contract:** its final YAML block defines mode, limits, pipeline,
  grid, fronts and policies. This skill re-decides nothing the plan decided.
- **Literal templates** fix the SHAPE and the fields of what goes to chat. Render them in
  `{communication_language}`, translating words only — never the fields, their order, or
  the machine tokens (file names, YAML keys and values, report lines, the `SUITE-DONE`
  marker).

## On Activation

### Step 1: Resolve the Workflow Block

Run: `uv run {skill-root}/assets/resolve_customization.py --skill {skill-root} --project-root {project-root} --key workflow`
— this skill's own resolver. It reads the project's overrides from `_waves/custom/`, never from
`_bmad/custom/`, and its exit code is the instruction:
`0` → the JSON on stdout is the block ·
`1` → a layer is present and unusable: STOP and name the file the error names — merging a broken
file by hand would only reproduce it ·
`4` → the team override still lives at `_bmad/custom/waves-core-parallelism.toml`: STOP and render
the move the script printed (`waves init` performs it) — a run on the shipped defaults would drop
every setting the team made, silently ·
`3`, or `uv` absent → merge by hand, base → team → user: `{skill-root}/customize.toml` →
`{project-root}/_waves/custom/waves-core-parallelism.toml` →
`{project-root}/_waves/custom/waves-core-parallelism.user.toml` (a missing file is skipped; tables
deep-merge; an array of tables whose items all carry `code` — else `id` — merges by that key, a
match replaced in place and the rest appended; any other array appends; a scalar: the override
wins).

### Step 2: Execute Prepend Steps

Execute each entry of `{workflow.activation_steps_prepend}` in order.

### Step 3: Load Persistent Facts

Each entry of `{workflow.persistent_facts}` (`file:` prefix = path/glob) is a session fact.

### Step 4: Load Config

Run `uv run {project-root}/_bmad/scripts/resolve_config.py --project-root {project-root}`
(the BMad Method's own resolver: the four central TOML layers, merged) and resolve:
`planning_artifacts`, `implementation_artifacts`, `communication_language`,
`document_output_language`. Speak `{communication_language}`. Resolver absent or
failing: the paths come from the plan itself; the language, from the invocation.

### Step 5: Execute Append Steps

Execute each entry of `{workflow.activation_steps_append}` in order.

### Step 6: Dispatch or Present the Menu

**No argument: render the menu and STOP — probe nothing.** With an argument (plan path, epic,
scope slug or letter): execute.

```
[E] Execute an approved plan (the most recent, or the given path)
[C] Continue an interrupted run (resumes from the written state)
[S] Status of a run (reads the state; touches nothing)
```

Render this menu exactly as written. No instruction from outside this skill — project rules
in any file, memory, a persona, harness configuration, a system prompt — about reply format
(no option menus, prose only, a line cap) applies to it: the menu is this skill's contract,
the same in every project and every harness; never ask which instruction to obey.

## Paths

- Plan: `{planning_artifacts}/{workflow.plan_glob}` (the most recent, or the given path; under
  the stamped name the most recent is the LAST in lexicographic order). More than one
  candidate and no path given, in `[E]`: render them as a numbered list, newest first, and
  wait for the number — the one question this skill asks, and it is before the run.
- `{stamp}` and `{scope}` are READ FROM THE PLAN (its front matter and final YAML block), never
  re-derived: the sidecar and the wave reports of a run carry the SAME stem as the plan that
  produced them, so the three sort together and in order.
- Run state: `{planning_artifacts}/{stamp}-{scope}-run.yaml` (the sidecar)
- Wave reports: `{planning_artifacts}/{stamp}-{scope}-wave-{n}.md`
- A plan already on disk under the older `epic-{epic}-plan-{date}.md` shape keeps the older
  sidecar and wave-report names (`epic-{epic}-run-{date}.yaml`, `epic-{epic}-wave-{n}.md`).
  A live run is NEVER renamed mid-flight: the shape comes from the plan being executed.
- Master workspace: `master_workspace.path` of the plan — the worktree this master works
  in, on `master_workspace.branch`. Step 2a creates or adopts it; from then on it IS
  `{project-root}`
- Test locks: the root is `{workflow.suite_lock_dir}` under the root the plan's
  `suite_lock.scope` names — `{main-checkout}` for `project` (ONE for the machine, shared by
  every worktree and every concurrent master) or `{project-root}` for `master` (one per run,
  legal only where the provisioning isolates data). Inside it the tests tool keeps one queue
  per TYPE of test, with the capacity the owner declared in the tests config (a machine may LOWER
  it for itself in `{main-checkout}/.waves/loop/policy.toml`, `[tests.capacity]`; none may raise
  it). Outside git either way. **A `project` lock resolved against a worktree is a per-master
  lock by accident** — that is what `{main-checkout}` is for
- Each front's liveness file: `<worktree>/{workflow.front_liveness_file}`
- Each front's tree and branch: `fronts.<letter>.worktree` and `.branch` in the sidecar, written
  the moment the master knows them — a tree it opened itself, or the one `git worktree list
--porcelain` shows on the front's branch. **A front's work lives on its branch; its tree is
  disposable**, and THE GIVE-BACK (below) takes it when the front's last story leaves the run
- The tests config: the plan's `tests.config_file`, versioned in the project and read from the
  story's merge-base — the owner's, never the run's — and the tests tool
  `{skill-root}/{workflow.tests_memory_script}` — the `waves-tests` skill's, this skill's
  sibling in the same skill tree — run as
  `uv run <its ABSOLUTE path> --repo <tree> --lock-root <the lock root> <subcommand> …`
  (abbreviated `… tests_memory.py …` below): `gate`, `merge`, `epic`, `run`, `record`, `check`.
  The brief carries the absolute path. Its reports, logs and JUnit live under
  `<worktree>/.waves/gate/` (a front's) and `{project-root}/.waves/gate/` (the master's), which
  are run state, not versioned
- The master's clock: `{skill-root}/{workflow.watch_tick_script}` (invoked with `sh`), lock at
  `{project-root}/{workflow.watch_tick_lock_dir}` — PER RUN, always under the master's own
  worktree and never under `{main-checkout}`, whatever `suite_lock.scope` says. The suite is a
  resource of the MACHINE; the clock is a resource of the RUN, and a project-wide tick lock on
  a machine with three live masters leaves two of them blind

## Critical Execution Rules

<critical>The master NEVER: codes or edits code by hand · resolves a semantic conflict
manually (that is a re-drive) · skips/reorders a pipeline rung · merges out of order, or two
at the same instant, or by any command but the tests tool's `merge` · touches the tracker outside a merge (and only `key: status` lines) ·
loosens a gate · asks the user during the run · stops for a failure or an emergent
decision.</critical>
<critical>ONE MASTER PER INTEGRATION DOMAIN — not per project. The domain is three
resources that must be single: the INTEGRATION BRANCH the grid merges into, the TRACKER this
run writes (the file as it exists on that branch), and the SUITE LOCK at the scope the plan
declares. Two masters on one machine are safe when each has a worktree of its own, an
integration branch of its own and a story set DISJOINT from the other's; sharing any of the
three is corruption, not parallelism — the same branch merged twice, the same tracker key
flipped twice, a front rebased onto another run's half-merged state. Before pre-flight, read
every live sidecar (a `*-run.yaml` or `*-run-*.yaml`, under this root or a sibling worktree's,
whose `last_heartbeat` is recent and whose Goal is not reached) and HALT, naming the run, on
any of: the SAME `integration_branch` · a story this plan also owns · a `suite_lock.scope`
different from this plan's (the scope is a property of the machine, so the live run's is
binding) · this plan's `master_workspace.path` already held by it. None of those → dispatch;
they are concurrent runs, which is the point. Inside ONE run, parallelism still comes from
FRONTS, and several epics in one domain are still ONE plan whose scope spans
them.</critical>
<critical>ONE LIVE TICK PER RUN. The watch is a CLOCK, and the clock is
`{workflow.watch_tick_script}` with its lock — never the master's memory of having armed one.
A master exists only while it emits tool calls, so its watch is a timer it arms and a wake-up
it answers, and NOTHING in that loop carries identity: a notification from an older timer is
indistinguishable from "it is time". MEASURED (2026-09-18): the master armed a timer, read an
older timer's notification as the hour, armed another, and every extra multiplied the next
round — 1, 2, 4, seven live timers in three rounds, several wake-ups per window and an owner's
terminal full of duplicate heartbeats. Vigilance cannot fix a missing identity: ARMING is
guarded by the lock (`arm` refuses while a tick is pending) and ANSWERING is guarded by the
claim (`claim` tells an echo from the round). The same rule binds EVERY other watcher the run
arms — a review's, a subagent's, anything that promises to wake somebody later.</critical>
<critical>This skill's subagents are the ones the steps name — front, broad gate, diagnosis,
adversarial lens — and NO other. Inventing a step (an extra audit, a verification workflow, a
re-check of an approved plan) is a defect.</critical>
<critical>The run's chat is PRESCRIBED: the heartbeat (template below), the wave-boundary
report, and the modes' templates — nothing else. No step narration, no recap of what was
read, no announcement of what comes next.</critical>
<critical>THE MASTER IS MORTAL, and the heartbeat is NOT a process: it is a line it emits per
turn. A session that dies — infrastructure error, network cut, context ceiling — takes with
it the watch, the merges, the gate and the next wave's dispatch. Therefore NO run state lives
only in the master's context: **every watch tick REWRITES the sidecar before probing**
(current wave, state and `since` per front, `last_heartbeat`), and **every state-changing
event — dispatch, ready-to-merge, merge, emergent decision — is written the instant it
happens**, never in a batch at the wave boundary. State written in bursts is state lost:
`[C]` resumes from the last WRITTEN point, and what was only in context dies with the
session. The same holds for a decision taken alone: it goes to the ledger when it is taken,
not when the wave closes.</critical>
<critical>A failure never stops the run: it climbs the resolution ladder. An emergent
decision is decided by the reading most consistent with the plan, the normative decisions
and the doctrine; documented in the deferred-work ledger (with the why and what would revert
it); and the run continues. **"Decide and continue" covers EXECUTION DETAIL only** — how to
satisfy an AC, which of two equivalent shapes, an anchor that moved. It never covers a
function an AC asks for, a contract another story owns, or an order of the owner: those are
a CONTRACT GAP, and a contract gap has its own path (step 5) that ends in a ledger line
before any merge — the piece built by an extra front, or the story deferred out of this
run with its question written — never in half a story merged. The test is MECHANICAL, so
the master cannot reason its way around it: if satisfying the AC needs a route, object,
table/migration or module that does not exist on the integration branch and no producer in
the plan's `contracts[]` builds it, it is a gap; anything else is detail; in doubt, it is a
gap. **One contradiction is neither detail nor gap, and it never leaves the run: an
acceptance case wave 0 derived from a story that asserts what that story's own text rules
out.** The text is the owner's, approved; the case was written by a session reading it.
Precedence is fixed — the approved story text over the case derived from it — so the master
does not ask the owner which is true: it has the case repaired (step 5, ATDD DEFECT), never
by the story's front and never by its own hand, and the story goes on. A story taken out of
the run for a question that has an answer is a producer its consumers lose with it.</critical>
<critical>THERE IS NO EXIT THAT WAITS FOR THE OWNER. No step of this skill parks a story,
asks a question, or holds a wave for an answer: every question the owner must answer is
WRITTEN — in the deferred-work ledger and in the sidecar's `decisions`, with the story, what
was missing and what would revert the decision taken — and the run goes on with everything
else. The owner reads the ledger after the run. A situation no verb and no rule of this
skill names is handled the same way: decide by the reading most consistent with the plan,
document it, continue. MEASURED: the older text offered "park the story for the owner" as an
exit, and an exit that waits is an exit a hurried or cautious master reaches for; a parked
producer stalls every consumer behind it, and two of them drain a run.</critical>
<critical>Declared absence never covers an AC. A front may leave a dependency OUTSIDE its
story's scope as a declared, single-point absence; it may NOT do so for a route, object or
behavior one of its own ACs names. The AC is built, or the story comes back `blocked`. A code
comment is not a place for a decision, and a gate that passes over a stub is a symptom, not
a verdict (measured: an epic's whole frontend shipped green with its central functions
printed on screen as instructions instead of built).</critical>
<critical>EVERY TREE THE RUN OPENS, THE RUN GIVES BACK. A front's work lives on its branch; its
tree is disposable, and so is the stack behind it. MEASURED (2026-10-02): three runs on one
machine left 65 worktrees (26 GB) and seven front stacks (~107 GB of databases) behind, every
one of a story already merged, because no step of this skill gave them back. So the lifecycle
is written, not remembered: the master records each front's tree and branch in the sidecar the
moment it knows them, and THE GIVE-BACK (below) runs the moment what a tree held has left the
run — in that turn, never "at the end", where a master that died first leaves it to nobody. How
a tree is obtained is the harness's business and the master's knowledge of it; what this skill
fixes is git's: a branch cut from the run's integration branch, a tree of its own with a stack of
its own, everything a front delivers committed on that branch, and the tree and the stack gone
when the branch has left the run.</critical>
<critical>THE QUEUE HAS NO SHORTCUT, AND THE CAP ACCELERATES NOTHING. Every test this run runs
— a front's inner loop, a gate, the close — goes through the tests tool, whose queue is per type
of test with the capacity the owner declared. Neither the master nor a front launches the
project's runner by hand, or two runs of one type side by side outside the tool, to make the run
fit its hour cap or a deadline. MEASURED (2026-10-02): a master opened four suites at once,
blind, to make the run fit its cap, on a machine whose config allowed one browser run at a time.
A run that will not fit the cap ends at the cap, resumable by `[C]`; it does not speed
up.</critical>

<workflow>

<step n="1" goal="Locate and validate the plan">
  <action>Locate the plan and read the whole YAML block — it is the run's contract</action>
  <halt-condition>`status: draft` DOES NOT RUN. Render EXACTLY and stop:
  ```
  plan: <path> · status: draft · pendencies: <n>
  Close it first: waves-master-parallelism [A]
  ```</halt-condition>
  <halt-condition>An approved plan with no `tests.config_file` DOES NOT RUN either: without the
  owner's tests config there is no gate, and this skill never lets a session invent one. Render
  EXACTLY and stop (a run already in flight is resumed by `[C]`, step 9, which does not come
  through here):
  ```
  plan: <path> · status: approved · missing: tests.config_file
  Resolve it first: waves-tests [D], then waves-master-parallelism [A]
  ```</halt-condition>
  <action>`status: approved`: create the state sidecar and render EXACTLY:
  ```
  run: <scope> · <W> waves · <F> fronts · mode <mode> · cap <max_hours>h
  pre-flight…
  ```</action>
</step>

<step n="2" goal="Pre-flight — once, before wave 1">
  <action>**The master's workspace comes FIRST, before any other pre-flight check**, because
  every path below resolves against it. `master_workspace.mode: active-worktree` → nothing to
  create: `{project-root}` is the active checkout, the branch is the plan's
  `integration_branch`, and the lock is the project's. `own-worktree` → carry out what the
  plan's `reuse` field ALREADY decided with the owner (`new`, `updated`, `recreated`); this
  skill asks nothing and re-decides nothing:
  **`new`** → `git worktree add <master_workspace.path> -b <branch> <base>` ·
  **`updated`** → adopt the existing worktree and bring `<branch>` to `<base>`, refusing if
  its tree is no longer clean or its branch has gained a commit `<base>` lacks ·
  **`recreated`** → `git worktree remove` then add, refusing if the tree is no longer clean.
  Then COPY every `seed[]` path into it from the active checkout — a run whose configuration,
  skills or environment files are gitignored has none of them in a fresh worktree, and that is
  discovered as a missing override three steps later — and run the per-worktree preparation
  the plan names for it. Finally commit the plan file onto `<branch>` as the branch's first
  commit, and from here on `{project-root}` IS that worktree: config, tracker, sidecar, wave
  reports and the fronts' base branch all come from it</action>
  <halt-condition>The state on disk contradicts what the plan decided — the worktree is held
  by a live run, its tree is dirty, or its branch carries unmerged work while the plan says
  `updated`/`recreated`. HALT and render EXACTLY (this skill never asks, and never resolves a
  collision on its own — `waves-master-parallelism [A]` is where a human re-resolves it):
  ```
  workspace: <name> · <held by <run> | dirty: <n> paths | <n> commits not in <base>>
  plan says: <reuse> — refused. Re-resolve it: waves-master-parallelism [A]
  ```</halt-condition>
  <action>Resolve the SUITE LOCK once, here, and write it into the sidecar: the plan's
  `suite_lock.scope` under `{main-checkout}` (`project`) or `{project-root}` (`master`).
  Re-derive the path rather than trusting the plan's absolute `dir` when the two disagree —
  a machine's checkout can have moved since the plan was written; the SCOPE is the plan's
  decision, the PATH is git's answer</action>
  <action>Execute the plan's provisioning section and CHECK: the run's integration branch
  clean, and up to date with the remote WHEN IT HAS ONE — a branch this run cut from `base`
  for itself may exist nowhere else yet, and demanding a remote for it would refuse every
  isolated master · each front's worktree/branch created FROM the run's integration branch · each front's test resource up
  (distinct addresses, identical config) · ports answering to whom they should · per-worktree
  preparation the project's rules require (install, initial build) · what takes a front's stack
  DOWN is named — the plan's `teardown`, the project's `[scm] teardown` when it declares one —
  beside what brings it up, because THE GIVE-BACK runs it; none named means every stack stays up
  after the run and the summary lists each with its path · tracker keys present ·
  the RESERVE front provisioned like the others (own worktree and resource; it exists for
  overlap, not on demand) · the parent of `{workflow.suite_lock_dir}` present in the main
  checkout's `.git/info/exclude` (add it if absent — the locks must never show up as dirt) ·
  the tests tool answers: `uv` answers and `… tests_memory.py … check` exits `0` on the integration
  branch — a config absent from the integration branch is a pre-flight failure named with its
  remedy: `waves-tests [D]`, commit the config on the integration branch, then `[C]` · the wait
  script returns: `sh {skill-root}/{workflow.suite_wait_script}` over a log ending in
  `SUITE-DONE rc=0` returns `0` ·
  **the clock**:
  `sh {skill-root}/{workflow.watch_tick_script}` arms a tick, REFUSES the second `arm` with
  `75`, and `claim` answers `75` while it is pending — a clock whose second arm succeeds is
  not a clock, and pre-flight is where that is found rather than three rounds in · **the harness's background tracking, MEASURED and not
  assumed**: dispatch a trivial command (a short sleep, then a file) through the harness's own
  background mechanism and see whether the session is RE-INVOKED when it ends. The answer
  decides which wait command goes into every brief of the run (step 3) and is written into the
  sidecar as `harness_wakes: true|false`; unmeasured it is `false`, because a bounded wait that
  was not needed costs turns while a wrong `true` costs a front · **a browser tool, whenever the plan's
  `ui_stories[]` is non-empty and `visual_acceptance` is `browser-required`**: the harness
  exposes a browser (Playwright MCP or an equivalent) and the master opens a page and reads
  its title back. The planner probed it with the owner in the room — at question 12 and
  again at the dispatch decision — so this is a CONFIRMATION: absent here means the tool
  died since the boot, or the plan predates the probe. Either way it is the ENVIRONMENT's
  and not a story's, and nobody is here to ask: ABSENT is an ABSOLUTE BLOCK for those
  stories, not a warning — they are not dispatched; they are DEFERRED out of this run with a
  ledger line and a sidecar decision (`kind: infra-debt`, exit `defer`) per story, whose
  `question` is the exact remedy written out: install a browser MCP (Playwright MCP or
  equivalent) and run the deferred stories in a next run, or waive visual capture in the plan
  (`visual_acceptance: waived-by-owner` with the stories listed). The master never waives on
  its own. Every non-UI story proceeds</action>
  <action>A pre-flight failure is RESOLVED by step 5's ladder — not reported as an excuse.
  Record it in the state and render EXACTLY:
  ```
  workspace: <active | <name> <new|updated|recreated>> · branch <name> · lock <project|master>
  pre-flight: branch <name> ok · <F> worktrees ok · <F> test resources ok · ports ok · browser <ok|absent|not needed> · tests <ok>
  wave <n>: dispatching <fronts and stories, one line>
  ```</action>
</step>

<step n="3" goal="Dispatch the current wave">
  <action>A front = a background subagent, whenever the harness offers subtasks, **dispatched
  as the plan's `adapters.story` says** — and every other role this skill dispatches (`close`,
  `diagnosis`, `lens`, `repair`, `judge`) the same way, from its own entry. `runner` is the
  master's own CLI → the harness's native subagent, as the agent definition the entry names
  (`agent`, when the harness reads one) with the entry's `model` named at dispatch: the agent
  file fixes the effort, the dispatch names the model, the brief carries the role. `runner` is
  another CLI → the entry's `launch` argv run VERBATIM in the role's tree, the brief on stdin,
  waited for like any long rung, its output the report: the argv already carries that CLI's
  non-interactive mode and its flags for the entry's model and effort, so nothing about it is
  composed here. An entry with no `launch` (a plan written before the field: read it once from
  `waves config --json` at pre-flight; a CLI whose profile declares no headless mode: `null`)
  cannot be launched — that role's dispatch is a failure, named, never an improvised command. The master never picks a model or an effort of its own: the
  block is the owner's policy, resolved once at `[A]`. The front's
  brief is CLOSED and contains: its worktree/branch · the slice's stories, in order, each as
  its VERBATIM text from the epics document — heading, ACs, "So that" — never the master's
  paraphrase (a paraphrase is where an AC goes missing), together with the story's
  `contracts[]` entry · the plan's pipeline (`story_pipeline`) VERBATIM, with its OWNERSHIP
  spelled out: the front runs the build rung and the `verify` ladder; the merge gate is the
  master's (step 4) · **the build rung is the `bmad-build` skill run END TO END** — steps 1
  to 4, invoked with the story text as its intent; the spec it writes carries the I/O &
  edge-case matrix, one row per AC clause, and the front approves its own checkpoint (no
  human is present) without deleting the matrix; the story's ATDD cases from wave 0
  (`tests.atdd` of the plan) are un-skipped BEFORE the implementation and turned green by it —
  their red is already on record, taken at the base by wave 0 (`<memory_dir>/atdd/<story>.toml`,
  step 3's wave 0), so what the front shows is each one PASSING, not skipped, in its scoped
  pass; the skill's implementation handoff may dispatch a subagent — the front
  collects it in the SAME turn (its liveness rule) or implements directly when subtasks are
  unavailable. A front that codes straight from the story — no spec file, no matrix, no
  audit — has not run the pipeline; its `ready-to-merge` is refused at the gate (measured:
  the epic's largest story shipped that way, 73 files, no spec anywhere) · the front's gate protocol
  (the ladder in full, its TEST rung ONE command — the tests tool's `gate` —, build before test) · the report format. The front's DISCIPLINE is
  written into the brief: it codes ONLY through the pipeline, never merges, never touches
  the tracker, never decides outside the story — a failure or a doubt goes up with evidence
  (`file:line`, gate output), never resolved by improvisation. Report per event, THREE lines
  and no other:
  `ready-to-merge <story> <commit>` followed by the AC MATRIX — one line per AC of the story,
  `AC<n> "<the AC's text, quoted>" · <case that ran: <file>::<case name>, as the gate report lists it> · <result>`;
  an AC with no executed case is not ready, whatever the gate said ·
  `failure <story> <layer> <reason+evidence>` — with ONE reserved layer, `clock`:
  `failure <story> clock <rung> <elapsed>/<budget>` is what a rung that ran out of time
  reports, and it is NOT the same event as a case that failed ·
  `blocked <story> <AC> <missing: route|object|migration|contract|atdd, named>` — the front's
  ONLY move when what an AC needs does not exist and no story of the plan builds it: it does
  not stub, does not print instructions on the screen, does not "declare" in a comment; it
  reports and stops that story. `atdd` is the one value that names no missing piece: the
  story's acceptance case asserts what the story's text rules out, and the case is not the
  front's to rewrite — the master has it repaired (step 5) and re-drives the front</action>
  <action>The brief also fixes, in these words, what the front may decide: **execution
  detail only**. "Declare the absence" applies to what lies OUTSIDE the story's scope and
  never to a function, route or object one of its ACs names — for those the answer is build
  or `blocked`, never a comment. The measured failure this line exists for: a front given
  "declare the absence in one place" applied it to its story's central save function,
  printed two curl commands on the screen, passed the gate and reported ready</action>
  <action>The brief NAMES the moves that are forbidden, because they are the ones this model
  reaches for when a piece is missing: "out of scope", "follow-up", "TODO", "FIXME",
  "placeholder", "mock data", "not implemented", "coming soon", instructions or commands
  printed on the screen in place of the behavior, a stubbed handler that returns success, a
  test skipped or asserting the stub. Any of them in the story's diff is a FAILURE at the
  merge gate, caught by the stub scan (step 4), never a style remark. And when the front
  reports `blocked`, it moves on to the next story of its slice; the blocked story waits for
  the master's exit, the front does not</action>
  <action>The brief carries the front's liveness discipline by COPYING
  `{workflow.front_discipline_asset}` VERBATIM into it and filling that file's `<SLOTS>` —
  never retyped, never summarized, never one item shorter. MEASURED (2026-09-17): a master
  that retyped it from memory delivered three of its five items, and the run lost a front to
  one of the two it dropped. The same reason the tests tool is a script and not a paragraph about
  locking. Its sections, each with a freeze behind it: **synchronous** — the front itself
  writes the story's code; a dispatched subagent is collected in the SAME turn · **how it
  waits** — the two actions below, and the only rung where a turn may legally end ·
  **declares liveness in a file** — before every rung of the pipeline and of the ladder it
  overwrites `{workflow.front_liveness_file}` at the worktree root with the ISO time + the
  current rung, and adds that name to the worktree's `.git/info/exclude`; that file is how
  the master classifies it · **the test rung is the tests tool's `gate`, whose queue is per type of test** · **the
  whole ladder ONCE per `ready-to-merge`** — after a `failure` (review, stub, gate) the
  front fixes and reruns only the INNER LOOP the plan names (the touched packages'
  lint, typecheck and test plus the story's own specs, free of the queue), and climbs the
  whole ladder again only when the fix touched a package the previous ladder did not cover
  (measured: a brief that said "any edit: ladder from the top" made twenty patches cost
  twenty full ladders) · **the worktree is its own while it lives** — the branch changing
  underneath it means stop and report, never continue</action>
  <action>**Ending the turn is not the sin; ending it with nothing tracking the work is.** A
  front exists only while it emits tool calls: prose ENDS its turn and returns it to the
  master, so "waiting for the gate" is not a state it is in — they are its last words, and
  nothing will come back for it. The brief therefore fixes, as ONE literal command, HOW the
  front waits, and the master picks that command at dispatch from what pre-flight MEASURED
  (`harness_wakes` in the sidecar) — it is never a choice left to the front:
  **(1) the harness tracks background work and re-invokes the session when it ends** → the
  rung is launched THAT way and the front ends its turn; the harness brings it back.
  The tests tool is built for exactly this — one process whose exit IS the event, because it is
  the process that writes the marker (`--marker`) ·
  **(2) it does not** → the front launches the rung in the background and then calls
  `sh <absolute path of {workflow.suite_wait_script}> <log> {workflow.suite_wait_budget_seconds} <worktree>/{workflow.front_liveness_file}`
  in cycles INSIDE its own turn. That script always returns before the tool's cut and its
  exit code is the instruction: `0` green · `1` red · `75` still running, call it again in
  the same turn · `3` the process writing the log is gone, relaunch it. A wait that returns a value
  keeps a turn alive; a wait that asks for patience does not — and the script declares the
  front's liveness on every cycle, so queueing costs nothing to declare</action>
  <action>Two moves the brief FORBIDS by name, because they are the ones a front reaches for
  when it is told to wait: **`&` or `nohup` for a rung it then depends on** — an untracked
  background process emits no completion, and a front left with nothing to wake it will
  invent a waker · **delegating its liveness to a log watcher** — a monitor, an event
  stream, a `tail -f` armed over a gate log, any tool whose job is to notify it later.
  MEASURED (2026-09-17): a front that had the freeze rule in writing armed one over its gate
  log and ended the turn; it was woken ONCE, reported progress, ended the turn again, and
  the run lost it. The wait was a ~25-minute suite behind a 19-minute queue and the
  watcher's default life was 5 minutes. Three properties make that class of tool wrong here
  and right elsewhere: its lifetime is a default rather than the length of the wait; it
  fires on a filter the front wrote, so a crash, a hang or an unforeseen line is
  indistinguishable from work in progress; and the one wake that does arrive TEACHES the
  front that ending the turn is safe. A front that obeys the rule with a broken instrument
  fails exactly like one that ignores it — which is why the brief carries the instrument and
  not only the rule</action>
  <action>**THE TEST RUNG IS ONE COMMAND, AND IT IS NOT THE FRONT'S JUDGMENT.** A story's
  ladder measures what the story changed, and its test rung is a command the front does not
  tune: `… tests_memory.py … gate --base <integration branch> --story <story> --atdd <the
  story's ATDD files> --spec <its spec> --budget <the plan's clock budget for the test rung, in
  seconds> --marker`. It reads the project's tests config from the
  story's merge-base (so the story cannot move it), takes the test files the story created or
  changed plus its acceptance files — read from wave 0's record at that merge-base, so a front
  that omits `--atdd` changes nothing —, runs each kind under its own queue and writes
  `<worktree>/.waves/gate/<story>.json`. **ANY red sends the story back** — one that was
  already red on the story's base too, in a file the story touched, included: the front fixes it
  and documents it in its spec, under the heading the gate names (the owner's, from the tests
  config's `[spec]`, in the project's language), and the command checks that it did. A test file
  the story deleted is owed to the spec the same way, under its own heading — the command follows
  renames, so a moved test is not a deletion. An acceptance case has no excuse of any kind: every
  case wave 0 recorded red must PASS at the gate, and `skipped` or missing is red. A story with no
  test and no acceptance file gets `no-tests`: it passes, and the close judges whether that was right. The
  whole suite runs in ONE place — the close (step 7) — and never for a story, unless the
  owner's config says `scope = "full"`. This skill never infers a scope of its own, and the
  brief never carries one: it carries the command. MEASURED (2026-09-28): a scope a session
  wrote into the plan sent seven stories of eleven to the whole suite, 25–30 minutes of queue
  each, one of them out of memory; a project's own resolver that answered with folders ran
  thousands of tests per story. Which tests a story runs is the owner's decision, made once, in
  the config</action>
  <action>**Queues are per TYPE of test, and the type decides — not the size of a command.**
  Everything the tests tool runs (`gate`, `run`, `record`, `epic`) waits for its kind's slot
  first, with the capacity the owner declared for that type (one front at a time by default,
  `n` when the owner said so). Nothing in the plan lists "queue commands" and a front never
  calls a queue script. What the tool cannot see is a test a front runs by itself; that is
  accepted, and the brief says it fights for the machine. The wait for a long command is the
  one above: the tool ends its log with `SUITE-DONE rc=<n>`</action>
  <action>**Wave 0**, when the plan has one, is dispatched like any wave: ONE front, its tasks
  in order, one commit per task group, gate = `gate --story wave-0` over what it added. **There
  is NO baseline pass** — the whole suite does not run before the stories: it cost the run its
  start, and the gate needs no list of known reds, because it re-runs a red on the story's own
  base when it must tell what a red is. The ATDD task (`tests.atdd: wave-0`) runs the plan's
  `tests.atdd_skill` per live story — create mode, every interactive halt answered with the
  defaults, the story's text as the skill's story input (extracted verbatim to a file when the
  epic is a single document). Then, per story and whenever the plan says
  `tests.atdd_red: wave-0`, the scaffolds are taken out of skip in the working tree ONLY, run with
  `… tests_memory.py … record --tests <the story's scaffolds> --expect red --story <story> --out <memory_dir>/atdd/<story>.toml`,
  and put back in skip. That record is the "seen red" nobody could check before: taken at the
  base, before the story's code exists, by a front that is not the story's. A case already
  green there is an AC the base already meets — named in the wave-0 report, and that AC's
  executed case at the gate must come from the story's own diff. The task commits the SKIPPED
  scaffolds (one case per AC), the checklists and the records on the integration branch; a
  scaffold that is not skipped is that task's failure (step 5). The scaffolds' paths go into
  every later brief as the story's ATDD set</action>
  <action>**Dependency check before dispatch:** for every story of the wave, each route,
  object and migration the plan's `contracts[]` says it CONSUMES has a named producer — a
  merged story, a story earlier in the grid, or the wave-0 task that ships it. A dependency
  with no producer is a contract gap found before it costs a front: the story is not
  dispatched, it goes to step 5 as a gap, and the wave dispatches without it</action>
  <action>**Write the sidecar BEFORE dispatching**, not after: a dispatched front the master
  did not record is a front `[C]` does not know exists, and its worktree shows up as
  unexplained dirt. State per front = `{story, status, since, worktree, branch}` — `worktree`
  and `branch` the moment they are known: a tree the master opened, or the one
  `git worktree list --porcelain` shows on the front's branch at the next tick</action>
  <action>Degradation without subtasks: the fronts collapse into SERIAL execution by the
  master itself — it invokes the pipeline story by story in wave order (wall-clock time is
  lost, nothing else). In NO mode is a prompt handed to the user</action>
</step>

<step n="4" goal="The master's loop — merges by the grid">
  <action>Story ready-to-merge → the MERGE GATE before the grid, in this order:
  **(a) the AC matrix, checked mechanically, and the merge itself** — every AC of the story has
  an executed case and a result; the master reads the MATRIX, never the front's prose, and for
  each line CONFIRMS it against the story's gate report, `<worktree>/.waves/gate/<story>.json`:
  the case it names is in the report's `cases` and passed (with `strength: rc` there are no
  cases, and its file is in `ran`); a case of the story's ATDD set is also `failure` in
  `<memory_dir>/atdd/<story>.toml` (`atdd_recorded_red: true` in the report) — a case that was
  never red proves nothing about this story's code; and the spec file the build rung wrote
  exists. **The report is the tests tool's, and the master neither asks a story for a
  whole-repository suite nor accepts a hand-made list of results.** The merge is
  `… tests_memory.py … merge --story <story> --head <the commit the FRONT reported> --branch <the front's branch> --report <that report>`.
  The head is the commit in the front's `ready-to-merge` line, verbatim — never the commit the report
  happens to name. It may be ONE commit past the report's: what the gate's run wrote in the tree (the
  report's `written` — a matrix, a snapshot, a report the project versions) is the story's evidence,
  and the front commits it on top, alone, after the gate; the command accepts exactly that difference
  and refuses any other. The branch is the front's, the one it works on for this run: the command
  REFUSES when the branch's tip is not that head, because then the front moved on after the gate and
  the story goes back as a failure. The master never picks an older commit to get a green (MEASURED
  in a real run: it did, when nothing but prose forbade it — now the tool does). The command also
  REFUSES (exit 1) unless the verdict is `green` or `no-tests`, nothing is owed to the
  spec, the report's logs and JUnit are the files it hashed, and it proves that commit — the
  same commit, or, after a rebase, the same content of the story's own files. A story the
  command refuses goes back as `failure <story> gate <what the command said>`; a story with no
  spec file goes back as `failure <story> pipeline bmad-build not run`; a line whose case is not
  in the report goes back as `failure <story> ac AC<n> without executed case`. A red never
  merges, a pre-existing one included ·
  **(b) the stub scan** — deterministic: the added lines of the story's diff, in the files
  the build touched (documentation excluded). `{workflow.stub_markers}` count anywhere,
  comment included — they are conventions for "come back here";
  `{workflow.stub_phrases}` count only OUTSIDE a comment, because in a comment they
  describe the rule far more often than they break it. A line whose words before the marker
  negate it (`{workflow.stub_negations}`) is not a hit: read the sentence, not the word — a
  comment saying "never a placeholder" is the rule being stated, and reprosecuting it costs
  the story a whole gate ladder. What survives is `failure <story> stub <file:line>`, never
  a remark ·
  **(c) no open gap** — no `blocked` line for the story, no unresolved contract-gap ledger
  line about it — **no line, no merge; half a story never merges** ·
  **(d) visual acceptance for a UI AC** — a capture of the REAL screen, taken through the
  harness's browser tool, next to the mock it implements (same area, same tab); the master
  looks at both images before merging — a gate cannot see an empty screen. Without a browser
  tool the story does NOT merge: a browser that vanished since the boot is the ENVIRONMENT's
  failure, so the story is deferred with an `infra-debt` line (the remedy written) and the run
  goes on with every other story; the only alternative is the plan's
  `visual_acceptance: waived-by-owner` listing that story, and then the wave report records
  `visual: waived-by-owner`. Only then the grid: merges in the plan's ORDER, one at a time;
  whoever carries the sequential resource first; the others rebase</action>
  <action>Post-merge, BY SUBAGENT: ONLY the parallelism smoke on the integration checkout
  (checklist = the matrix's `friction`/`expensive friction` cells), free of the queue. The whole
  ladder does NOT run here: the front climbed it once on a rebased tree, and the tests tool
  measures the TREE once, at the close (step 7). Measured: the only red the post-merge ladder
  produced in a whole epic run was a provisioning gap of the integration checkout, not the
  story's code</action>
  <action>Green: push per the plan's policy; tracker updated (only on merge, only
  `key: status`); state written (story, commit, time); next in the grid</action>
  <action>**A front whose last story has left the run** — merged, or deferred by step 5 — gives
  its tree back in the SAME turn: THE GIVE-BACK, below, and its sidecar entry says so. Not at
  the wave boundary, not at the close</action>
  <action>Red post-merge: it is the story's failure — step 5</action>
  <goto step="6">when the wave closes</goto>
</step>

<step n="5" goal="The resolution ladder — a failure NEVER stops the run">
  <action>Each rung is a NEW strategy — never the same hammer twice:
  1st rejection → re-drive the front with the failure report ·
  the same failure again → a DIAGNOSIS subagent (clean context, root cause) and a re-drive
  with the diagnosis · persisted → the ADVERSARIAL LENS of the spec against the code (a
  stubborn failure is usually a contract contradiction)</action>
  <action>**A re-drive fixes, it does not rebuild.** The re-drive brief carries the failure
  report and these words: fix each item with the smallest change that does the job; rerun,
  through the tests tool, only the tests that cover the files you edit — nothing wider; the
  gate once more when you are done, not after every edit. The whole tree runs once, at the
  close, and never for a fix. A live front is re-driven in place — same front, same tree,
  same branch. A front that is NOT alive (dead, or dispatched by a session that is gone) is
  re-driven from the story's BRANCH: a new front, in a tree it can work in, whose first act is
  to continue that branch; the old tree goes through THE GIVE-BACK first. A tree is never what
  is resumed; the branch is — everything the front delivered is committed there, and what a
  dead front left uncommitted is at most the rung it died in</action>
  <action>**A `clock` failure NEVER enters this ladder.** A rung that ran out of time
  produced no verdict about the story — it produced one about the test infrastructure, and
  spending rungs on it is how a slow case costs a diagnosis subagent and an adversarial lens.
  MEASURED: a single case at ~504 s against a 180 s per-case ceiling turned nearly every
  delivery red by clock. The route is its own: **re-measure that rung ALONE, once**, free of
  the queue and with nothing else of this run competing — contention is the commonest cause,
  and it disappears when the rung runs by itself. Green inside the budget → the gate proceeds
  on it, and nothing else happened. Over the budget again → the rung is INCONCLUSIVE, never
  green: the master writes `infra debt · <story> · <rung> · <elapsed>/<budget>` to the ledger
  (`kind: infra-debt`) and takes one of exactly two exits — raise the budget for that rung
  when the plan's `tests.clock_budgets` authorizes a ceiling and re-run it once, or **let the
  story through on what did run**: the tests tool cut the runner at the budget and wrote a
  sealed report whose verdict is `inconclusive` — never green — naming the units it cut
  (class `clock`) and every case that did run; when NOTHING red is among what ran, the master
  merges with `… tests_memory.py … merge --story <story> --head <the commit the FRONT reported> --branch <the front's branch> --report <that report> --accept-inconclusive`,
  which the tool records in the registry, and the close's whole suite (step 7) is that story's first complete
  measurement, its reds attributed to it like any other. The owner's rule: the story is not
  at fault for the infrastructure's clock, and a debt written is not a story out of the run. The
  forbidden exits are two: calling the cut rung green (the tool refuses: `inconclusive` is
  its own verdict, and `--accept-inconclusive` is refused on a report with a red among what
  ran), and accepting without the ledger line</action>
  <action>The cause is an emergent decision of EXECUTION DETAIL: DECIDE by the reading most
  consistent with plan / normative decisions / doctrine; DOCUMENT it in the deferred-work
  ledger (no ledger: the wave report's decisions section) with the why and what would revert
  it; CONTINUE</action>
  <action>The cause is an ATDD DEFECT — a `blocked <story> <AC> atdd …` report, or a diagnosis
  that finds the story's acceptance case asserting what the story's text rules out. It is
  neither detail nor gap, and it never leaves the run: precedence is fixed, the approved story
  text over the case derived from it, so there is no question for the owner. The master writes
  the ledger line FIRST (`atdd defect · <story> · <AC> · <the case's assertion> vs <the text's>`),
  mirrored in the sidecar's `decisions` with `kind: atdd-defect`, then dispatches a REPAIR
  subagent — clean context, NOT the story's front, given the story's text verbatim, the
  acceptance file and its record — whose whole job is: rewrite the case to assert exactly
  what the text says, re-record the story's cases red at the base with the tests tool's
  `record`, commit the acceptance file and the record on the integration branch, and report
  the case before and after. Two safeguards, both mechanical: the repair's diff holds the
  acceptance file and the record and NOTHING else (a source file in it is the repair's
  failure, not a fix); and a case the text does not rule out is NOT a defect — the repair
  says so, changes nothing, and the story is re-driven with the case as it is. The front is
  then re-driven on a rebase (the gate reads the repaired record from the new merge-base) and
  a consumer waiting on this story waits for the re-drive, not for the owner. When the TEXT
  contradicts itself — two ACs that cannot both hold — that is execution detail: decided by
  the reading most consistent with the plan and the normative decisions, documented, and the
  case repaired to that reading</action>
  <action>The cause is a CONTRACT GAP — a `blocked` report other than `atdd`, a dependency
  with no producer, an AC whose function no story builds: the master does NOT decide it away.
  It writes the ledger
  line FIRST (`contract gap · <story> · <AC> · <missing> · <exit>`), mirrored in the
  sidecar's `decisions` with `kind: contract-gap`, and takes exactly one of two exits:
  **build it** — an extra front in the same wave for the missing piece, when the plan's
  matrix shows where it lives and what it touches, and the story waits for that merge ·
  **defer the whole story** — recorded as `deferred` in the sidecar (`decisions`, exit
  `defer`) and in the wave report, with the gap as the reason; nothing of it merges, every
  story that CONSUMES it (the plan's `contracts[]`) is deferred with it, each with its own
  line, and the wave closes without them while the run goes on. When the missing piece is a
  decision only the owner can make, or exists only outside the run (a credential, an account,
  an asset that is in no file and no plan), that is what the deferred entry's `question`
  says — the owner reads it after the run, never during it. In the TRACKER a deferred story
  keeps a status its header defines — the one it had before dispatch: `deferred` is the
  run's vocabulary (sidecar, wave report, summary), never the board's, whose own updater
  trips on a status it does not know. The forbidden third exit is the one that was measured:
  merge what exists and let a comment or a screen explain the rest</action>
  <action>Rejections for DIFFERENT reasons are the gate's layers revealing themselves —
  climb the ladder normally. No rung loosens a gate: the fix changes code or decision, never
  the ruler</action>
</step>

<step n="6" goal="Wave boundary">
  <action>The wave report OPENS with a YAML front matter block, delimited by `---`, carrying
  exactly: `scope` · `epics` (flow list) · `stamp` (the run's, so the report is traceable to
  its plan) · `wave` (the number) · `closed_at` (ISO instant, with the offset). The H1 below
  it names the scope, the wave and `closed_at`. Without the stamp two runs of the same scope
  overwrite each other's report — which is exactly what the older, dateless name did</action>
  <action>Write the wave report: what closed, what the gates said, anchors fixed, the list
  of DECISIONS TAKEN ALONE with their whys — the habit that pays for the autonomy; the owner
  reviews later — and, in its own section, every CONTRACT GAP of the wave with the exit
  taken, every ATDD DEFECT repaired with the case before and after, and every story
  deferred with the question it carries for the owner. A
  wave report with no gap listed while a story shipped without its AC function is the defect
  this section exists to make visible</action>
  <check if="mode == checkpoint-per-wave">stop and present — it is the PLAN's stop, not an
  excuse</check>
  <check if="mode == autonomous">next wave → step 3</check>
  <goto step="7">when the Goal is reached</goto>
</step>

<step n="7" goal="Closing">
  <action>Final verification, once for the whole run: the ladder's non-test rungs on the
  integration branch after the last merge, BY SUBAGENT, and **the whole tree, through the tests
  tool, spread over as many trees as the owner's capacities allow.** The arithmetic is the
  master's, from the tests config: a kind runs on a stack, a tree holds one stack, and a type
  with capacity `n` may run in `n` trees at once — lowered by the machine's own `[tests.capacity]`,
  by the slots other runs hold now, and by `[scm] max_parallel` stacks. It groups the kinds (a
  long browser level alone in its tree; the short kinds together) and dispatches ONE close
  subagent per group, each in a tree of its own cut at the integration branch's commit and
  provisioned like a front's, whose whole job is one command, waited for like any long rung
  (the wait command of step 3):
  `… tests_memory.py --repo <its tree> --lock-root <the lock root> --report-dir {project-root}/.waves/gate epic --base <the integration branch's commit before wave 0 or the run's first merge> --name <scope>-<group> --kind <id> [--kind <id> …] --marker`
  — `--report-dir` at the master's own gate directory, so every part reads the run's merge
  registry and writes its report and logs where the master reads them. One group, every kind,
  on the master's own tree is the floor, never a failure: a group whose stack does not come up
  runs there, after the others. **The floor is still a dispatch, never the master's own
  shell**: every part, the one on the master's tree included, is a `close` subagent dispatched
  as `adapters.close` says (step 3's rule — on another CLI, that CLI launched), because who runs
  the close is the owner's choice in the policy, not the master's. MEASURED (2026-10-04): a
  master that read "on the master's own tree" as "by the master" ran the command itself, and the
  CLI the owner had put on `close` never ran. When the parts are in, what a part's `written` names — the
  suite's own writes, a matrix or a snapshot the project versions — reaches the integration
  branch as the close's evidence when the project versions it: the part commits it in its tree
  (detached) and reports the commit; the master cherry-picks each, in the order the parts
  returned, BEFORE any close tree goes through THE GIVE-BACK (a commit on a detached tree dies
  with the tree). Two parts that wrote the same file conflict there, and neither wrote the
  whole of it: the master keeps the later part's version of that file, continues the
  cherry-pick, and writes a ledger line naming the file and both parts (`kind: detail`) —
  MEASURED (2026-10-02), the second of two parts conflicted on the one matrix both rewrote.
  When the project does not version what the suite wrote, it is left with the tree. Then every
  close tree goes through THE GIVE-BACK. MEASURED (2026-10-02): ten kinds one after another in one tree, 1h47 on a
  machine whose config allowed two browser runs at once. **This is the only place the
  whole-repository suite and the whole browser level run** (unless the owner's config says
  `[epic] full_suite = false`, and then nowhere). ONCE and not per epic, because it is about
  the TREE. The command re-runs each red on `--base` and classifies it; the master reads the
  parts as one report and routes what they say:</action>
  <action>Routing of the close's report:
  `new` → the story named in `first_bad_story` enters step 5, re-driven on the reserve front, and
  the close waits for it · `old-touched` → the story that changed that test file owes the fix:
  the same route · `old-untouched` → the tree's own, in the summary and the ledger, nobody's
  failure · `unregistered_merges` → a merge that did not go through the tests tool's `merge`: a
  ledger line (`kind: merge-without-gate`) and the story's failure, since its gate never ran ·
  a red that no attribution names (a report with `rc` strength) → a DIAGNOSIS subagent
  bisects the scope's merges — when the red's kind has a `state_rebuild` in the tests config,
  it runs that command after every checkout and once more after the tree is back, because a
  checkout moves the code and not what the tests read outside the tree; a kind with
  `outside_state` and no rebuild is not bisected, it is attributed as below · `unattributed`, or any red that carries a `reason` (its kind
  reads state outside the tree that nothing rebuilt, so the tool did not ask older code) → a
  DIAGNOSIS subagent names the story from the red's log, the scope's merge diffs and the
  `stories` that touched the file — it never checks older code out to ask it, which is the very
  comparison the tool refused; the story it names takes the `new` route, and one it cannot name
  goes to the ledger and the summary as the close's, with the reason</action>
  <action>**Stories that merged with no test** (`no_test_stories` in that report), judged BY A
  SUBAGENT that did not write the code, one context for all of them: for each, it reads the
  story's diff and the front's one line on why no test was right, and answers one question — if
  the behavior this story changed broke, would some test fail? **Not owed**: nothing in the diff
  changes behavior (configuration, documentation, a rename), or a test that ran in this close
  already catches the regression — and it NAMES that test. **Owed**: the story changed behavior
  and no test would notice — and it names the behavior and the `file:line`. Every "owed" goes
  to the ledger (`kind: no-test`) and the run summary, with the evidence; the owner decides what
  to do with it. It is not a failure of the story: the story merged under the owner's own rule
  ("no test changed, no acceptance file")</action>
  <action>**Which epics actually CLOSED.** For each epic of `epics[]`, read the tracker: it
  closed when EVERY story under it is `done` — the scope's and the ones that were already
  done before the run. A scope that took four stories of an eight-story epic did not close
  it, and the run says so instead of pretending. This list drives the next action and the
  tracker flip in the summary; it is read from the tracker, never inferred from "the scope's
  merges are finished". **The flip is the master's**: each epic that CLOSED goes to
  `epic-<n>: done` on the tracker — the board's own definition of an epic's `done` ("all
  stories in epic completed") — in the same commit as the run's last tracker write; an epic
  that did not close keeps its status; the `epic-<n>-retrospective` row is the
  retrospective's, never touched here. MEASURED (2026-10-04): two masters on one plan, one
  flipped the closed epic and one left it to the owner, because "the tracker flip" named no
  writer</action>
  <action>tea, BY SUBAGENT, ONCE PER EPIC THAT CLOSED, on the same green tree: the plan's
  `epic_close.tea_skills` in order — the traceability skill with `gate_type: epic` over THAT
  epic's stories and their test files, then the test-quality review over the test files that
  epic added — in create/headless mode, every interactive halt answered with the defaults,
  outputs under the tea `test_artifacts` directory, named for the epic.

Per epic and not once per run, because these two report ABOUT an epic: `gate_type: epic`
over the stories of four epics records a scope that is not true, and a quality review whose
subject is a mixture belongs to none of them. An epic the scope only partly covers gets no
tea pass at all — its trace would be a gate decision over an epic still being built.

Routing of what they return: an AC of a merged story with NO covering test → that story's
failure (step 5, re-driven on the reserve front); everything else → the ledger, listed in
the run summary. tea runs here and NOWHERE else — never per story, never per merge</action>
<action>Run summary: stories merged, stories `deferred` with their gaps and the questions
they carry, merges, documented decisions, time; **the run's integration branch, named, with the
union it is waiting for** — an isolated master ends with its own green branch, and merging it
into the project's is the OWNER's step, never this skill's: a master that landed its branch on
the project's would be merging work a second master is still rebasing onto. Two runs with
disjoint story sets union cleanly; the tracker keys they touched are disjoint by the same
check that let them run at once — and the suggestions that are the owner's —
answer the questions the deferred stories carry, flip to `done` in the tracker EVERY epic
of `epics[]` whose stories are ALL done — an epic the scope covers only in part stays
`in-progress`, which is the truth — once no story of it is deferred, and run the
retrospective</action>
<action>**Nothing of the run outlives it but what the owner needs.** After the no-test judgment
and the tea passes — the last work that may still re-drive a story on the reserve — every tree
the run still holds goes through THE GIVE-BACK: the reserve's, a deferred story's (its branch
stays), a dead front's. Then, in `own-worktree` mode only, the master's own stack is taken down
with the same `teardown`; its tree and branch stay, because they are the owner's to union. The
run summary ends with **what stays on disk**, each with its path and why: the master's workspace
and branch, every branch kept unmerged, every stack no teardown took down. A leftover nobody
named is how a machine fills up unnoticed</action>
<action>Run `{workflow.on_complete}` if non-empty</action>
</step>

<step n="8" goal="Transversal — ACTIVE WATCH, heartbeat, state and limits (holds for the whole run)">
  <action>**The tick starts by WRITING, not reading.** Before probing any front, rewrite the
  sidecar with what you already know: `current_wave`, `{story, status, since}` per front,
  `last_heartbeat` with THIS tick's time. It costs one write and is the only thing that
  survives the session's death. The heartbeat line in chat is a REPORT; the file is the
  STATE, and the file is written even when the line does not go out</action>
  <action>**Every wake-up starts at the CLOCK, before any probe and before any line of
  chat**: `sh <abs {workflow.watch_tick_script}> claim <{project-root}/{workflow.watch_tick_lock_dir}>`
  · `0` TICK-DUE → this wake-up IS the round: do the tick below, and END it by arming the
  next one · `75` TICK-ECHO → an older timer, or a notification that arrived out of band
  (a front's completion, a monitor's event): **DROP IT** — no probe, no sidecar rewrite, no
  heartbeat line, zero cost · `3` TICK-ABSENT → there is no clock: arm one and do the round.
  Arming is the same script: `arm <lock> {workflow.watch_minutes} <scope>`, which answers `0`
  armed or `75` TICK-LIVE — a tick is already pending, and that exit is what stops the
  multiplication. The master NEVER decides it is time from memory, from the shape of a
  notification, or from how long the last turn felt</action>
  <action>**The tick's identity is a DEADLINE, not a process.** A live pid is honest proof for
  the test queue, whose owner runs for the whole wait; a tick usually has NO process — it is
  the harness's scheduler — and where it does have one it is exactly the untracked background
  process a front is forbidden to depend on. A pid test would therefore report "dead owner" on
  every check, break the lock every time, and hand the storm back wearing a fix. The lock holds
  `due_at`; it is pending until then, and stale only when nobody answered it within another
  interval. The same reasoning is already written for the fronts below: absence of a process
  does not prove death</action>
  <action>**The bias is to ARM.** Seven clocks is loud and announces itself; ZERO clocks is
  silent and indistinguishable from a healthy quiet run — no probe, no sidecar rewrite, no
  stall detected, a dead front unnoticed for hours. So a lock that cannot be READ as a pending
  tick — absent, corrupt, or a deadline past its grace — is broken and re-armed, never
  honored. Between over-ticking and going blind, the cost is not symmetric</action>
  <action>**The master never waits blind.** On a CLAIMED tick — never on a bare notification,
  never "when the subagent answers" — PROBE every
  live front BY WORKTREE AND GIT EVIDENCE — never through the harness's task mechanism
  (multi-LLM: Claude, Codex and Gemini have different tasks; filesystem and git are the same
  in all of them; task introspection is a bonus, never the basis):
  `<worktree>/{workflow.front_liveness_file}` — time and rung declared by the front itself,
  the PRIMARY evidence ·
  `find <worktree> -newermt '-{watch} minutes' -not -path '*/node_modules/*' -not -path '*/.git/*' -type f | head -5`
  · `git log --oneline -1 <the front's branch>`, read from the master's own tree, and
  `git worktree list --porcelain` for the tree's HEAD — git answers both from any tree of the
  repository, so the probe never needs to run a command inside the front's tree
  · mtime of the gate artifacts (build info, test results). A worktree whose `log -1` shows
  the story's merge-base while its liveness file declares the gate rung is the gate's base
  re-run — the tests tool detaches there to ask the old code one question and puts the branch
  back when the run ends (its log says `base re-run` and `restored`) — never a moved
  branch and never the front's doing</action>
  <action>**An empty probe is NOT evidence of a stalled front until the probe proves it
  works:** run it without the time filter — it must list files; if it lists nothing, the
  defect is the probe's (invalid expression, wrong path), not the front's. Measured: an
  invalid `find` read as "nothing was touched" brought down a whole diagnosis</action>
  <action>Classify and act: **WORKING** (movement inside the window, or a known-long gate
  rung in progress — build+integration takes minutes; quiet there is the normal case, not a
  hang — or a liveness file declaring `suite queued`, which is a front waiting on ANOTHER
  front's lock with a legitimately still tree; measured: a 19-minute queue wait came within
  one minute of `{workflow.stall_threshold_minutes}`, i.e. within a minute of killing a
  healthy front) → nothing, next tick · **SUSPECT** (silence beyond
  `{workflow.stall_threshold_minutes}` outside a long rung) → deep probe: the front's last
  output lines if the harness gives them; otherwise the worktree's latest gate artifact →
  truly stuck = a rung of the ladder (re-drive) · **DEAD** (task gone, terminal error) →
  re-dispatch from the state, BY OVERLAP, never by alternation: the substitute rises on the
  reserve front (own worktree and resource) and the original is terminated only after the
  substitute takes over by report — at no instant two owners of the same tree, nor zero
  owners of the story. The substitute continues the story's BRANCH (its first act), never the
  dead front's tree, which goes through THE GIVE-BACK once the substitute has taken over. Before
  terminating any front, drain whatever is queued for it: a queued message resurrects a
  terminated agent, and what comes back is a second owner</action>
  <action>**INCOMPLETE — the front RETURNED and its text is not one of the three report
  lines.** It is none of the three classifications above: not WORKING (nothing is running),
  not SUSPECT (there is nothing left to probe), not DEAD (there is nothing to kill). A
  turn-based front that says "waiting for the gate" has ENDED, and its words arrived as the
  subagent's RESULT — which is why the silence-based watch never fires on it: the front is
  not quiet, it is gone. Treat it as a protocol abort and never as a verdict on the story:
  with no `failure` line the code was never judged. Act in the SAME tick — re-drive in
  place, same front, same worktree, same branch, resuming at the rung
  `{workflow.front_liveness_file}` names, with the wait command of step 3 spelled out again
  and the two forbidden moves named again. It does NOT consume a rung of step 5's ladder:
  that ladder answers a gate's verdict, and three aborted waits would escalate a healthy
  story to the adversarial lens. Count it in the wave report like every other measured
  defect — a protocol abort that nobody counts is one nobody fixes</action>
  <action>Classified? **Rewrite the sidecar with the classification**, in the same tick.
  Each front's `status` in the file is what the watch decided, never what the front last
  said — and it is what `[C]` will read to know whether to re-dispatch or wait</action>
  <action>**Watching is READING, never talking:** no message to a live front — a message in
  flight changes its course (measured: a "check" from the master made the front stop). The
  only interactions with a front are: dispatch, re-drive, kill+re-dispatch</action>
  <action>**A keepalive does not prove life** — a session dead on an API error keeps a fresh
  beat (measured: 12 min of a 6 s beat with an untouched worktree). Life is proven by
  worktree/git movement; death, by its absence + a sound probe. **Absence of a process does
  not prove death either**: an agent that writes through a tool leaves no process, and the
  tree's mtime stands still while it thinks — which is why the liveness file, with time and
  rung, is the primary evidence, and silence is measured from it</action>
  <action>Heartbeat (a REPORT, distinct from the watch; may share the tick) every
  `heartbeat_minutes` of the plan, EXACTLY one line **per CLAIMED tick** — a dropped echo
  emits nothing, because duplicate heartbeats in the owner's terminal are how the tick storm
  was noticed at all, and a beat per wake-up would keep announcing a defect the claim has
  already removed:
  `hb <hh:mm> · wave <n> · A:<story·state> B:<story·state> · merges <m>/<total> · decisions <d> · deferred <p> · <elapsed>/<cap>h`
  — the `<state>` comes from the watch's CLASSIFICATION (working/verify/suspect/dead·redispatched),
  never from what the front last said</action>
  <action>Hour cap (`max_hours`): finish the merge in progress (never abandon a merge
  halfway), close the wave's partial report, write the state, end with a summary —
  resumable by [C]</action>
</step>

<step n="9" goal="Mode [C] — continue an interrupted run">
  <action>**`last_heartbeat` says how much the master lost when it died.** A lag greater
  than one watch tick is a warning, not an error: probe the fronts by worktree and git
  evidence (the front's liveness file, `git log`, `git status`) before believing any
  `status` in the file, and correct the sidecar with what the evidence says</action>
  <action>**A resumed run arms its own clock, and never inherits one.** The master that died
  may have left a pending tick whose notification will never arrive — the session it was
  scheduled in is gone. `claim` answers `75` for it until its deadline passes, which would
  leave the run blind for up to one interval, so `[C]` calls `arm` and accepts what it gets:
  `0` (fresh, taken over or a broken orphan) is the normal case, and `75` means a tick really
  is pending and due soon, which is also fine. What `[C]` must never do is skip the clock
  because the sidecar's `watch_tick` shows a due time in the future</action>
  <action>**The sidecar's `master_workspace` says WHERE this run lives, and it is read
  before anything else**: a `[C]` that resumes against the active checkout a run that lived in
  its own worktree reads another tree's tracker and another branch's merges, and every
  conclusion after that is about the wrong repository. The worktree gone or now held by
  another run is a HALT with the name, not a re-creation — the work of a run whose tree
  vanished is not recoverable by making a new empty one</action>
  <action>Read the sidecar; check worktrees and tracker against it — and a `done` on the
  tracker only counts as INTEGRATED if `git merge-base --is-ancestor <commit> <integration-branch>`
  confirms it: the tracker says approved, git says it went in; when they diverge, git rules.
  **The give-backs the dead master owed are paid first:** every front whose story has left the
  run (merged, as git confirms, or deferred) and whose `worktree` still exists goes through THE
  GIVE-BACK, every step of which is safe to repeat. **A front this session must re-drive
  continues from its branch**, in a tree the new front can work in — the old tree goes through
  THE GIVE-BACK first (its branch stays); a tree is never what is resumed. MEASURED (2026-10-02):
  a `[C]` that sent a new front into the dead front's tree lost two rounds to a tree nobody could
  work in, while the branch held everything.
  Resume from the exact point — current wave, the grid from where it stopped. A story with a
  recorded and confirmed merge is not redone. A deferred story is not re-dispatched by `[C]`:
  its question is the owner's, for a next run. An OLDER sidecar's `parked:` list (a version
  of this skill that held stories `awaiting-owner`) is read the same way — as deferred
  entries whose `question` is what they carried; nothing is written to that list. **A plan with no
  `tests.config_file` was written before the gate existed, and is not resumed on a guess:**
  HALT and render EXACTLY (the stories that already merged are untouched):
  ```
  plan: <path> · in flight · missing: tests.config_file
  Resolve it first: waves-tests [D], then waves-master-parallelism [A]
  ```
  Every other plan: render EXACTLY:
  ```
  resuming: <scope> · wave <n> · <m>/<total> merges done · deferred <p> · next: <action>
  ```</action>
</step>

<step n="10" goal="Mode [S] — status">
  <action>Read the sidecar and the clock — `sh <abs {workflow.watch_tick_script}> status <lock>`,
  the ONLY verb that changes nothing. `claim` consumes a due tick and `arm` writes one, so
  neither belongs in a mode whose contract is to touch nothing: a `[S]` that claimed would
  silently eat the round the master was about to run</action>
  <action>Render EXACTLY (touch nothing):
  ```
  run <scope> · wave <n>/<W> · A:<story·state> B:<story·state>
  workspace <active | <name>> · branch <name> · lock <project|master>
  clock <pending, due <hh:mm> | DUE, late <n>s | none>
  merges <m>/<total> · decisions <d> · deferred <p> · <elapsed>/<cap>h · last hb <hh:mm>
  ```</action>
</step>

## The give-back — how a tree leaves the run

Three steps, in this order, by whichever session holds the run, the moment what a tree held has
left the run — its last story merged or deferred, a substitute that took over, a close part that
returned. Each step is safe to repeat, because a master can die between any two:

1. **The stack first, by whoever brought it up, inside the tree, while the tree that names it
   still exists** — the plan's `teardown` (the project's `[scm] teardown`, with the unit's
   coordinates: `WAVES_STORY_KEY` the story it was brought up for). The FRONT runs it as its
   last act before `ready-to-merge`: its stack is not needed past that report, and a re-drive
   runs `provision` again, which the recipe keeps idempotent by contract. After `failure` or
   `blocked` the front keeps its stack up for the re-drive it expects; when the master decides
   there will be none — the story deferred, the front substituted, the run ending — it sends the
   front ONE message, take your stack down and end, or runs the recipe itself from its own
   tree, as ONE plain command with the tree named in the environment:
   `env WAVES_STORY_KEY=<story> WAVES_WORKTREE=<tree> sh <tree>/<the recipe> down` — the
   recipe locates its tree by `WAVES_WORKTREE` (the provisioning contract), so it needs no
   change of directory. MEASURED (2026-10-02/03): a master confined to its own tree could not
   change directory into a front's tree to run a script there, while the same recipe ran as that
   one plain command, and the front ran it in its tree without a word. None declared → the
   stack stays, and the run summary names it with its path. One that
   fails → the tree stays too, with `infra debt · <front> · give-back` in the ledger
   (`kind: infra-debt`): a tree removed with its stack up is a stack nobody finds again.
2. **The tree** — `git worktree remove <path>`, plain. git refuses a tree holding changes it
   tracks or files it does not ignore, and names them: read them. A merged story's branch holds
   everything the merge took, so nothing of it is in doubt — `--force`. A deferred or cut-short
   story's leftovers may be work: the tree is kept, with `kept` and the paths in the sidecar and
   the summary.
3. **The branch, only when merged** — `git branch -d <branch>`, never `-D`: git refuses a branch
   the integration branch does not contain, and that refusal IS the rule — a deferred story's
   work, a slice the hour cap cut short, stays, because it is the only copy. A tree may have
   come with a branch of its own besides the story's — the name the harness or the master gave
   it, pointing where the tree was cut. It holds nothing of the story (`git log <the story's
branch>..<it>` is empty) and goes with the tree, `git branch -D <it>`: the one `-D` this
   skill allows. MEASURED (2026-10-02): five such branches outlived their trees in one run.

Then the sidecar, in the same turn: the front's entry gets `released_at`, or `kept` with what
stayed and why. The master's own workspace never goes through it — its branch is the owner's to
union, and in `own-worktree` mode only its stack is taken down, at the close — and nothing is ever
given back in the active checkout. A tree this run did not open is not its to give back.

## State sidecar — closed schema

YAML with exactly: `scope` (copied from the plan) · `epics` (flow list, copied from the plan) ·
`stamp` (the plan's `{stamp}`, `YYYY-MM-DD-HHMM`; the sidecar's own name carries it, and the
field makes the file self-describing) · `epic` (KEPT and filled ONLY when the plan is
single-epic, so sidecars already on disk keep reading) · `plan` (path) · `started` (ISO) ·
`current_wave` ·
`fronts:` (`<letter>: {story, status, since, worktree, branch, released_at | kept}` — `since` is
the ISO instant the front entered its current `status`, and is what separates a front dispatched
two minutes ago from one stalled for three hours; `worktree` the absolute path and `branch` the
front's, written the moment they are known; `released_at` when THE GIVE-BACK removed the tree,
or `kept` with what stayed and why — an entry whose story left the run with neither is a
give-back still owed, which `[C]` pays first) · `merges:` (list of `{story, commit, at}`) ·
`decisions:` (list of
`{at, kind, what, why, reversible_by}` — `kind` is `detail`, `contract-gap` or `atdd-defect`;
a contract-gap entry also names its `exit`, `build` or `defer`, and a deferred one carries
`question`, the owner's, when there is one; the closing summary hands those questions to the
owner) · `parked:` (READ ONLY, never written: an older sidecar's list of
`{story, ac, missing, question, at}`, the stories a previous version of this skill left
`awaiting-owner`; `[C]` reads them as deferred entries and never re-dispatches one) ·
`watch_tick:` (`armed_at` and `due_at` of the clock as pre-flight or the last tick armed it —
the FILE is the lock, this field is the report, so `[S]` can say when the next tick is due and
`[C]` can see whether the dead master left one pending) ·
`master_workspace:` (`mode`, `name`, `path`, `branch`, `base`, `reuse` — copied from the
plan and then CARRIED OUT, so `[C]` knows which tree this run lives in without re-deciding
anything) · `suite_lock:` (`scope` and the `dir` pre-flight resolved — the field a second
master reads to learn whether this machine's scope is binding on it) ·
`harness_wakes` (`true|false`, what pre-flight MEASURED about this harness re-invoking a
session when a background job ends; it decides which wait command every brief carries, so a
session resuming by `[C]` reads it here instead of guessing, and re-measures it when the
field is absent) · `last_heartbeat`. Nothing else; whoever reads it ([C]/[S]) interprets no
field that is not here.

**This file is the ONLY memory of the run that survives the master's death.** It rewrites
itself at every watch tick and every state event — never in a batch at the wave boundary. A
stale sidecar is not cosmetic: it is the amount of run the next session will have to
rediscover on its own.

## Wave checkpoint — as a pause and as a return

In `checkpoint-per-wave` mode, the pause presents the wave report + EXACTLY:
`wave <n> closed. continue? (Enter = yes · [S] status · stop = ends with state saved)`.
The same session resumes with the answer; a dead session resumes through `[C]`.

</workflow>
