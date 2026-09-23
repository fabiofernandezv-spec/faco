# Quickstart: validar Rundown completo

## Requisitos

- `npm install`
- Para pruebas SQL: PostgreSQL 16 local con `psql` (o un proyecto Supabase de
  pruebas).

## 1. Pruebas automáticas

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Esperado: todo en verde, incluidos `rundownTiming` (horarios, desfase,
medianoche) y `rundownState` (un solo al aire).

## 2. Reglas de base de datos

Sobre una base con los stubs de `auth`/`storage` y `supabase/schema.sql`
aplicado (dos veces, debe ser idempotente):

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/rundown_behavior.sql
```

Esperado: cada caso negativo imprime `OK bloqueado: …` y el script termina sin
error. Casos cubiertos: redactor no crea/edita; presentador solo estado; dos
segmentos al aire imposibles (el anterior queda emitido); archivado de solo
lectura (alta, edición, estado, reorden, baja); reactivación; presentador con
rol inválido; nota no aprobada o duplicada; borrar el segmento al aire.

## 3. Recorrido manual (modo demo: `npm run dev` sin variables Supabase)

1. Como **Carlos López (editor)** abre Rundown TV. Verifica cabecera: salida
   20:00:00, duración planificada 30:00, fin estimado y desfase.
2. Agrega una "Pausa comercial" de 2:00 con observaciones y presentador "Sofía
   Torres": aparece al final y las horas se recalculan; el desfase cambia.
3. Edita la duración de un segmento y sube/baja otro: horas recalculadas.
4. Pon al aire el segmento 4: el que estaba al aire queda emitido.
5. Cambia a **Sofía Torres (presentadora)**: solo puede cambiar estados.
6. Cambia a **María Rodríguez (redactora)**: todo en solo lectura.
7. Como editor, **Archivar**: el rundown pasa a "Anteriores" y se abre en solo
   lectura; crea un **Nuevo rundown**; reabre el archivado y **Reactivar**.

## 4. Con Supabase

Repite el paso 3 con dos navegadores (editor y presentador): los cambios de uno
aparecen en el otro en menos de 3 s.
