#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# ///
"""Dockerfile validator with hadolint-like rules (native Python implementation).

Validates Dockerfiles against best practices without external dependencies.
Rules: D001-D015 (syntax pragma, MAINTAINER, FROM tags, CMD form, apt cleanup,
non-root USER, HEALTHCHECK, cache mounts, consecutive RUNs, etc.)

Usage:
    python validate_dockerfile.py <dockerfile-path> [--format json|text] [--strict]
    python validate_dockerfile.py --check-project [--format json|text]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


class Severity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class LintResult:
    rule_id: str
    severity: Severity
    line: int
    message: str
    suggestion: Optional[str] = None


@dataclass
class LintReport:
    file: str
    results: list[LintResult] = field(default_factory=list)
    total_errors: int = 0
    total_warnings: int = 0
    total_info: int = 0

    def add(self, result: LintResult) -> None:
        self.results.append(result)
        if result.severity == Severity.ERROR:
            self.total_errors += 1
        elif result.severity == Severity.WARNING:
            self.total_warnings += 1
        else:
            self.total_info += 1

    def to_dict(self) -> dict:
        return {
            "file": self.file,
            "total_errors": self.total_errors,
            "total_warnings": self.total_warnings,
            "total_info": self.total_info,
            "results": [
                {
                    "rule_id": r.rule_id,
                    "severity": r.severity.value,
                    "line": r.line,
                    "message": r.message,
                    "suggestion": r.suggestion,
                }
                for r in self.results
            ],
        }

    def to_text(self) -> str:
        lines = [f"Dockerfile Lint Report: {self.file}"]
        lines.append(
            f"Errors: {self.total_errors} | Warnings: {self.total_warnings} | Info: {self.total_info}"
        )
        lines.append("-" * 60)
        for r in self.results:
            prefix = f"[{r.severity.value.upper():7s}]"
            lines.append(f"  {prefix} L{r.line:4d}: [{r.rule_id}] {r.message}")
            if r.suggestion:
                lines.append(f"           → {r.suggestion}")
        lines.append("-" * 60)
        if self.total_errors > 0:
            lines.append("RESULT: FAIL — errors found")
        elif self.total_warnings > 0:
            lines.append("RESULT: WARN — warnings found")
        else:
            lines.append("RESULT: PASS — no issues found")
        return "\n".join(lines)


def _check_d001_syntax_pragma(lines: list[str], report: LintReport) -> None:
    """D001: Syntax pragma must be the first non-comment, non-empty line."""
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            if "syntax=" in stripped:
                return  # Found it
            continue
        # First non-comment, non-empty line is not syntax pragma
        report.add(
            LintResult(
                rule_id="D001",
                severity=Severity.ERROR,
                line=1,
                message="Dockerfile must start with '# syntax=docker/dockerfile:1' pragma",
                suggestion="Add '# syntax=docker/dockerfile:1' as the first line",
            )
        )
        return
    # All lines were comments or empty
    report.add(
        LintResult(
            rule_id="D001",
            severity=Severity.ERROR,
            line=1,
            message="Dockerfile has no instructions, only comments",
        )
    )


def _check_d002_maintainer(lines: list[str], report: LintReport) -> None:
    """D002: MAINTAINER is obsolete, use LABEL maintainer=."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^MAINTAINER\s+", stripped):
            report.add(
                LintResult(
                    rule_id="D002",
                    severity=Severity.ERROR,
                    line=i,
                    message="MAINTAINER is obsolete",
                    suggestion="Use LABEL maintainer=\"name <email>\" instead",
                )
            )


