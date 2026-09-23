# Data Model: Rundown completo

## Rundown (`rundowns`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| title | text | 1-200 caracteres |
| air_date | date | obligatorio, por defecto hoy |
| channel | text | ≤ 100 caracteres |
| air_time | time, **nuevo** | opcional; hora de salida al aire |
| planned_duration_secs | int, **nuevo** | 60-21600, por defecto 1800 |
| status | text | `activo` \| `archivado` (se conserva `borrador` por compatibilidad) |
| created_by | uuid | fijado por la base |
| archived_at | timestamptz, **nuevo** | fijado por la base al archivar; null al reactivar |
| archived_by | text, **nuevo** | nombre de quien archivó; fijado por la base |
| created_at | timestamptz | |

**Transiciones**: `activo → archivado` y `archivado → activo` (editor/director).
Un rundown archivado no admite ningún otro cambio (título, hora, duración…).

## Segmento (`rundown_items`)

| Campo | Tipo | Reglas |
|-------|------|--------|
| id | uuid | PK |
| rundown_id | uuid | FK `rundowns`, cascade |
| order_num | int | orden 1..n |
| type | text | `apertura` \| `nota` \| `pausa_comercial` \| `cortina` \| `cierre` |
| note_id | uuid | solo si `type = nota`; nota aprobada/publicada y `for_tv`; única por rundown (índice parcial) |
| note_title | text | copiado de la nota por la base |
| presenter_id | uuid, **nuevo** | FK `profiles`, `on delete set null`; debe tener rol `presentador` al asignarse |
| presenter | text | nombre copiado por la base desde `presenter_id` |
| duration_secs | int | 1-3600 |
| notes | text | observaciones ≤ 1000 |
| status | text | `pendiente` \| `al_aire` \| `emitido` |
| start_time | text | **obsoleto**: se ignora (horas calculadas) |

**Invariantes**:
- Como máximo un segmento `al_aire` por rundown (índice único parcial).
- Al pasar un segmento a `al_aire`, el que estaba al aire pasa a `emitido`
  (trigger, con bloqueo del rundown).
- No se borra un segmento `al_aire`.
- Ningún cambio (alta, edición, reorden, estado, baja) si el rundown está
  `archivado`.
- Presentador: solo puede cambiar `status`.
- `type = nota` exige `note_id` al crearse; si la nota se elimina queda `note_id
  = null` con `note_title` conservado ("nota no disponible").

## Datos calculados (cliente, `src/lib/rundownTiming.ts`)

| Dato | Cálculo |
|------|---------|
| inicio del segmento i | `air_time + Σ duración(0..i-1)` (mod 24 h), o "—" sin `air_time` |
| fin estimado | `air_time + Σ duraciones` (mod 24 h) |
| total | `Σ duraciones` |
| desfase | `total − planned_duration_secs` → `> 0` "sobran", `< 0` "faltan", `= 0` "En tiempo" |
| progreso | `Σ duración(emitidos) / total` (0 % si total = 0) |

## Tipos TypeScript (cambios)

- `Rundown`: + `airTime?: string` (`HH:MM:SS`), `plannedDurationSecs: number`,
  `archivedAt?`, `archivedBy?`.
- `RundownItem`: + `presenterId?: string`; `startTime` deja de usarse.
- `RundownSummary`: `id, title, date, channel, status, archivedAt?` para el
  listado.
