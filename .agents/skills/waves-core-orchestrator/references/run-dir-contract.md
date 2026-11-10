# The run directory is the interface

The dashboard, the status command, the run list, the attach path and the stop
path do not talk to whatever is driving a run. They read files. The dashboard's
own reader says so: everything it shows comes from run-directory artifacts, and
runs it launches itself are observed exactly like runs started from a plain
shell.

That is the whole reason an LLM can hold this control loop without any of those
tools changing. Whatever writes these artifacts _is_ an engine as far as every
reader is concerned. It is also the whole risk: a writer that stops emitting one
of them does not fail. Everything keeps appearing to work, and the dashboard
shows a run that no longer exists in that state. A regression test pins the
contract for exactly this reason — the failure mode is silence.

You do not write any of these yourself; the verbs and the supervisor do. You
need to know what they are because when the dashboard says something surprising,
this table tells you which artifact is lying and why.

---

## `engine.pid` — proof the run is alive

**Written by** the supervisor, at run start, never deleted.
**Read by** the liveness check behind every run listing.

Its content is a pid _plus the process create-time_, not a bare pid. The
create-time is what stops a recycled pid belonging to some unrelated process
from making a dead run look alive — an identity check, not just an existence
check.

Liveness is three-valued: alive, dead, or unknown. Unknown is a real answer and
not a failure — a run on another host can never be probed, and saying "unknown"
is honest where saying "dead" would be a lie.

**If it stops being written:** every run in the picker reads as interrupted, even
while it is actively working. Nothing errors. This is also why no verb can own
the pid: a verb is a short-lived process, so between two verbs there would be no
live pid at all and the run would flicker into "interrupted" on every poll.

## `state.json` — what the run is

**Written by** verbs, always inside the run-directory lock.
**Read by** everything, including you through `unit state`.

Replaced atomically, so a reader never sees a torn file. Atomic replacement does
not prevent a _lost update_, though: two writers that each read the same state
and write back serially lose the first one's work. That is what the lock is for,
and why every mutating verb holds it across the whole read-modify-write rather
than just the write.

The status a human sees is derived, in this order: finished, then paused, then
stopped, then crashed, and only then liveness — running if alive, interrupted if
dead, unknown otherwise. The order is load-bearing. A deliberate stop and a
recorded crash both leave a dead pid, so both are checked _before_ liveness;
otherwise a clean stop would display as a crash.

`paused` is not stored. A run is paused exactly when `paused_reason` is set,
which is why `unit pause` refuses an empty reason: a pause with no reason would
be a run that is not paused.

**If it stops being written:** phases freeze at their last recorded value while
work continues underneath. This is the worst artifact to lose, because it is the
one that looks most like it is working.

## `journal.jsonl` — what happened, and why

**Written by** verbs and the supervisor, append-only.
**Read by** the dashboard, and by every relaunched orchestrator session.

Each line is one JSON object with a `ts`, a `kind`, and whatever fields the
writer added. The dashboard renders **any** kind generically, which is why
`unit journal` lets you choose one freely. Only three kinds are read
structurally: `session-start` and `session-end` — matched by their `task_id` to
work out which session is currently open — and `decision-pending`, which the
dashboard treats as a prompt awaiting an answer when it is the _last_ entry.

Entries written while a session's log is active also carry `log_task` and
`log_pos`: which pane log the entry belongs to and how many bytes into it the
entry happened. That is what lets a reader jump from a journal line to the
moment in the log it describes — and it is why `ts`, `kind`, `log_task` and
`log_pos` are refused as `--field` names. A caller-supplied value would silently
replace the real one and the entry would point at the wrong moment.

**If it stops being written:** the dashboard's activity view goes quiet, the
session/task correlation breaks, and — the part that costs you — a relaunched
session inherits no reasoning. The journal is the orchestrator's memory across
relaunches. Losing it does not stop the run; it makes the run unable to explain
itself, which is the same thing a few hours later.

## `logs/<task-id>.log` — the raw session output

**Written by** the multiplexer, piping the session's pane straight to the file.
**Read by** the dashboard's log view, replayed through a terminal emulator.

Raw terminal bytes, escape sequences and all. Any writer works, because the
reader emulates a terminal rather than parsing text. This is the artifact you
read when you need to know what a session actually did, as opposed to what its
result claims.

**If it stops being written:** the log view is empty and there is no evidence
left for any junction — you would be judging sessions on their status codes
alone, which is precisely what the deterministic engine already does.

## `ATTENTION` and `stop-request.json` — the human channel

**Written by** the attention and notification verbs; the stop request by whoever
asks the run to stop.
**Read by** the dashboard banner and the supervisor's wait loop.

Two directions on one channel. `ATTENTION` is you speaking outward: `unit
attention` overwrites it, the configured notification appends a timestamped line
to it. `stop-request.json` is the graceful-stop channel inward: a request to
wind down cleanly rather than be killed.

Graceful is not a synonym for immediate. The design has the supervisor decline
to kill anything on a graceful stop — it tells the orchestrator to stop taking
new stories, finish or cleanly park the one in hand, and end the turn. A clean
stop is worth more than a fast one, because a killed run leaves work in a state
somebody has to reconstruct. A hard stop, by contrast, does kill, and the run
records that it was stopped rather than that it crashed.

**If they stop being written:** a human's request to stop is silently ignored,
and messages meant for a person go nowhere. Neither failure announces itself.

---

## Also in the directory

`crash.txt` holds the traceback of an escaped exception, written by the
supervisor alongside the crash flags in `state.json`, so the dashboard can show
a crashed run rather than a mysteriously dead one.

`state.lock` is the run-directory lock. It is created on demand and **never
deleted** — removing it would let a second process create a fresh file and lock
_that_, leaving two holders each convinced it owns the run. If a verb ever comes
back `lock-timeout`, this is the file involved; see `error-kinds.md`.

`tasks/<task-id>/` is where the design puts per-session artifacts: the session
result, a heartbeat carrying remaining time and stall-nudge state, and lifecycle
records. **This subtree is not written yet** — the watcher and the execution
verbs that produce it are still being built. Do not plan on reading it.
