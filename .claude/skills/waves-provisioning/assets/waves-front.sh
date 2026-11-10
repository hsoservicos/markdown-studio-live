#!/usr/bin/env sh
# The stack a unit works against — the project's recipe behind the provisioning
# contract. `waves` runs `up` in the unit's worktree right after it is mounted and
# seeded (before any session) and `down` when the unit leaves the run, with these in
# the environment: WAVES_STORY_KEY, WAVES_WORKTREE, WAVES_BRANCH, WAVES_TARGET_BRANCH,
# WAVES_RUN_DIR, WAVES_EPIC, and WAVES_WAVE / WAVES_FRONT in a --plan run.
#
# Fill the TODOs for this project. Keep every step IDEMPOTENT: `up` runs again on a
# resume, and `down` runs on a stack that may already be gone. Exit non-zero from `up`
# only when the unit cannot work — the run parks the story on that exit code.
set -eu

story="${WAVES_STORY_KEY:?WAVES_STORY_KEY is set by the run}"
worktree="${WAVES_WORKTREE:-$PWD}"
# A short, filesystem- and DNS-safe name for this unit's resources (compose project,
# database, port block). The story key is unique per run; keep the prefix short.
name="wv-$(printf '%s' "$story" | tr -c 'a-zA-Z0-9' '-' | cut -c1-24)"

up() {
  # TODO 1 — dependencies: the install step, only if the worktree lacks them.
  #   e.g. [ -d node_modules ] || <install command>
  # TODO 2 — environment: the unit's own env file, aimed at the unit's own services
  #   (its ports, its database name); never the owner's.
  #   e.g. sed "s/^DB_NAME=.*/DB_NAME=$name/" .env.example > .env
  # TODO 3 — data: a database of its own, cloned from the owner's installation or
  #   seeded from fixtures, then this branch's migrations on top.
  # TODO 4 — services: bring the unit's services up under $name, on ports derived
  #   from $name or claimed from a free block; wait until they answer.
  # TODO 5 — smoke: one request or one query that proves the stack answers.
  echo "provisioned $story in $worktree as $name"
}

down() {
  # TODO — reverse of `up`, tolerant of a stack already gone:
  #   stop the services under $name, drop the database, free the ports.
  echo "released $name"
}

status() {
  # TODO — one line: are $name's services up and answering?
  echo "$name: unknown (fill status in waves-front.sh)"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) echo "usage: $0 up|down|status (run by waves with WAVES_* in the environment)" >&2; exit 2 ;;
esac
