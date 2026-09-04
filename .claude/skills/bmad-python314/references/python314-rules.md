# Python 3.14 Validation Rules

Reference for Python 3.14+ code validation and best practices.

---

## Feature Status (Verified October 2025)

| Feature | PEP | Status | Module/Syntax |
|---------|-----|--------|---------------|
| Free-Threading | PEP 779 (+ 703) | **Final** | `python3.14t` build, `threading.Thread` |
| Subinterpreters | PEP 734 | **Final** | `concurrent.interpreters`, `InterpreterPoolExecutor` |
| Template Strings | PEP 750 | **Final** | `t"..."`, `string.templatelib.Template` |
| Deferred Annotations | PEP 649/749 | **Final** | `annotationlib`, `__annotate__` |
| Zstandard Compression | PEP 784 | **Final** | `compression.zstd` |
| Except Without Parens | PEP 758 | **Final** | `except A, B:` (no `as`) |
| Safe Debugger Interface | PEP 768 | **Final** | `sys.remote_exec()` |
| UUID v6-v8 | RFC 9562 | **Final** | `uuid.uuid7()` |

---

## Rule PY001 — Remove `from __future__ import annotations` (INFO)

**Rule:** In Python 3.14+, `from __future__ import annotations` is unnecessary.

**Why:** PEP 649 makes annotations lazily evaluated by default. The future import switches to PEP 563 string semantics, which is now redundant.

```python
# ✅ CORRETO (Python 3.14+)
def process(data: list[int]) -> dict[str, Any]:
    ...

# ❌ ERRADO (obsoleto em 3.14+)
from __future__ import annotations
def process(data: list[int]) -> dict[str, Any]:
    ...
```

---

## Rule PY002 — Use t-strings for Injection Prevention (WARNING)

**Rule:** Use t-strings (`t"..."`) instead of f-strings for SQL, HTML, shell commands.

**Why:** T-strings return `Template` objects that separate static text from interpolated values, preventing injection attacks.

```python
# ✅ CORRETO
from string.templatelib import Template

query = t"SELECT * FROM users WHERE id = {user_id}"
# Returns Template object — safe by default

# ❌ ERRADO (SQL injection risk)
query = f"SELECT * FROM users WHERE id = {user_id}"
# Returns str — no sanitization hook
```

---

## Rule PY003 — Use InterpreterPoolExecutor for CPU-Bound (WARNING)

**Rule:** For CPU-bound workloads, prefer `InterpreterPoolExecutor` or free-threaded `threading.Thread` over `multiprocessing.Pool`.

**Why:** Subinterpreters (PEP 734) provide isolation with lower overhead than multiprocessing. Free-threading (PEP 779) enables true parallel threads.

```python
# ✅ CORRETO (CPU-bound, isolated contexts)
from concurrent.futures import InterpreterPoolExecutor

with InterpreterPoolExecutor(max_workers=4) as executor:
    results = list(executor.map(compute_heavy, data_chunks))

# ✅ CORRETO (CPU-bound, shared memory, free-threaded build)
import threading

threads = []
for chunk in data_chunks:
    t = threading.Thread(target=process_chunk, args=(chunk,))
    threads.append(t)
    t.start()
for t in threads:
    t.join()

# ❌ ERRADO (higher overhead)
from multiprocessing import Pool
with Pool(4) as p:
    results = p.map(compute_heavy, data_chunks)
```

---

## Rule PY004 — Use compression.zstd Instead of zlib (INFO)

**Rule:** Use `compression.zstd` for new compression needs instead of `zlib` or `gzip`.

**Why:** Zstandard offers better compression ratios and speed. Native in Python 3.14 stdlib (PEP 784).

```python
# ✅ CORRETO
from compression import zstd

compressed = zstd.compress(data, level=3)
decompressed = zstd.decompress(compressed)

# ❌ FUNCIONAL mas não ideal
import zlib
compressed = zlib.compress(data)
```

