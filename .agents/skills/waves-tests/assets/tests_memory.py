#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""The tests gate — deterministic, no LLM, no knowledge of any language or runner.

Shipped by the ``waves-tests`` skill; called by the loop's verbs, by ``waves-core-parallelism``'s
master and by a front that wants a queued run. It knows git, the project's own test commands
(read from ``_waves/tests_memory.toml``, written with the owner) and the JUnit XML those commands
can emit. Everything specific to a project is DATA in that file; nothing here parses a language.

What it decides is arithmetic, never judgment: which test files a story touched, which ones ran,
which cases are red, whether a red already failed on the story's base, whether the spec documents
what the story owes. It MEASURES and writes a report; whoever called it routes.

Subcommands (``--help`` on each):

* ``check``  — the config is well-formed.
* ``gate``   — a story's tests, at its ready-to-merge commit: the test files the story created or
  changed plus its acceptance (ATDD) files, run under each kind's lock. ANY red sends the story
  back; each red is classified against the story's base so the front is told what happened.
* ``merge``  — merge a story's commit, and refuse unless a green report matches it (the same
  commit, or the same content of the story's files after a rebase).
* ``epic``   — the whole tree, kind by kind, at an epic's boundary; each red is classified
  against the commit before the epic and attributed to a story; stories that merged with no test
  are packed for an independent judge.
* ``run``    — one kind's command over the given files, queued under the kind's lock.
* ``record`` — run acceptance files and record each case's result at the base.

Every long subcommand prints a heartbeat at least every 30 s, so a log a front waits on keeps
advancing; with ``--marker`` it ends the log with ``SUITE-DONE rc=<n>``, the one line the core's
``suite-wait.sh`` waits for. The runner's own output goes to a log file, never to stdout: on a
red, stdout carries the last lines of that log and nothing more.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import shlex
import shutil
import signal
import subprocess  # nosec B404 — this tool's job is running git and the project's own test commands
import sys
import threading
import time
import xml.etree.ElementTree as ET  # nosec B405 — parses JUnit the project's own runner just wrote
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:
    sys.stderr.write("error: Python 3.11+ is required (stdlib `tomllib` not found)\n")
    raise SystemExit(3) from None

FORMAT = 1
DEFAULT_CONFIG = "_waves/tests_memory.toml"
DEFAULT_MEMORY_DIR = "_waves/tests"
DEFAULT_REPORT_DIR = ".waves/gate"
# The machine's own policy (per machine, outside git): `[tests.capacity] <type> = n` may LOWER a
# type's capacity below the project's, never raise it — the project's number says what is shared.
MACHINE_POLICY = ".waves/loop/policy.toml"
TYPES = ("unit", "integration", "api", "e2e", "other")
# `capacity = "all"`: every front has its own of everything this type uses — no queue for it
ALL = 0
PLACEHOLDERS = ("{files}", "{dirs}", "{names}")
SCOPES = ("story", "full")
# The spec sections a story documents under. The owner's, in the project's language, in the
# config's `[spec]`; these are only what the tool reads when the config says nothing.
DEFAULT_PREEXISTING_HEADING = "Pre-existing reds fixed"
DEFAULT_DELETED_HEADING = "Test files removed"
OWED_CLASSES = ("preexisting", "deleted")
REGISTRY = "merged.jsonl"
HEARTBEAT_SECONDS = 30
TAIL_LINES = 20
# Windows `cmd` refuses a command line past 8191 characters; batches stay well under it.
MAX_COMMAND = 7000

EXIT_OK = 0
EXIT_NEGATIVE = 1  # a well-formed "no": a red, a refused merge, a malformed config
EXIT_USAGE = 2
EXIT_RESTORE = 3


class Refusal(Exception):
    """A precondition not met — reported, never worked around."""


# ------------------------------------------------------------------------------------ git


def _git_env() -> dict[str, str]:
    env = dict(os.environ)
    env.update({"LC_ALL": "C", "GIT_OPTIONAL_LOCKS": "0"})
    return env


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    proc = subprocess.run(  # nosec B603 B607 — git, argv form, no shell
        ["git", "-C", str(repo), "-c", "core.quotepath=off", *args],
        capture_output=True,
        env=_git_env(),
        check=False,
    )
    if check and proc.returncode != 0:
        raise Refusal(
            f"git {' '.join(args)} failed: {proc.stderr.decode(errors='replace').strip()}"
        )
    return proc


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).stdout.decode("utf-8", errors="replace").strip()


def rev(repo: Path, ref: str) -> str:
    return git_text(repo, "rev-parse", "--verify", f"{ref}^{{commit}}")


def toplevel(start: Path) -> Path:
    return Path(git_text(start, "rev-parse", "--show-toplevel"))


