---
name: bmad-python314
description: 'Python 3.14+ specialization skill — generates, validates, and optimizes code using Python 3.14 features: free-threading, subinterpreters, t-strings, deferred annotations, compression.zstd, and modern syntax. Use when the user says "python 3.14", "t-strings", "free-threading", "subinterpreters", "modern python", or "optimize python".'
---

Run the following command exactly once without changing the current working directory. Replace `{project-root}` with the absolute path to the project root and `{skill-root}` with the absolute path to this skill's directory:

```bash
uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py" --project-root "{project-root}" --skill "{skill-root}"
```

- On success, read and follow the one absolute `workflow.md` instruction printed to stdout.
- On failure (including `uv` being unavailable), report the command output and HALT. Do not run any workflow source directly.
