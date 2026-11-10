#!/usr/bin/env sh
# suite-wait.sh — a BOUNDED, RETURNING wait for a long command's marker.
#
# Shipped by the waves-core-parallelism skill (canonical copy: the riaworks-waves package,
# skills/waves-core-parallelism/assets/). Project-agnostic on purpose; POSIX sh, no bashisms.
#
# Usage: sh suite-wait.sh <log> [budget-seconds] [liveness-file] [poll-seconds]
#
# Why it exists. A front is a turn-based agent: it exists only while it emits tool calls, and
# text ends its turn. So a wait is safe only when it is a tool call that RETURNS — one that
# always comes back inside the harness's cut and says what to do next. "Wait patiently" is an
# instruction to do nothing, and a front asked to do nothing writes prose and disappears.
# MEASURED: a front told in writing that ending its turn would freeze it armed a log watcher
# instead, was woken once, reported progress, ended the turn again and was lost — the wait was
# a ~25-minute suite behind a 19-minute queue, and the watcher's default life was 5 minutes.
#
# Exit codes — the whole contract, one instruction each:
#   0   `SUITE-DONE rc=0` is in <log>: the suite is GREEN. The tail is printed.
#   1   `SUITE-DONE rc=<n>`, n != 0: the suite is RED. The marker and the tail are printed.
#   75  budget spent, the process is alive and the log is advancing: prints
#       `STILL-RUNNING <elapsed>s <queued|running>` — CALL IT AGAIN, in the same turn.
#   3   `NO-PROGRESS`: <log> never appeared, or it stopped advancing while carrying no marker.
#       The process writing it is GONE (a background launch the harness reaped, a killed job).
#       Relaunch the command; waiting longer cannot help.
#   2   usage.
#
# 75 is reserved for "still running" and is never a suite's own code here: a red suite exits 1
# whatever its rc, and the rc itself is printed rather than encoded.
#
# With <liveness-file>, every cycle overwrites it with `<ISO> suite <state> <elapsed>s`, so the
# wait declares liveness on the front's behalf and a legitimate queue wait is never read as a
# stalled front by the master's watch.
set -u

if [ "$#" -lt 1 ]; then
  echo "usage: sh suite-wait.sh <log> [budget-seconds] [liveness-file] [poll-seconds]" >&2
  exit 2
fi

LOG="$1"
BUDGET="${2:-90}"
LIVENESS="${3:-}"
POLL="${4:-5}"

# The tests tool heartbeats every 30s while it waits for a slot and while a command runs, so a
# log that has not grown in four minutes is not a slow queue — it is a process that no longer
# exists.
STALE=240
# A log that never appears at all: the launch itself failed. Short, because nothing is running.
MISSING_GRACE=30
TAIL_LINES=30

now_s() { date -u +%s; }
iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }

log_size() {
  if [ -f "$LOG" ]; then
    wc -c <"$LOG" | tr -d ' '
  else
    echo 0
  fi
}

# `queued` while the LAST queue line of the log is a wait, `running` when it is an acquisition:
# one command takes several slots in turn (a kind after a kind, a re-run on the base), and it
# is queued again each time it waits for the next. The master's watch reads the same two words
# out of the liveness file.
state() {
  last=""
  if [ -f "$LOG" ]; then
    last=$(grep -E '=== (queue: (still )?waiting|lock acquired)' "$LOG" 2>/dev/null | tail -n 1)
  fi
  case "$last" in
    *"=== lock acquired"*) echo running ;;
    *) echo queued ;;
  esac
}

declare_liveness() {
  [ -n "$LIVENESS" ] || return 0
  printf '%s suite %s %ss\n' "$(iso)" "$1" "$2" >"$LIVENESS" 2>/dev/null || true
}

start=$(now_s)
last_size=$(log_size)
last_change=$start

while :; do
  marker=""
  if [ -f "$LOG" ]; then
    marker=$(grep 'SUITE-DONE rc=' "$LOG" 2>/dev/null | tail -n 1)
  fi
  if [ -n "$marker" ]; then
    rc=$(printf '%s' "$marker" | sed 's/.*SUITE-DONE rc=//' | tr -d ' ')
    tail -n "$TAIL_LINES" "$LOG"
    declare_liveness done 0
    [ "$rc" = "0" ] && exit 0
    exit 1
  fi

  size=$(log_size)
  if [ "$size" != "$last_size" ]; then
    last_size="$size"
    last_change=$(now_s)
  fi

  elapsed=$(($(now_s) - start))
  quiet=$(($(now_s) - last_change))
  declare_liveness "$(state)" "$elapsed"

  if [ ! -f "$LOG" ] && [ "$elapsed" -ge "$MISSING_GRACE" ]; then
    echo "NO-PROGRESS ${elapsed}s — the log was never written: the command was not launched"
    exit 3
  fi
  if [ -f "$LOG" ] && [ "$quiet" -ge "$STALE" ]; then
    echo "NO-PROGRESS ${elapsed}s — the log has not advanced for ${quiet}s and carries no marker:"
    echo "the process writing it is gone. Relaunch it."
    tail -n "$TAIL_LINES" "$LOG"
    exit 3
  fi

  if [ "$elapsed" -ge "$BUDGET" ]; then
    # A budget shorter than the grace above must not report a missing log as progress.
    if [ ! -f "$LOG" ]; then
      echo "NO-PROGRESS ${elapsed}s — the log was never written: the command was not launched"
      exit 3
    fi
    echo "STILL-RUNNING ${elapsed}s $(state)"
    tail -n 3 "$LOG"
    exit 75
  fi

  sleep "$POLL"
done
