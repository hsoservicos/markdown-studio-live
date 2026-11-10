# The tests config and the gate's files — format 1

Paths inside the files are repository-relative, with `/`. A glob uses `**` for any number of
directories, `*` and `?` inside one; a path with no wildcard names that file or everything below
that directory.

Who writes what:

| file                             | written by                                    | when                        |
| -------------------------------- | --------------------------------------------- | --------------------------- |
| `_waves/tests_memory.toml`       | `waves-tests [D]`, approved by the owner      | before planning, committed  |
| `<memory_dir>/atdd/<story>.toml` | `tests_memory.py record --expect red`, wave 0 | once per story, at the base |
| `.waves/gate/<story>.json`       | `tests_memory.py gate`                        | each gate run (run state)   |
| `.waves/gate/merged.jsonl`       | `tests_memory.py merge`                       | each merge (run state)      |
| `.waves/gate/epic-<name>.json`   | `tests_memory.py epic`                        | the epic's close            |
| `.waves/gate/{logs,junit}/`      | every run                                     | runner output, never stdout |

`.waves/` is run state and is never versioned. A story changes neither the config nor anything under
`<memory_dir>`: the gate reads the config from the story's merge-base, and reports any change to
either as a `violation` the story is sent back for — the ruler does not move while it measures.

## `_waves/tests_memory.toml`

```toml
format = 1

[story]
scope = "story"          # "story": the tests the story touched (default) · "full": the whole suite

[epic]
full_suite = true        # the epic's close runs every kind's full command

[spec]                   # the headings a front documents under, in the project's language
preexisting_heading = "<heading of the section that documents a red already red at the base, fixed>"
deleted_heading = "<heading of the section that documents a test file the story removed, and why>"

# One per set of test files run by one command.
[[kind]]
id = "<name>"
type = "unit|integration|api|e2e|other"   # what the tests USE, never the tool that runs them
glob = ["<glob of this kind's test files>"]
story_run = "<command> {files}"          # exactly one of {files} {dirs} {names}
full_run = "<command that runs every test of this kind>"
report = "<the runner's JUnit option> {report}"   # optional
capacity = 1             # how many fronts may run this TYPE at once: an integer, or "all" (no queue)
each = false             # true: one invocation per file even with a report (a runner that takes ONE path)
outside_state = false    # true: the tests also read state OUTSIDE the tree that the code moves forward
# state_rebuild = "<command that rebuilds that state from the tree as it stands>"   # optional; implies outside_state
```

| placeholder | the command receives                        | fits, for example                          |
| ----------- | ------------------------------------------- | ------------------------------------------ |
| `{files}`   | the test files' paths                       | runners that take a file                   |
| `{dirs}`    | the directories of those files, once each   | runners that take a package or a directory |
| `{names}`   | the file names without extension, once each | runners that filter by class or name       |

`{report}`, in `report`, is where the runner writes JUnit XML; the option is appended to the command.
With a report the gate knows which CASE failed and runs a batch per invocation; without one the unit
is the file (or directory, or name) and the gate runs one invocation per unit. `each = true` keeps the
report and still runs one invocation per unit — for a runner that takes ONE path per call and ignores
the rest without a word, or one that needs a prefix per unit (write it in the command: with `each`
the placeholder holds a single unit). `run` says when a file it handed the runner came back with no
case (`warning: no case reported for …`): that is how `[D]` finds such a runner, with two files. It
also prints how long the command took. `each` matters again under a budget (`gate --budget`): a
runner writes its report at the END of an invocation, so a cut loses every case of that invocation —
a red included; with `each = true` a cut loses only the file it fell on.

