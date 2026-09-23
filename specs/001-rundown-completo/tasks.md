---
description: "Lista de tareas: Rundown completo"
---

# Tasks: Rundown completo

**Input**: Design documents from `/specs/001-rundown-completo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/database.md, contracts/ui.md, quickstart.md

**Tests**: incluidos. La constitución (principio IV) y la especificación exigen tests, incluidos casos negativos.

**Organization**: por historia de usuario (US1-US4 de spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1…US4)

---

## Phase 1: Setup

**Purpose**: infraestructura de pruebas SQL reutilizable

- [X] T001 Crear `supabase/tests/stubs.sql` con los stubs mínimos de Supabase para pruebas locales (roles `anon`/`authenticated`, `auth.users`, `auth.uid()` desde `request.jwt.claim.sub`, `storage.buckets`, `storage.objects` con RLS, `storage.foldername`, publicación `supabase_realtime`, grants por defecto en `public`)
- [X] T002 Crear `supabase/tests/README.md` explicando cómo levantar PostgreSQL 16 local, aplicar `stubs.sql` + `supabase/schema.sql` (dos veces) y ejecutar los scripts de comportamiento con `psql -v ON_ERROR_STOP=1`

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: modelo de datos, tipos y funciones puras compartidas

- [X] T003 Extender `rundowns` en `supabase/schema.sql` de forma idempotente (`alter table … add column if not exists`): `air_time time` (opcional), `planned_duration_secs int not null default 1800 check (planned_duration_secs between 60 and 21600)`, `archived_at timestamptz`, `archived_by text`
- [X] T004 Extender `rundown_items` en `supabase/schema.sql`: `presenter_id uuid references profiles(id) on delete set null`; índice único parcial `rundown_items_one_on_air (rundown_id) where status = 'al_aire'`; índice único parcial `rundown_items_note_unique (rundown_id, note_id) where note_id is not null`; comentario marcando `start_time` como obsoleto
- [X] T005 [P] Ampliar tipos en `src/types/index.ts`: `Rundown` + `airTime?: string` (`HH:MM:SS`), `plannedDurationSecs: number`, `archivedAt?: string`, `archivedBy?: string`; `RundownItem` + `presenterId?: string`; nuevo `RundownSummary { id, title, date, channel, status, archivedAt? }`
- [X] T006 [P] Crear `src/lib/rundownTiming.ts` con funciones puras: `parseClock('HH:MM[:SS]') → segundos | null`, `parseDuration('M:SS' | 'H:MM:SS' | minutos) → segundos | null`, `formatClock(seg)` (mod 86400, `HH:MM:SS`), `formatDuration(seg)` (`M:SS`, o `H:MM:SS` si ≥ 1 h), `computeSchedule(items, airTime?, plannedSecs)` → `{ starts: (number|null)[], totalSecs, endSecs|null, diffSecs, emittedSecs, progress }` y `describeDiff(diffSecs)` → `{ label: 'sobran M:SS' | 'faltan M:SS' | 'En tiempo', tone: 'over'|'under'|'ok' }`
- [X] T007 [P] Tests de `src/lib/__tests__/rundownTiming.test.ts`: ejemplo de la spec (salida 20:00:00, 0:30 + 1:15 + 2:00 → inicios 20:00:00, 20:00:30, 20:01:45; fin 20:03:45; planificado 10:00 → "faltan 6:15"), sin hora de salida (inicios null), lista vacía (total 0, progreso 0), sobra y en tiempo, cruce de medianoche (23:50 + 30:00 → 00:20:00), parseo inválido (`25:00`, `abc`, `0:75`) → null
- [X] T008 Actualizar `src/lib/rundownService.ts`: mapear los campos nuevos (`air_time`, `planned_duration_secs`, `archived_at`, `archived_by`, `presenter_id`); `fetchRundownSummaries()` (activos y archivados, más recientes primero, límite 200) y `fetchRundown(id)` con segmentos ordenados; mantener `fetchActiveRundown()` como el activo más reciente
- [X] T009 Actualizar demo en `src/data/mockData.ts`: `MOCK_RUNDOWN` con `airTime: '20:00:00'`, `plannedDurationSecs: 1800`, segmentos con `presenterId: 'u5'` donde tengan presentador; sin `startTime`
- [X] T010 Actualizar el store `src/store/useStore.ts`: estado `rundowns: RundownSummary[]` y `selectRundown(id)`; `refreshRundown` recarga el listado y el rundown seleccionado (por defecto el activo más reciente); en modo demo el listado se deriva del rundown local y de los archivados locales

**Checkpoint**: tipos, cálculo de horarios y carga de rundowns listos.

---

## Phase 3: User Story 1 - Armar la escaleta completa (P1) 🎯 MVP

**Goal**: editores/directores agregan segmentos de cualquier tipo con duración, presentador y observaciones, y los editan, reordenan y quitan; redactores y presentadores no pueden.

**Independent Test**: en un rundown activo vacío, un editor agrega apertura, dos notas, una pausa y un cierre, asigna presentador y edita una duración; al recargar todo persiste y otro usuario lo ve igual. Un redactor no ve ni puede ejecutar esas acciones.

### Tests (US1)

- [X] T011 [P] [US1] Crear `supabase/tests/rundown_behavior.sql` (sección US1) con `expect_fail`: redactor no inserta/edita/borra segmentos; presentador no cambia `duration_secs`, `presenter_id`, `notes` ni `order_num`; nota no aprobada o sin `for_tv` rechazada; misma nota dos veces rechazada; `presenter_id` de un perfil sin rol presentador rechazado ("El presentador asignado no tiene rol de presentador"); `presenter` enviado por el cliente se ignora y se copia el nombre del perfil; `duration_secs` 0 y 3601 rechazados (CHECK); `notes` > 1000 rechazado
- [X] T012 [P] [US1] Tests en `src/lib/__tests__/permissions.test.ts` para `canEditRundown(user, rundown)`: editor/director true solo si `status === 'activo'`; redactor/presentador false; archivado false para todos

### Implementation (US1)

- [X] T013 [US1] Ampliar `guard_rundown_item()` en `supabase/schema.sql`: si cambia `presenter_id`, validar que el perfil tenga rol `presentador` y copiar `full_name` a `presenter` (null si `presenter_id` es null); ignorar `presenter` enviado; `type = 'nota'` exige `note_id` en el alta; tipos distintos de nota fuerzan `note_id = null`; mantener la validación de nota aprobada/`for_tv` y la regla de presentador solo-estado (incluyendo `presenter_id`)
- [X] T014 [P] [US1] Añadir `canEditRundown(user, rundown)` a `src/lib/permissions.ts` (editor/director y `rundown.status === 'activo'`)
- [X] T015 [US1] En `src/lib/rundownService.ts`: `insertSegment(rundownId, { order, type, noteId?, presenterId?, durationSecs, notes? })` y `updateSegment(id, { durationSecs?, presenterId?: string | null, notes? })` que devuelvan el segmento mapeado; `fetchPresenters()` (`profiles` con `role = 'presentador'`)
- [X] T016 [US1] En `src/store/useStore.ts`: acciones `addSegment(input)` y `updateSegment(id, changes)` (Supabase y demo; demo copia el nombre del presentador desde `profiles` y valida límites: duración 1-3600 s, observaciones ≤ 1000), `presenters` derivados de `profiles` con rol presentador y `refreshProfiles` al abrir el rundown; `addRundownItem(note)` pasa a usar `addSegment`; comprobaciones con `canEditRundown`
- [X] T017 [P] [US1] Crear `src/components/SegmentForm.tsx`: modal de alta/edición según `contracts/ui.md` (tipo solo en alta; selector de notas aprobadas/publicadas para TV no incluidas, precargando su duración; duración `M:SS` validada con `parseDuration` 1 s-60:00; presentador o "Sin presentador"; observaciones ≤ 1000; Guardar deshabilitado con errores; errores en español)
- [X] T018 [US1] En `src/pages/Rundown.tsx`: botón "Agregar segmento" (reemplaza "Agregar nota") y acción "Editar" por fila con `SegmentForm`; mostrar presentador y observaciones; "Nota no disponible" si `type = nota` y la nota no existe o no está aprobada/publicada; todas las acciones de edición condicionadas a `canEditRundown`

**Checkpoint**: MVP de escaleta completa funcional y probado.

---

## Phase 4: User Story 2 - Horas de inicio y desfase (P1)

**Goal**: horas de inicio, fin estimado y desfase calculados al instante.

**Independent Test**: salida 20:00:00, planificado 10:00, segmentos 0:30/1:15/2:00 → inicios 20:00:00, 20:00:30, 20:01:45; fin 20:03:45; "faltan 6:15".

- [X] T019 [US2] En `src/lib/rundownService.ts` + `src/store/useStore.ts`: `updateRundown(id, { title?, channel?, date?, airTime?, plannedDurationSecs? })` (demo incluido) y `createRundown` acepta `airTime` y `plannedDurationSecs` (por defecto 1800)
- [X] T020 [US2] En `src/pages/Rundown.tsx`: cabecera con hora de salida, duración planificada, total, fin estimado y desfase (`describeDiff`: rojo "sobran", ámbar "faltan", verde "En tiempo"); columna Inicio con `computeSchedule` ("—" sin hora de salida); barra de progreso con `progress`
- [X] T021 [P] [US2] Crear `src/components/RundownForm.tsx`: alta/edición de rundown (título 1-200, canal ≤ 100, fecha, salida `HH:MM[:SS]` opcional validada con `parseClock`, duración planificada 1:00-6:00:00 con `parseDuration`); usarlo en `src/pages/Rundown.tsx` para "Nuevo rundown" y "Editar datos"
- [X] T022 [P] [US2] En `src/pages/Dashboard.tsx`: mostrar hora de fin estimada y desfase del rundown seleccionado usando `computeSchedule`

**Checkpoint**: US1 + US2 cumplen el objetivo P1 completo.

---

## Phase 5: User Story 3 - Un solo segmento al aire (P2)

**Goal**: al poner un segmento al aire, el anterior pasa a emitido; nunca dos al aire.

**Independent Test**: con el 2 al aire, poner el 3 al aire → 2 emitido, 3 al aire; dos sesiones simultáneas nunca dejan dos al aire.

- [X] T023 [P] [US3] Añadir a `supabase/tests/rundown_behavior.sql` (sección US3): poner B al aire con A al aire deja A `emitido`; `insert` directo de un segundo `al_aire` falla por índice único; presentador puede cambiar estado; redactor no; borrar el segmento al aire rechazado ("No se puede quitar el segmento que está al aire")
- [X] T024 [P] [US3] Crear `src/lib/rundownState.ts` con `applySegmentStatus(items, itemId, status)` pura (si `status = 'al_aire'`, el anterior al aire pasa a `emitido`) y tests en `src/lib/__tests__/rundownState.test.ts` (cambio simple, relevo de al aire, poner pendiente el que está al aire, id inexistente sin cambios)
- [X] T025 [US3] En `supabase/schema.sql`: en `guard_rundown_item()`, cuando `new.status = 'al_aire'` y antes no lo era, `select … from rundowns where id = new.rundown_id for update` y `update rundown_items set status = 'emitido' where rundown_id = new.rundown_id and status = 'al_aire' and id <> new.id`; trigger `BEFORE DELETE` que rechaza borrar un segmento `al_aire`
- [X] T026 [US3] En `src/store/useStore.ts`: `setRundownItemStatus` usa `applySegmentStatus` en demo y, con Supabase, aplica el mismo cambio local tras éxito y refresca; `removeRundownItem` rechaza en cliente quitar el segmento al aire con el mismo mensaje
- [X] T027 [US3] En `src/pages/Rundown.tsx`: deshabilitar "Quitar" en el segmento al aire con `title` explicativo; el indicador de pausa comercial al aire se mantiene

**Checkpoint**: control al aire consistente en base y cliente.

---

## Phase 6: User Story 4 - Crear, archivar y consultar (P3)

**Goal**: archivar/reactivar, listado de rundowns anteriores y selección entre varios activos; archivados de solo lectura.

**Independent Test**: archivar el activo, crear uno nuevo, abrir el archivado (solo lectura, cualquier cambio rechazado) y reactivarlo.

- [X] T028 [P] [US4] Añadir a `supabase/tests/rundown_behavior.sql` (sección US4): en rundown archivado se rechazan alta, edición, cambio de estado, `reorder_rundown` y baja de segmentos ("El rundown está archivado…"), y cambios de título/hora/duración; editor puede reactivar; redactor/presentador no pueden crear, archivar ni reactivar (0 filas / RLS); `archived_at`/`archived_by` fijados por la base y limpiados al reactivar; `created_by` ignorado del cliente
- [X] T029 [US4] En `supabase/schema.sql`: función + trigger `guard_rundown()` en `rundowns` (`BEFORE INSERT OR UPDATE`): fija `created_by = auth.uid()` en alta; si `old.status = 'archivado'` solo permite cambiar `status` a `activo` (resto de campos iguales) y limpia `archived_*`; al pasar a `archivado` fija `archived_at = now()` y `archived_by = current_app_name()`. En `guard_rundown_item()` y en un trigger `BEFORE DELETE`: rechazar cualquier cambio si el rundown está archivado. Política `rundowns delete` solo para director (separar la política `for all`)
- [X] T030 [US4] En `src/lib/rundownService.ts` + `src/store/useStore.ts`: `archiveRundown(id)` y `reactivateRundown(id)` (demo incluido: al archivar, el rundown pasa a la lista de archivados locales y se selecciona el siguiente activo o ninguno)
- [X] T031 [US4] En `src/pages/Rundown.tsx`: selector de rundown (activos primero, luego "Anteriores" archivados con fecha), sincronizado con `?id=` en la URL; botones "Nuevo rundown", "Archivar" (con confirmación) y "Reactivar"; en archivado, etiqueta "Archivado · solo lectura" con fecha y autor y sin controles de edición ni de estado; si no hay rundowns, mostrar el formulario de alta (editores) o el aviso actual

**Checkpoint**: todas las historias funcionales e independientes.

---

## Phase 7: Polish & cross-cutting

- [X] T032 [P] Actualizar `src/pages/Teleprompter.tsx` y `src/pages/Dashboard.tsx` para usar el rundown seleccionado/activo sin romper cuando no hay ninguno
- [X] T033 Ejecutar `supabase/tests/rundown_behavior.sql` completo sobre PostgreSQL 16 local con `stubs.sql` y el esquema aplicado dos veces; corregir hasta que todos los casos pasen
- [X] T034 Ejecutar `npm run lint && npm run typecheck && npm test && npm run build` y corregir
- [X] T035 Recorrido de `specs/001-rundown-completo/quickstart.md` sección 3 (modo demo) con Playwright/Chromium: editor agrega pausa y edita duración, relevo de al aire, presentador solo estados, redactor solo lectura, archivar/crear/reactivar; sin errores de consola
- [X] T036 [P] Actualizar `README.md` (sección Rundown: horas calculadas, archivado, pruebas SQL en `supabase/tests/`)

---

## Dependencies & Execution Order

- **Setup (T001-T002)** → **Foundational (T003-T010)** → historias.
- **US1 (T011-T018)**: depende de Foundational. MVP.
- **US2 (T019-T022)**: depende de Foundational; usa la página de US1 (T018) para la tabla, pero su lógica (T006) es independiente.
- **US3 (T023-T027)**: depende de Foundational; independiente de US1/US2 salvo la página.
- **US4 (T029-T031)**: depende de Foundational; T029 toca el mismo trigger que T013/T025 → hacer después de ellos.
- Archivos compartidos (secuenciales): `supabase/schema.sql` (T003, T004, T013, T025, T029), `src/store/useStore.ts` (T010, T016, T019, T026, T030), `src/pages/Rundown.tsx` (T018, T020, T021, T027, T031).
- **Polish (T032-T036)** al final.

## Parallel Opportunities

- Foundational: T005, T006, T007 en paralelo (tipos, cálculo, tests).
- US1: T011, T012, T014, T017 en paralelo antes de T015/T016/T018.
- US2: T021 y T022 en paralelo tras T019.
- US3: T023 y T024 en paralelo.
- Polish: T032 y T036 en paralelo.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 → validar el test independiente de US1.
2. **P1 completo**: + US2 (horarios y desfase).
3. **P2**: + US3 (un solo al aire, atómico).
4. **P3**: + US4 (archivado, historial, varios activos).
5. Polish: pruebas SQL completas, CI, recorrido demo, README.