def _check_d003_from_no_version(lines: list[str], report: LintReport) -> None:
    """D003: FROM without explicit version tag."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        match = re.match(r"^FROM\s+(\S+)", stripped)
        if match:
            image = match.group(1)
            # Skip --platform, AS alias, etc.
            if image.startswith("--"):
                continue
            # Check if it has a tag
            if ":" not in image and "@" not in image:
                report.add(
                    LintResult(
                        rule_id="D003",
                        severity=Severity.WARNING,
                        line=i,
                        message=f"FROM {image} has no version tag",
                        suggestion=f"Pin a specific version: {image}:<version>",
                    )
                )


def _check_d004_from_latest(lines: list[str], report: LintReport) -> None:
    """D004: FROM with :latest tag."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        match = re.match(r"^FROM\s+(\S+)", stripped)
        if match:
            image = match.group(1)
            if image.endswith(":latest"):
                report.add(
                    LintResult(
                        rule_id="D004",
                        severity=Severity.WARNING,
                        line=i,
                        message=f"FROM {image} uses :latest tag",
                        suggestion="Use a specific version tag for reproducibility",
                    )
                )


def _check_d005_cmd_shell_form(lines: list[str], report: LintReport) -> None:
    """D005: CMD in shell form instead of exec form."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Match CMD but not CMD []
        if re.match(r"^CMD\s+[^[\"]", stripped):
            report.add(
                LintResult(
                    rule_id="D005",
                    severity=Severity.INFO,
                    line=i,
                    message="CMD uses shell form",
                    suggestion='Use exec form: CMD ["executable", "arg1"]',
                )
            )


def _check_d006_apt_no_cleanup(lines: list[str], report: LintReport) -> None:
    """D006: apt-get install without cleanup."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if "apt-get" in stripped and "install" in stripped:
            # Check if this line or surrounding context has rm -rf /var/lib/apt
            # Look in the same RUN block (simple heuristic: check current line)
            if "rm -rf /var/lib/apt" not in stripped and "--mount=type=cache" not in stripped:
                report.add(
                    LintResult(
                        rule_id="D006",
                        severity=Severity.WARNING,
                        line=i,
                        message="apt-get install without cleaning apt lists",
                        suggestion="Add '&& rm -rf /var/lib/apt/lists/*' or use cache mount",
                    )
                )


