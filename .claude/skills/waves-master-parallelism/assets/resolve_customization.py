#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Resolve a Waves skill's customization — the shipped default, then the project's team
and personal layers under ``_waves/custom/``.

Every Waves skill that ships a ``customize.toml`` ships this file beside it, byte-identical
in each (a test pins the copies together). A copy per skill, not one shared file, because a
skill is installed on its own and must not depend on a sibling being present.

Layers, later wins:

1. ``<skill>/customize.toml`` — the shipped default; required.
2. ``<project>/_waves/custom/<skill>.toml`` — the team layer; versioned.
3. ``<project>/_waves/custom/<skill>.user.toml`` — the personal layer; gitignored.

``<skill>`` is the skill's directory name. The merge is the BMAD Method's own, so an
operator who learned it there learns nothing new here: tables merge recursively; an array
of tables whose items all carry ``code`` (else ``id``) merges by that key — a match is
replaced in place, the rest append; any other array appends; a scalar from the override
wins.

``_bmad/custom/`` is NOT read. Waves skills were customized there before their overrides
moved to a directory of their own; ``waves init`` moves the team layer. A team layer left
behind is a refusal (exit 4), not a warning: a skill that ran on the shipped defaults after
an update would silently drop every setting the team made.

Exit codes — the calling skill's Step 1 maps each to an action:

* ``0`` the merged JSON is on stdout.
* ``1`` a layer is present and unusable (unparseable, not a file, a bad keyed identifier):
  the skill stops and names the file. Merging it by hand would reproduce the same break.
* ``2`` usage error.
* ``3`` no ``tomllib`` (Python older than 3.11): the skill merges by hand.
* ``4`` the team layer is still at ``_bmad/custom/<skill>.toml`` and none exists at
  ``_waves/custom/<skill>.toml``: the skill stops and prints the move.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:
    sys.stderr.write("error: Python 3.11+ is required (stdlib `tomllib` not found)\n")
    raise SystemExit(3) from None

CUSTOM_DIR = Path("_waves") / "custom"
LEGACY_DIR = Path("_bmad") / "custom"
KEYED_FIELDS = ("code", "id")

EXIT_OK = 0
EXIT_BAD_LAYER = 1
EXIT_UNMOVED = 4

_MISSING = object()


class LayerError(ValueError):
    """A present layer that cannot be used as-is."""


def load_layer(path: Path, *, required: bool = False) -> dict[str, Any]:
    if not path.exists():
        if required:
            raise LayerError(f"required TOML file not found: {path}")
        return {}
    if not path.is_file():
        raise LayerError(f"TOML layer is not a file: {path}")
    try:
        with path.open("rb") as stream:
            return tomllib.load(stream)
    except tomllib.TOMLDecodeError as error:
        raise LayerError(f"failed to parse {path}: {error}") from error
    except OSError as error:
        raise LayerError(f"failed to read {path}: {error}") from error


def _keyed_field(items: list[Any]) -> str | None:
    if not items or not all(isinstance(item, dict) for item in items):
        return None
    for candidate in KEYED_FIELDS:
        if all(candidate in item for item in items):
            for item in items:
                value = item[candidate]
                if not isinstance(value, str) or not value:
                    raise LayerError(
                        f"keyed array identifier `{candidate}` must be a non-empty string, "
                        f"got {value!r}"
                    )
            return candidate
    return None


def merge_arrays(base: list[Any], override: list[Any]) -> list[Any]:
    field = _keyed_field(base + override)
    if field is None:
        return list(base) + list(override)
    result: list[Any] = []
    index: dict[str, int] = {}
    for item in base:
        copied = dict(item)
        index[copied[field]] = len(result)
        result.append(copied)
    for item in override:
        copied = dict(item)
        key = copied[field]
        if key in index:
            result[index[key]] = copied
        else:
            index[key] = len(result)
            result.append(copied)
    return result


