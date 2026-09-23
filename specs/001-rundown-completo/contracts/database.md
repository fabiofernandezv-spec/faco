# Contrato de base de datos: Rundown completo

Interfaz que el cliente usa vía PostgREST/supabase-js. Todas las operaciones
requieren sesión (`authenticated`); `anon` no tiene acceso.

## Lectura (todos los roles con sesión)

| Operación | Llamada | Resultado |
|-----------|---------|-----------|
| Listar rundowns | `from('rundowns').select('id,title,air_date,channel,status,archived_at').order('air_date',desc).order('created_at',desc).limit(200)` | resumen, más recientes primero |
| Detalle | `from('rundowns').select('*, rundown_items(*)').eq('id', id).single()` | rundown + segmentos |
| Presentadores | `from('profiles').select('id,full_name').eq('role','presentador')` | lista para asignar |

## Escritura

| Operación | Llamada | Quién | Errores esperados (mensaje) |
|-----------|---------|-------|-----------------------------|
| Crear rundown | `insert rundowns {title, channel, air_date, air_time?, planned_duration_secs}` | editor, director | RLS (otros roles) |
| Editar rundown activo | `update rundowns {title?, channel?, air_date?, air_time?, planned_duration_secs?}` | editor, director | "El rundown está archivado…" |
| Archivar / reactivar | `update rundowns {status: 'archivado' \| 'activo'}` | editor, director | RLS (otros roles) |
| Agregar segmento | `insert rundown_items {rundown_id, order_num, type, note_id?, presenter_id?, duration_secs, notes?}` | editor, director | "Solo se pueden agregar notas aprobadas…", "La nota ya está en el rundown", "El presentador asignado no tiene rol de presentador", "El rundown está archivado…" |
| Editar segmento | `update rundown_items {duration_secs?, presenter_id?, notes?}` | editor, director | mismos + límites (CHECK) |
| Cambiar estado | `update rundown_items {status}` | editor, director, presentador | "El rundown está archivado…" |
| Reordenar | `rpc('reorder_rundown', {p_rundown_id, p_item_ids})` | editor, director | "Solo editores o directores pueden reordenar", archivado |
| Quitar segmento | `delete rundown_items where id` | editor, director | "No se puede quitar el segmento que está al aire", archivado |

## Comportamientos garantizados por la base

1. Poner un segmento `al_aire` deja el anterior en `emitido` en la misma
   transacción; nunca hay dos `al_aire` en un rundown.
2. Presentador: cualquier cambio que no sea `status` se rechaza con "Los
   presentadores solo pueden cambiar el estado del segmento".
3. `note_title`, `presenter`, `created_by`, `archived_at`, `archived_by` los
   calcula la base; los valores enviados por el cliente se ignoran.
4. Un `update`/`delete` que RLS filtra devuelve 0 filas; el servicio lo
   convierte en "No tienes permiso…".

## Realtime

Cambios en `rundowns` y `rundown_items` se publican en `supabase_realtime`; el
cliente recarga el listado y el rundown seleccionado (debounce 300 ms).
