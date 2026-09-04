---
name: bmad-docker
description: 'Docker containerization skill — generates, validates, and maintains Dockerfiles and docker-compose files following current best practices. Includes BuildKit optimization, multi-stage builds, security hardening, and continuous documentation sync. Use when the user says "create Dockerfile", "create docker-compose", "validate Docker", "docker best practices", or "containerize this".'
---

Run the following command exactly once without changing the current working directory. Replace `{project-root}` with the absolute path to the project root and `{skill-root}` with the absolute path to this skill's directory:

```bash
uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py" --project-root "{project-root}" --skill "{skill-root}"
```

- On success, read and follow the one absolute `workflow.md` instruction printed to stdout.
- On failure (including `uv` being unavailable), report the command output and HALT. Do not run any workflow source directly.
