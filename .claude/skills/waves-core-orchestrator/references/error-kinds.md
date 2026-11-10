# When a verb fails

A failed verb writes one JSON document to **stderr**, leaves stdout empty, and
exits non-zero:

```json
{
  "schema_version": 1,
  "ok": false,
  "kind": "state-conflict",
  "error": "run is already paused at 'escalation': …"
}
```

Two things are guaranteed and both matter. **The `kind` comes from a closed
vocabulary** — seven values, listed below — so you route on it rather than
reading prose. And **a failed verb changed nothing**: mutation happens inside
the run-directory lock, all-or-nothing, so there is never a half-applied state
to clean up. If the call failed, it did not happen.

You will never get a Python traceback. A traceback is unactionable noise to a
caller that cannot patch the tool, so the boundary that renders every failure
swallows them deliberately.

The `error` string is for your reasoning and for the journal. Never
pattern-match on it — its wording is not a contract, and the `kind` is.

---

## `invalid-args` — the call was malformed

Your call, not the world. Something you typed does not parse or does not name a
real option: a `--field` that is not `key=value`, an unknown mode, an unknown
phase or pause stage, a required text argument left empty, a story key missing
where the verb needs one, a malformed run id.

**Do:** read the message — these verbs name the legal values when they refuse,
so the fix is usually in the error itself. Correct the call and repeat it.

**Do not:** retry the same call, and do not work around it by doing the thing in
a shell. A rejected argument is a rejected argument; the same call fails the
same way, and the shell route crosses the hard boundary.

This kind is never a reason to journal a decision. Nothing was decided; a
command was mistyped.

## `not-found` — the thing you named does not exist

The run, the story, the task, the board entry or the ledger file is absent. This
is a fact about the world, not a malformed call, and the two are deliberately
separate kinds because the remedies are completely different.

**Do:** work out which of two situations you are in. Either you named the wrong
thing — a story key that is not on the board, a run id that is not this run — in
which case re-read `unit state` and use what it says. Or the thing genuinely
does not exist yet: no sprint board because planning has not run, no task
because nothing opened the story, no ledger because nothing has been deferred.
The second case is often a legitimate answer to your question rather than a
problem, and the right response is to record it and adjust the plan.

**Do not:** create the missing artifact yourself. A board or a ledger you write
by hand is outside every guarantee the verbs provide.

## `illegal-transition` — the phase move is not in the state machine

You asked to move a story somewhere it cannot go from where it is. The message
names the current phase and every legal target.

**Do:** treat this as evidence that _your_ model of the story is stale, not that
the state machine is wrong. It is the single source of truth for legal moves.
Re-read `unit state`, find out where the story actually is — very often another
turn, or a session's own effects, already moved it — and decide again from
there.

**Do not:** hunt for a sequence of intermediate moves that gets you to the
target you originally wanted. If the direct move is illegal, the path usually
is too, and forcing it produces a run whose recorded history is fiction.

## `lock-timeout` — someone held the run directory too long

Every mutating verb holds an exclusive lock across its read-modify-write, for
milliseconds. You run verbs one at a time. So this should never happen, and the
tool treats it as an anomaly rather than routine contention — thirty seconds of
waiting is already far outside normal.

**Do:** retry once, in case you caught a genuinely slow write. If it recurs,
stop assuming the run directory is healthy: something is wedged holding the
lock, and every future mutation will fail the same way. That is a systemic
failure, and if you cannot clear it, it is a legitimate pause — name the wedged
lock as the cause.

**Do not:** loop on it. A retry storm against a wedged writer produces nothing
but a long journal of failures.

## `git` — a git operation failed

A verb that touches the repository could not complete: a rollback, a commit
preservation, a reference that could not be created.

**Do:** read the message, because git errors are specific and usually
actionable, then find out what state the repository is actually in before doing
anything else. You may read git freely — `status`, `log`, `diff` — and you
should, because the interesting question is what survived. Since the verb was
all-or-nothing, the tree is in the state it was before the call; the failure is
about what git refused, not about a partial mutation.

