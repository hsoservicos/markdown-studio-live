#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# requires = ["requests>=2.28"]
# ///
"""DocSync for Docker — verifies Dockerfile and Compose syntax against official docs.

Fetches documentation from docs.docker.com and caches locally for 14 days.
Detects deprecated instructions and recommends current alternatives.

Usage:
    python docsync_docker.py --check          # Check if cache is fresh
    python docsync_docker.py --refresh        # Force refresh cache
    python docsync_docker.py --status         # Show cache status
    python docsync_docker.py --validate <file> # Validate file against cached docs
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

try:
    import requests

    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


CACHE_DIR = Path("_bmad/cache/docker-docs")
CACHE_TTL_SECONDS = 14 * 24 * 3600  # 14 days

ENDPOINTS = {
    "dockerfile_reference": "https://docs.docker.com/engine/reference/builder/",
    "compose_reference": "https://docs.docker.com/reference/compose-file/",
    "build_best_practices": "https://docs.docker.com/build/building/best-practices/",
    "buildkit": "https://docs.docker.com/build/buildkit/",
}


@dataclass
class DocCache:
    """Manages cached documentation from Docker docs."""

    cache_dir: Path = CACHE_DIR
    ttl_seconds: int = CACHE_TTL_SECONDS

    def _ensure_cache_dir(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, key: str) -> Path:
        return self.cache_dir / f"{key}.json"

    def _meta_path(self) -> Path:
        return self.cache_dir / "_meta.json"

    def get(self, key: str) -> Optional[dict]:
        """Get cached content if fresh."""
        path = self._cache_path(key)
        if not path.exists():
            return None

        meta = self._load_meta()
        if key not in meta:
            return None

        cached_time = meta[key].get("timestamp", 0)
        if time.time() - cached_time > self.ttl_seconds:
            return None

        try:
            return json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            return None

    def set(self, key: str, data: dict) -> None:
        """Store data in cache."""
        self._ensure_cache_dir()
        path = self._cache_path(key)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

        meta = self._load_meta()
        meta[key] = {"timestamp": time.time(), "size": len(json.dumps(data))}
        self._save_meta(meta)

    def _load_meta(self) -> dict:
        meta_path = self._meta_path()
        if meta_path.exists():
            try:
                return json.loads(meta_path.read_text())
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def _save_meta(self, meta: dict) -> None:
        self._ensure_cache_dir()
        self._meta_path().write_text(json.dumps(meta, indent=2, ensure_ascii=False))

    def status(self) -> dict:
        """Get cache status."""
        meta = self._load_meta()
        status = {}
        for key, info in meta.items():
            age_seconds = time.time() - info.get("timestamp", 0)
            age_days = age_seconds / 86400
            status[key] = {
                "age_days": round(age_days, 1),
                "is_fresh": age_seconds <= self.ttl_seconds,
                "size_bytes": info.get("size", 0),
            }
        return status

    def is_fresh(self) -> bool:
        """Check if all cached entries are fresh."""
        meta = self._load_meta()
        if not meta:
            return False
        for info in meta.values():
            age_seconds = time.time() - info.get("timestamp", 0)
            if age_seconds > self.ttl_seconds:
                return False
        return True

    def refresh_all(self) -> dict:
        """Fetch all endpoints and update cache."""
        results = {}
        for key, url in ENDPOINTS.items():
            try:
                content = self._fetch_url(url)
                self.set(key, content)
                results[key] = {"status": "ok", "title": content.get("title", "")}
            except Exception as e:
                results[key] = {"status": "error", "error": str(e)}
        return results

    def _fetch_url(self, url: str) -> dict:
        """Fetch a URL and extract relevant content."""
        if not HAS_REQUESTS:
            raise RuntimeError("requests library not installed. Run: pip install requests")

        headers = {
            "User-Agent": "BMAD-DocSync/1.0 (Docker-Best-Practices-Validator)"
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        # Extract key information from HTML
        html = response.text
        return self._extract_docker_info(html, url)

    def _extract_docker_info(self, html: str, url: str) -> dict:
        """Extract Docker-specific information from HTML content."""
        # Extract title
        title_match = re.search(r"<title>([^<]+)</title>", html)
        title = title_match.group(1) if title_match else "Unknown"

        # Extract deprecated instructions
        deprecated = []
        # MAINTAINER
        if "MAINTAINER" in html and "obsolete" in html.lower():
            deprecated.append({
                "instruction": "MAINTAINER",
                "alternative": 'LABEL maintainer="name <email>"',
                "reason": "MAINTAINER is obsolete since Docker 1.13",
            })
        # version in Compose
        if "version" in html and "compose" in url.lower():
            deprecated.append({
                "instruction": "version (Compose)",
                "alternative": "Remove the version field entirely",
                "reason": "Compose Specification does not require version field",
            })

        # Extract recommended practices
        practices = []
        if "syntax=docker/dockerfile" in html:
            practices.append({
                "practice": "BuildKit syntax pragma",
                "syntax": "# syntax=docker/dockerfile:1",
            })
        if "--mount=type=cache" in html:
            practices.append({
                "practice": "Cache mounts",
                "syntax": "RUN --mount=type=cache,target=/path ...",
            })
        if "--mount=type=secret" in html:
            practices.append({
                "practice": "Secret mounts",
                "syntax": "RUN --mount=type=secret,id=mysecret ...",
            })
        if "distroless" in html.lower():
            practices.append({
                "practice": "Distroless images",
                "syntax": "FROM gcr.io/distroless/static-debian13:nonroot",
            })

        return {
            "url": url,
            "title": title,
            "deprecated": deprecated,
            "recommended_practices": practices,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "content_length": len(html),
        }


def validate_against_cache(file_path: str, cache: DocCache) -> dict:
    """Validate a Dockerfile against cached documentation."""
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    content = path.read_text()
    findings = []

    # Check against cached Dockerfile reference
    dockerfile_docs = cache.get("dockerfile_reference")
    if dockerfile_docs:
        for dep in dockerfile_docs.get("deprecated", []):
            instruction = dep["instruction"].split(" ")[0]
            if instruction in content:
                findings.append({
                    "type": "deprecation",
                    "instruction": instruction,
                    "alternative": dep["alternative"],
                    "reason": dep["reason"],
                })

    # Check against Compose reference
    compose_docs = cache.get("compose_reference")
    if compose_docs and "services:" in content:
        for dep in compose_docs.get("deprecated", []):
            if dep["instruction"].startswith("version"):
                if re.search(r"^version\s*:", content, re.MULTILINE):
                    findings.append({
                        "type": "deprecation",
                        "instruction": "version",
                        "alternative": dep["alternative"],
                        "reason": dep["reason"],
                    })

    return {
        "file": str(path),
        "findings": findings,
        "total_findings": len(findings),
        "cache_status": "fresh" if cache.is_fresh() else "stale",
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="DocSync — Docker documentation synchronization and validation"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--check",
        action="store_true",
        help="Check if documentation cache is fresh",
    )
    group.add_argument(
        "--refresh",
        action="store_true",
        help="Force refresh all cached documentation",
    )
    group.add_argument(
        "--status",
        action="store_true",
        help="Show cache status and age",
    )
    group.add_argument(
        "--validate",
        metavar="FILE",
        help="Validate a file against cached documentation",
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="text",
        help="Output format (default: text)",
    )
    args = parser.parse_args()

    cache = DocCache()

    if args.check:
        is_fresh = cache.is_fresh()
        if args.format == "json":
            print(json.dumps({"fresh": is_fresh}))
        else:
            if is_fresh:
                print("Cache is FRESH — no refresh needed")
            else:
                print("Cache is STALE — run --refresh to update")
        sys.exit(0 if is_fresh else 1)

    elif args.refresh:
        if not HAS_REQUESTS:
            print("ERROR: 'requests' library not installed.", file=sys.stderr)
            print("Install with: pip install requests", file=sys.stderr)
            sys.exit(1)

        if args.format == "text":
            print("Refreshing Docker documentation cache...")

        results = cache.refresh_all()

        if args.format == "json":
            print(json.dumps(results, indent=2, ensure_ascii=False))
        else:
            for key, result in results.items():
                status = "✓" if result["status"] == "ok" else "✗"
                detail = result.get("title", result.get("error", ""))
                print(f"  {status} {key}: {detail}")
            print(f"\nCache directory: {cache.cache_dir}")

    elif args.status:
        status = cache.status()
        if args.format == "json":
            print(json.dumps(status, indent=2))
        else:
            if not status:
                print("No cached documentation found. Run --refresh to populate cache.")
            else:
                print("Docker DocSync Cache Status")
                print("-" * 50)
                for key, info in status.items():
                    fresh = "FRESH" if info["is_fresh"] else "STALE"
                    print(f"  {key}: {info['age_days']}d old [{fresh}] ({info['size_bytes']} bytes)")

    elif args.validate:
        result = validate_against_cache(args.validate, cache)
        if args.format == "json":
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"Validation: {result['file']}")
            print(f"Cache status: {result['cache_status']}")
            print(f"Findings: {result['total_findings']}")
            if result["findings"]:
                print("-" * 50)
                for f in result["findings"]:
                    print(f"  [{f['type'].upper()}] {f['instruction']}")
                    print(f"    Alternative: {f['alternative']}")
                    print(f"    Reason: {f['reason']}")
            else:
                print("No deprecated patterns found.")


if __name__ == "__main__":
    main()
