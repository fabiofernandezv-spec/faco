# Contrato de interfaz: pantalla Rundown (`/rundown?id=<uuid>`)

## Cabecera

- Selector de rundown (activos primero, luego "Anteriores" archivados) con
  título, canal y fecha.
- Datos: hora de salida, duración planificada, total, hora de fin estimada y
  desfase ("sobran M:SS" en rojo, "faltan M:SS" en ámbar, "En tiempo" en verde).
- Etiqueta "Archivado · solo lectura" (con fecha y quién) cuando corresponde.

## Acciones por rol

| Acción | Editor / director | Presentador | Redactor |
|--------|-------------------|-------------|----------|
| Nuevo rundown | ✅ | — | — |
| Editar datos del rundown (título, canal, fecha, salida, duración) | ✅ activo | — | — |
| Archivar / reactivar | ✅ | — | — |
| Agregar segmento (tipo, nota, duración, presentador, observaciones) | ✅ activo | — | — |
| Editar segmento | ✅ activo | — | — |
| Subir / bajar / quitar | ✅ activo (quitar deshabilitado si está al aire) | — | — |
| Cambiar estado | ✅ activo | ✅ activo | — (solo lectura) |
| Ver escaleta y horarios | ✅ | ✅ | ✅ |

Las acciones no permitidas no se muestran; si aun así el servidor rechaza una
acción, el mensaje aparece en el `ErrorBanner`.

## Tabla de segmentos

Columnas: `#` (con subir/bajar), Tipo, Contenido (título de nota o tipo,
observaciones, presentador; "Nota no disponible" si la nota ya no existe o dejó
de estar aprobada), Inicio (calculado o "—"), Duración (`M:SS`), Estado,
Acciones (editar, quitar).

## Formulario de segmento (alta/edición)

- Tipo (solo en alta). Si es "Nota": selector de notas aprobadas/publicadas
  para TV que no estén en el rundown; la duración se precarga con la de la nota.
- Duración `M:SS` (1 s – 60:00), presentador (lista de presentadores o
  "Sin presentador"), observaciones (≤ 1000).
- Validación en el cliente con los mismos límites; el botón Guardar se
  deshabilita si hay errores.

## Formulario de rundown (alta/edición)

Título, canal, fecha, hora de salida (`HH:MM` o `HH:MM:SS`, opcional) y
duración planificada (`M:SS` o minutos, 1 min – 6 h; por defecto 30:00).