`outside_state` and `state_rebuild` are about what the tool does when it asks OLD code a question
(see "The gate re-runs a red on the story's base" below, and the epic's bisection). A checkout moves
the code and nothing else. When a kind's tests also read state kept outside the tree — a schema the
code migrates, data or an artifact the code generates — and the code moves that state forward, the
old code meets the state the new code left: it fails for that, and a red is pinned on the wrong
commit. `state_rebuild` is the project's command that rebuilds that state from the tree as it stands
(reset, then build — a command that only moves the state forward cannot take it back to an older
commit); it is enough on its own, and implies `outside_state`. The tool runs it, in the tree and
under the kind's queue slot, after every move to an older commit and once more after the branch is
back. It must not change tracked files: what it writes at an old commit is dropped with the old
code's writes, and what it writes after the restore would read as the run's evidence.
`outside_state = true` with no `state_rebuild` says the state exists and nothing rebuilds it: the
tool never asks the old code about that kind, and its reds are `unattributed` — blocking, with a
`reason`, and named by a diagnosis instead.

`check` also reads HEAD: a kind whose glob matches no file, and a file that matches MORE THAN ONE
kind (the first wins silently — a browser test filed under `unit` runs on the wrong queue) are
warnings naming the kinds and the file; make the globs disjoint, or list the narrower kind first.

`capacity` is a property of the TYPE: kinds of one type must agree. The queue is one slot directory
per unit of capacity under the lock root, one lock root per machine; `"all"` means no queue for the
type (every front has its own of everything it uses). The number is the project's —
it says what the fronts SHARE. A machine may lower it for itself, never raise it, in its own
`.waves/loop/policy.toml` (per machine, outside git):

```toml
[tests.capacity]
e2e = 1                  # this machine runs one browser suite at a time, whatever the project allows
```

`[spec]` names the two sections the gate looks up in a story's spec (a heading containing the text,
case-insensitive, and its body up to the next heading). When the table is absent the tool reads
`Pre-existing reds fixed` and `Test files removed`; `[D]` proposes them in the project's language.
The gate prints the heading it expects with every red that owes one, so a front never guesses it.

## `gate` — what a story's gate runs

The diff of the story, from its merge-base to the commit it is being judged at, gives the files it
created or changed (deleted files are not run). The files that match a kind's `glob`, plus the
story's acceptance files, form the set. The acceptance files are read from wave 0's record at the
merge-base (`<memory_dir>/atdd/<story>.toml`); `--atdd` adds to them, and is all there is when no
record was taken. Every case that record holds must PASS at the gate — skipped, missing or red is
class `atdd`. A test file the story deleted (one that existed at the merge-base and was not moved —
renames are followed) is class `deleted` and owed to the spec. `scope = "full"` runs each kind's
`full_run` instead. No file and no acceptance: verdict `no-tests`, registered for the epic's judge.

## `.waves/gate/<story>.json`

```json
{
  "format": 1,
  "story": "<key>",
  "commit": "<the commit judged>",
  "base": "<the integration branch commit>",
  "merge_base": "<where the story left it>",
  "digest": "<sha256 of the story's files' content>",
  "verdict": "green|red|no-tests|inconclusive",
  "reason": "<why red, when it is not a red test; or what the budget cut>",
  "scope": "story|full",
  "measured_at": "<ISO instant>",
  "strength": "junit|rc",
  "ran": { "<kind id>": ["<file>", "…"] },
  "atdd": ["<file>"],
  "atdd_recorded_red": true,
  "commands": [{ "command": "…", "rc": 0, "log": "…", "log_sha256": "…", "report": "…", "report_sha256": "…", "cut": false }],
  "cases": { "<file>::<case>": "passed|failure|error|skipped" },
  "reds": [
    {
      "kind": "…",
      "file": "…",
      "cases": ["…"],
      "class": "new|preexisting|deleted|atdd|untouched|unattributed|runner|clock",
      "reason": "<only when unattributed: why the base was not asked>"
    }
  ],
  "violations": ["<a path the story must not change>"],
  "owed": [{ "file": "<what the spec must still document>", "class": "preexisting|deleted" }],
  "files": ["<every path the story changed>"],
  "written": ["<a tracked file the run changed, or a file it created, in the tree>"],
  "seal": "<HMAC of this file's content, with this machine's gate key>"
}
```