def merge(base: Any, override: Any) -> Any:
    if isinstance(base, dict) and isinstance(override, dict):
        result = dict(base)
        for key, value in override.items():
            result[key] = merge(result[key], value) if key in result else value
        return result
    if isinstance(base, list) and isinstance(override, list):
        return merge_arrays(base, override)
    return override


def extract(data: Any, dotted: str) -> Any:
    node = data
    for part in dotted.split("."):
        if not isinstance(node, dict) or part not in node:
            return _MISSING
        node = node[part]
    return node


def resolve(skill_dir: Path, project_root: Path) -> dict[str, Any]:
    name = skill_dir.name
    merged: dict[str, Any] = {}
    for layer in (
        load_layer(skill_dir / "customize.toml", required=True),
        load_layer(project_root / CUSTOM_DIR / f"{name}.toml"),
        load_layer(project_root / CUSTOM_DIR / f"{name}.user.toml"),
    ):
        merged = merge(merged, layer)
    return merged


def unmoved_team_layer(skill_dir: Path, project_root: Path) -> Path | None:
    """The old-location team layer when it is the only one — the case that refuses."""
    name = skill_dir.name
    legacy = project_root / LEGACY_DIR / f"{name}.toml"
    current = project_root / CUSTOM_DIR / f"{name}.toml"
    return legacy if legacy.is_file() and not current.exists() else None


def legacy_warnings(skill_dir: Path, project_root: Path) -> list[str]:
    name = skill_dir.name
    lines = []
    legacy_team = LEGACY_DIR / f"{name}.toml"
    if (project_root / legacy_team).is_file() and (
        project_root / CUSTOM_DIR / f"{name}.toml"
    ).exists():
        lines.append(
            f"warning: {legacy_team.as_posix()} is left over beside "
            f"{(CUSTOM_DIR / f'{name}.toml').as_posix()} and is not read; merge it by hand, "
            "then delete it"
        )
    legacy_user = LEGACY_DIR / f"{name}.user.toml"
    if (project_root / legacy_user).is_file():
        lines.append(
            f"warning: {legacy_user.as_posix()} is not read; move it by hand to "
            f"{(CUSTOM_DIR / f'{name}.user.toml').as_posix()} (the personal layer is never "
            "moved for you)"
        )
    return lines


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Resolve a Waves skill's customization from _waves/custom/."
    )
    parser.add_argument("--skill", "-s", required=True, help="the skill's directory")
    parser.add_argument("--project-root", "-p", required=True, help="the project's root")
    parser.add_argument(
        "--key",
        "-k",
        action="append",
        default=[],
        help="dotted field to resolve (repeatable); omit for the whole document",
    )
    args = parser.parse_args(argv)
    skill_dir = Path(args.skill).resolve()
    project_root = Path(args.project_root).resolve()

    unmoved = unmoved_team_layer(skill_dir, project_root)
    if unmoved is not None:
        name = skill_dir.name
        old = (LEGACY_DIR / f"{name}.toml").as_posix()
        new = (CUSTOM_DIR / f"{name}.toml").as_posix()
        sys.stderr.write(
            f"error: {old} is this skill's team override at its old location, and it is "
            f"NOT read from there.\n"
            f"  move it:  mkdir -p {CUSTOM_DIR.as_posix()} && git mv {old} {new}\n"
            f"  (`waves init` performs the same move; if _bmad/ is not versioned, move the "
            f"file with plain `mv`)\n"
        )
        return EXIT_UNMOVED
    for line in legacy_warnings(skill_dir, project_root):
        sys.stderr.write(line + "\n")

    try:
        merged = resolve(skill_dir, project_root)
    except LayerError as error:
        sys.stderr.write(f"error: {error}\n")
        return EXIT_BAD_LAYER

    output: dict[str, Any] = merged
    if args.key:
        output = {}
        for key in args.key:
            value = extract(merged, key)
            if value is not _MISSING:
                output[key] = value
    json.dump(output, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return EXIT_OK


if __name__ == "__main__":
    raise SystemExit(main())