---

## Rule PY005 — Use uuid.uuid7() for Database IDs (INFO)

**Rule:** Use `uuid.uuid7()` instead of `uuid.uuid4()` for database primary keys.

**Why:** UUIDv7 (RFC 9562) is time-ordered, making it B-Tree friendly and index-optimized.

```python
# ✅ CORRETO
import uuid
user_id = uuid.uuid7()  # Ordered by time

# ❌ FUNCIONAL mas não otimizado
user_id = uuid.uuid4()  # Random, poor index performance
```

---

## Rule PY006 — Use Modern Except Syntax (INFO)

**Rule:** Parentheses are optional in `except` when not using `as`.

**Why:** PEP 758 removes the Python 2 remnant requiring parentheses.

```python
# ✅ CORRETO (Python 3.14+)
try:
    ...
except ValueError, TypeError, KeyError:
    ...

# ✅ CORRETO (com as — parênteses obrigatórios)
try:
    ...
except (ValueError, TypeError) as e:
    ...

# ❌ ERRADO (as com múltiplas exceções sem parênteses)
try:
    ...
except ValueError, TypeError as e:  # SyntaxError
    ...
```

---

## Rule PY007 — Type Hints with Deferred Annotations (INFO)

**Rule:** Forward references work without quotes in Python 3.14+.

**Why:** PEP 649 defers evaluation, so forward references resolve naturally.

```python
# ✅ CORRETO (Python 3.14+)
class Node:
    next: Node | None = None  # No quotes needed

# ❌ ERRADO (obsoleto em 3.14+)
class Node:
    next: "Node | None" = None  # Quotes unnecessary
```

---

## Rule PY008 — Use annotationlib for Annotation Introspection (INFO)

**Rule:** Use `annotationlib.get_annotations()` instead of direct `__annotations__` access.

**Why:** PEP 749 introduces `annotationlib` for proper deferred annotation handling.

```python
# ✅ CORRETO
from annotationlib import get_annotations, Format

annotations = get_annotations(func, format=Format.VALUE)
forward_refs = get_annotations(func, format=Format.FORWARDREF)

# ❌ FUNCIONAL mas não recomendado
annotations = func.__annotations__
```

---

## Rule PY009 — Use Remote Debugger for Production (INFO)

**Rule:** Use `sys.remote_exec()` for zero-overhead debugging of running processes.

**Why:** PEP 768 provides a safe external debugger interface without restart.

```python
# ✅ CORRETO (attach to running process)
import sys
sys.remote_exec(pid, "debug_script.py")

# ❌ ERRADO (requires restart)
# import pdb; pdb.set_trace()  # Requires process restart
```

---

## Rule PY010 — Free-Threading Build Selection (WARNING)

**Rule:** Use `python3.14t` for free-threaded builds. Standard `python3.14` still has GIL.

**Why:** PEP 779 makes free-threading officially supported but optional (Phase II).

```bash
# ✅ CORRETO (free-threaded build)
python3.14t script.py

# Standard build (still has GIL)
python3.14 script.py
```

---

## Migration Checklist

| Old Pattern | New Pattern (3.14+) | Priority |
|-------------|---------------------|----------|
| `from __future__ import annotations` | Remove (PEP 649) | High |
| f-strings for SQL/HTML | t-strings (PEP 750) | High |
| `multiprocessing.Pool` | `InterpreterPoolExecutor` (PEP 734) | Medium |
| `zlib.compress()` | `compression.zstd.compress()` (PEP 784) | Medium |
| `uuid.uuid4()` | `uuid.uuid7()` (RFC 9562) | Medium |
| `except (A, B):` | `except A, B:` (PEP 758) | Low |
| `"ForwardRef"` annotations | Direct forward refs (PEP 649) | Low |
| `func.__annotations__` | `annotationlib.get_annotations()` (PEP 749) | Low |
