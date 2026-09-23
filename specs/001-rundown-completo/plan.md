# Implementation Plan: Rundown completo

**Branch**: `001-rundown-completo` (trabajo en `claude/gifted-bardeen-byfpdq`) | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-rundown-completo/spec.md`

## Summary

Convertir el rundown en una escaleta completa: segmentos de cualquier tipo
(apertura, nota, pausa comercial, cortina, cierre) con duración, presentador y
observaciones editables; horas de inicio, hora de fin y desfase calculados a
partir de la hora de salida y la duración planificada; un único segmento al
aire (el anterior pasa a emitido de forma atómica); rundowns archivados de solo
lectura con listado e historial y reactivación.

Enfoque: las reglas (permisos, límites, archivado, exclusividad del "al aire",
presentador válido) se aplican en Postgres con triggers e índices únicos
parciales, extendiendo `supabase/schema.sql` de forma idempotente. El cálculo
de tiempos es una función pura en `src/lib/rundownTiming.ts`, compartida por la
UI y el modo demo, con tests. El estado del modo demo usa una función pura
equivalente para el cambio de estado.

## Technical Context

**Language/Version**: TypeScript 5 (estricto), SQL (PostgreSQL 15+ en Supabase)

**Primary Dependencies**: React 18, React Router 7, Zustand 4, Tailwind 3, @supabase/supabase-js 2, lucide-react

**Storage**: Supabase Postgres (tablas `rundowns`, `rundown_items`, `profiles`, `notes`); Realtime para refresco en vivo. Modo demo: `localStorage` vía Zustand persist.

**Testing**: Vitest (jsdom) para lógica pura; script SQL de comportamiento contra PostgreSQL 16 con stubs de `auth`/`storage` (mismo método usado en la auditoría) para reglas de base de datos.

**Target Platform**: Navegadores de escritorio modernos; despliegue estático en nginx (Docker/EasyPanel).

**Project Type**: Aplicación web SPA + backend gestionado (Supabase).

**Performance Goals**: recálculo de horarios < 1 s para 100 segmentos (O(n) en cliente); propagación Realtime < 3 s.

**Constraints**: reglas en el servidor (constitución I); sin dependencias nuevas; esquema re-ejecutable; español.

**Scale/Scope**: 1 redacción, decenas de usuarios, ~1-5 rundowns/día, hasta ~100 segmentos por rundown, historial de 12 meses (~1.800 rundowns).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento en este diseño | Estado |
|-----------|-----------------------------|--------|
| I. Seguridad en la base | Permisos, archivado de solo lectura, exclusividad "al aire", presentador válido, límites de duración y bloqueo de borrar el segmento al aire: triggers + índices únicos + RLS. `created_by`, `archived_*` y el nombre del presentador los fija la base. | ✅ |
| II. Roles explícitos | Editor/director: todo sobre rundowns activos. Presentador: solo `status`. Redactor: solo lectura. Reglas replicadas en `src/lib/permissions.ts` (sin cambios de roles). | ✅ |
| III. Contenido saneado | Observaciones y títulos se muestran como texto (React escapa); sin HTML. Límites de longitud en la base. | ✅ |
| IV. Pruebas | Vitest: tiempos, desfase, medianoche, cambio de estado demo, permisos. SQL: casos negativos (redactor, presentador, archivado, dos al aire, presentador inválido, borrar al aire). | ✅ |
| V. Simplicidad | Sin librerías nuevas; acceso vía `rundownService.ts`; errores por `ErrorBanner`; Realtime existente. | ✅ |
| Restricciones: CSP | Sin fuentes externas nuevas. | ✅ |

Re-evaluación post-diseño (tras data-model y contratos): sin violaciones. No hay entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-rundown-completo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── database.md      # Tablas, triggers y RPC expuestos al cliente
│   └── ui.md            # Contrato de la pantalla Rundown por rol
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
supabase/
├── schema.sql                     # Extensión idempotente de rundowns/rundown_items
└── tests/rundown_behavior.sql     # Casos SQL de permisos y reglas (nuevo)

src/
├── types/index.ts                 # Rundown, RundownItem, RundownSummary
├── lib/
│   ├── rundownTiming.ts           # Cálculo puro de horarios y desfase (nuevo)
│   ├── rundownState.ts            # Cambio de estado puro "un solo al aire" (nuevo)
│   ├── rundownService.ts          # CRUD de rundowns y segmentos
│   ├── permissions.ts             # + canEditRundown (activo + rol)
│   └── __tests__/rundown*.test.ts # Tests nuevos
├── store/useStore.ts              # rundowns, selección, segmentos, archivado
├── data/mockData.ts               # Demo: airTime, duración planificada, presentadores
├── components/
│   └── SegmentForm.tsx            # Modal alta/edición de segmento (nuevo)
└── pages/
    ├── Rundown.tsx                # Escaleta, cabecera de tiempos, selector, historial
    ├── Dashboard.tsx              # Usa horarios calculados
    └── Teleprompter.tsx           # Sin cambios funcionales
```

**Structure Decision**: SPA única existente (`src/`) + esquema SQL en `supabase/`.
La lógica de negocio pura va en `src/lib` para poder testearla sin UI; las
reglas de seguridad en `supabase/schema.sql`.

## Complexity Tracking

Sin violaciones de la constitución.
