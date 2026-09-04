# Python 3.14 Templates

Reference templates for Python 3.14+ code generation.

---

## Template A: Free-Threading CPU-Bound Pipeline

```python
"""CPU-bound parallel processing using free-threaded Python 3.14+ (PEP 779)."""

import threading
from typing import TypeVar, Callable, List

T = TypeVar("T")
R = TypeVar("R")


def execute_parallel_pipeline(
    data_chunks: List[List[T]],
    worker_fn: Callable[[List[T]], R],
    max_workers: int = 8,
) -> List[R]:
    """
    Execute CPU-bound tasks in parallel threads using free-threaded Python.

    Requires Python 3.14+ free-threaded build (python3.14t).
    For standard builds, consider InterpreterPoolExecutor instead.
    """
    results: List[R | None] = [None] * len(data_chunks)
    errors: List[Exception | None] = [None] * len(data_chunks)

    def worker(index: int, chunk: List[T]) -> None:
        try:
            results[index] = worker_fn(chunk)
        except Exception as e:
            errors[index] = e

    threads: List[threading.Thread] = []
    for i, chunk in enumerate(data_chunks[:max_workers]):
        t = threading.Thread(target=worker, args=(i, chunk), daemon=True)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Check for errors
    for i, error in enumerate(errors):
        if error is not None:
            raise RuntimeError(f"Worker {i} failed: {error}") from error

    return results  # type: ignore[return-value]
```

---

## Template B: Subinterpreter Isolated Processing (PEP 734)

```python
"""Isolated processing using subinterpreters (PEP 734)."""

from concurrent.interpreters import InterpreterPoolExecutor
from concurrent.futures import InterpreterPoolExecutor as IPE
from typing import Any
import json


def process_isolated(
    payloads: list[dict[str, Any]],
    worker_code: str,
    max_workers: int = 4,
) -> list[dict[str, Any]]:
    """
    Process payloads in isolated subinterpreters.

    Each subinterpreter has its own GIL, memory, and module state.
    Data is serialized via JSON for safe transfer between interpreters.
    """

    def isolated_worker(payload_json: str) -> str:
        # Each interpreter imports independently
        import json
        import math

        data = json.loads(payload_json)
        # Apply worker logic
        result = {"id": data.get("id"), "processed": True}
        return json.dumps(result)

    json_inputs = [json.dumps(p) for p in payloads]

    with IPE(max_workers=max_workers) as executor:
        results = list(executor.map(isolated_worker, json_inputs))

    return [json.loads(r) for r in results]
```

---

## Template C: T-String SQL Handler (PEP 750)

```python
"""Safe SQL query builder using t-strings (PEP 750)."""

from string.templatelib import Template
from typing import Any


class SafeSQL:
    """Build parameterized SQL queries using t-strings to prevent injection."""

    @staticmethod
    def build(template: Template) -> tuple[str, list[Any]]:
        """
        Convert a t-string Template into a parameterized query.

        Usage:
            query, params = SafeSQL.build(
                t"SELECT * FROM users WHERE name = {name} AND age > {min_age}"
            )
        """
        parts: list[str] = []
        params: list[Any] = []

        for i, part in enumerate(template.strings):
            parts.append(part)
            if i < len(template.args):
                interpolation = template.args[i]
                if hasattr(interpolation, "value"):
                    params.append(interpolation.value)
                else:
                    params.append(interpolation)
                parts.append("%s")

        return "".join(parts), params

    @staticmethod
    def execute(template: Template, cursor: Any) -> Any:
        """Build and execute a parameterized query."""
        query, params = SafeSQL.build(template)
        cursor.execute(query, params)
        return cursor.fetchall()


# Usage example
def get_users(name: str, min_age: int, cursor: Any) -> list[dict]:
    query, params = SafeSQL.build(
        t"SELECT * FROM users WHERE name = {name} AND age > {min_age}"
    )
    cursor.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]
```

---

## Template D: T-String HTML Escaper (PEP 750)

```python
"""Safe HTML output using t-strings (PEP 750)."""

from string.templatelib import Template, Interpolation
from html import escape
from typing import Any


def render_html(template: Template) -> str:
    """
    Render a t-string as safe HTML, escaping all interpolated values.

    Usage:
        user_input = "<script>alert('xss')</script>"
        safe_html = render_html(t"<p>Hello, {user_input}</p>")
        # => <p>Hello, &lt;script&gt;alert('xss')&lt;/script&gt;</p>
    """
    parts: list[str] = []

    for item in template:
        if isinstance(item, Interpolation):
            # HTML-escape all interpolated values
            parts.append(escape(str(item.value)))
        else:
            # Static text — use as-is
            parts.append(str(item))

    return "".join(parts)


# Usage
def user_profile(name: str, bio: str) -> str:
    return render_html(t"""
        <div class="profile">
            <h2>{name}</h2>
            <p>{bio}</p>
        </div>
    """)
```