def main_checkout(repo: Path) -> Path:
    """The checkout that owns the shared ``.git`` — one place for a whole machine's locks."""
    common = Path(git_text(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"))
    return common.parent if common.name == ".git" else repo


def blob(repo: Path, ref: str, path: str) -> str | None:
    proc = git(repo, "rev-parse", "--verify", "--quiet", f"{ref}:{path}", check=False)
    return proc.stdout.decode().strip() or None if proc.returncode == 0 else None


def show(repo: Path, ref: str, path: str) -> bytes | None:
    proc = git(repo, "show", f"{ref}:{path}", check=False)
    return proc.stdout if proc.returncode == 0 else None


def files_at(repo: Path, ref: str) -> list[str]:
    out = git(repo, "ls-tree", "-r", "-z", "--name-only", ref).stdout
    return [p for p in out.decode("utf-8", errors="replace").split("\0") if p]


def changed(repo: Path, base: str, head: str) -> list[tuple[str, str]]:
    """``(status, path)`` for every file ``head`` changed since its merge-base with ``base``.
    Renames are split into a deletion and an addition: a moved test is a test at its new path."""
    out = git(repo, "diff", "--no-renames", "--name-status", "-z", f"{base}...{head}").stdout
    parts = [p for p in out.decode("utf-8", errors="replace").split("\0") if p]
    return [(parts[i][0], parts[i + 1]) for i in range(0, len(parts) - 1, 2)]


def renamed_from(repo: Path, base: str, head: str) -> set[str]:
    """The OLD paths of the files ``head`` renamed since its merge-base with ``base``: a moved
    test is a test at its new path, not a deleted one."""
    out = git(
        repo, "diff", "-M", "--diff-filter=R", "--name-status", "-z", f"{base}...{head}"
    ).stdout
    parts = [p for p in out.decode("utf-8", errors="replace").split("\0") if p]
    # `R<score>`, old path, new path
    return {parts[i + 1] for i in range(0, len(parts) - 2, 3) if parts[i].startswith("R")}


def _status(repo: Path, untracked: str) -> list[tuple[str, str]]:
    """``(XY, path)`` per entry of ``git status``, the tool's own run state left out."""
    out = git(
        repo,
        "status",
        "--porcelain=v1",
        "-z",
        f"--untracked-files={untracked}",
        "--",
        ".",
        f":(exclude){DEFAULT_REPORT_DIR.split('/')[0]}",
    ).stdout
    entries = [e for e in out.decode("utf-8", errors="replace").split("\0") if e]
    return [(e[:2], e[3:]) for e in entries if len(e) > 3]


def tracked_dirty(repo: Path) -> list[str]:
    return [f"{xy} {path}" for xy, path in _status(repo, "no")]


def untracked(repo: Path) -> set[str]:
    """Files git neither tracks nor ignores."""
    return {path for xy, path in _status(repo, "all") if xy == "??"}


def written_since(repo: Path, untracked_before: set[str]) -> list[str]:
    """What a run wrote in the tree: every tracked file it changed and every file it created that
    git does not ignore. The tree held no tracked change when the run started — the gate and the
    epic refuse to start otherwise — so every tracked change now is the run's."""
    changed_now = {path for _, path in _status(repo, "no")}
    return sorted(changed_now | (untracked(repo) - untracked_before))


# ---------------------------------------------------------------------------------- globs


def _glob_regex(pattern: str) -> re.Pattern[str]:
    out = ""
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            out += ".*"
            i += 2
        elif c == "*":
            out += "[^/]*"
            i += 1
        elif c == "?":
            out += "[^/]"
            i += 1
        else:
            out += re.escape(c)
            i += 1
    return re.compile(out + r"\Z")


_GLOB_CACHE: dict[str, re.Pattern[str]] = {}


def glob_match(pattern: str, path: str) -> bool:
    """``**`` spans directories, ``*`` and ``?`` do not; a pattern without a wildcard also
    matches everything below it, so ``tests/unit`` names a directory of tests."""
    pattern = pattern.strip().rstrip("/")
    if not any(ch in pattern for ch in "*?"):
        return path == pattern or path.startswith(pattern + "/")
    if pattern not in _GLOB_CACHE:
        _GLOB_CACHE[pattern] = _glob_regex(pattern)
    return bool(_GLOB_CACHE[pattern].match(path))


def any_match(patterns: list[str], path: str) -> bool:
    return any(glob_match(p, path) for p in patterns)


# --------------------------------------------------------------------------------- config


@dataclass
class Kind:
    id: str
    type: str
    glob: list[str]
    story_run: str
    full_run: str
    report: str = ""
    capacity: int = 1
    # one invocation per unit even with a report: for a runner that takes ONE path per call
    each: bool = False
    # the tests also read state OUTSIDE the tree that the code moves forward — a schema it
    # migrates, data or an artifact it generates — and checking an older commit out does not
    # take that state back with it
    outside_state: bool = False
    # the project's command that rebuilds that state from the tree as it stands; run after the
    # tool moves the tree to another commit and again after it puts the branch back
    state_rebuild: str = ""

    @property
    def placeholder(self) -> str:
        found = [p for p in PLACEHOLDERS if p in self.story_run]
        return found[0] if len(found) == 1 else ""

    @property
    def unaskable(self) -> bool:
        """Its tests read state outside the tree that no command rebuilds: the old code would
        meet the state the NEW code left, so what it answers says nothing about the old code.
        MEASURED (2026-10-04): a close whose stories had migrated a database re-ran the old code
        against the migrated schema and attributed its reds to the wrong story."""
        return self.outside_state and not self.state_rebuild


@dataclass
class Config:
    scope: str = "story"
    epic_full_suite: bool = True
    kinds: list[Kind] = field(default_factory=list)
    preexisting_heading: str = DEFAULT_PREEXISTING_HEADING
    deleted_heading: str = DEFAULT_DELETED_HEADING

    def heading(self, owed_class: str) -> str:
        return self.deleted_heading if owed_class == "deleted" else self.preexisting_heading

    def kind_of(self, path: str) -> Kind | None:
        for kind in self.kinds:
            if any_match(kind.glob, path):
                return kind
        return None

    def kind(self, kind_id: str) -> Kind:
        for kind in self.kinds:
            if kind.id == kind_id:
                return kind
        raise Refusal(f"no kind {kind_id!r} in the config")


def _capacity(raw: Any) -> int:
    """An integer >= 1, ``ALL`` for the string "all", -1 for anything else (refused by `check`)."""
    if isinstance(raw, bool):
        return -1
    if isinstance(raw, int):
        return raw if raw >= 1 else -1
    if isinstance(raw, str) and raw.strip().lower() == "all":
        return ALL
    return -1


def parse_config(text: str, where: str) -> Config:
    try:
        doc = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise Refusal(f"{where} does not parse: {error}") from error
    kinds = []
    for raw in doc.get("kind", []):
        rebuild = raw.get("state_rebuild", "")
        rebuild = rebuild.strip() if isinstance(rebuild, str) else ""
        kinds.append(
            Kind(
                id=str(raw.get("id", "")),
                type=str(raw.get("type", "")),
                glob=[str(g) for g in raw.get("glob", [])],
                story_run=str(raw.get("story_run", "")),
                full_run=str(raw.get("full_run", "")),
                report=str(raw.get("report", "")),
                capacity=_capacity(raw.get("capacity", 1)),
                each=bool(raw.get("each", False)),
                # a rebuild command says there is such state; `outside_state` alone says there
                # is and that nothing rebuilds it
                outside_state=raw.get("outside_state") is True or bool(rebuild),
                state_rebuild=rebuild,
            )
        )
    spec = doc.get("spec", {}) if isinstance(doc.get("spec", {}), dict) else {}
    return Config(
        scope=str(doc.get("story", {}).get("scope", "story")),
        epic_full_suite=bool(doc.get("epic", {}).get("full_suite", True)),
        kinds=kinds,
        preexisting_heading=str(spec.get("preexisting_heading", DEFAULT_PREEXISTING_HEADING)),
        deleted_heading=str(spec.get("deleted_heading", DEFAULT_DELETED_HEADING)),
    )


def config_errors(doc: dict[str, Any], config: Config) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if doc.get("format") != FORMAT:
        errors.append(f"format is {doc.get('format')!r}, this tool reads {FORMAT}")
    if config.scope not in SCOPES:
        errors.append(f"[story] scope must be one of {SCOPES}, not {config.scope!r}")
    if not config.kinds:
        errors.append("no [[kind]] — the gate has nothing to run")
    ids: set[str] = set()
    capacity_of: dict[str, int] = {}
    raws = [r if isinstance(r, dict) else {} for r in doc.get("kind", [])]
    for kind, raw in zip(config.kinds, raws):
        label = f"kind {kind.id!r}"
        if "outside_state" in raw and not isinstance(raw["outside_state"], bool):
            errors.append(f"{label}: outside_state must be true or false")
        rebuild = raw.get("state_rebuild")
        if rebuild is not None and (not isinstance(rebuild, str) or not rebuild.strip()):
            errors.append(f"{label}: state_rebuild must be a command (leave it out when none)")
        if raw.get("outside_state") is False and kind.state_rebuild:
            errors.append(
                f"{label}: state_rebuild is set but outside_state is false — a rebuild says "
                "there IS state outside the tree"
            )
        if not kind.id or kind.id in ids:
            errors.append(f"{label}: id is empty or repeated")
        ids.add(kind.id)
        if kind.type not in TYPES:
            errors.append(f"{label}: type must be one of {TYPES}, not {kind.type!r}")
        if not kind.glob:
            errors.append(f"{label}: no glob")
        found = [p for p in PLACEHOLDERS if p in kind.story_run]
        if len(found) != 1:
            errors.append(f"{label}: story_run needs exactly one of {PLACEHOLDERS}, has {found}")
        if config.epic_full_suite and not kind.full_run:
            errors.append(f"{label}: full_run is empty but [epic] full_suite is on")
        if kind.report and "{report}" not in kind.report:
            errors.append(f"{label}: report has no {{report}}")
        if kind.capacity < 0:
            errors.append(f'{label}: capacity must be an integer >= 1, or "all"')
        elif capacity_of.setdefault(kind.type, kind.capacity) != kind.capacity:
            errors.append(f"{label}: kinds of type {kind.type} disagree about capacity")
    for i, first in enumerate(config.kinds):
        for second in config.kinds[i + 1 :]:
            if set(first.glob) & set(second.glob):
                warnings.append(f"kinds {first.id!r} and {second.id!r} share a glob; first wins")
    headings = {
        "preexisting_heading": config.preexisting_heading.strip(),
        "deleted_heading": config.deleted_heading.strip(),
    }
    for key, heading in headings.items():
        if not heading:
            errors.append(f"[spec] {key} is empty — the gate could not find the section")
    if len({h.lower() for h in headings.values() if h}) < len([h for h in headings.values() if h]):
        errors.append(
            "[spec] preexisting_heading and deleted_heading are the same — the gate could not tell "
            "the sections apart"
        )
    return errors, warnings


def machine_capacities(repo: Path) -> dict[str, int]:
    """``type -> capacity`` from this machine's policy, `[tests.capacity]`. Read on every run;
    a missing or malformed file is no override."""
    path = main_checkout(repo) / MACHINE_POLICY
    if not path.is_file():
        return {}
    try:
        doc = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError):
        return {}
    table = doc.get("tests", {}).get("capacity", {}) if isinstance(doc.get("tests"), dict) else {}
    if not isinstance(table, dict):
        return {}
    return {str(k): v for k, v in table.items() if isinstance(v, int) and v >= 1}


def effective_capacity(kind: Kind, machine: dict[str, int]) -> int:
    """The smaller of the project's capacity and the machine's: a machine protects itself, and
    no machine raises what the owner declared shared. ``ALL`` (no queue) yields to any number
    the machine gives."""
    if kind.capacity == ALL:
        return machine.get(kind.type, ALL)
    return min(kind.capacity, machine.get(kind.type, kind.capacity))


def load_config(repo: Path, config_path: str, ref: str | None) -> Config:
    """The config as it stood at ``ref`` (the working tree when ``ref`` is None). The gate reads
    it from the story's merge-base: a story cannot move the ruler that judges it."""
    if ref is None:
        path = repo / config_path
        data = path.read_bytes() if path.is_file() else None
    else:
        data = show(repo, ref, config_path)
    if data is None:
        raise Refusal(f"{config_path} is missing — run waves-tests [D] and commit it")
    return parse_config(data.decode("utf-8"), config_path)


# ------------------------------------------------------------------------------ commands


def shell_join(paths: list[str]) -> str:
    if os.name == "nt":
        return subprocess.list2cmdline(paths)
    return " ".join(shlex.quote(p) for p in paths)


def units_for(kind: Kind, files: list[str]) -> list[str]:
    """What the command receives for ``files``: the files, their directories or their names."""
    if kind.placeholder == "{dirs}":
        return sorted({str(PurePosixPath(f).parent) for f in files})
    if kind.placeholder == "{names}":
        return sorted({PurePosixPath(f).stem for f in files})
    return sorted(files)


def render(kind: Kind, template: str, units: list[str], report_path: str | None) -> str:
    command = template
    if kind.placeholder and kind.placeholder in command:
        command = command.replace(kind.placeholder, shell_join(units))
    if kind.report and report_path:
        command = f"{command} {kind.report.replace('{report}', shell_join([report_path]))}"
    return command


def batches(kind: Kind, units: list[str]) -> list[list[str]]:
    out: list[list[str]] = []
    current: list[str] = []
    for unit in units:
        trial = current + [unit]
        if current and len(render(kind, kind.story_run, trial, None)) > MAX_COMMAND:
            out.append(current)
            current = [unit]
        else:
            current = trial
    if current:
        out.append(current)
    return out


def say(line: str) -> None:
    sys.stdout.write(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {line}\n")
    sys.stdout.flush()


class Heartbeat:
    """Prints a line every ``HEARTBEAT_SECONDS`` while a long step runs, so a waiting log
    keeps advancing (the core's wait gives up on a log silent for four minutes)."""

    def __init__(self, label: str) -> None:
        self.label = label
        self.started = time.monotonic()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._beat, daemon=True)

    def _beat(self) -> None:
        interval = float(os.environ.get("WAVES_TESTS_HEARTBEAT", HEARTBEAT_SECONDS))
        while not self._stop.wait(interval):
            say(f"... {self.label} {int(time.monotonic() - self.started)}s")

    def __enter__(self) -> Heartbeat:
        self._thread.start()
        return self

    def __exit__(self, *_: object) -> None:
        self._stop.set()


def tail(path: Path, lines: int = TAIL_LINES) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    return text.splitlines()[-lines:]


def _inside(path: Path, root: Path) -> bool:
    try:
        return path.resolve().is_relative_to(root.resolve())
    except OSError:
        return False


def project_env(repo: Path) -> dict[str, str]:
    """The environment the project's commands run in: the one this tool was started from.

    `uv run <script>` runs this script in an ephemeral environment of its own and puts it first
    on ``PATH``, so a project's ``python3 -m pytest`` would resolve to an empty interpreter and
    fail with "No module named pytest" (measured in a real run). That environment is recognised
    by what every launch shares — never by the name uv gives its directory today: `uv run`
    leaves ``UV_RUN_RECURSION_DEPTH`` in the environment, ``VIRTUAL_ENV`` is this interpreter's
    prefix, and that prefix is outside the repository (a project's own environment, started
    from inside the repository, is the project's and stays)."""
    env = dict(os.environ)
    prefix = Path(sys.prefix)
    own = env.get("VIRTUAL_ENV", "")
    ephemeral = (
        "UV_RUN_RECURSION_DEPTH" in env
        and bool(own)
        and _inside(Path(own), prefix)
        and _inside(prefix, Path(own))
        and not _inside(prefix, main_checkout(repo))
    )
    if ephemeral:
        env["PATH"] = os.pathsep.join(
            p for p in env.get("PATH", "").split(os.pathsep) if not _inside(Path(p), prefix)
        )
        env.pop("VIRTUAL_ENV", None)
    return env


# The rc of a command the tool CUT at its budget (the shell convention `timeout` uses). It is not
# a test's verdict and not the runner's failure: what the command would have said is unknown.
CUT_RC = 124


def _kill_tree(proc: subprocess.Popen[bytes]) -> None:
    """Stop the command and everything it started; the shell alone dying leaves the runner alive."""
    try:
        if os.name == "posix":
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        else:
            proc.kill()
        proc.wait(timeout=10)
    except (ProcessLookupError, PermissionError, subprocess.TimeoutExpired, OSError):
        try:
            if os.name == "posix":
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            else:
                proc.kill()
            proc.wait(timeout=5)
        except (ProcessLookupError, PermissionError, subprocess.TimeoutExpired, OSError):
            pass


def run_command(
    command: str, repo: Path, log: Path, label: str, budget: float | None = None
) -> int:
    """Run one command with its output in ``log``. stdout gets the command, its rc and, on a
    red, the last lines of the log: a runner's whole output is never a story's context. With a
    ``budget`` (seconds) the command is cut when it runs past it and the rc is ``CUT_RC``."""
    log.parent.mkdir(parents=True, exist_ok=True)
    say(f"$ {command if len(command) <= 300 else command[:297] + '...'}")
    cut = False
    started = time.monotonic()
    with Heartbeat(label), log.open("wb") as sink:
        proc = subprocess.Popen(  # nosec B602 — the project's own test command, from its own config
            command,
            shell=True,
            cwd=repo,
            stdout=sink,
            stderr=subprocess.STDOUT,
            env=project_env(repo),
            start_new_session=(os.name == "posix"),
        )
        try:
            proc.wait(timeout=budget)
        except subprocess.TimeoutExpired:
            cut = True
            _kill_tree(proc)
    rc = CUT_RC if cut else proc.returncode
    # the time is what an owner compares with the budget a plan gives the rung
    took = f"took {time.monotonic() - started:.1f}s"
    if cut:
        say(
            f"rc={rc} ({label}, {took}) CUT at the budget of {budget:.0f}s — output so far in {log}"
        )
    else:
        say(f"rc={rc} ({label}, {took}) output in {log}")
    if rc != 0:
        for line in tail(log):
            sys.stdout.write(f"  | {line}\n")
        sys.stdout.flush()
    return rc


# ---------------------------------------------------------------------------------- locks


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


class SlotLock:
    """One of ``capacity`` slots of a kind's type, taken by ``mkdir`` (atomic on every platform).

    The holder touches its ``owner`` file while it runs; a waiter breaks a slot whose owner file
    is older than the stale window (and, on POSIX, one whose pid is gone). No pid probe on
    Windows: ``os.kill(pid, 0)`` there is a kill, not a probe."""

    def __init__(self, root: Path, name: str, capacity: int, holder: str) -> None:
        self.dir = root / name
        self.name = name
        self.capacity = capacity
        self.holder = holder
        self.slot: Path | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def _owner(self, slot: Path) -> Path:
        return slot / "owner"

    def _try(self, slot: Path) -> bool:
        try:
            slot.mkdir()
        except FileExistsError:
            return False
        self._owner(slot).write_text(f"{self.holder}\n{os.getpid()}\n", encoding="utf-8")
        return True

    def _stale(self, slot: Path, stale_after: float) -> bool:
        owner = self._owner(slot)
        try:
            age = time.time() - (owner if owner.exists() else slot).stat().st_mtime
            lines = owner.read_text(encoding="utf-8").splitlines() if owner.exists() else []
        except OSError:
            return False
        if age > stale_after:
            return True
        if os.name == "posix" and len(lines) >= 2 and lines[1].isdigit():
            try:
                os.kill(int(lines[1]), 0)
            except ProcessLookupError:
                return True
            except PermissionError:
                return False
        return False

    def _break(self, slot: Path) -> None:
        stale = slot.with_name(f"{slot.name}.stale.{os.getpid()}")
        try:
            slot.rename(stale)
        except OSError:
            return
        shutil.rmtree(stale, ignore_errors=True)
        say(f"=== queue: stale {self.name} slot broken ({slot.name}) ===")

    def _touch(self, slot: Path) -> None:
        interval = _env_float("WAVES_TESTS_LOCK_TOUCH", 10.0)
        while not self._stop.wait(interval):
            try:
                os.utime(self._owner(slot), None)
            except OSError:
                return

    def __enter__(self) -> SlotLock:
        poll = _env_float("WAVES_TESTS_LOCK_POLL", 5.0)
        heartbeat = _env_float("WAVES_TESTS_HEARTBEAT", HEARTBEAT_SECONDS)
        stale_after = _env_float("WAVES_TESTS_LOCK_STALE", 180.0)
        self.dir.mkdir(parents=True, exist_ok=True)
        say(f"=== queue: waiting for a {self.name} slot (capacity {self.capacity}) ===")
        waited = 0.0
        next_beat = heartbeat
        while True:
            for n in range(1, self.capacity + 1):
                slot = self.dir / f"slot-{n}"
                if self._try(slot):
                    self.slot = slot
                    self._thread = threading.Thread(target=self._touch, args=(slot,), daemon=True)
                    self._thread.start()
                    say(f"=== lock acquired: {self.name} {slot.name} ===")
                    return self
            for n in range(1, self.capacity + 1):
                slot = self.dir / f"slot-{n}"
                if slot.exists() and self._stale(slot, stale_after):
                    self._break(slot)
            time.sleep(poll)
            waited += poll
            if waited >= next_beat:
                say(f"=== queue: still waiting {int(waited)}s for a {self.name} slot ===")
                next_beat += heartbeat

    def __exit__(self, *_: object) -> None:
        self._stop.set()
        if self.slot is None:
            return
        try:
            lines = self._owner(self.slot).read_text(encoding="utf-8").splitlines()
        except OSError:
            return
        # release only what this process owns: a slot broken and re-taken is someone else's
        if len(lines) >= 2 and lines[1] == str(os.getpid()):
            shutil.rmtree(self.slot, ignore_errors=True)


class _NoLock:
    """What a type with no queue, or a caller that already holds the slot, enters instead."""

    def __enter__(self) -> _NoLock:
        return self

    def __exit__(self, *_: object) -> None:
        return None


# ---------------------------------------------------------------------------------- junit


def junit_cases(path: Path) -> dict[str, str]:
    """``case id -> passed|failure|error|skipped`` from one JUnit XML file. The id is
    ``<file or classname>::<name>``, the spelling every subcommand writes and reads."""
    cases: dict[str, str] = {}
    if not path.is_file() or path.stat().st_size == 0:
        return cases
    try:
        root = ET.parse(path).getroot()  # nosec B314 — the project's own runner wrote it
    except ET.ParseError:
        return cases
    for case in root.iter("testcase"):
        owner = case.get("file") or case.get("classname") or ""
        name = case.get("name") or ""
        outcome = "passed"
        for child in case:
            if child.tag in ("failure", "error", "skipped"):
                outcome = child.tag
                break
        cases[f"{owner}::{name}"] = outcome
    return cases


def _red(outcome: str | None) -> bool:
    return outcome in ("failure", "error")


def normalize_owner(owner: str, repo: Path) -> str:
    owner = owner.replace("\\", "/")
    prefix = repo.as_posix().rstrip("/") + "/"
    if owner.startswith(prefix):
        owner = owner[len(prefix) :]
    return owner[2:] if owner.startswith("./") else owner


def owner_to_file(owner: str, universe: list[str]) -> str | None:
    """The test file a JUnit owner names: a path, or a dotted class name whose path is a suffix
    of a file's path (Java-style ``pkg.Class`` -> ``.../pkg/Class.java``)."""
    if owner in universe:
        return owner
    dotted = owner.replace(".", "/")
    for path in universe:
        without_ext = str(PurePosixPath(path).with_suffix(""))
        if without_ext == dotted or without_ext.endswith("/" + dotted):
            return path
    stem = owner.rsplit(".", 1)[-1]
    matches = [p for p in universe if PurePosixPath(p).stem == stem]
    return matches[0] if len(matches) == 1 else None


# ------------------------------------------------------------------------------ execution


@dataclass
class KindResult:
    kind: str
    type: str
    commands: list[dict[str, Any]] = field(default_factory=list)
    cases: dict[str, str] = field(default_factory=dict)  # junit case id -> outcome
    unit_rc: dict[str, int] = field(default_factory=dict)  # rc-only: unit -> rc
    strength: str = "junit"
    unlocalized_red: bool = False  # a non-zero rc no case or unit explains
    # units whose command did not RUN as a test runner: it failed and wrote no report, or the shell
    # could not find it (126/127). That is the environment's or the command's, never a test's.
    runner_failed: list[str] = field(default_factory=list)
    # units whose command was CUT at the rung's budget: what they would have said is unknown —
    # neither red nor green. The verdict they make is `inconclusive`.
    cut: list[str] = field(default_factory=list)

    def red_cases(self) -> list[str]:
        return sorted(c for c, o in self.cases.items() if _red(o))

    def red_units(self) -> list[str]:
        return sorted(u for u, rc in self.unit_rc.items() if rc != 0)

    @property
    def red(self) -> bool:
        return bool(
            self.red_cases() or self.red_units() or self.unlocalized_red or self.runner_failed
        )

    @property
    def inconclusive(self) -> bool:
        return bool(self.cut) and not self.red


@dataclass
class Env:
    repo: Path
    config: Config
    lock_root: Path
    report_dir: Path
    holder: str
    label: str
    machine: dict[str, int] = field(default_factory=dict)
    # the rung's budget in seconds (None: none) and the running time already spent against it —
    # queue waits and the tool's own base re-runs do not count, the project's commands do
    budget: float | None = None
    spent: float = 0.0

    def remaining(self) -> float | None:
        return None if self.budget is None else max(self.budget - self.spent, 0.0)

    def lock(self, kind: Kind) -> SlotLock | _NoLock:
        capacity = effective_capacity(kind, self.machine)
        if capacity == ALL:
            say(f"=== queue: none for {kind.type} (capacity all) ===")
            return _NoLock()
        return SlotLock(self.lock_root, kind.type, capacity, self.holder)


def make_env(repo: Path, config: Config, args: argparse.Namespace, label: str) -> Env:
    return Env(
        repo=repo,
        config=config,
        lock_root=(
            Path(args.lock_root)
            if args.lock_root
            else main_checkout(repo) / ".waves" / "tests.lock"
        ),
        report_dir=repo / args.report_dir,
        holder=str(repo),
        label=label,
        machine=machine_capacities(repo),
        budget=getattr(args, "budget", None),
    )


def _timed(env: Env, budgeted: bool, command: str, log: Path, label: str) -> int:
    """Run ``command`` against what is left of the rung's budget (when ``budgeted``), and book
    the time it took. Out of budget before it starts: cut without running."""
    remaining = env.remaining() if budgeted else None
    if remaining is not None and remaining <= 0:
        say(f"$ {command if len(command) <= 300 else command[:297] + '...'}")
        say(f"rc={CUT_RC} ({label}) CUT — the rung's budget is spent; not run")
        return CUT_RC
    started = time.monotonic()
    rc = run_command(command, env.repo, log, label, budget=remaining)
    if budgeted:
        env.spent += time.monotonic() - started
    return rc


def execute_units(
    env: Env,
    kind: Kind,
    units: list[str],
    tag: str,
    lock: bool = True,
    budgeted: bool = True,
) -> KindResult:
    """Run ``units`` with the kind's story command under the kind's lock (unless the caller
    already holds it). With a report option, one invocation per batch and a result per case —
    or per unit when the kind says ``each``; without, one invocation per unit and its rc as the
    result, so a red still names the unit that produced it. ``budgeted`` commands count
    against the rung's budget and are cut at it; the tool's own base re-runs are not."""
    result = KindResult(kind=kind.id, type=kind.type)
    logs = env.report_dir / "logs"
    junit_dir = env.report_dir / "junit"
    junit_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{env.label}-{tag}-{kind.id}"
    with env.lock(kind) if lock else _NoLock():
        if kind.report:
            groups = [[u] for u in units] if kind.each else batches(kind, units)
            for n, batch in enumerate(groups):
                junit = junit_dir / f"{stem}-{n}.xml"
                junit.unlink(missing_ok=True)
                log = logs / f"{stem}-{n}.log"
                command = render(kind, kind.story_run, batch, str(junit))
                rc = _timed(env, budgeted, command, log, f"{tag} {kind.id}")
                result.commands.append(
                    {
                        "command": command,
                        "rc": rc,
                        "log": str(log),
                        "report": str(junit),
                        "cut": rc == CUT_RC,
                    }
                )
                if rc == CUT_RC:
                    result.cut.extend(batch)
                    continue
                found = junit_cases(junit)
                if found:
                    result.cases.update(found)
                    if rc != 0 and not any(_red(o) for o in found.values()):
                        result.unlocalized_red = True
                else:
                    result.strength = "rc"
                    if rc != 0:
                        result.runner_failed.extend(batch)
        else:
            result.strength = "rc"
            for n, unit in enumerate(units):
                log = logs / f"{stem}-{n}.log"
                command = render(kind, kind.story_run, [unit], None)
                rc = _timed(env, budgeted, command, log, f"{tag} {kind.id}")
                result.commands.append(
                    {"command": command, "rc": rc, "log": str(log), "cut": rc == CUT_RC}
                )
                if rc == CUT_RC:
                    result.cut.append(unit)
                elif rc in (126, 127):
                    result.runner_failed.append(unit)
                else:
                    result.unit_rc[unit] = rc
    return result


def execute_full(env: Env, kind: Kind, tag: str) -> KindResult:
    result = KindResult(kind=kind.id, type=kind.type)
    junit_dir = env.report_dir / "junit"
    junit_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{env.label}-{tag}-{kind.id}"
    junit = junit_dir / f"{stem}.xml"
    junit.unlink(missing_ok=True)
    log = env.report_dir / "logs" / f"{stem}.log"
    with env.lock(kind):
        command = render(kind, kind.full_run, [], str(junit))
        rc = _timed(env, True, command, log, f"{tag} {kind.id}")
    result.commands.append(
        {
            "command": command,
            "rc": rc,
            "log": str(log),
            "report": str(junit) if kind.report else "",
            "cut": rc == CUT_RC,
        }
    )
    if rc == CUT_RC:
        result.cut.append("<full>")
        return result
    found = junit_cases(junit) if kind.report else {}
    if found:
        result.cases = found
        if rc != 0 and not any(_red(o) for o in found.values()):
            result.unlocalized_red = True
    else:
        result.strength = "rc"
        if rc != 0:
            result.runner_failed.append("<full>" if kind.report or rc in (126, 127) else kind.id)
    return result


# ---------------------------------------------------------------- checkout at another commit

JOURNAL = Path(".waves") / "gate" / "journal.json"


class StateRebuildFailed(Exception):
    """A kind's ``state_rebuild`` failed at a commit the tool moved the tree to: the old code
    cannot be asked — what it would meet is not the state its own tree builds."""


@dataclass
class StateRebuild:
    """A kind's ``state_rebuild``, and where its output goes."""

    command: str
    logs: Path
    label: str

    def run(self, repo: Path, at: str) -> int:
        log = self.logs / f"{self.label}-state-{_safe(at)}.log"
        return run_command(self.command, repo, log, f"state rebuild at {at}")


def state_rebuild(env: Env, kind: Kind) -> StateRebuild | None:
    if not kind.state_rebuild:
        return None
    return StateRebuild(kind.state_rebuild, env.report_dir / "logs", f"{env.label}-{kind.id}")


def unaskable_reason(kind: Kind) -> str:
    return (
        f"kind {kind.id!r} reads state outside the tree (`outside_state`) and its config has no "
        "`state_rebuild`: the old code would meet the state the new code left, so it was not asked"
    )


def _drop_written(repo: Path) -> None:
    """What the OLD code (or the state rebuild at its commit) wrote while detached: not the
    story's, never left in the tree as if the story had produced it."""
    if tracked_dirty(repo):
        git(repo, "checkout", "--quiet", "--", ".")
    for path in untracked(repo):
        (repo / path).unlink(missing_ok=True)


def _put_back(repo: Path, restore: str, stash: str) -> None:
    """The branch back where it was, with what the run had written before the tool detached.
    What the OLD code wrote while detached is dropped first: it is not the story's."""
    _drop_written(repo)
    # a branch by its short name: `checkout refs/heads/x` would detach HEAD at it
    git(repo, "checkout", "--quiet", restore.removeprefix("refs/heads/"))
    if stash:
        top = git(repo, "rev-parse", "--verify", "--quiet", "stash@{0}", check=False)
        if top.stdout.decode().strip() == stash:
            git(repo, "stash", "pop", "--quiet")
        else:
            git(repo, "stash", "apply", "--quiet", stash)


def _journal_rebuild_only(repo: Path, command: str) -> None:
    """The branch is back; only the state is left to rebuild — what the next run retries."""
    (repo / JOURNAL).write_text(
        json.dumps({"restore": "", "stash": "", "rebuild": command}), encoding="utf-8"
    )


def restore_journal(repo: Path) -> bool:
    """Put back the ref an interrupted gate left the tree away from, and rebuild the state
    outside the tree for it when the interrupted kind declared how. Idempotent."""
    journal = repo / JOURNAL
    if not journal.is_file():
        return False
    data = json.loads(journal.read_text(encoding="utf-8"))
    target = str(data.get("restore", ""))
    command = str(data.get("rebuild", ""))
    if target:
        _put_back(repo, target, str(data.get("stash", "")))
        say(f"restored the tree to {target} after an interrupted gate")
    if command:
        _journal_rebuild_only(repo, command)
        rebuild = StateRebuild(command, repo / JOURNAL.parent / "logs", "journal")
        rc = rebuild.run(repo, rev(repo, "HEAD")[:10])
        if rc != 0:
            raise Refusal(
                "an interrupted gate left the state outside the tree at an older commit, and "
                f"`state_rebuild` failed (rc={rc}) rebuilding it for this one: fix what its log "
                "says, then run again — it is retried first"
            )
    journal.unlink()
    return True


class AtCommit:
    """The tree at ``commit`` (detached) for the length of the block, then back where it was.

    This is how a red is asked "did you fail before the story?": the SAME provisioned worktree
    (its dependencies, its environment file) runs the same test against the old code. What the
    run wrote in the tree before this — a matrix, a snapshot, a report git tracks — is the
    story's evidence, not dirt: it goes aside while the old code runs and comes back with the
    branch (MEASURED 2026-10-02: a refusal here, "commit first", looped a story whose browser
    suite rewrote three tracked files on every run). A journal survives a kill, and the next
    gate restores the tree first.

    A checkout moves the code and nothing else. When the kind's tests read state outside the
    tree that the code moves forward, ``rebuild`` (the kind's ``state_rebuild``) runs after
    every move, so the old code meets the state its own tree builds, and once more after the
    branch is back. A rebuild that fails at an old commit raises ``StateRebuildFailed`` (the
    tree is put back first); one that fails after the branch is back is a failed restore.

    ``commit`` None enters without moving: the caller moves with ``move`` — one stash, one
    journal and one restore for a whole bisection."""

    def __init__(self, repo: Path, commit: str | None, rebuild: StateRebuild | None = None) -> None:
        self.repo = repo
        self.commit = commit
        self.rebuild = rebuild
        self.restore = ""
        self.stash = ""
        self.moved = False

    def __enter__(self) -> AtCommit:
        restore_journal(self.repo)
        branch = git(self.repo, "symbolic-ref", "--quiet", "HEAD", check=False)
        self.restore = (
            branch.stdout.decode().strip() if branch.returncode == 0 else rev(self.repo, "HEAD")
        )
        if tracked_dirty(self.repo) or untracked(self.repo):
            # ignored files are never stashed, and `.waves/` is ignored by contract
            git(
                self.repo,
                "stash",
                "push",
                "--quiet",
                "--include-untracked",
                "--message",
                "waves gate: what the run wrote",
            )
            self.stash = git_text(self.repo, "rev-parse", "--verify", "stash@{0}")
        journal = self.repo / JOURNAL
        journal.parent.mkdir(parents=True, exist_ok=True)
        journal.write_text(
            json.dumps(
                {
                    "restore": self.restore,
                    "stash": self.stash,
                    "rebuild": self.rebuild.command if self.rebuild else "",
                }
            ),
            encoding="utf-8",
        )
        if self.commit is not None:
            try:
                self.move(self.commit)
            except StateRebuildFailed:
                self.__exit__()
                raise
        return self

    def move(self, commit: str) -> None:
        if self.moved:
            _drop_written(self.repo)
        git(self.repo, "checkout", "--quiet", "--detach", commit)
        self.moved = True
        # said out loud, for whoever reads this worktree's git while it lasts: the branch did
        # not move — the tool is asking the old code a question and puts the branch back after
        say(
            f"=== base re-run: HEAD detached at {commit[:10]} in this worktree; "
            f"{self.restore.removeprefix('refs/heads/')} is restored when it ends ==="
        )
        if self.rebuild is not None:
            rc = self.rebuild.run(self.repo, commit[:10])
            if rc != 0:
                raise StateRebuildFailed(f"`state_rebuild` failed at {commit[:10]} (rc={rc})")

    def __exit__(self, *_: object) -> None:
        try:
            _put_back(self.repo, self.restore, self.stash)
        except Refusal as error:
            say(f"RESTORE FAILED: {error}")
            raise SystemExit(EXIT_RESTORE) from None
        branch = self.restore.removeprefix("refs/heads/")
        if self.rebuild is not None and self.moved:
            _journal_rebuild_only(self.repo, self.rebuild.command)
            rc = self.rebuild.run(self.repo, branch)
            if rc != 0:
                say(
                    f"RESTORE FAILED: {branch} is back, but `state_rebuild` failed (rc={rc}): the "
                    "state outside the tree still matches an older commit — the next run of this "
                    "tool retries it first"
                )
                raise SystemExit(EXIT_RESTORE)
        (self.repo / JOURNAL).unlink(missing_ok=True)
        say(f"=== restored {branch} ===")


# ----------------------------------------------------------------------------- the story gate


def diff_digest(
    repo: Path,
    base: str,
    head: str,
    evidence: list[str] | None = None,
    measured: str | None = None,
) -> str:
    """The content of the story's files, independent of the commits carrying it: what a rebase
    must leave alone for a green report to keep holding. ``evidence`` is what the gate's run
    wrote (the report's ``written``): at ``head`` those files are read as they stood at the
    ``measured`` commit, so a commit that only adds them on top still proves the same story."""
    at_measured = {path for _, path in changed(repo, base, measured)} if measured else set()
    entries: list[str] = []
    for _, path in changed(repo, base, head):
        if evidence and path in evidence:
            if not measured or path not in at_measured:
                continue
            entries.append(f"{path}\t{blob(repo, measured, path) or '-'}")
        else:
            entries.append(f"{path}\t{blob(repo, head, path) or '-'}")
    return hashlib.sha256("\n".join(sorted(entries)).encode("utf-8")).hexdigest()


def file_sha256(path: str) -> str | None:
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
    except OSError:
        return None


def seal(commands: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add the hash of each command's log and report: a merge later checks the files a report
    points at are the ones the run wrote, so a green cannot be typed by hand."""
    for entry in commands:
        entry["log_sha256"] = file_sha256(entry.get("log", ""))
        if entry.get("report"):
            entry["report_sha256"] = file_sha256(entry["report"])
    return commands


def _seal_key(repo: Path, create: bool) -> bytes | None:
    """A key of this machine, in the main checkout's ``.waves/``: what makes a report the tool's
    and not a file somebody typed. Not a secret from a session with a shell that goes looking for
    it; a barrier against the mistake, and against the shortcut that takes a deliberate act."""
    path = main_checkout(repo) / ".waves" / "gate.key"
    if path.is_file():
        return bytes.fromhex(path.read_text(encoding="utf-8").strip())
    if not create:
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_bytes(32)
    path.write_text(key.hex(), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return key


def _seal_payload(record: dict[str, Any]) -> bytes:
    body = {k: v for k, v in record.items() if k != "seal"}
    return json.dumps(body, sort_keys=True, ensure_ascii=False).encode("utf-8")


def sign(repo: Path, record: dict[str, Any]) -> str:
    key = _seal_key(repo, create=True)
    assert key is not None
    return hmac.new(key, _seal_payload(record), hashlib.sha256).hexdigest()


def unsealed(repo: Path, report: dict[str, Any]) -> str | None:
    key = _seal_key(repo, create=False)
    if key is None:
        return "this machine has no gate key: the report was not written here"
    expected = hmac.new(key, _seal_payload(report), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, str(report.get("seal", ""))):
        return "the report's seal does not match its content: it was edited after the gate wrote it"
    return None


def tampered(report: dict[str, Any]) -> str | None:
    for entry in report.get("commands", []):
        for key, digest in (("log", "log_sha256"), ("report", "report_sha256")):
            path = entry.get(key)
            if path and entry.get(digest) != file_sha256(path):
                return f"the {key} {path} is not the file the gate wrote"
    return None


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name) or "story"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def spec_section(spec: Path | None, heading: str) -> tuple[bool, str]:
    """``(has the section, its body)``: the spec's section under a heading containing ``heading``,
    up to the next heading. The front writes it; the gate only checks it names what the story owes.
    """
    if spec is None or not spec.is_file():
        return False, ""
    found = False
    body: list[str] = []
    for line in spec.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            if found:
                break
            found = heading.lower() in line.lower()
            continue
        if found:
            body.append(line)
    return found, "\n".join(body)


def owed_entry(raw: Any) -> dict[str, str]:
    """An ``owed`` entry, also from a report written before the entries carried a class."""
    if isinstance(raw, dict):
        return {"file": str(raw.get("file", "")), "class": str(raw.get("class", "preexisting"))}
    return {"file": str(raw), "class": "preexisting"}


def still_owed(
    config: Config, spec: Path | None, owed: list[dict[str, str]]
) -> list[dict[str, str]]:
    """What the spec does not yet name, each class under its own heading."""
    sections = {cls: spec_section(spec, config.heading(cls)) for cls in OWED_CLASSES}
    left = []
    for entry in owed:
        has_section, body = sections.get(entry["class"], (False, ""))
        if not (has_section and entry["file"] in body):
            left.append(entry)
    return left


# ------------------------------------------------------------------ the acceptance record


def atdd_record(repo: Path, ref: str, memory_dir: str, story: str) -> dict[str, str] | None:
    """``case id -> result`` from wave 0's record at ``ref``, or None when there is none. This is
    what the gate holds a story to: every case recorded there must PASS at the gate."""
    data = show(repo, ref, f"{memory_dir.rstrip('/')}/atdd/{story}.toml")
    if data is None:
        return None
    try:
        doc = tomllib.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as error:
        raise Refusal(f"the acceptance record of {story} does not parse: {error}") from error
    return {str(c.get("id", "")): str(c.get("result", "")) for c in doc.get("case", []) if c}


def recorded_files(repo: Path, record: dict[str, str], universe: list[str]) -> set[str]:
    """The test files the record's case ids name (a path, or a class name mapped to one)."""
    files: set[str] = set()
    for case_id in record:
        owner = case_id.partition("::")[0] if "::" in case_id else case_id
        owner = normalize_owner(owner, repo)
        files.add(owner_to_file(owner, universe) or owner)
    return files


def case_key(case_id: str, repo: Path, universe: list[str]) -> tuple[str, str]:
    """``(test file, case name)`` for a case id. A runner that writes dotted class names spells
    them from ITS root, so the record (taken in the main checkout) and the gate (run in a worktree
    at another path) name one case differently; the file and the name are what they share."""
    owner, sep, name = case_id.partition("::")
    owner = normalize_owner(owner, repo)
    return (owner_to_file(owner, universe) or owner, name if sep else "")


def acceptance_not_passed(
    record: dict[str, str],
    cases: dict[str, str],
    unit_rc: dict[str, int],
    repo: Path,
    universe: list[str],
) -> list[str]:
    """The recorded case ids that did not PASS at the gate: skipped, missing, red — one and the
    same. A recorded unit (no report) passes when its command exited zero."""
    by_key = {case_key(c, repo, universe): o for c, o in cases.items()}
    missed = []
    for case_id in record:
        file, name = case_key(case_id, repo, universe)
        if name:
            if by_key.get((file, name)) != "passed":
                missed.append(case_id)
            continue
        by_case = [o for (f, n), o in by_key.items() if f == file and n]
        ran_green = (by_case and all(o == "passed" for o in by_case)) or unit_rc.get(file) == 0
        if not ran_green:
            missed.append(case_id)
    return sorted(missed)


def classify_story_reds(
    env: Env,
    results: list[KindResult],
    story_paths: dict[str, str],
    atdd: set[str],
    universe: dict[str, list[str]],
    merge_base: str,
    scope: str,
) -> list[dict[str, Any]]:
    """Every red case or unit, classified: ``atdd`` (no excuse), ``new`` (the story's),
    ``preexisting`` (already red on the story's base, in a file the story touched) or
    ``unattributed`` (the base could not be asked: the kind reads state outside the tree that
    nothing rebuilds, or its rebuild failed there — the entry's ``reason`` says which)."""
    reds: list[dict[str, Any]] = []
    to_rerun: dict[str, dict[str, list[str]]] = {}  # kind -> file -> [case ids]
    for result in results:
        kind = env.config.kind(result.kind)
        files = universe[kind.id]
        by_file: dict[str, list[str]] = {}
        for unit in result.cut:
            for file in _unit_files(kind, unit, files) if unit != "<full>" else [unit]:
                reds.append(
                    {"kind": kind.id, "file": file, "cases": [f"clock:{unit}"], "class": "clock"}
                )
        for unit in result.runner_failed:
            reds.append(
                {"kind": kind.id, "file": unit, "cases": [f"runner:{unit}"], "class": "runner"}
            )
        for case in result.red_cases():
            owner, _, name = case.partition("::")
            file = owner_to_file(normalize_owner(owner or name, env.repo), files)
            by_file.setdefault(file or "?", []).append(case)
        for unit in result.red_units():
            for file in _unit_files(kind, unit, files):
                by_file.setdefault(file, []).append(f"unit:{unit}")
        if result.unlocalized_red:
            by_file.setdefault("?", []).append(f"command:{kind.id}")
        for file, cases in by_file.items():
            entry = {"kind": kind.id, "file": file, "cases": sorted(set(cases))}
            if file in atdd:
                entry["class"] = "atdd"
            elif file == "?":
                entry["class"] = "new"
            elif blob(env.repo, merge_base, file) is None:
                entry["class"] = "new"  # created by the story: it cannot have been red before
            else:
                entry["class"] = "pending"
                to_rerun.setdefault(kind.id, {})[file] = sorted(set(cases))
            reds.append(entry)
    # The slot first, the checkout after: the worktree is off its branch only while the old
    # code actually runs, never while it waits in the queue.
    for kind_id, by_file in to_rerun.items():
        kind = env.config.kind(kind_id)
        again: KindResult | None = None
        why = unaskable_reason(kind) if kind.unaskable else ""
        if not why:
            try:
                with env.lock(kind), AtCommit(env.repo, merge_base, state_rebuild(env, kind)):
                    again = execute_units(
                        env,
                        kind,
                        units_for(kind, sorted(by_file)),
                        f"base-{kind_id}",
                        lock=False,
                        budgeted=False,
                    )
            except StateRebuildFailed as error:
                why = f"{error}: the story's base could not be asked"
        for entry in reds:
            if entry["class"] != "pending" or entry["kind"] != kind_id:
                continue
            if again is None:
                entry["class"], entry["reason"] = "unattributed", why
                continue
            still = _still_red(again, entry["file"], entry["cases"], kind, universe[kind_id])
            if still:
                touched = entry["file"] in story_paths
                entry["class"] = "preexisting" if touched or scope == "story" else "untouched"
            else:
                entry["class"] = "new"
    return reds


def _unit_files(kind: Kind, unit: str, files: list[str]) -> list[str]:
    if kind.placeholder == "{dirs}":
        return [f for f in files if str(PurePosixPath(f).parent) == unit] or [unit]
    if kind.placeholder == "{names}":
        return [f for f in files if PurePosixPath(f).stem == unit] or [unit]
    return [unit]


def _still_red(
    again: KindResult, file: str, cases: list[str], kind: Kind, files: list[str]
) -> bool:
    if again.cases:
        base_red = set(again.red_cases())
        wanted = {c for c in cases if "::" in c and not c.startswith("command:")}
        if wanted:
            return bool(wanted & base_red)
        return any(
            owner_to_file(normalize_owner(c.partition("::")[0], Path(".")), files) == file
            for c in base_red
        )
    units = set(units_for(kind, [file]))
    return (
        any(rc != 0 for unit, rc in again.unit_rc.items() if unit in units) or again.unlocalized_red
    )


def cmd_gate(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    restore_journal(repo)
    head = rev(repo, "HEAD")
    base = rev(repo, args.base)
    if tracked_dirty(repo):
        raise Refusal(
            f"tracked files are not clean: {tracked_dirty(repo)} — the gate runs on a commit"
        )
    untracked_before = untracked(repo)
    merge_base = git_text(repo, "merge-base", base, head)
    config = load_config(repo, args.config, merge_base)
    scope = "full" if args.scope_override == "full" else config.scope
    story = args.story
    report_dir = repo / args.report_dir
    report_path = report_dir / f"{_safe(story)}.json"
    previous = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {}

    diff = changed(repo, base, head)
    story_paths = {path: status for status, path in diff}
    violations = sorted(
        p for p in story_paths if p == args.config or glob_match(args.memory_dir, p)
    )
    universe: dict[str, list[str]] = {}
    head_files = files_at(repo, head)
    for kind in config.kinds:
        universe[kind.id] = [f for f in head_files if config.kind_of(f) is kind]
    # The acceptance files: wave 0's record at the merge-base is the authority; `--atdd` adds to
    # it (and is all there is when no record was taken).
    record = atdd_record(repo, merge_base, args.memory_dir, story)
    requested = set(args.atdd)
    if record:
        requested |= recorded_files(repo, record, [f for fs in universe.values() for f in fs])
    atdd = {a for a in requested if a in head_files}
    missing_atdd = sorted(requested - atdd)
    by_kind: dict[str, list[str]] = {}
    for path, status in story_paths.items():
        kind = config.kind_of(path)
        if kind is not None and status != "D":
            by_kind.setdefault(kind.id, []).append(path)
    for path in sorted(atdd):
        kind = config.kind_of(path)
        if kind is None:
            raise Refusal(f"acceptance file {path} matches no [[kind]] glob")
        if path not in by_kind.setdefault(kind.id, []):
            by_kind[kind.id].append(path)
    # A test file the story deleted (one that existed at its base and was not moved) is owed
    # to the spec: deleting the test that would fail is the cheapest shortcut there is.
    moved = renamed_from(repo, base, head)
    deleted = sorted(
        p
        for p, status in story_paths.items()
        if status == "D"
        and p not in moved
        and p not in requested
        and config.kind_of(p) is not None
        and blob(repo, merge_base, p) is not None
    )

    env = make_env(repo, config, args, _safe(story))
    results: list[KindResult] = []
    ran: dict[str, list[str]] = {}
    if scope == "full":
        for kind in config.kinds:
            results.append(execute_full(env, kind, "story"))
            ran[kind.id] = ["<full>"]
    else:
        for kind in config.kinds:
            files = sorted(by_kind.get(kind.id, []))
            if not files:
                continue
            ran[kind.id] = files
            results.append(execute_units(env, kind, units_for(kind, files), "story"))

    reds = classify_story_reds(env, results, story_paths, atdd, universe, merge_base, scope)
    cases: dict[str, str] = {}
    unit_rc: dict[str, int] = {}
    for result in results:
        cases.update(result.cases)
        unit_rc.update(result.unit_rc)
    # Every case the record holds red at the base must PASS here — skipped or missing is not
    # passing, whatever the runner's exit code said.
    if record:
        everything = [f for fs in universe.values() for f in fs]
        missed = acceptance_not_passed(record, cases, unit_rc, repo, everything)
        add_atdd_reds(reds, config, missed, universe)
    for path in deleted:
        kind = config.kind_of(path)
        reds.append(
            {
                "kind": kind.id if kind else "?",
                "file": path,
                "cases": [f"deleted:{path}"],
                "class": "deleted",
            }
        )
    blocking = [r for r in reds if r["class"] not in ("untouched", "deleted", "clock")]
    cut_files = [r["file"] for r in reds if r["class"] == "clock"]

    # What the story owes the spec — a pre-existing red it touched, a test file it deleted —
    # carried across runs until the section of that class names the file.
    owed_now = [
        {"file": r["file"], "class": r["class"]} for r in reds if r["class"] in OWED_CLASSES
    ]
    owed_all = {
        (o["file"], o["class"]): o
        for o in [owed_entry(o) for o in previous.get("owed", [])] + owed_now
    }
    owed_left = still_owed(
        config, Path(args.spec) if args.spec else None, [owed_all[k] for k in sorted(owed_all)]
    )
    verdict = "green"
    reason = ""
    if violations:
        verdict, reason = "red", "the story changes the config or the acceptance records"
    elif blocking:
        verdict = "red"
    elif owed_left:
        classes = ", ".join(sorted({o["class"] for o in owed_left}))
        verdict, reason = "red", f"owed to the spec and not documented there: {classes}"
    elif cut_files:
        # nothing red among what ran, and something did not run: neither green nor red
        verdict = "inconclusive"
        reason = (
            f"the rung ran out of its budget ({env.budget:.0f}s): {len(cut_files)} unit(s) cut, "
            "what they would have said is unknown"
        )
    elif not ran and not atdd:
        verdict = "no-tests"
    if missing_atdd:
        reason = (
            reason + "; " if reason else ""
        ) + f"acceptance files not in the commit: {missing_atdd}"
        verdict = "red"

    record = {
        "format": FORMAT,
        "story": story,
        "commit": head,
        "base": base,
        "merge_base": merge_base,
        "digest": diff_digest(repo, base, head),
        "verdict": verdict,
        "reason": reason,
        "scope": scope,
        "measured_at": _now(),
        "strength": "junit" if results and all(r.strength == "junit" for r in results) else "rc",
        "ran": ran,
        "atdd": sorted(atdd),
        "atdd_recorded_red": record is not None,
        "commands": seal([c for r in results for c in r.commands]),
        "cases": cases,
        "reds": reds,
        "violations": violations,
        "owed": owed_left,
        "files": sorted(story_paths),
        "written": written_since(repo, untracked_before),
    }
    record["seal"] = sign(repo, record)
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    _summary_story(record, report_path, config)
    return EXIT_OK if verdict in ("green", "no-tests") else EXIT_NEGATIVE


def add_atdd_reds(
    reds: list[dict[str, Any]], config: Config, missed: list[str], universe: dict[str, list[str]]
) -> None:
    """Fold the recorded cases that did not pass into ``reds`` as class ``atdd``, joining the
    entry of a file that is already red for another of its cases."""
    everything = [f for fs in universe.values() for f in fs]
    by_file: dict[str, list[str]] = {}
    for case_id in missed:
        owner = case_id.partition("::")[0] if "::" in case_id else case_id
        file = owner_to_file(normalize_owner(owner, Path(".")), everything) or owner
        by_file.setdefault(file, []).append(case_id)
    for file, case_ids in by_file.items():
        existing = next((r for r in reds if r["file"] == file and r["class"] == "atdd"), None)
        if existing is not None:
            existing["cases"] = sorted(set(existing["cases"]) | set(case_ids))
            continue
        kind = config.kind_of(file)
        reds.append(
            {"kind": kind.id if kind else "?", "file": file, "cases": case_ids, "class": "atdd"}
        )


def _summary_story(record: dict[str, Any], path: Path, config: Config) -> None:
    reds = record["reds"]
    counts: dict[str, int] = {}
    for red in reds:
        counts[red["class"]] = counts.get(red["class"], 0) + 1
    label = record["verdict"].upper()
    detail = ", ".join(f"{n} {c}" for c, n in sorted(counts.items()))
    say(f"gate {record['story']}: {label}" + (f" — {detail}" if detail else ""))
    if record["reason"]:
        say(f"  reason: {record['reason']}")
    for red in reds:
        say(f"  {red['class']}: {red['file']} ({red['kind']}) {', '.join(red['cases'][:3])}")
        if red.get("reason"):
            say(f"    not attributed: {red['reason']}")
    for cls, advice in (
        (
            "preexisting",
            "already red on the story's base, in a file it touched: fix it and document it in "
            f'the spec section "{config.preexisting_heading}"',
        ),
        (
            "deleted",
            "a test file that existed at the story's base is gone: put it back, or say which and "
            f'why in the spec section "{config.deleted_heading}"',
        ),
        (
            "runner",
            "the test command did not run as a test runner (it failed and wrote no report, or was "
            "not found): read its log — it is the environment's or the command's, not a test's. Do "
            "NOT change the project's dependency or build files to make it run: report "
            "`blocked <story> gate <the log's last lines>`",
        ),
        (
            "atdd",
            "an acceptance case recorded red at the base must PASS here — skipped or missing is "
            "not passing: no exception",
        ),
        ("new", "the story broke it"),
        (
            "unattributed",
            "red here, and the story's base could not be asked whether it was red there too (the "
            "reason is in the report): treat it as yours — read its log; when it was already red "
            "before your story, fix it all the same and say so in the spec section "
            f'"{config.preexisting_heading}"',
        ),
        (
            "clock",
            "the rung ran out of its budget and these units were cut: what they would have said "
            "is unknown — never green. Report `failure <story> clock gate <elapsed>/<budget>`; "
            "the master re-measures the rung alone, once",
        ),
    ):
        if counts.get(cls):
            say(f"  {cls}: {advice}")
    for entry in record["owed"]:
        say(
            f'  owed: {entry["file"]} — name it in the spec section "{config.heading(entry["class"])}"'
        )
    _say_written(record)
    say(f"report: {path}")


def _say_written(record: dict[str, Any]) -> None:
    if record.get("written"):
        say(
            "  written: " + ", ".join(record["written"]) + " — what the run wrote in the tree. "
            "It is this run's evidence: commit it on top (or restore it, when the project does "
            "not version it) before you report, and report THAT commit"
        )


# --------------------------------------------------------------------------------- merge


def read_report(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise Refusal(f"no gate report at {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def report_holds(
    repo: Path, report: dict[str, Any], base: str, head: str, accept_inconclusive: bool = False
) -> str | None:
    """None when the report proves ``head``; otherwise why it does not. An ``inconclusive``
    report (the rung was cut at its budget, nothing red among what ran) holds only when the
    caller accepts it in the open; a red is never accepted."""
    forged = unsealed(repo, report)
    if forged:
        return forged
    verdict = report.get("verdict")
    if verdict == "inconclusive" and not accept_inconclusive:
        return (
            "the gate verdict is 'inconclusive': the rung ran out of its budget — re-measure it "
            "alone once; to merge on what did run (all green), say so with --accept-inconclusive "
            "and write the infra debt"
        )
    if verdict not in ("green", "no-tests", "inconclusive"):
        return f"the gate verdict is {verdict!r}"
    if report.get("owed"):
        return f"the spec still owes documentation for {report['owed']}"
    altered = tampered(report)
    if altered:
        return altered
    if report.get("commit") == head:
        return None
    if report.get("digest") == diff_digest(repo, base, head):
        return None
    # the front committed what the gate wrote on top of the gated commit: the story's files
    # are still the ones the report measured, the evidence rides with them
    written = report.get("written") or []
    if written and report.get("digest") == diff_digest(
        repo, base, head, written, str(report.get("commit", ""))
    ):
        return None
    return "the story's files changed after the gate ran: run the gate again"


def cmd_merge(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    head = rev(repo, args.head)
    base = rev(repo, "HEAD")
    report = read_report(Path(args.report))
    if report.get("story") != args.story:
        raise Refusal(f"the report is for story {report.get('story')!r}, not {args.story!r}")
    if args.branch:
        # MEASURED in a real run: a front edited its story after a green gate and reported the
        # new commit; the master merged the OLDER commit the report named to get its green. The
        # branch's tip is what the front delivered; anything else is not the story.
        tip = rev(repo, args.branch)
        if tip != head:
            say(
                f"merge {args.story}: REFUSED — the branch {args.branch} is at {tip[:10]}, not "
                f"{head[:10]}: the front moved on after the gate; the story goes back through it"
            )
            return EXIT_NEGATIVE
    why = report_holds(repo, report, base, head, accept_inconclusive=args.accept_inconclusive)
    if why:
        say(f"merge {args.story}: REFUSED — {why}")
        return EXIT_NEGATIVE
    if tracked_dirty(repo):
        raise Refusal(f"tracked files are not clean: {tracked_dirty(repo)}")
    mode = ["--ff-only"] if args.ff_only else ["--no-ff"]
    proc = git(repo, "merge", *mode, "-m", f"merge {args.story}", head, check=False)
    if proc.returncode != 0:
        git(repo, "merge", "--abort", check=False)
        say(f"merge {args.story}: git refused — {proc.stderr.decode(errors='replace').strip()}")
        return EXIT_NEGATIVE
    merged = rev(repo, "HEAD")
    registry = repo / args.report_dir / REGISTRY
    registry.parent.mkdir(parents=True, exist_ok=True)
    inconclusive = report["verdict"] == "inconclusive"
    entry = {
        "story": args.story,
        "head": head,
        "merge_commit": merged,
        "verdict": report["verdict"],
        "no_tests": report["verdict"] == "no-tests",
        "inconclusive": inconclusive,
        "cut": [r["file"] for r in report.get("reds", []) if r.get("class") == "clock"],
        "files": report.get("files", []),
        "merged_at": _now(),
    }
    with registry.open("a", encoding="utf-8") as sink:
        sink.write(json.dumps(entry, ensure_ascii=False) + "\n")
    say(
        f"merge {args.story}: MERGED at {merged[:10]}"
        + (" (no tests: judged at the epic)" if entry["no_tests"] else "")
        + (" (INCONCLUSIVE accepted: the close measures it for real)" if inconclusive else "")
    )
    return EXIT_OK


# ------------------------------------------------------------------------------- the epic


def load_registry(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    return [
        json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()
    ]


def first_bad(commits: list[str], is_bad: Callable[[str], bool]) -> int | None:
    """Index of the first commit where ``is_bad`` holds, assuming it stays bad once it starts."""
    lo, hi = 0, len(commits)
    while lo < hi:
        mid = (lo + hi) // 2
        if is_bad(commits[mid]):
            hi = mid
        else:
            lo = mid + 1
    return lo if lo < len(commits) else None


def cmd_epic(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    restore_journal(repo)
    head = rev(repo, "HEAD")
    base = rev(repo, args.base)
    if tracked_dirty(repo):
        raise Refusal(f"tracked files are not clean: {tracked_dirty(repo)}")
    untracked_before = untracked(repo)
    config = load_config(repo, args.config, None)
    # A close spread over several trees runs a subset of the kinds in each; the split is the
    # caller's, the tool only takes the list.
    kinds = config.kinds
    if args.kind:
        unknown = sorted(set(args.kind) - {k.id for k in config.kinds})
        if unknown:
            raise Refusal(
                f"unknown kind(s) {unknown}: the config declares {[k.id for k in config.kinds]}"
            )
        kinds = [k for k in config.kinds if k.id in set(args.kind)]
    report_dir = repo / args.report_dir
    env = make_env(repo, config, args, _safe(args.name))
    registry = load_registry(report_dir / REGISTRY)
    epic_changed = {path for _, path in changed(repo, base, head)}
    head_files = files_at(repo, head)
    universe = {k.id: [f for f in head_files if config.kind_of(f) is k] for k in config.kinds}

    results: list[KindResult] = []
    if config.epic_full_suite:
        for kind in kinds:
            results.append(execute_full(env, kind, "epic"))

    pending: dict[str, dict[str, list[str]]] = {}
    reds: list[dict[str, Any]] = []
    for result in results:
        kind = config.kind(result.kind)
        by_file: dict[str, list[str]] = {}
        for unit in result.runner_failed:
            reds.append(
                {"kind": kind.id, "file": unit, "cases": [f"runner:{unit}"], "class": "runner"}
            )
        for case in result.red_cases():
            owner, _, name = case.partition("::")
            file = owner_to_file(normalize_owner(owner or name, repo), universe[kind.id])
            by_file.setdefault(file or "?", []).append(case)
        if result.unlocalized_red:
            by_file.setdefault("?", []).append(f"command:{kind.id}")
        for file, cases in by_file.items():
            entry: dict[str, Any] = {"kind": kind.id, "file": file, "cases": sorted(set(cases))}
            if file == "?" or blob(repo, base, file) is None:
                entry["class"] = "new"
            else:
                entry["class"] = "pending"
                pending.setdefault(kind.id, {})[file] = sorted(set(cases))
            reds.append(entry)
    for kind_id, by_file in pending.items():
        kind = config.kind(kind_id)
        again: KindResult | None = None
        why = unaskable_reason(kind) if kind.unaskable else ""
        if not why:
            try:
                with env.lock(kind), AtCommit(repo, base, state_rebuild(env, kind)):
                    again = execute_units(
                        env,
                        kind,
                        units_for(kind, sorted(by_file)),
                        f"pre-epic-{kind_id}",
                        lock=False,
                    )
            except StateRebuildFailed as error:
                why = f"{error}: the commit before the epic could not be asked"
        for entry in reds:
            if entry["class"] == "pending" and entry["kind"] == kind_id:
                if again is None:
                    entry["class"], entry["reason"] = "unattributed", why
                    continue
                red_before = _still_red(
                    again, entry["file"], entry["cases"], kind, universe[kind_id]
                )
                entry["class"] = "old" if red_before else "new"
    for entry in reds:
        touching = [s["story"] for s in registry if entry["file"] in s.get("files", [])]
        entry["stories"] = touching
        if entry["class"] == "old":
            entry["class"] = "old-touched" if entry["file"] in epic_changed else "old-untouched"

    if args.bisect and registry:
        merges = [s.get("merge_commit") or s["head"] for s in registry]
        suspects: dict[str, list[dict[str, Any]]] = {}
        for entry in reds:
            if entry["class"] == "new" and entry["file"] != "?":
                suspects.setdefault(entry["kind"], []).append(entry)
        for kind_id, entries in suspects.items():
            kind = config.kind(kind_id)
            if kind.unaskable:
                for entry in entries:
                    entry["first_bad_story"], entry["reason"] = None, unaskable_reason(kind)
                continue
            # one slot, one detached stretch and one restore per kind: with a state rebuild,
            # every step costs a rebuild, and the branch's own comes once, at the end
            with env.lock(kind), AtCommit(repo, None, state_rebuild(env, kind)) as tree:
                for entry in entries:
                    units = units_for(kind, [entry["file"]])

                    def bad(
                        commit: str,
                        kind: Kind = kind,
                        units: list[str] = units,
                        file: str = entry["file"],
                    ) -> bool:
                        if blob(repo, commit, file) is None:
                            return False
                        tree.move(commit)
                        return execute_units(env, kind, units, "bisect", lock=False).red

                    try:
                        index = first_bad(merges, bad)
                    except StateRebuildFailed as error:
                        entry["first_bad_story"] = None
                        entry["reason"] = f"{error}: the merge that broke it could not be traced"
                        continue
                    entry["first_bad_story"] = (
                        registry[index]["story"] if index is not None else None
                    )

    registered = {s.get("merge_commit") for s in registry}
    merges = git_text(repo, "rev-list", "--first-parent", "--merges", f"{base}..{head}").split()
    unregistered = [m for m in merges if m not in registered]
    judge = [
        {
            "story": s["story"],
            "files": s.get("files", []),
            "commit": s.get("merge_commit"),
            "head": s["head"],
        }
        for s in registry
        if s.get("no_tests")
    ]
    # stories the master merged on an inconclusive gate: the whole suite here is their first
    # complete measurement, and the reds above are attributed to them like to any other
    inconclusive = [
        {"story": s["story"], "cut": s.get("cut", [])} for s in registry if s.get("inconclusive")
    ]
    blocking = [r for r in reds if r["class"] in ("new", "old-touched", "runner", "unattributed")]
    record = {
        "format": FORMAT,
        "epic": args.name,
        "base": base,
        "head": head,
        "measured_at": _now(),
        "ran_full_suite": config.epic_full_suite,
        "kinds": [k.id for k in kinds],
        "verdict": "red" if blocking or unregistered else "green",
        "reds": reds,
        "unregistered_merges": unregistered,
        "no_test_stories": judge,
        "inconclusive_merges": inconclusive,
        "commands": seal([c for r in results for c in r.commands]),
        "written": written_since(repo, untracked_before),
    }
    out = Path(args.out) if args.out else report_dir / f"epic-{_safe(args.name)}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for red in reds:
        counts[red["class"]] = counts.get(red["class"], 0) + 1
    say(
        f"epic {args.name}: {record['verdict'].upper()} — "
        + (", ".join(f"{n} {c}" for c, n in sorted(counts.items())) or "no reds")
    )
    for red in reds:
        who = f" -> {red.get('first_bad_story') or ','.join(red['stories']) or '-'}"
        say(f"  {red['class']}: {red['file']} ({red['kind']}){who}")
        if red.get("reason"):
            say(f"    not attributed: {red['reason']}")
    if any(r["class"] == "unattributed" or r.get("reason") for r in reds):
        say(
            "  a red the tool could not attribute is the DIAGNOSIS's: it names the story from the "
            "red's log and the merges' diffs (the `stories` that touched the file first) — never "
            "by running old code against the state the new code left"
        )
    if unregistered:
        say(f"  merged without the gate: {[m[:10] for m in unregistered]}")
    if inconclusive:
        say(
            f"  {len(inconclusive)} story(ies) merged on an inconclusive gate: "
            f"{[i['story'] for i in inconclusive]} — this suite is their first full measurement"
        )
    if judge:
        say(
            f"  {len(judge)} story(ies) merged with no test: {[j['story'] for j in judge]} — judge them"
        )
    _say_written(record)
    say(f"report: {out}")
    return EXIT_NEGATIVE if blocking or unregistered else EXIT_OK


# ---------------------------------------------------------------------------- run, record


def cmd_run(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    config = load_config(repo, args.config, None)
    kind = config.kind(args.kind)
    env = make_env(repo, config, args, "run")
    result = execute_units(env, kind, units_for(kind, list(args.files)), "run")
    reds = len(result.red_cases()) or len(result.red_units())
    say(
        f"run {kind.id}: {'RED' if result.red else 'GREEN'} ({reds} red, report: {result.strength})"
    )
    if result.strength == "junit" and not kind.each:
        # A runner that takes ONE path per invocation ignores the rest without a word; the
        # report shows it — a file handed over that no case came back for.
        head_files = files_at(repo, "HEAD") if rev(repo, "HEAD") else []
        universe = sorted(set(args.files) | {f for f in head_files if config.kind_of(f) is kind})
        covered = {case_key(c, repo, universe)[0] for c in result.cases}
        for file in args.files:
            if file not in covered:
                say(
                    f"warning: no case reported for {file} — the runner may take one path per "
                    f"invocation: set `each = true` for kind {kind.id!r}"
                )
    return EXIT_NEGATIVE if result.red else EXIT_OK


def toml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def cmd_record(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    config = load_config(repo, args.config, None)
    env = make_env(repo, config, args, "record")
    by_kind: dict[str, list[str]] = {}
    for path in args.tests:
        kind = config.kind_of(path)
        if kind is None:
            raise Refusal(f"{path} matches no [[kind]] glob")
        by_kind.setdefault(kind.id, []).append(path)
    cases: dict[str, str] = {}
    strength = "junit"
    for kind_id, files in by_kind.items():
        kind = config.kind(kind_id)
        result = execute_units(env, kind, units_for(kind, files), "record")
        cases.update(result.cases)
        for unit, rc in result.unit_rc.items():
            cases[unit] = "failure" if rc != 0 else "passed"
        if result.strength == "rc":
            strength = "rc"
    wanted = ("failure", "error") if args.expect == "red" else ("passed",)
    mismatched = sorted(c for c, o in cases.items() if o not in wanted)
    lines = [
        f"format = {FORMAT}",
        f"story = {toml_str(args.story or '')}",
        f"ref = {toml_str(rev(repo, 'HEAD'))}",
        f"expect = {toml_str(args.expect)}",
        f"strength = {toml_str(strength)}",
        f"recorded_at = {toml_str(_now())}",
        "",
    ]
    for case, outcome in sorted(cases.items()):
        lines += ["[[case]]", f"id = {toml_str(case)}", f"result = {toml_str(outcome)}", ""]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    say(f"recorded {len(cases)} case(s) -> {out}; not {args.expect}: {len(mismatched)}")
    for case in mismatched:
        say(f"  not {args.expect}: {case} ({cases[case]})")
    return EXIT_OK if not mismatched else EXIT_NEGATIVE


# ------------------------------------------------------------------------------------ check


def cmd_check(args: argparse.Namespace) -> int:
    repo = toplevel(Path(args.repo))
    path = repo / args.config
    if not path.is_file():
        sys.stdout.write(
            f"error: {args.config} is missing — run waves-tests [D]\ncheck: 1 error(s), 0 warning(s)\n"
        )
        return EXIT_NEGATIVE
    try:
        doc = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as error:
        sys.stdout.write(
            f"error: {args.config} does not parse: {error}\ncheck: 1 error(s), 0 warning(s)\n"
        )
        return EXIT_NEGATIVE
    config = parse_config(path.read_text(encoding="utf-8"), args.config)
    errors, warnings = config_errors(doc, config)
    head_files = (
        files_at(repo, "HEAD")
        if git(repo, "rev-parse", "--verify", "--quiet", "HEAD", check=False).returncode == 0
        else []
    )
    for kind in config.kinds:
        if head_files and not any(any_match(kind.glob, f) for f in head_files):
            warnings.append(f"kind {kind.id!r}: its glob matches no file at HEAD")
    # Two globs spelled differently can claim one file; the first kind wins silently, and a
    # browser test filed under `unit` runs on the wrong queue with the wrong capacity.
    claimed: list[tuple[str, list[str]]] = []
    for file in head_files:
        kinds = [k.id for k in config.kinds if any_match(k.glob, file)]
        if len(kinds) > 1:
            claimed.append((file, kinds))
    if claimed:
        examples = "; ".join(
            f"{kinds[0]!r} wins over {', '.join(repr(k) for k in kinds[1:])} for {file}"
            for file, kinds in claimed[:3]
        )
        warnings.append(
            f"{len(claimed)} file(s) at HEAD match more than one kind — {examples}"
            + (" …" if len(claimed) > 3 else "")
            + ": make the globs disjoint, or list the narrower kind first"
        )
    for line in errors:
        sys.stdout.write(f"error: {line}\n")
    for line in warnings:
        sys.stdout.write(f"warning: {line}\n")
    sys.stdout.write(f"check: {len(errors)} error(s), {len(warnings)} warning(s)\n")
    return EXIT_NEGATIVE if errors else EXIT_OK


# ------------------------------------------------------------------------------------ cli


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tests_memory.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--repo", default=".", help="any path inside the repository")
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--memory-dir", default=DEFAULT_MEMORY_DIR)
    parser.add_argument("--report-dir", default=DEFAULT_REPORT_DIR)
    parser.add_argument(
        "--lock-root", help="the locks' directory (default: the main checkout's .waves/tests.lock)"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check", help="the config is well-formed")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("gate", help="a story's tests, at HEAD, against its base")
    p.add_argument("--base", required=True, help="the integration branch (or its commit)")
    p.add_argument("--story", required=True)
    p.add_argument(
        "--atdd",
        nargs="*",
        default=[],
        help="the story's acceptance test files, added to wave 0's record at the merge-base",
    )
    p.add_argument("--spec", help="the story's spec file (the sections it owes are read there)")
    p.add_argument("--scope-override", choices=("story", "full"), help="override the config scope")
    p.add_argument(
        "--budget",
        type=float,
        help="the rung's budget in seconds of running time: a command past it is cut and the "
        "verdict is `inconclusive` (never green)",
    )
    p.add_argument("--marker", action="store_true")
    p.set_defaults(func=cmd_gate)

    p = sub.add_parser("merge", help="merge a story's commit, refusing without a green report")
    p.add_argument("--story", required=True)
    p.add_argument("--head", required=True, help="the ready-to-merge commit")
    p.add_argument("--report", required=True, help="the gate report of the story")
    p.add_argument(
        "--branch", help="the front's branch: refused unless its tip is --head (it moved on)"
    )
    p.add_argument(
        "--accept-inconclusive",
        action="store_true",
        help="merge on an `inconclusive` report (the rung was cut at its budget, nothing red "
        "among what ran); recorded in the registry, measured for real at the epic's close",
    )
    p.add_argument("--ff-only", action="store_true")
    p.set_defaults(func=cmd_merge)

    p = sub.add_parser("epic", help="the whole tree at an epic's boundary")
    p.add_argument("--base", required=True, help="the commit before the epic")
    p.add_argument("--name", required=True)
    p.add_argument(
        "--kind",
        action="append",
        help="run only this kind's full command (repeatable) — a close spread over several "
        "trees runs a subset in each; default: every kind",
    )
    p.add_argument("--no-bisect", dest="bisect", action="store_false")
    p.add_argument("--out")
    p.add_argument("--marker", action="store_true")
    p.set_defaults(func=cmd_epic)

    p = sub.add_parser("run", help="one kind's command over files, queued")
    p.add_argument("--kind", required=True)
    p.add_argument("files", nargs="+")
    p.add_argument("--budget", type=float, help="seconds of running time before the run is cut")
    p.add_argument("--marker", action="store_true")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("record", help="run acceptance files and record each case")
    p.add_argument("--tests", nargs="+", required=True)
    p.add_argument("--expect", choices=("red", "green"), required=True)
    p.add_argument("--story")
    p.add_argument("--out", required=True)
    p.add_argument("--marker", action="store_true")
    p.set_defaults(func=cmd_record)
    return parser


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)
    code = EXIT_USAGE
    try:
        code = args.func(args)
    except Refusal as error:
        sys.stderr.write(f"refused: {error}\n")
        code = EXIT_USAGE
    except SystemExit as stop:
        code = stop.code if isinstance(stop.code, int) else EXIT_USAGE
    finally:
        if getattr(args, "marker", False):
            say(f"SUITE-DONE rc={code}")
    return code


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, _frame: sys.exit(128 + signum))
    raise SystemExit(main())
