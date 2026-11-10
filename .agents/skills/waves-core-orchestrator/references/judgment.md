# The junctions

This is the reason the LLM control loop exists. Everything else is plumbing.

The deterministic engine routes every outcome through a fixed table and numeric
bounds: budget left, retry; budget gone, defer; anything the table did not
anticipate, pause and wait for a person. That is not a bad table — it is a
table, and a table cannot read a failing log, form a theory, run a diagnostic,
or weigh one defect against another. Where it runs out, it stops the run.

Your job at a junction is to do what the table cannot: look at the evidence,
decide, record why, and keep the run moving. What follows is every junction the
design names, with what stays deterministic and what is yours.

**The division, in one sentence:** the tool measures and acts; you decide. Every
measurement below is a fact somebody else computed. None of them is a verdict.

---

## The vocabulary a verification hands you

A verification outcome is not a boolean. It carries:

- `ok` — passed or not.
- `reason` — what failed, in words.
- `severity` — `""`, `"CRITICAL"` or `"PREFERENCE"`. Set only when the failure
  is _not_ retryable; an empty severity means the outcome is retryable.
- `fixable` — the failure carries concrete evidence, such as failing command
  output, that a repair pass can act on.
- `env_fault` — the failure is the run environment's, not the story's.
- `contradiction` — a session deliberately contradicted a state the run had
  already established.

Those last three are the interesting ones, and each gets a junction below.

An executor session's own result is separate and coarser: a status of
`completed`, `stalled`, `timeout`, `crashed` or `over_budget`, plus an
`env_fault` flag with the log evidence that set it. A session can complete and
still fail verification; a session can fail to complete and have done most of
the work. Never collapse the two.

---

## Verify failed, `fixable` is true

