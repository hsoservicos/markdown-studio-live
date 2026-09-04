# PostgreSQL 18 Rules & Constraints

## Core Rules

### PG001 — UUIDv7 for Primary Keys
- Use `uuidv7()` for PKs in high-volume transaction/event tables
- Ordered by timestamp reduces B-Tree page splits
- Increases cache reuse in write-heavy tables
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    ...
);
```

### PG002 — Virtual Generated Columns (PG18 Default)
- Use `GENERATED ALWAYS AS (...) VIRTUAL` (default in PG18)
- Saves disk space and I/O overhead for fast-read computations
- Reserve `STORED` for logical replication or heavy computations
```sql
CREATE TABLE products (
    price DECIMAL(10,2),
    quantity INT,
    total DECIMAL(10,2) GENERATED ALWAYS AS (price * quantity) VIRTUAL
);
```

### PG003 — Non-Blocking Constraint Addition
- Add NOT NULL constraints in two steps:
  1. `ALTER TABLE ... ADD CONSTRAINT ... NOT NULL NOT VALID;`
  2. `VALIDATE CONSTRAINT` (non-blocking)
```sql
ALTER TABLE users ADD CONSTRAINT users_email_not_null 
    CHECK (email IS NOT NULL) NOT VALID;

ALTER TABLE users VALIDATE CONSTRAINT users_email_not_null;
```

### PG004 — Temporal WITHOUT OVERLAPS
- Define PKs and uniqueness with temporal intervals
- Prevents overlapping reservations/schedules
```sql
CREATE TABLE bookings (
    room_id INT,
    booking_period TSTZRANGE,
    PRIMARY KEY (room_id, booking_period WITHOUT OVERLAPS)
);
```

### PG005 — B-Tree Skip Scan
- Leverage multi-column indexes even without prefix columns
- Eliminates need for redundant indexes
- Automatic in PG18 for qualifying queries
```sql
-- Single index serves both queries
CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);

-- Skip Scan works even without customer_id
SELECT * FROM orders WHERE order_date > '2026-01-01';
```

### PG006 — RETURNING OLD/NEW
- Extract previous and new state directly in mutations
- Eliminates race conditions in application layer
- Works with UPDATE, INSERT ... ON CONFLICT, DELETE
```sql
UPDATE orders 
SET status = 'SHIPPED' 
WHERE id = $1
RETURNING OLD.status AS previous_status, NEW.status AS current_status;
```

### PG007 — Asynchronous I/O (AIO)
- Enable `io_method = io_uring` for up to 3x scan performance
- Requires Linux kernel 5.1+
- Monitor via `pg_aios` system view
```ini
# postgresql.conf
io_method = io_uring
io_workers = 16
effective_io_concurrency = 200
```

### PG008 — pgvector Integration
- HNSW index for high-precision, low-latency queries
- Use cosine distance (`<=>`), L2 (`<->`), inner product (`<#>`)
- Supports scalar quantization (`halfvec`, `bit`)
```sql
CREATE INDEX idx_embedding_hnsw 
ON documents USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
```

### PG009 — Transactional Outbox Pattern
- Use RETURNING NEW.id, OLD.status for outbox events
- Ensures exactly-once delivery in distributed systems
```sql
WITH outbox_event AS (
    INSERT INTO outbox (aggregate_id, event_type, payload)
    SELECT id, 'ORDER_SHIPPED', to_jsonb(orders.*)
    FROM orders
    WHERE id = $1
    RETURNING *
)
SELECT * FROM outbox_event;
```

### PG010 — Optimistic Locking
- Add version column for optimistic concurrency control
- Check version in UPDATE WHERE clause
```sql
UPDATE orders 
SET status = 'SHIPPED', version = version + 1 
WHERE id = $1 AND version = $2
RETURNING *;
```

### PG011 — Pessimistic Locking (SKIP LOCKED)
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for queue processing
- Prevents blocking in high-concurrency scenarios
```sql
SELECT * FROM notifications
WHERE status = 'PENDING'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

### PG012 — SCRAM-SHA-256 Authentication
- Enforce SCRAM-SHA-256 for password authentication
- Never use plaintext or MD5
```sql
ALTER USER app_user WITH PASSWORD 'secure_password';
-- postgresql.conf: password_encryption = scram-sha-256
```

### PG013 — TLS 1.3 Encryption
- Configure SSL with TLS 1.3 ciphers
- Require SSL connections for all clients
```ini
# postgresql.conf
ssl = on
ssl_min_protocol_version = 'TLSv1.3'
ssl_ciphers = 'HIGH:!aNULL:!MD5'
```

### PG014 — Per-Table Autovacuum
- Configure aggressive autovacuum for high-write tables
- Prevents table bloat and performance degradation
```sql
ALTER TABLE high_write_table SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.005,
    autovacuum_vacuum_cost_delay = 2
);
```

### PG015 — pg_upgrade with Statistics
- PG18 preserves planner statistics during pg_upgrade
- Run selective ANALYZE only for unusually volatile data
```bash
pg_upgrade --old-datadir=/var/lib/postgresql/17/main \
           --new-datadir=/var/lib/postgresql/18/main \
           --link
```
