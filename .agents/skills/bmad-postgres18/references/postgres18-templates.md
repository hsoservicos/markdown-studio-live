# PostgreSQL 18 Code Templates

## Template 1: UUIDv7 Primary Key with Generated Columns

```sql
-- Tabela de pedidos com UUIDv7 e colunas geradas virtuais
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.08,
    total DECIMAL(12,2) GENERATED ALWAYS AS (
        subtotal * (1 + tax_rate)
    ) VIRTUAL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice B-Tree multicoluna (aproveita Skip Scan do PG18)
CREATE INDEX idx_orders_customer_date 
ON public.orders(customer_id, created_at DESC);

-- Índice parcial para pedidos pendentes
CREATE INDEX idx_orders_pending 
ON public.orders(created_at) 
WHERE status = 'PENDING';
```

## Template 2: Transactional Outbox with RETURNING OLD/NEW

```sql
-- Tabela de outbox para eventos distribuídos
CREATE TABLE public.outbox_events (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_outbox_unprocessed 
ON public.outbox_events(created_at) 
WHERE processed = false;

-- Inserir evento e retornar delta completo
WITH order_update AS (
    UPDATE public.orders
    SET status = 'SHIPPED',
        updated_at = CURRENT_TIMESTAMP,
        version = version + 1
    WHERE id = :order_id
    RETURNING OLD.id, OLD.status AS prev_status, OLD.version AS prev_version,
              NEW.id, NEW.status AS new_status, NEW.version AS new_version
)
INSERT INTO public.outbox_events (aggregate_type, aggregate_id, event_type, payload)
SELECT 
    'Order',
    id,
    'OrderShipped',
    jsonb_build_object(
        'previous_status', prev_status,
        'current_status', new_status,
        'previous_version', prev_version,
        'new_version', new_version
    )
FROM order_update
RETURNING id, event_type, payload;
```

## Template 3: Queue Processor with SKIP LOCKED

```sql
-- Tabela de notificações com fila concorrente
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    tenant_id UUID NOT NULL,
    channel VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    is_processable BOOLEAN GENERATED ALWAYS AS (
        status IN ('PENDING', 'FAILED') AND retry_count < max_retries
    ) VIRTUAL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_queue 
ON public.notifications(tenant_id, status, created_at)
WHERE status IN ('PENDING', 'FAILED');

-- Desenfileiramento concorrente com SKIP LOCKED
WITH next_task AS (
    SELECT id
    FROM public.notifications
    WHERE is_processable = true
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE public.notifications n
SET status = 'PROCESSING',
    retry_count = n.retry_count + 1,
    updated_at = CURRENT_TIMESTAMP
FROM next_task
WHERE n.id = next_task.id
RETURNING 
    n.id,
    n.channel,
    n.payload,
    n.retry_count;
```

## Template 4: Temporal Table with WITHOUT OVERLAPS

```sql
-- Tabela de reservas com proteção temporal
CREATE TABLE public.bookings (
    room_id INT NOT NULL,
    guest_id UUID NOT NULL,
    booking_period TSTZRANGE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (room_id, booking_period WITHOUT OVERLAPS)
);

-- Índice para consultas temporais
CREATE INDEX idx_bookings_period 
ON public.bookings USING gist (booking_period);

-- Consulta de sobreposição (verificar conflitos)
SELECT * FROM public.bookings
WHERE room_id = 1
  AND booking_period && tstzrange('2026-09-10', '2026-09-15');
```

## Template 5: Hybrid Vector Search (pgvector + Relational)

```sql
-- Tabela de base de conhecimento com embeddings
CREATE TABLE public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    category_id INT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    is_active BOOLEAN NOT NULL DEFAULT true,
    published_date DATE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Índice HNSW para busca vetorial
CREATE INDEX idx_knowledge_embedding_hnsw
ON public.knowledge_base
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para filtros relacionais
CREATE INDEX idx_knowledge_category_active
ON public.knowledge_base(category_id, published_date DESC)
WHERE is_active = true;

-- Busca híbrida ponderada com RRF (Reciprocal Rank Fusion)
WITH vector_results AS (
    SELECT 
        id, 
        title, 
        content,
        1 - (embedding <=> '[0.012, -0.043, ...]'::vector) AS vector_score,
        ROW_NUMBER() OVER (ORDER BY embedding <=> '[0.012, -0.043, ...]'::vector) AS vector_rank
    FROM public.knowledge_base
    WHERE is_active = true
      AND category_id = 42
),
text_results AS (
    SELECT 
        id,
        title,
        content,
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'postgresql performance')) AS text_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'postgresql performance')) DESC) AS text_rank
    FROM public.knowledge_base
    WHERE is_active = true
      AND category_id = 42
)
SELECT 
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.title, t.title) AS title,
    COALESCE(v.content, t.content) AS content,
    (1.0 / (1 + COALESCE(v.vector_rank, 100))) + 
    (1.0 / (1 + COALESCE(t.text_rank, 100))) AS rrf_score
FROM vector_results v
FULL OUTER JOIN text_results t ON v.id = t.id
ORDER BY rrf_score DESC
LIMIT 10;
```

## Template 6: Audit Table with OLD/NEW Deltas

```sql
-- Tabela de auditoria unificada
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table_record 
ON public.audit_log(table_name, record_id, changed_at DESC);

-- Trigger para capturar deltas automaticamente
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log (table_name, operation, record_id, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
        current_setting('app.current_user_id')::uuid
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela de pedidos
CREATE TRIGGER orders_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
```

## Template 7: Non-Blocking Migration Pattern

```sql
-- Migração segura para produção (zero downtime)
-- Etapa 1: Adicionar constraint sem validação
ALTER TABLE public.users 
ADD CONSTRAINT users_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') 
NOT VALID;

-- Etapa 2: Validar sem bloquear (executa em background)
ALTER TABLE public.users VALIDATE CONSTRAINT users_email_format;

-- Etapa 3: Adicionar coluna generated virtual
ALTER TABLE public.users 
ADD COLUMN email_domain VARCHAR(255) 
GENERATED ALWAYS AS (
    split_part(email, '@', 2)
) VIRTUAL;

-- Etapa 4: Criar índice concurrently
CREATE INDEX CONCURRENTLY idx_users_email_domain 
ON public.users(email_domain);
```

## Template 8: pg_upgrade with Statistics Preservation

```bash
#!/bin/bash
# Migração PG17 → PG18 com preservação de estatísticas

# 1. Verificar compatibilidade
pg_upgrade \
  --old-datadir=/var/lib/postgresql/17/main \
  --new-datadir=/var/lib/postgresql/18/main \
  --old-bindir=/usr/lib/postgresql/17/bin \
  --new-bindir=/usr/lib/postgresql/18/bin \
  --link \
  --check

# 2. Executar migração
pg_upgrade \
  --old-datadir=/var/lib/postgresql/17/main \
  --new-datadir=/var/lib/postgresql/18/main \
  --old-bindir=/usr/lib/postgresql/17/bin \
  --new-bindir=/usr/lib/postgresql/18/bin \
  --link

# 3. Iniciar PostgreSQL 18
sudo systemctl start postgresql

# 4. Recriar estatísticas (apenas dados voláteis)
psql -d mydb -c "ANALYZE orders;"
psql -d mydb -c "ANALYZE notifications;"

# 5. Verificar integridade
psql -d mydb -c "SELECT * FROM pg_stat_user_tables;"
```