**What the engine does:** if the attempt budget has room, retry — dispatch a
_fresh_ session with the failure as feedback. If the budget is gone, defer the
story (or, mid re-drive of a human-resolved escalation, pause rather than
silently file the human's correction as deferred work).

**What stays deterministic for you:** the verification itself, and the tree. You
never decide whether the commands passed; you decide what their failing means.

**What you do:** read the evidence before deciding anything. `fixable` means
there _is_ evidence — failing output naming a file, a line, an assertion — and
that evidence usually distinguishes three very different situations that the
budget arithmetic cannot tell apart:

_The session misunderstood something small._ A wrong boundary condition, a
missed case, an inverted check. This is the case repair was invented for. Prefer
resuming the session that already holds the context over paying for a fresh one
that must re-read everything to reach the same understanding — the design's
resume path exists precisely so that preferring repair costs nothing. Under the
engine, a repair pass cost the same as a reimplementation, so a repair that
_worked_ could be thrown away on baseline arithmetic rather than on its merits.
Do not repeat that.

_The session was building the wrong thing._ The evidence contradicts the intent
rather than falling short of it. Repair is the wrong move here — feeding a
correction into a session convinced it is finished tends to produce argument,
not correction. Start over with the misunderstanding named explicitly.

_The failure is not the story's._ A pre-existing failure the story merely
exposed, or a check that was already red before this work started. No number of
repair passes fixes that, and each one costs a session. Record the finding,
route the residue to the deferred-work ledger, and judge the story on what it
was actually asked to do.

The budget is a signal, not a verdict. A third attempt whose evidence is clearly
narrowing on the same defect is worth more than a first attempt that has learned
nothing — and the reverse is also true: three attempts producing three different
theories mean the story's intent is unclear, and the honest move is to stop
attempting and say so.

**Do not pause for this.** Ever. A failed verification is the most ordinary
event in the loop.

---

## Verify failed, `env_fault` is true

**What the engine does:** pause, and deliberately does not charge the attempt
budget — the environment's fault is not the story's, every story shares the same
commands, and re-arming resets the budget.

**What you do:** the non-charging half is right and you should keep it — never
count an environment failure against a story. The pausing half is where you
differ, and the distinction that matters is _scope_.

An environment fault that no session can fix and that blocks everything — the
process multiplexer is unavailable, git cannot spawn — is a legitimate pause,
and it is case 3 of the closed list below. Nothing you do next will work, so
continuing only burns budget.

But `env_fault` is also set for narrower things: a verify command that is not
found or not executable. That is a real fault and no repair session will fix it,
yet it is not necessarily fatal to the run. Read the evidence: does it name one
missing tool, or a broken world? If one command is missing and the rest of the
verification is meaningful, you can still form a judgment about the story —
record explicitly that you did so on partial evidence, name the missing command
so the human fixing it does not have to hunt, and move on. If the whole
verification is inert, you are not judging anything; that is systemic failure
and pausing is honest.

The trap here is a run that keeps going through a broken environment,
"succeeding" story after story on verifications that never actually ran. Notice
the repetition. A second story failing for the same environmental cause is the
signal; a third is you having ignored it.

---

## `contradiction`

**What the engine does:** pause with both sides named. Its reasoning is sound as
far as it goes — a review that revokes a sign-off the run already recorded at
dev time is not a state another session can reconcile, so dispatching another
session would just produce a third opinion.

**What you do:** the engine is right that another _session_ cannot settle it. It
is wrong that only a human can. A contradiction is two claims about the same
work, and you can read both, plus the artifact they disagree about.

Go to the evidence, not the claims. The work is on disk: the diff, the tests,
the spec. One of these is usually true:

_One side is simply wrong,_ and the code says which. Record the finding with the
evidence that settles it, believe the correct side, and proceed. Say plainly in
the journal that you overrode a claim and what convinced you — this is exactly
the entry a relaunched session needs, because the contradiction will still be
visible in the state and your successor will otherwise re-litigate it.

_They are answering different questions._ Dev signed off on the acceptance
criteria; review objected to something outside them. Both can be right. The
objection may be real and still not be this story's — that is what the
deferred-work ledger is for.

_The spec is silent and the planning artifacts are not._ Review blocks because
something is "not declared in the intent", and it is declared — in the epic, the
PRD, the project context. This is not a disagreement at all. It is a
transcription gap, and it is yours to close.

Close it in the **spec**, not in the next prompt. Reviewers read the spec; they
do not read the epics. A target passed in the dev prompt settles the round in
front of you and leaves the next one untouched, so the same block returns, and
the story goes around again having learned nothing. Find the requirement, quote
it into the section of the spec the reviewer actually opens, cite where it came
from as `file:line`, journal what you moved and from where — then dispatch the
repair. Do this on the **first** occurrence; recognising it on the second is a
correct diagnosis one round late, and the round is measured in hours.

_They genuinely disagree about intent,_ and nothing on disk settles it — not the
spec, not the epic, not the PRD. Now the ambiguity is a product question, and no
reading of the code will resolve it. This is case 1 of the closed list: pause at
stage `escalation`, naming both positions and the exact line of intent that is
silent, so the human resolving it has everything they need in the pause reason.

Only that last branch pauses, and it pauses because it is a product decision
that surfaced _as_ a contradiction — not because contradictions pause. The
branch above it is the one to reach for first: silence in the spec is only a
product question once you have looked everywhere the project writes intent down.

---

## A session died without leaving a result

**What the engine does:** if the budget has room, retry with a reason of "dev
session timeout" or similar; if not, defer. The status alone drives the branch —
`stalled`, `timeout`, `crashed`, `over_budget` route the same way.

**What you do:** those four statuses describe very different situations and the
work already on disk is invisible to the status. A session that timed out at 95%
and one that crashed on its first tool call both come back "not completed".
Retrying the first from scratch throws away most of a story.

So look before you decide. You have the pane log, the diff against the baseline,
the commits above it, and the spec's own status — read them and ask what
actually happened, not what the status is called:

- Is there real work on disk? Then the next dispatch builds on it, and its
  prompt says so and lists what is there. Resuming beats restarting whenever the
  session's own context is still reachable.
- Did it die _before_ doing anything? Then a fresh attempt is genuinely fresh
  and cheap, and the interesting question is why it died — because if the answer
  is environmental, the next attempt dies the same way.
- Is `over_budget` a story that is too large, or a session that went in circles?
  The log distinguishes them, and the answers are opposite: split the work, or
  re-dispatch with a much narrower instruction.
- Did the watcher vanish rather than the session? The design's `await` reports
  this as its own wake reason precisely so you do not confuse "nobody recorded
  the outcome" with "there was no outcome". Judge from the log and the diff.

**Do not pause for this.** A dead session is the most ordinary failure there is.

---

## Review budget exhausted

**What the engine does:** plateau-defer — skip the story, keep the run alive —
unless the story is mid re-drive of a human-resolved escalation, in which case
it re-escalates rather than silently filing the human's correction as deferred
work.

**What you do:** the defer is often right, and when it is, do it without
ceremony. What the counter cannot see is whether the cycles were _converging_.
Read the review findings across cycles:

Findings that got smaller and more specific each round mean the work is close,
and one more targeted pass is worth more than a defer that leaves an
almost-finished story on the board. Findings that stayed the same size, or moved
to a new area every round, mean the loop is not converging and further cycles
buy nothing — defer, and record _what_ did not converge so the deferred entry is
actionable rather than a shrug.

Findings that are real but not this story's belong in the ledger, and the story
can close on its own merits. A budget spent arguing about work that was never in
scope is a budget wasted, and the counter cannot tell you that; only reading can.

The re-drive exception is not yours to relax: a story carrying a human's
resolution must never be quietly downgraded to deferred work. If that re-drive
does not converge, the human needs to see it again.

**Do not pause for an ordinary exhausted budget.** Defer and continue.

---

## A red epic boundary

**What the engine does:** at a boundary it journals, optionally fires a
notification, optionally runs an automatic ledger sweep, and — if policy says so
— pauses unconditionally. It does not evaluate whether the epic is actually in
good shape; it has no way to.

**What you do:** treat the boundary as the one moment when the question is the
epic rather than the story. A boundary is red when the epic's stories are
individually done and the whole is not sound: a check that only fails when the
work is combined, an integration nobody's story owned, a residue that each story
correctly deferred and that nobody picked up.

That is a judgment about scope, and there are three honest answers. Open
remediation work now, while the context is live and the cost is lowest — usually
right when the defect is small and clearly attributable. File it to the
deferred-work ledger with enough detail to be actionable later — right when the
work is real but belongs to a story that does not exist yet. Or continue, having
recorded explicitly that the boundary is red and why you judged it acceptable —
right when the residue is genuinely minor, and dishonest if you have not looked.

Whichever you choose, the journal entry is the deliverable. "Epic boundary
passed" is worthless; "epic boundary red on two integration checks, both
attributable to work deferred from the third story, filed to the ledger as one
bundle" is a record a human can act on months later.

**A red boundary is not a pause.** It is the highest-value junction in the run,
because it is the only one where anyone looks at the whole.

---

## The three causes that do pause

`unit pause` is the only thing that stops a run, and a stopped run may sit for
hours before anyone notices. The list is closed.

**1. A genuinely ambiguous product decision.** The intent is silent or
self-contradictory on something that changes what gets built, and no amount of
reading the code settles it, because the answer is a preference nobody has
recorded. Pause at stage `escalation` — that stage is what the interactive
resolution flow dispatches on, and a pause filed under any other stage produces
a halted run that flow refuses to open. Name both readings and quote the exact
line of intent that is silent. The human resolving it should not have to
reconstruct the question.

The test for this case is: _would a competent person on this project have to
choose?_ If the answer is discoverable in the code, the spec, the history, or
the planning artifacts the spec was cut from — the epic, the PRD, the project
context — it is not a product decision and you should go and discover it.

The planning artifacts belong in that list because that is where the answer was
the time this cost real hours: two consecutive reviews blocked on a target the
epic declared and the spec never inherited. Discovering it is only half. A
requirement you found in an epic and used only to write a prompt is still absent
from the spec, and the next reviewer will block on it again — so transcribe it,
with its `file:line`, and say in the journal that you did. Writing to a spec is
inside your boundary: the boundary is on state the _run_ owns, and a planning
artifact is the project's.

**2. A risk of destroying work.** Something in front of you would discard real
work and you cannot establish that it is safe. Preserving work is deterministic
and never delegated to you — rollback, commit preservation and worktree
snapshots are git operations, not judgments — so this pause is for the case
where even the safe path is unclear. Unrecoverable is the key word. Work that
can be reconstructed is not this case; work that exists nowhere else is.

**3. Systemic failure.** Consecutive stories failing for the same cause that is
not the story's: a service the tests depend on is down, credentials have
expired, the disk is full, run-level spend has passed anything the remaining
work is worth. Nothing raises an error — that is what makes this case hard —
but continuing burns budget and commits nothing.

This one is yours alone; no signal in the system announces it. It is visible
only in the pattern across stories, which means the only way to catch it is to
notice that you have seen this failure before. **Name the repeated cause in the
pause reason.** A pause that says "third story failed" is nearly useless; one
that says "third consecutive story failed at the same fixture setup, same error,
none of them touched that code" is a diagnosis, and a human can act on it in a
minute.

Also on the closed list, though neither is your call: the relaunch budget
running out, which means the orchestrator itself is broken, and a human asking
for a stop. One more, narrow and yours, is spelled out under
"What never pauses": an integration only the owner can complete, when every
story left depends on it.

## What never pauses

A failed verification. A failed review. An exhausted review budget. A red epic
boundary. A session that died without a result. A dev/review contradiction that
the evidence can settle.

Each of those is a junction: decide, act, and journal why. And when a story owes
an action only a human can perform, park _the story_ — never the run. A story
waiting on a human must not block the stories behind it.

The one exception is the story everything left depends on. A committed story
whose merge-back failed for a cause only the owner can clear — a content
conflict with the target, a hook or signing policy, their own work in the way
(the `git` kind in `error-kinds.md`) — is parked like any other. But when every
story still in scope depends on it, parking it leaves nothing to run, and
`finish` refuses a run holding a committed story that never merged. That is a
pause at stage `story-gate`: name the story, the merge-back's exact failure, and
the one thing the owner has to do; once they have, `close` it again. Check the
dependency before concluding it: a story whose prerequisites are all integrated
is not blocked, and a transient cause (another process's index lock) is a wait
and a second `close`, never a pause. Measured on 2026-09-23: with no rule for
this case, the orchestrator had to pick between "never pause for one story" and
"finish when no work is left", and neither was true.