`written` is what the run itself wrote in the tree — a matrix, a snapshot, a report the project
versions — left exactly as the run left it: the gate names it and never refuses or discards it. It
is the story's evidence, and the front decides what the project does with it: commit it on top of
the gated commit (one commit, nothing else in it) and report THAT commit, or restore it when the
project does not version those files. The tool's own run state (`.waves/`) is never in it.

Classes of a red: `runner` (the test command did not run as a test runner: it failed and wrote no
report although one is configured, or the shell could not find it — the environment's or the
command's, never a test's; no re-run on the base, and the front is told NOT to change the project's
dependency or build files to make it run, but to report `blocked`), `atdd` (an acceptance case that
did not PASS — red, skipped or missing from the run, measured against wave 0's record; never
excused), `new` (passes on the story's base, or the test file was created by the story: the story
broke it), `preexisting` (already red on the story's base, in a file the story touched: the story
is sent back all the same — fix it and document it under `[spec] preexisting_heading`), `deleted`
(a test file that existed at the story's base and is gone — not moved — from its diff: owed to the
spec under `[spec] deleted_heading`, blocking until that section names it), `untouched` (only under
`scope = "full"`: red on the base in a file the story did not touch — reported, not blocking),
`unattributed` (red here, and the base could not be asked: the kind declares `outside_state` with
no `state_rebuild`, or the rebuild failed at the base — `reason` says which; blocking, and the
story treats it as its own),
`clock` (the command was CUT at the rung's budget — `gate --budget <seconds>` of running time,
queue waits and the tool's own base re-runs not counted; what those units would have said is
unknown). A report with `clock` reds and nothing else red has the verdict `inconclusive`: never
green, and not red either — the runner's exit code was the cut's (`124`), the `commands` entry says
`cut: true`.

`seal` is what makes the report the tool's and not a file somebody typed: an HMAC-SHA256 of the report
(every field but `seal`) under a key the tool creates on first use in the main checkout's
`.waves/gate.key`. `merge` refuses a report whose seal does not match, one written on a machine with no
key, and one whose logs or JUnit no longer hash to what `commands` recorded. It is a barrier against
the mistake and the shortcut — not a secret from a session that goes looking for the key.

The gate re-runs a red on the story's base by checking the base out in the SAME worktree
(detached, restored afterwards; a journal survives a kill), so the dependencies and the environment
of the worktree apply to the old code as they do to the new. It takes the kind's queue slot FIRST
and detaches only then, so the worktree is off its branch while the old code runs and never while
it waits; the log says `=== base re-run: HEAD detached at <base> …` before and `=== restored
<branch> ===` after — whoever reads that worktree's git in between is reading the re-run, not a
moved branch. What the run had written by then goes aside (a stash, the tool's own) and comes back
with the branch; what the OLD code writes while detached is dropped, never left in the tree as if
the story had produced it. A kind with a `state_rebuild` has it run after the checkout of the base
and again after the branch is back (`<label>-<kind>-state-<at>.log` under the logs); a rebuild that
fails after the branch is back exits `3`, like any failed restore, and the journal keeps it: the
next run of the tool retries the rebuild first and refuses to measure until it passes.

`owed` carries across runs until the spec names each file under the section of its class. The gate
reads the sections from the spec given by `--spec`: a heading containing the configured text, and
its body up to the next heading.

## `merge`

`merge --story <key> --head <commit> --branch <the front's branch> --report <the story's json>`
merges `<commit>` into the current branch, and refuses (exit 1) unless the branch's tip IS that
commit (otherwise the front moved on after the gate: the story goes back), the report's verdict is
`green` or `no-tests`, nothing is `owed`, and the report proves the commit: the same commit, or —
after a rebase — the same `digest`, the story's own files having the same content; a commit on top
of the gated one that changes nothing but what the report lists as `written` (the evidence the
front committed after the gate) proves the same story, through a rebase as well. `--branch` is
optional to the parser and mandatory to the core's master: without it the tool cannot tell the
commit the front delivered from an older one that happens to hold a green. An `inconclusive`
report is refused too — unless the caller says `--accept-inconclusive`, which merges on what did
run (there is nothing red in it, or the verdict would be `red` and the flag changes nothing) and
records the acceptance; the epic's close then measures that story for real. It appends to
`.waves/gate/merged.jsonl`:
`{story, head, merge_commit, verdict, no_tests, inconclusive, cut, files, merged_at}`.

## `epic`

`epic --base <the commit before the epic> --name <name>` runs every kind's `full_run` (when
`[epic] full_suite` is on) at the current commit — or only the kinds named by `--kind <id>`
(repeatable): a close spread over several trees, each with a stack of its own, runs a subset in
each, with its own `--name` and the same `--report-dir`, and the caller reads the parts; which
kinds go together is the caller's arithmetic, from the capacities — and classifies each red against `--base`: `new`
(passes there, or did not exist), `old-touched` (red there too, in a file a story of the epic
changed — that story owes the fix), `old-untouched` (red there too, nobody touched it — reported
only), `unattributed` (the commit before the epic could not be asked: the kind declares
`outside_state` with no `state_rebuild`, or the rebuild failed there — `reason` says which),
`runner` (the command did not run as a test runner). Each `new` red is traced to the first merge of
the registry that makes it fail (`first_bad_story`), one checkout per step under the kind's slot,
the kind's `state_rebuild` run at each step and once after the branch is back; a `new` red of a
kind nothing rebuilds is not traced, and carries a `reason` instead. A red with a `reason` is the
diagnosis's to attribute, from its log and the merges' diffs (`stories` names who touched the
file) — never by running old code against the state the new code left. The report lists
`no_test_stories` — the stories that merged with `no-tests` — for an independent session to judge.
Exit 1 when any red is `new`, `old-touched`, `unattributed` or `runner`.

