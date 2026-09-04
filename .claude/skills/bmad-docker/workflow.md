# Docker Skill Workflow

**Goal:** Generate, validate, and deliver Docker artifacts following current best practices.

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

### Step 2: Load Validation Rules

Read `{skill-root}/references/docker-rules.md` — these are the authoritative validation rules.

### Step 3: Load Templates

Read `{skill-root}/references/templates.md` — these are the reference templates.

### Step 4: Confirm Readiness

Greet the user and confirm the Docker skill is active. Ask what they need:
1. Create a new Dockerfile
2. Create a new docker-compose.yml
3. Validate existing Docker files
4. Optimize existing Dockerfiles
5. Containerize an existing application

## WORKFLOW

### Phase 1: Clarify Requirements

Gather the following from the user (or infer from project context):

**For Dockerfiles:**
- Application language/runtime (Node.js, Python, Go, Rust, Java, etc.)
- Framework (Express, FastAPI, Gin, etc.)
- Build requirements (compilation, bundling, etc.)
- Production vs development target
- Security requirements (non-root, read-only filesystem, etc.)

**For docker-compose:**
- Services needed (app, database, cache, proxy, etc.)
- Networking requirements
- Volume mounts (persistent data, config files)
- Environment variables
- Health checks needed

### Phase 2: DocSync Validation

Before generating artifacts, verify current syntax against official docs:

1. Run: `python3 {project-root}/_bmad/scripts/docsync_docker.py --check`
2. If cache is stale (>14 days), run: `python3 {project-root}/_bmad/scripts/docsync_docker.py --refresh`
3. Apply any new deprecation warnings to the generation rules

### Phase 3: Generate Artifact

#### Option A: Generate Dockerfile

Use the appropriate template from `references/templates.md`:
1. Select base image based on stack (prefer alpine/slim/distroless)
2. Apply multi-stage build pattern (build → runtime)
3. Add `# syntax=docker/dockerfile:1` pragma
4. Optimize layer ordering (dependency-first)
5. Add cache mounts for package managers
6. Add non-root user
7. Add HEALTHCHECK
8. Add OCI labels

#### Option B: Generate docker-compose.yml

1. Use Compose Specification (no `version` field)
2. Name file `compose.yaml` (not `docker-compose.yml`)
3. Configure services with health checks
4. Set resource limits
5. Configure networks
6. Set restart policies

### Phase 4: Validate Generated Artifact

1. Run: `python3 {project-root}/_bmad/scripts/validate_dockerfile.py {file}` (for Dockerfiles)
2. Run: `python3 {project-root}/_bmad/scripts/validate_compose.py {file}` (for Compose files)
3. If errors found, fix and re-validate
4. If warnings found, present to user for review

### Phase 5: Deliver

1. Present the validated artifact to the user
2. Include a summary of:
   - Base image choices and rationale
   - Security measures applied
   - Cache optimizations
   - Any warnings or considerations
3. Offer to run `docker compose config` or `docker build --check` if Docker is available
4. Save the artifact to the project

### Phase 6: Document

Log the artifact creation in `{project-root}/_bmad-output/`:
- File created
- Validation results
- Any deprecations found
- Recommendations applied
