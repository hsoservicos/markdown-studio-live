#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# ///
"""Docker Compose validator with Compose Specification rules (native Python).

Validates docker-compose.yml / compose.yaml files against current best practices.
Rules: C001-C007 (version field, filename, CLI convention, links, depends_on, etc.)

Usage:
    python validate_compose.py <compose-file> [--format json|text] [--strict]
    python validate_compose.py --check-project [--format json|text]
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
from typing import Any, Optional

try:
    import yaml

    HAS_YAML = True
except ImportError:
    HAS_YAML = False


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
        lines = [f"Compose Lint Report: {self.file}"]
        lines.append(
            f"Errors: {self.total_errors} | Warnings: {self.total_warnings} | Info: {self.total_info}"
        )
        lines.append("-" * 60)
        for r in self.results:
            prefix = f"[{r.severity.value.upper():7s}]"
            line_info = f"L{r.line:4d}" if r.line > 0 else "    "
            lines.append(f"  {prefix} {line_info}: [{r.rule_id}] {r.message}")
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


def _find_line_number(content: str, key: str) -> int:
    """Find the line number of a key in raw content."""
    for i, line in enumerate(content.splitlines(), 1):
        if key in line:
            return i
    return 0


def _check_c001_version_field(data: dict, content: str, report: LintReport) -> None:
    """C001: 'version' field is obsolete in Compose Specification."""
    if "version" in data:
        line = _find_line_number(content, "version")
        report.add(
            LintResult(
                rule_id="C001",
                severity=Severity.ERROR,
                line=line,
                message="'version' field is obsolete in Compose Specification",
                suggestion="Remove the 'version' field entirely",
            )
        )


def _check_c002_filename(file_path: str, report: LintReport) -> None:
    """C002: Prefer compose.yaml over docker-compose.yml."""
    basename = os.path.basename(file_path)
    legacy_names = [
        "docker-compose.yml",
        "docker-compose.yaml",
        "docker-compose.override.yml",
        "docker-compose.override.yaml",
    ]
    if basename in legacy_names:
        report.add(
            LintResult(
                rule_id="C002",
                severity=Severity.INFO,
                line=0,
                message=f"Filename '{basename}' is legacy convention",
                suggestion="Use 'compose.yaml' or 'compose.yml' instead",
            )
        )


def _check_c004_links(data: dict, report: LintReport) -> None:
    """C004: 'links' is deprecated, use 'networks'."""
    services = data.get("services", {})
    if not isinstance(services, dict):
        return
    for svc_name, svc_config in services.items():
        if isinstance(svc_config, dict) and "links" in svc_config:
            report.add(
                LintResult(
                    rule_id="C004",
                    severity=Severity.WARNING,
                    line=0,
                    message=f"Service '{svc_name}' uses deprecated 'links'",
                    suggestion="Use 'networks' for service communication instead",
                )
            )


def _check_c005_depends_on_form(data: dict, report: LintReport) -> None:
    """C005: depends_on without condition (simplified form)."""
    services = data.get("services", {})
    if not isinstance(services, dict):
        return
    for svc_name, svc_config in services.items():
        if not isinstance(svc_config, dict):
            continue
        depends = svc_config.get("depends_on", {})
        if isinstance(depends, list):
            # Simplified form: depends_on: [service1, service2]
            report.add(
                LintResult(
                    rule_id="C005",
                    severity=Severity.INFO,
                    line=0,
                    message=f"Service '{svc_name}' uses simplified depends_on form",
                    suggestion="Use 'depends_on' with 'condition: service_healthy' for proper startup ordering",
                )
            )


def _check_c006_no_healthcheck_on_deps(data: dict, report: LintReport) -> None:
    """C006: Services in depends_on without healthcheck."""
    services = data.get("services", {})
    if not isinstance(services, dict):
        return

    # Collect all services referenced in depends_on with condition
    deps_with_condition = set()
    for svc_name, svc_config in services.items():
        if not isinstance(svc_config, dict):
            continue
        depends = svc_config.get("depends_on", {})
        if isinstance(depends, dict):
            for dep_name, dep_config in depends.items():
                if isinstance(dep_config, dict) and dep_config.get("condition") == "service_healthy":
                    deps_with_condition.add(dep_name)

    # Check if those services have healthchecks
    for dep_name in deps_with_condition:
        svc_config = services.get(dep_name, {})
        if isinstance(svc_config, dict):
            if "healthcheck" not in svc_config:
                report.add(
                    LintResult(
                        rule_id="C006",
                        severity=Severity.WARNING,
                        line=0,
                        message=f"Service '{dep_name}' is referenced with condition: service_healthy but has no healthcheck",
                        suggestion="Add a healthcheck to the dependency service",
                    )
                )


def _check_c007_no_resource_limits(data: dict, report: LintReport) -> None:
    """C007: No resource limits defined."""
    services = data.get("services", {})
    if not isinstance(services, dict):
        return

    services_without_limits = []
    for svc_name, svc_config in services.items():
        if not isinstance(svc_config, dict):
            continue
        deploy = svc_config.get("deploy", {})
        if not isinstance(deploy, dict):
            services_without_limits.append(svc_name)
            continue
        resources = deploy.get("resources", {})
        if not isinstance(resources, dict):
            services_without_limits.append(svc_name)
            continue
        if "limits" not in resources:
            services_without_limits.append(svc_name)

    if services_without_limits:
        report.add(
            LintResult(
                rule_id="C007",
                severity=Severity.WARNING,
                line=0,
                message=f"Services without resource limits: {', '.join(services_without_limits)}",
                suggestion="Add deploy.resources.limits for production deployments",
            )
        )


def _check_text_patterns(content: str, report: LintReport) -> None:
    """Check patterns in raw text (fallback when PyYAML not available)."""
    # C001: version field
    version_match = re.search(r"^version\s*:", content, re.MULTILINE)
    if version_match:
        line = content[: version_match.start()].count("\n") + 1
        report.add(
            LintResult(
                rule_id="C001",
                severity=Severity.ERROR,
                line=line,
                message="'version' field is obsolete in Compose Specification",
                suggestion="Remove the 'version' field entirely",
            )
        )

    # C004: links
    links_match = re.search(r"links\s*:", content)
    if links_match:
        line = content[: links_match.start()].count("\n") + 1
        report.add(
            LintResult(
                rule_id="C004",
                severity=Severity.WARNING,
                line=line,
                message="Deprecated 'links' directive found",
                suggestion="Use 'networks' for service communication instead",
            )
        )


def validate_compose(file_path: str, strict: bool = False) -> LintReport:
    """Validate a docker-compose / compose file and return a lint report."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Compose file not found: {file_path}")

    content = path.read_text()
    report = LintReport(file=str(path))

    # C002: Filename check (always, no parsing needed)
    _check_c002_filename(str(path), report)

    if HAS_YAML:
        try:
            data = yaml.safe_load(content)
            if not isinstance(data, dict):
                report.add(
                    LintResult(
                        rule_id="C001",
                        severity=Severity.ERROR,
                        line=0,
                        message="Compose file is empty or invalid YAML",
                    )
                )
                return report

            _check_c001_version_field(data, content, report)
            _check_c004_links(data, report)
            _check_c005_depends_on_form(data, report)
            _check_c006_no_healthcheck_on_deps(data, report)
            _check_c007_no_resource_limits(data, report)

        except yaml.YAMLError as e:
            line = 0
            if hasattr(e, "problem_mark") and e.problem_mark:
                line = e.problem_mark.line + 1
            report.add(
                LintResult(
                    rule_id="C001",
                    severity=Severity.ERROR,
                    line=line,
                    message=f"YAML parse error: {e}",
                )
            )
    else:
        # Fallback: text-based pattern matching
        report.add(
            LintResult(
                rule_id="C000",
                severity=Severity.INFO,
                line=0,
                message="PyYAML not available — using text-based validation only",
                suggestion="Install PyYAML for full validation: pip install pyyaml",
            )
        )
        _check_text_patterns(content, report)

    # In strict mode, promote warnings to errors
    if strict:
        for result in report.results:
            if result.severity == Severity.WARNING:
                result.severity = Severity.ERROR

    return report


def validate_project(project_root: str, strict: bool = False) -> list[LintReport]:
    """Validate all compose files in a project."""
    root = Path(project_root)
    reports = []
    compose_names = [
        "docker-compose.yml",
        "docker-compose.yaml",
        "compose.yml",
        "compose.yaml",
    ]

    for name in compose_names:
        for compose_file in root.rglob(name):
            parts = compose_file.parts
            if any(p.startswith(".") and p not in (".",) for p in parts):
                continue
            if "node_modules" in parts:
                continue
            reports.append(validate_compose(str(compose_file), strict=strict))

    return reports


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate Docker Compose files against best practices"
    )
    parser.add_argument("file", nargs="?", help="Path to compose file")
    parser.add_argument(
        "--check-project",
        action="store_true",
        help="Validate all compose files in current directory tree",
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
        reports = [validate_compose(args.file, strict=args.strict)]
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