```json
{
  "format": 1,
  "epic": "<name>",
  "base": "<the commit before the epic>",
  "head": "<the commit judged>",
  "measured_at": "<ISO instant>",
  "ran_full_suite": true,
  "kinds": ["<the kinds this invocation ran: every kind, or the ones --kind named>"],
  "verdict": "green|red",
  "reds": [
    {
      "kind": "…",
      "file": "…",
      "cases": ["…"],
      "stories": ["<key>"],
      "class": "new|old-touched|old-untouched|unattributed|runner",
      "first_bad_story": "<key>",
      "reason": "<only when the tool could not attribute it: why>"
    }
  ],
  "unregistered_merges": ["<a first-parent merge that did not go through `merge`>"],
  "no_test_stories": [{ "story": "<key>", "files": ["…"], "commit": "…", "head": "…" }],
  "inconclusive_merges": [{ "story": "<key>", "cut": ["<the units the story's gate never finished>"] }],
  "commands": [{ "command": "…", "rc": 0, "log": "…", "log_sha256": "…" }],
  "written": ["<what the suite wrote in the tree, left there for the caller to commit or restore>"]
}
```

A merge on the integration branch that is not in `merged.jsonl` — a story merged by hand — turns the
epic red: its gate never ran.

## `<memory_dir>/atdd/<story>.toml`

Written by `record`: the story's acceptance cases, taken out of skip and run at the base, before
any of the story's code exists. Each case is expected `failure`; a case already `passed` there is an
acceptance criterion the base already satisfies (a regression guard), and the wave-0 report names it.

```toml
format = 1
story = "<story key>"
ref = "<the base commit>"
expect = "red"
strength = "junit|rc"
recorded_at = "<ISO instant>"

[[case]]
id = "<file or class>::<case name>"
result = "failure|error|passed|skipped"
```

## Case ids

`<file or classname>::<name>`, taken from the JUnit `testcase` element (`file` when the runner
writes it, else `classname`). Without a report the id is the unit (file, directory or name) and the
result is the command's exit code. A dotted class name is spelled from the RUNNER's root, which
differs between the main checkout (where wave 0 records) and a front's worktree (where the gate
runs); the gate therefore matches a recorded case to a run case by `(test file, case name)`, mapping
the class name to a file by its path suffix or its unique stem, never by the raw string.
