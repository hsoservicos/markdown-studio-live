#!/usr/bin/env sh
# watch-tick.sh — the master's watch is ONE CLOCK, and the clock is this script.
#
# Shipped by the waves-core-parallelism skill (canonical copy: the riaworks-waves package,
# skills/waves-core-parallelism/assets/). Project-agnostic on purpose; POSIX sh, no bashisms.
#
# Usage:
#   sh watch-tick.sh arm    <lock-dir> <minutes> [label]   # arm the next tick, if none is pending
#   sh watch-tick.sh claim  <lock-dir>                     # a wake-up arrived: is it the round?
#   sh watch-tick.sh status <lock-dir>                     # read it without changing it
#
# Why it exists. A master exists only while it emits tool calls, so its watch is a timer it
# arms and a wake-up it answers. Nothing in that loop carries identity: a notification from an
# OLDER timer looks exactly like "it is time", so the master arms another, and every extra
# timer multiplies the next round. MEASURED: seven concurrent watch timers in one run — 1, 2,
# 4 over three rounds — waking the master several times per window and filling the owner's
# terminal with duplicate heartbeats. The cure is not vigilance, it is identity: the lock IS
# the live tick, so the master consults the lock and never its own recollection of having
# armed one.
#
# The identity is a DEADLINE, not a process. For the suite queue a live pid is honest proof:
# the owner runs for the whole wait. A tick usually has NO process — it is the harness's
# scheduler — and where it does have one it is the untracked background process a front is
# forbidden to depend on. So a pid test would report "dead owner" on every check, break the
# lock every time, and hand back the storm wearing a fix. What proves a tick is pending is
# that its due time has not arrived.
#
# THE BIAS IS TO ARM. Seven clocks is loud and announces itself; zero clocks is silent and
# looks exactly like a healthy quiet run — no probe, no sidecar rewrite, no stall detected, a
# dead front unnoticed for hours. So anything this script cannot read as a pending tick (a
# missing lock, a corrupt one, a deadline long past with nobody having answered it) is broken
# and re-armed, never honored.
#
# Exit codes — the whole contract:
#   arm    0  armed. Prints TICK-ARMED (fresh), TICK-TAKEOVER (the pending tick was already
#             due and unanswered) or TICK-ORPHAN-BROKEN (its deadline is past the grace, or
#             its lock was unreadable), with the new due time.
#   arm   75  a tick IS pending and not yet due: prints TICK-LIVE and the seconds to go.
#             Do NOT arm another one. This is the exit that stops the multiplication.
#   claim  0  TICK-DUE: this wake-up IS the round. The lock is released, so the master runs
#             its tick and then arms the next one.
#   claim 75  TICK-ECHO: a tick is pending and not due — the wake-up came from an older timer
#             or out of band. Drop it: no probe, no sidecar rewrite, no heartbeat line.
#   claim  3  TICK-ABSENT: no clock is running at all. Arm one.
#   status 0  always; prints the state.
#   *      2  usage.
set -u

usage() {
  echo "usage: sh watch-tick.sh arm <lock-dir> <minutes> [label] | claim <lock-dir> | status <lock-dir>" >&2
  exit 2
}

[ "$#" -ge 2 ] || usage
VERB="$1"
LOCK="$2"

now_s() { date -u +%s; }
iso() { date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "+${1}s"; }

OWNER="$LOCK/owner"

# `<label> <pid> <armed_at> <due_at>` — read field by field so a truncated or hand-edited
# file degrades to "unreadable", which the bias above turns into a re-arm.
field() { awk -v n="$1" '{print $n}' "$OWNER" 2>/dev/null; }
label_of() { field 1; }
armed_of() { field 3; }
due_of() { field 4; }

is_int() { case "${1:-}" in '' | *[!0-9]*) return 1 ;; *) return 0 ;; esac; }

write_owner() {
  # atomic: write beside the file, then rename over it
  tmp="$LOCK/.owner.$$"
  printf '%s %s %s %s\n' "$LABEL" "$$" "$1" "$2" >"$tmp" || return 1
  mv "$tmp" "$OWNER"
}

case "$VERB" in
  arm)
    [ "$#" -ge 3 ] || usage
    MINUTES="$3"
    LABEL="${4:-watch}"
    is_int "$MINUTES" && [ "$MINUTES" -ge 1 ] || usage
    INTERVAL=$((MINUTES * 60))
    # A tick nobody answered within one further interval is not pending, it is orphaned: the
    # master that armed it died, or its notification never arrived.
    GRACE=$INTERVAL
    mkdir -p "$(dirname "$LOCK")" 2>/dev/null || true

    now=$(now_s)
    due=$((now + INTERVAL))

    if mkdir "$LOCK" 2>/dev/null; then
      write_owner "$now" "$due" || exit 1
      echo "TICK-ARMED $LABEL due=$(iso "$due") in ${INTERVAL}s"
      exit 0
    fi

    held_due=$(due_of)
    if ! is_int "$held_due"; then
      write_owner "$now" "$due" || exit 1
      echo "TICK-ORPHAN-BROKEN unreadable-lock · re-armed $LABEL due=$(iso "$due")"
      exit 0
    fi
    if [ "$now" -lt "$held_due" ]; then
      echo "TICK-LIVE $(label_of) due=$(iso "$held_due") in $((held_due - now))s — not arming"
      exit 75
    fi
    late=$((now - held_due))
    write_owner "$now" "$due" || exit 1
    if [ "$late" -ge "$GRACE" ]; then
      echo "TICK-ORPHAN-BROKEN late=${late}s · re-armed $LABEL due=$(iso "$due")"
    else
      echo "TICK-TAKEOVER late=${late}s · re-armed $LABEL due=$(iso "$due")"
    fi
    exit 0
    ;;

  claim)
    if [ ! -d "$LOCK" ]; then
      echo "TICK-ABSENT — no clock is running; arm one"
      exit 3
    fi
    held_due=$(due_of)
    if ! is_int "$held_due"; then
      echo "TICK-ABSENT unreadable-lock — treat as no clock; arm one"
      exit 3
    fi
    now=$(now_s)
    if [ "$now" -lt "$held_due" ]; then
      echo "TICK-ECHO $(label_of) due=$(iso "$held_due") in $((held_due - now))s — drop this wake-up"
      exit 75
    fi
    lbl=$(label_of)
    rm -rf "$LOCK"
    echo "TICK-DUE ${lbl:-watch} late=$((now - held_due))s — run the tick, then arm the next"
    exit 0
    ;;

  status)
    if [ ! -d "$LOCK" ]; then
      echo "no clock"
      exit 0
    fi
    held_due=$(due_of)
    if ! is_int "$held_due"; then
      echo "clock: unreadable lock at $LOCK"
      exit 0
    fi
    now=$(now_s)
    if [ "$now" -lt "$held_due" ]; then
      echo "clock: $(label_of) pending · armed=$(iso "$(armed_of)") due=$(iso "$held_due") in $((held_due - now))s"
    else
      echo "clock: $(label_of) DUE · due=$(iso "$held_due") late=$((now - held_due))s"
    fi
    exit 0
    ;;

  *) usage ;;
esac
