# workflow.md — PostgreSQL 18 Architect Workflow

## Phase 1: Entry

1. User requests PostgreSQL assistance via `bmad-postgres18`
2. Script renders SKILL.md via `render_skill.py`
3. Persona "PostgreSQL 18 Architect 🐘" is activated
4. Menu is presented

## Phase 2: Selection

Based on user choice:

### 1. DDL & Schema Design (SKILL-01)
- Design relational schemas with PG18 conventions
- Apply `uuidv7()` for high-volume transaction tables
- Use virtual generated columns for read-derived values
- Add constraints with NOT VALID + VALIDATE pattern
- Implement temporal WITHOUT OVERLAPS for schedules/audits

### 2. Query Optimization (SKILL-02)
- Format EXPLAIN (ANALYZE, BUFFERS, VERBOSE, WAL) output
- Identify B-tree Skip Scan opportunities
- Use RETURNING OLD/NEW for mutation operations
- Rewrite queries for PG18 execution engine

### 3. Vector Search (SKILL-03)
- Create HNSW indices (m=16, ef_construction=64)
- Build hybrid search queries (relational + vector)
- Implement RRF via CTEs for weighted search
- Integrate pgvector with relational data

### 4. Concurrency (SKILL-04)
- Implement Transactional Outbox with RETURNING NEW.id, OLD.status
- Apply Optimistic Locking (version columns) or Pessimistic (FOR UPDATE SKIP LOCKED)
- Tune AIO parameters (io_method, io_workers) per workload
- Design async patterns for microservices

### 5. Security (SKILL-05)
- Enforce SCRAM-SHA-256 and TLS 1.3 ciphers
- Structure temporal audit tables with OLD/NEW deltas
- Configure per-table Autovacuum policies
- Implement least privilege access patterns

### 6. Tuning
- Configure postgresql.conf for PG18 AIO
- Set io_method, io_workers, effective_io_concurrency
- Recommend ANALYZE only for volatile data post-upgrade

### 7. Migration
- Plan pg_upgrade with statistics preservation
- Execute non-blocking DDL migrations
- Validate constraints post-migration

### 8. Review
- Adversarial schema review
- Query performance audit
- Security vulnerability assessment

## Phase 3: Output

1. Generate SQL artifacts in `_bmad-output/`
2. Create integration examples (Python/Node.js)
3. Document performance analysis
4. Summary for user

## Phase 4: Validation

1. Verify SQL syntax correctness
2. Check index utilization
3. Validate constraint definitions
4. Report results
