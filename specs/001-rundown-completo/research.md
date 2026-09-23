# Research: Rundown completo

No quedaron "NEEDS CLARIFICATION" en el contexto técnico. Estas son las
decisiones de diseño y sus alternativas.

## R1. Exclusividad de "al aire" sin condiciones de carrera

- **Decision**: índice único parcial `(rundown_id) where status = 'al_aire'`
  más un trigger `BEFORE UPDATE` que, cuando un segmento pasa a `al_aire`,
  bloquea la fila del rundown (`select … for update`) y luego marca como
  `emitido` el segmento que estuviera al aire.
- **Rationale**: el bloqueo del rundown serializa dos cambios simultáneos; el
  segundo ve el estado ya confirmado del primero y lo pasa a emitido. El índice
  garantiza la invariante aunque falle cualquier otra ruta.
- **Alternatives**: solo índice único (el segundo usuario recibiría un error en
  lugar del comportamiento especificado); solo lógica en el cliente (viola la
  constitución I).

## R2. Hora de inicio calculada vs. almacenada

- **Decision**: no almacenar horas de inicio. El rundown guarda `air_time`
  (hora de salida, opcional) y `planned_duration_secs`; el cliente calcula
  inicio = salida + suma de duraciones previas en una función pura.
- **Rationale**: un dato derivado almacenado se desincroniza con cada
  reordenamiento; el cálculo es O(n) y trivial. La columna `start_time`
  existente se conserva por compatibilidad y se ignora.
- **Alternatives**: columna generada o vista SQL con ventana acumulada (más
  complejo, igual resultado, y el modo demo necesitaría otra implementación).

## R3. Archivado de solo lectura

- **Decision**: trigger en `rundown_items` (insert/update/delete) que rechaza
  cualquier cambio si el rundown está `archivado`; trigger en `rundowns` que solo
  permite, sobre uno archivado, volver a `activo`, y fija `archived_at` /
  `archived_by`.
- **Rationale**: RLS por sí sola no ve el estado del padre en `DELETE` sin
  subconsultas costosas; el trigger da mensajes claros en español.
- **Alternatives**: políticas RLS con `exists (select … from rundowns …)`;
  válido pero con mensajes genéricos de "row-level security".

## R4. Presentador

- **Decision**: `rundown_items.presenter_id` (FK a `profiles`, `on delete set
  null`); el trigger valida que el perfil tenga rol `presentador` al asignarlo y
  copia su nombre a `presenter`.
- **Rationale**: evita nombres escritos a mano y conserva el nombre mostrado
  aunque el usuario cambie de rol o se elimine (FR-004).
- **Alternatives**: texto libre (sin validación); solo FK sin nombre copiado
  (se pierde el dato histórico).

## R5. Varios rundowns activos

- **Decision**: la pantalla carga la lista resumida de rundowns (activos y
  archivados, más recientes primero) y el detalle del seleccionado; por defecto
  el activo más reciente. Selección recordada en la URL (`/rundown?id=…`).
- **Rationale**: soporta ediciones/canales simultáneos sin estado oculto y
  permite enlazar un rundown archivado.
- **Alternatives**: un único rundown activo forzado por índice (rechazado en la
  especificación).

## R6. Medianoche y formato

- **Decision**: cálculos en segundos desde 00:00; la hora mostrada es
  `segundos mod 86400` en formato `HH:MM:SS`; duraciones en `M:SS` (o `H:MM:SS`
  si ≥ 1 h); desfase con signo: "sobran", "faltan" o "En tiempo".
- **Rationale**: sin dependencias de fecha/zona horaria; la hora de salida es
  una hora local del programa.

## R7. Pruebas de base de datos

- **Decision**: `supabase/tests/rundown_behavior.sql`, ejecutable con `psql`
  contra una base con el esquema y stubs de `auth`/`storage`, con una función
  `expect_fail` para casos negativos. Se documenta en quickstart.
- **Rationale**: cumple la constitución IV sin infraestructura nueva; ya se usó
  para validar el esquema en la auditoría.