---

## Template E: Zstandard Compression (PEP 784)

```python
"""High-performance compression using Zstandard (PEP 784)."""

from compression import zstd
from pathlib import Path
from typing import BinaryIO


class Compressor:
    """Zstandard compression wrapper using native stdlib module."""

    @staticmethod
    def compress(data: bytes, level: int = 3) -> bytes:
        """Compress data using Zstandard."""
        return zstd.compress(data, level=level)

    @staticmethod
    def decompress(data: bytes) -> bytes:
        """Decompress Zstandard data."""
        return zstd.decompress(data)

    @staticmethod
    def compress_file(src: Path, dst: Path, level: int = 3) -> dict[str, int]:
        """Compress a file and return statistics."""
        original = src.read_bytes()
        compressed = zstd.compress(original, level=level)
        dst.write_bytes(compressed)
        return {
            "original_size": len(original),
            "compressed_size": len(compressed),
            "ratio": len(compressed) / len(original) if original else 0,
        }

    @staticmethod
    def decompress_file(src: Path, dst: Path) -> int:
        """Decompress a file and return original size."""
        compressed = src.read_bytes()
        decompressed = zstd.decompress(compressed)
        dst.write_bytes(decompressed)
        return len(decompressed)
```

---

## Template F: Modern Exception Handling (PEP 758)

```python
"""Modern exception handling patterns for Python 3.14+."""


def process_data(data: dict) -> str:
    """
    Demonstrate PEP 758 except syntax (no parentheses required).
    """
    try:
        return data["key"]
    except KeyError, ValueError, TypeError:
        # PEP 758: no parentheses needed without 'as'
        return "default"
    except (KeyError, ValueError) as e:
        # Parentheses still required with 'as' clause
        return f"error: {e}"
```

---

## Template G: Annotation Introspection (PEP 649/749)

```python
"""Modern annotation handling using annotationlib (PEP 649/749)."""

from annotationlib import get_annotations, Format
from typing import Any


class AnnotationInspector:
    """Inspect deferred annotations using annotationlib."""

    @staticmethod
    def get_typed_annotations(func: Any) -> dict[str, Any]:
        """Get resolved type annotations."""
        return get_annotations(func, format=Format.VALUE)

    @staticmethod
    def get_forward_refs(func: Any) -> dict[str, Any]:
        """Get annotations with unresolved forward references as markers."""
        return get_annotations(func, format=Format.FORWARDREF)

    @staticmethod
    def get_string_annotations(func: Any) -> dict[str, str]:
        """Get annotations as strings."""
        return get_annotations(func, format=Format.STRING)


# Usage — forward references work without quotes in 3.14+
class Node:
    """Tree node with forward reference (no quotes needed)."""
    value: int
    children: list[Node] | None = None  # Forward ref, no quotes!
```

---

## Template H: UUID v7 for Database IDs (RFC 9562)

```python
"""Ordered UUID generation using uuid7 (RFC 9562)."""

import uuid
from datetime import datetime


class ModelBase:
    """Base model with UUIDv7 primary key."""

    def __init__(self) -> None:
        self.id: uuid.UUID = uuid.uuid7()
        self.created_at: datetime = datetime.now()

    @property
    def id_str(self) -> str:
        return str(self.id)

    @property
    def is_ordered(self) -> bool:
        """UUIDv7 encodes timestamp — check if sortable."""
        return True
```

---

## Template I: Asyncio with Subinterpreters

```python
"""Combine asyncio with subinterpreters for mixed workloads."""

import asyncio
from concurrent.interpreters import InterpreterPoolExecutor
from typing import Any


async def process_with_subinterpreters(
    payloads: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Offload CPU-bound work to subinterpreters from async context."""

    def compute(payload_json: str) -> str:
        import json, math
        data = json.loads(payload_json)
        result = {"id": data["id"], "value": math.factorial(data.get("n", 10))}
        return json.dumps(result)

    loop = asyncio.get_event_loop()
    json_inputs = [json.dumps(p) for p in payloads]

    with InterpreterPoolExecutor(max_workers=4) as executor:
        # Run in thread pool to avoid blocking the event loop
        results = await loop.run_in_executor(
            executor, lambda: list(executor.map(compute, json_inputs))
        )

    return [json.loads(r) for r in results]
```