One case is the exception to "all-or-nothing" above, and it matters enough to
name: `close` sets a story's terminal phase before it merges the unit's branch
back, on purpose, so a merge-back that fails leaves the story sitting at its
terminal phase with its worktree still mounted rather than half-moved (the
journal says `unit-merge-failed`). That is not a stuck run — it is a retryable
one. Once the cause the message names is cleared, call `close` again on the same
story with the same outcome; it finds the phase already where it should be and
resumes the integration instead of refusing the call. Do not treat this `git`
failure as a dead end that only a human can resolve.

What the message says decides who clears the cause:

- **Another process holding the target checkout's index lock.** The tool has
  already waited it out several times before telling you. Wait a minute and
  `close` again; if it persists, the message names the lock file — a lock that
  outlives every retry is a process still running git there, or one that died
  holding it, and removing it is the owner's call.
- **Something only the owner can change** — a content conflict with the target,
  a hook or signing policy that refused the commit, the owner's own uncommitted
  work in the way. Park the story (it stays committed and retryable), carry on
  with work that does not depend on it, and tell the owner exactly what to do.
  If everything left depends on it, see the one exception in `judgment.md`.

A story an older version of the tool escalated this way (`escalated` after
`story-done`, its worktree still mounted) is reopened by the same `close` call;
if the owner already merged its branch by hand, `close` records that and merges
nothing twice.

**Do not:** finish the operation by hand in the shell. This is the exact case
the hard boundary exists for, and it is also the case where doing so is most
tempting. If the work is genuinely at risk and no verb can protect it, that is
the destroy-work pause — case 2 of the closed list.

## `state-conflict` — the run's state contradicts the request

The broadest kind, and it covers two flavours worth separating.

_Unreadable_: `state.json` or the sprint board exists but will not parse. That
is corruption, not a decision you can route around. Nothing you do next will
work until the file is repaired, and repairing state files is not yours — this
is systemic failure.

_Contradicted_: the state is fine and refuses your request on its merits. The
run is already paused, so a second pause is declined and the first reason
preserved. A rollback was asked for on a story with no recorded baseline, or
aimed at the shared checkout while `scm.rollback_on_failure` is off — treat
that one as the engine's manual-recovery pause and leave the tree for the
operator. A ledger entry could not be appended, or the id you tried to close is
missing or already done.

**Do:** distinguish the two, because they are opposite situations. A
contradicted request means the world already moved — usually in a direction you
would have wanted — and the fix is to re-read `unit state` and take the world's
version. An unreadable file means the world is broken.

**Do not:** overwrite a refusal by another route. When a pause already exists,
the recorded reason is the true one; a second pause replacing it would erase the
record of why the run stopped, which is the one thing the pause exists to
preserve.

## `env` — the environment is at fault, and the catch-all

Two distinct situations arrive under this one kind, and knowing that is the
difference between routing well and routing badly.

_A real environment fault_: the project's configuration cannot be read, the
project layout cannot be resolved. Nothing about your call was wrong and no
retry helps.

_An unmodelled failure_: `env` is also what the boundary emits for any exception
the tool did not anticipate. From the caller's side those are indistinguishable
from the environment misbehaving, which is why they share a kind — but the
message keeps the exception's **type name**, and that type name is the only
actionable part. Read it.

**Do:** read the message before deciding anything, because the two flavours have
different answers. A missing or unreadable configuration file is a broken world
and a legitimate systemic pause. An unexpected exception type from one verb,
while every other verb still works, is a bug in that verb — route around it if
you can do the work another way, journal it precisely enough that it can be
fixed (the verb, the arguments, the type name), and continue. Do not pause a
whole run over one broken verb if the run can still make progress.

**Do not:** treat every `env` as fatal, and do not treat any of them as your
fault. Retrying an identical call is almost never useful here.

---

## The pattern that matters more than any single kind

One failure is an event. The same failure on consecutive stories is a
**diagnosis**, and it is the only way systemic failure ever announces itself —
nothing in the system raises an alarm for "this run is no longer accomplishing
anything". `env`, `lock-timeout` and the unreadable flavour of `state-conflict`
are the three most likely to repeat.

Notice the repetition. Name the repeated cause. That is the difference between a
pause a human can act on in a minute and a pause that costs them an hour of
reconstruction.
