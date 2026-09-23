# Pruebas SQL del esquema

Verifican las reglas que aplica la base (RLS, triggers, índices) con casos
positivos y **negativos**, según la constitución (principio IV).

## Requisitos

PostgreSQL 16 local con `psql` (no se ejecuta contra un proyecto Supabase
real: `stubs.sql` simula `auth` y `storage`).

## Ejecutar

```bash
# 1. Base temporal
initdb -D /tmp/mc-pg -A trust
pg_ctl -D /tmp/mc-pg -o "-p 5499 -k /tmp" -l /tmp/mc-pg.log start
export PGHOST=/tmp PGPORT=5499 PGUSER=postgres   # ajusta al usuario de initdb

# 2. Stubs + esquema (dos veces: debe ser idempotente)
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/stubs.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/schema.sql
psql -v ON_ERROR_STOP=1 -q -f supabase/schema.sql

# 3. Casos de comportamiento
psql -v ON_ERROR_STOP=1 -q -f supabase/tests/rundown_behavior.sql
```

Cada caso negativo imprime `OK bloqueado: …`. Si una regla no se cumple, el
script se detiene con `ESPERABA FALLO` o `Fallo inesperado`.

Los scripts se ejecutan dentro de una transacción que se revierte al final,
así que pueden repetirse sobre la misma base.