def _check_d007_apt_no_norecommends(lines: list[str], report: LintReport) -> None:
    """D007: apt-get install without --no-install-recommends."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if "apt-get" in stripped and "install" in stripped:
            if "--no-install-recommends" not in stripped:
                report.add(
                    LintResult(
                        rule_id="D007",
                        severity=Severity.INFO,
                        line=i,
                        message="apt-get install without --no-install-recommends",
                        suggestion="Add --no-install-recommends to reduce image size",
                    )
                )


def _check_d008_add_vs_copy(lines: list[str], report: LintReport) -> None:
    """D008: ADD used instead of COPY."""
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if re.match(r"^ADD\s+", stripped):
            report.add(
                LintResult(
                    rule_id="D008",
                    severity=Severity.ERROR,
                    line=i,
                    message="ADD used instead of COPY",
                    suggestion="Use COPY unless ADD features (tar extraction, URL fetch) are needed",
                )
            )


def _check_d009_no_user(lines: list[str], report: LintReport) -> None:
    """D009: No non-root USER instruction found."""
    has_user = False
    for line in lines:
        stripped = line.strip()
        if re.match(r"^USER\s+", stripped):
            user = stripped.split()[1]
            if user.lower() not in ("root",):
                has_user = True
                break
    if not has_user:
        report.add(
            LintResult(
                rule_id="D009",
                severity=Severity.WARNING,
                line=0,
                message="No non-root USER instruction found",
                suggestion="Add a non-root user: RUN adduser -S appuser && USER appuser",
            )
        )


def _check_d010_no_healthcheck(lines: list[str], report: LintReport) -> None:
    """D010: No HEALTHCHECK instruction found."""
    has_healthcheck = False
    for line in lines:
        if line.strip().startswith("HEALTHCHECK"):
            has_healthcheck = True
            break
    if not has_healthcheck:
        report.add(
            LintResult(
                rule_id="D010",
                severity=Severity.INFO,
                line=0,
                message="No HEALTHCHECK instruction found",
                suggestion="Add HEALTHCHECK for container orchestration",
            )
        )


def _check_d011_no_cache_mount(lines: list[str], report: LintReport) -> None:
    """D011: Package manager commands without cache mounts."""
    cache_patterns = [
        (r"npm\s+(ci|install)", "npm"),
        (r"pip\s+install", "pip"),
        (r"cargo\s+build", "cargo"),
        (r"go\s+build", "go"),
    ]
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        for pattern, name in cache_patterns:
            if re.search(pattern, stripped) and "--mount=type=cache" not in stripped:
                report.add(
                    LintResult(
                        rule_id="D011",
                        severity=Severity.WARNING,
                        line=i,
                        message=f"{name} command without cache mount",
                        suggestion=f"Add --mount=type=cache,target=<cache-path> for {name}",
                    )
                )
                break


def _check_d012_consecutive_runs(lines: list[str], report: LintReport) -> None:
    """D012: Multiple consecutive RUN instructions."""
    consecutive = 0
    last_run_line = 0
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("RUN "):
            if consecutive == 0:
                last_run_line = i
            consecutive += 1
        elif stripped and not stripped.startswith("#"):
            if consecutive > 2:
                report.add(
                    LintResult(
                        rule_id="D012",
                        severity=Severity.WARNING,
                        line=last_run_line,
                        message=f"{consecutive} consecutive RUN instructions",
                        suggestion="Consolidate into fewer RUN commands with &&",
                    )
                )
            consecutive = 0


def _check_d015_no_dockerignore(project_root: str, report: LintReport) -> None:
    """D015: No .dockerignore file found."""
    dockerignore = Path(project_root) / ".dockerignore"
    if not dockerignore.exists():
        report.add(
            LintResult(
                rule_id="D015",
                severity=Severity.WARNING,
                line=0,
                message="No .dockerignore file found in project root",
                suggestion="Create .dockerignore to exclude .git, node_modules, .env, etc.",
            )
        )


def validate_dockerfile(file_path: str, strict: bool = False) -> LintReport:
    """Validate a Dockerfile and return a lint report."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Dockerfile not found: {file_path}")

    lines = path.read_text().splitlines()
    report = LintReport(file=str(path))

    # Run all checks
    _check_d001_syntax_pragma(lines, report)
    _check_d002_maintainer(lines, report)
    _check_d003_from_no_version(lines, report)
    _check_d004_from_latest(lines, report)
    _check_d005_cmd_shell_form(lines, report)
    _check_d006_apt_no_cleanup(lines, report)
    _check_d007_apt_no_norecommends(lines, report)
    _check_d008_add_vs_copy(lines, report)
    _check_d009_no_user(lines, report)
    _check_d010_no_healthcheck(lines, report)
    _check_d011_no_cache_mount(lines, report)
    _check_d012_consecutive_runs(lines, report)

    # Check .dockerignore if project root can be determined
    if path.parent.name:
        _check_d015_no_dockerignore(str(path.parent), report)

    # In strict mode, promote warnings to errors
    if strict:
        for result in report.results:
            if result.severity == Severity.WARNING:
                result.severity = Severity.ERROR

    return report


def validate_project(project_root: str, strict: bool = False) -> list[LintReport]:
    """Validate all Dockerfiles in a project."""
    root = Path(project_root)
    reports = []

    for dockerfile in root.rglob("Dockerfile*"):
        # Skip hidden directories and node_modules
        parts = dockerfile.parts
        if any(p.startswith(".") and p not in (".",) for p in parts):
            continue
        if "node_modules" in parts:
            continue
        reports.append(validate_dockerfile(str(dockerfile), strict=strict))

    return reports


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate Dockerfiles against best practices"
    )
    parser.add_argument("file", nargs="?", help="Path to Dockerfile")
    parser.add_argument(
        "--check-project",
        action="store_true",
        help="Validate all Dockerfiles in current directory tree",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors",
    )
    args = parser.parse_args()

    if args.check_project:
        reports = validate_project(os.getcwd(), strict=args.strict)
    elif args.file:
        reports = [validate_dockerfile(args.file, strict=args.strict)]
    else:
        parser.print_help()
        sys.exit(1)

    if args.format == "json":
        output = [r.to_dict() for r in reports]
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        for report in reports:
            print(report.to_text())
            print()

    # Exit code based on errors
    total_errors = sum(r.total_errors for r in reports)
    sys.exit(1 if total_errors > 0 else 0)


if __name__ == "__main__":
    main()
