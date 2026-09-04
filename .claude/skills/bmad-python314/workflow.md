# Python 3.14 Skill Workflow

**Goal:** Generate, validate, and optimize Python 3.14+ code using modern language features.

**CRITICAL:** If a step directs you to another file, read it fully and follow it. No exceptions.

## Conventions

- `{skill-root}` resolves to this skill's installed directory.
- `{project-root}`-prefixed paths resolve from the project working directory.
- All output messages use `{communication_language}`.

## On Activation

### Step 1: Load Configuration

Load config from `{project-root}/_bmad/core/config.yaml`:
- Use `{communication_language}` for all communications
- Use `{document_output_language}` for output documents

### Step 2: Load References

Read `{skill-root}/references/python314-rules.md` — validation rules and best practices.
Read `{skill-root}/references/python314-templates.md` — code templates.

### Step 3: Confirm Readiness

Greet the user and confirm the Python 3.14 skill is active. Ask what they need:
1. Generate Python 3.14+ code with modern features
2. Migrate existing code to Python 3.14 patterns
3. Validate Python code for 3.14 best practices
4. Optimize for free-threading or subinterpreters
5. Create t-string based DSLs (SQL, HTML, shell)

## WORKFLOW

### Phase 1: Clarify Requirements

Gather from the user (or infer from project context):
- Python version target (3.14+ required for all new features)
- Workload type (CPU-bound, IO-bound, mixed)
- Concurrency model (free-threading, subinterpreters, asyncio)
- Security requirements (t-strings for injection prevention)
- Framework (FastAPI, Django, Flask, etc.)

### Phase 2: Analyze Current Code

If migrating existing code:
1. Check current Python version (`python --version`)
2. Identify `from __future__ import annotations` (can be removed in 3.14+)
3. Identify `multiprocessing` usage (can be replaced with subinterpreters)
4. Identify f-strings used for SQL/HTML/shell (should use t-strings)
5. Identify `zlib`/`gzip` usage (can use compression.zstd)

### Phase 3: Generate/Refactor Code

Apply Python 3.14 features based on workload:

**For CPU-bound workloads:**
- Use `threading.Thread` with free-threaded build (PEP 779)
- Use `InterpreterPoolExecutor` for isolated contexts (PEP 734)

**For IO-bound workloads:**
- Use `asyncio` with improved introspection
- Use `concurrent.futures.InterpreterPoolExecutor` for parallel IO

**For security-sensitive code:**
- Use t-strings for SQL queries (PEP 750)
- Use t-strings for HTML output
- Use t-strings for shell commands

**For modern Python patterns:**
- Remove `from __future__ import annotations` (PEP 649)
- Use `except ExceptionA, ExceptionB:` without parens (PEP 758)
- Use `compression.zstd` instead of zlib (PEP 784)
- Use `uuid.uuid7()` for ordered IDs

### Phase 4: Validate

1. Run: `python3 {project-root}/_bmad/scripts/validate_python314.py {file}` (if available)
2. Check for deprecated patterns
3. Verify type hints work with deferred annotations
4. Ensure t-strings are used where appropriate

### Phase 5: Deliver

1. Present the code with feature annotations
2. Explain which Python 3.14 features were applied
3. Note any migration considerations
4. Provide performance expectations

### Phase 6: Document

Log the work in `{project-root}/_bmad-output/`:
- Code generated/refactored
- Features applied
- Migration notes
- Performance improvements expected
