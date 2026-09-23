# Especificación: Rundown completo

**Feature Branch**: `001-rundown-completo` (desarrollada en `claude/gifted-bardeen-byfpdq`)

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Rundown completo para Mesa Central: los editores y directores pueden construir la escaleta completa de un noticiero, no solo agregar notas aprobadas. Incluye: crear segmentos que no son notas (apertura, pausa comercial, cortina, cierre) con duración y observaciones; asignar presentador a cada segmento; editar duración, presentador y observaciones de cada segmento; calcular automáticamente la hora de inicio de cada segmento a partir de la hora de salida al aire del rundown y las duraciones acumuladas; mostrar desfase entre duración planificada y hora de fin del programa; archivar el rundown del día y consultar rundowns anteriores (solo lectura); y crear un rundown nuevo. Presentadores solo cambian el estado (pendiente, al aire, emitido); redactores solo consultan. Solo un segmento puede estar al aire a la vez. Debe respetar la constitución: reglas en la base (RLS/triggers), tests negativos, errores visibles, español."

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Armar la escaleta completa del noticiero (Prioridad: P1)

Un editor prepara el noticiero de la noche. Además de las notas aprobadas para
TV, agrega la apertura, las pausas comerciales, las cortinas y el cierre, cada
uno con su duración y observaciones (por ejemplo, "Bloque comercial 1 — 4
spots"). Asigna el presentador de cada segmento y ajusta duraciones hasta que
el programa cuadra.

**Por qué esta prioridad**: hoy el rundown solo admite notas; sin segmentos de
apertura, pausas y cierre no refleja el programa real y no se puede usar al
aire.

**Prueba independiente**: con un rundown activo vacío, un editor agrega una
apertura, dos notas, una pausa comercial y un cierre, asigna presentador y
edita la duración de uno; al recargar la página todo sigue igual y otro usuario
lo ve igual.

**Escenarios de aceptación**:

1. **Dado** un rundown activo, **cuando** un editor agrega un segmento de tipo
   "Pausa comercial" con duración 2:00 y observaciones, **entonces** aparece al
   final de la escaleta con esos datos.
2. **Dado** un segmento existente, **cuando** el editor cambia su duración, su
   presentador o sus observaciones, **entonces** el cambio se guarda y lo ven
   todos los usuarios.
3. **Dado** un segmento, **cuando** el editor lo sube o baja en el orden,
   **entonces** la numeración y las horas de inicio se recalculan.
4. **Dado** un redactor o un presentador, **cuando** intenta agregar, editar,
   reordenar o quitar un segmento, **entonces** la acción se rechaza y se le
   muestra un mensaje claro, también si lo intenta sin pasar por la interfaz.

---

### Historia 2 - Horas de inicio y desfase calculados (Prioridad: P1)

El rundown tiene una hora de salida al aire (por ejemplo 20:00:00) y una
duración planificada del programa (por ejemplo 30:00). Cada segmento muestra su
hora de inicio calculada a partir de la hora de salida y la suma de las
duraciones anteriores. La cabecera muestra la hora de fin estimada y cuánto
sobra o falta respecto a la duración planificada.

**Por qué esta prioridad**: la dirección necesita saber en todo momento si el
programa cabe en su franja; calcularlo a mano es lento y propenso a errores.

**Prueba independiente**: con salida 20:00:00, duración planificada 10:00 y
segmentos de 0:30, 1:15 y 2:00, las horas de inicio son 20:00:00, 20:00:30 y
20:01:45; la hora de fin estimada es 20:03:45 y el desfase indica "faltan
6:15".

**Escenarios de aceptación**:

1. **Dado** un rundown con hora de salida, **cuando** se agrega, quita,
   reordena o cambia la duración de un segmento, **entonces** todas las horas de
   inicio posteriores se recalculan al instante.
2. **Dado** que la suma de duraciones supera la duración planificada,
   **entonces** la cabecera muestra "sobran M:SS" resaltado como alerta.
3. **Dado** que la suma es menor, **entonces** muestra "faltan M:SS"; si es
   igual, muestra "En tiempo".

---

### Historia 3 - Control al aire con un solo segmento activo (Prioridad: P2)

Durante la emisión, el presentador o el editor marca qué segmento está al aire.
Solo puede haber uno: al poner un segmento "al aire", el que estaba al aire pasa
automáticamente a "emitido". El teleprompter y el dashboard muestran el
segmento al aire.

**Por qué esta prioridad**: evita estados contradictorios (dos segmentos al
aire) que confunden al teleprompter y a la dirección.

**Prueba independiente**: con el segmento 2 al aire, un presentador pone al
aire el segmento 3; el 2 queda "emitido" y el 3 "al aire", y ningún otro está
al aire, aunque dos personas lo cambien casi a la vez.

**Escenarios de aceptación**:

1. **Dado** un segmento al aire, **cuando** otro segmento pasa a "al aire",
   **entonces** el anterior queda "emitido" y solo hay uno al aire.
2. **Dado** un presentador, **cuando** cambia el estado de un segmento,
   **entonces** se permite; **cuando** intenta cambiar cualquier otro dato,
   **entonces** se rechaza.
3. **Dado** un redactor, **cuando** intenta cambiar un estado, **entonces** se
   rechaza.

---

### Historia 4 - Crear, archivar y consultar rundowns (Prioridad: P3)

Al terminar el programa, el editor archiva el rundown. Al día siguiente crea
uno nuevo (título, canal, fecha, hora de salida y duración planificada). En una
lista de rundowns anteriores cualquiera puede abrir uno archivado en modo solo
lectura. Si se archivó por error, un editor o director puede reactivarlo.

**Por qué esta prioridad**: permite trabajar día a día sin mezclar escaletas y
conservar el historial, pero el valor principal ya lo dan las historias 1-3.

**Prueba independiente**: archivar el rundown activo, crear uno nuevo, abrir el
archivado desde la lista y comprobar que no se puede modificar; reactivarlo.

**Escenarios de aceptación**:

1. **Dado** un rundown activo, **cuando** un editor lo archiva, **entonces** deja
   de aparecer como activo y aparece en "Rundowns anteriores".
2. **Dado** un rundown archivado, **cuando** cualquier usuario lo abre,
   **entonces** ve la escaleta completa sin controles de edición, y cualquier
   intento de modificación se rechaza.
3. **Dado** varios rundowns activos (por ejemplo, distintas ediciones o
   canales), **entonces** el usuario puede elegir cuál ver.
4. **Dado** un redactor o presentador, **cuando** intenta crear, archivar o
   reactivar un rundown, **entonces** se rechaza.

---

### Casos límite

- Rundown sin hora de salida: las horas de inicio no se muestran ("—"), pero las
  duraciones y el desfase sí.
- Rundown sin segmentos: duración total 0:00, progreso 0 %, sin errores.
- Una nota del rundown se elimina o deja de estar aprobada: el segmento se
  conserva con su último título y se marca "nota no disponible"; no se puede
  volver a enlazar una nota no aprobada.
- La misma nota no puede aparecer dos veces en el mismo rundown.
- Duración fuera de rango (menos de 1 segundo o más de 1 hora por segmento), o
  duración planificada fuera de 1 minuto a 6 horas: se rechaza con mensaje.
- Quitar el segmento que está al aire: se rechaza; primero hay que marcarlo
  emitido o pendiente.
- Dos editores reordenan a la vez: el último orden guardado prevalece y ambos
  ven el mismo resultado final sin duplicar números de orden.
- El programa cruza la medianoche (salida 23:50, duración 30:00): la hora de
  fin se muestra como 00:20:00.
- Pérdida de conexión al guardar: se muestra el error y el dato no se da por
  guardado.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: Editores y directores DEBEN poder agregar segmentos de tipo
  apertura, pausa comercial, cortina, cierre y nota a un rundown activo.
- **FR-002**: Cada segmento DEBE tener duración (1 s a 60 min) y PUEDE tener
  presentador y observaciones (hasta 1000 caracteres).
- **FR-003**: Editores y directores DEBEN poder editar duración, presentador y
  observaciones, reordenar y quitar segmentos de un rundown activo.
- **FR-004**: El presentador de un segmento DEBE elegirse entre los usuarios
  con rol presentador; el sistema conserva el nombre mostrado aunque el usuario
  cambie de rol después.
- **FR-005**: Los segmentos de tipo nota DEBEN enlazar solo notas aprobadas o
  publicadas marcadas para TV, sin repetir la misma nota en un rundown.
- **FR-006**: Cada rundown DEBE tener título, canal, fecha, hora de salida al
  aire opcional y duración planificada (1 min a 6 h).
- **FR-007**: El sistema DEBE calcular la hora de inicio de cada segmento como
  hora de salida + suma de duraciones de los segmentos anteriores, y la hora de
  fin estimada del programa.
- **FR-008**: El sistema DEBE mostrar el desfase entre la suma de duraciones y
  la duración planificada ("sobran", "faltan" o "En tiempo").
- **FR-009**: Como máximo un segmento por rundown DEBE estar "al aire"; al poner
  uno al aire, el anterior pasa a "emitido" automáticamente.
- **FR-010**: Los presentadores DEBEN poder cambiar solo el estado de los
  segmentos; los redactores solo DEBEN poder consultar.
- **FR-011**: Editores y directores DEBEN poder crear rundowns, archivarlos y
  reactivarlos.
- **FR-012**: Un rundown archivado DEBE ser de solo lectura para todos:
  cualquier alta, cambio, reorden, cambio de estado o baja de sus segmentos se
  rechaza.
- **FR-013**: Todos los usuarios con sesión DEBEN poder listar rundowns activos
  y archivados (más recientes primero) y abrir cualquiera.
- **FR-014**: Todas las reglas de permisos, límites y estados de FR-001 a FR-012
  DEBEN aplicarse en el servidor, no solo en la interfaz.
- **FR-015**: Los cambios DEBEN verse en vivo para los demás usuarios con el
  mismo rundown abierto.
- **FR-016**: Todo rechazo o fallo DEBE mostrarse al usuario con un mensaje
  claro en español.
- **FR-017**: Quitar el segmento que está al aire DEBE rechazarse.
- **FR-018**: El modo demo DEBE ofrecer el mismo comportamiento con datos
  locales.

### Entidades clave

- **Rundown**: escaleta de una emisión. Título, canal, fecha, hora de salida al
  aire, duración planificada, estado (activo o archivado), quién lo creó.
- **Segmento**: elemento de la escaleta. Tipo (apertura, nota, pausa comercial,
  cortina, cierre), orden, duración, presentador, observaciones, estado
  (pendiente, al aire, emitido) y, si es de tipo nota, la nota enlazada y su
  título.
- **Presentador**: usuario con rol presentador que se puede asignar a
  segmentos.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Un editor arma una escaleta de 15 segmentos (incluidas aperturas,
  pausas y cierre) en menos de 10 minutos.
- **SC-002**: Las horas de inicio y el desfase se actualizan en menos de 1
  segundo tras cualquier cambio, y coinciden al segundo con el cálculo manual.
- **SC-003**: En ninguna circunstancia hay más de un segmento al aire en un
  rundown, incluso con cambios simultáneos de dos usuarios.
- **SC-004**: El 100 % de los intentos de redactores y presentadores de hacer
  acciones no permitidas, y de cualquier modificación a un rundown archivado, se
  rechazan, también fuera de la interfaz.
- **SC-005**: Un cambio hecho por un usuario aparece para otro usuario con el
  mismo rundown abierto en menos de 3 segundos.
- **SC-006**: Cualquier rundown archivado de los últimos 12 meses se encuentra y
  se abre en menos de 30 segundos.

## Supuestos

- Pueden coexistir varios rundowns activos (ediciones o canales distintos); la
  pantalla muestra por defecto el más reciente y permite elegir otro.
- La hora de inicio se calcula siempre; ya no se escribe a mano por segmento.
  Los datos existentes con hora manual se ignoran para el cálculo.
- La duración planificada por defecto es 30 minutos.
- Reactivar un rundown archivado solo lo pueden hacer editores o directores.
- El orden y la edición de segmentos emitidos se permiten (útil para corregir
  la escaleta), salvo lo indicado para el segmento al aire.
- No se incluye en esta versión: plantillas de rundown, duplicar rundowns,
  exportar la escaleta a PDF, ni cronómetro de emisión en tiempo real.
- Depende de la autenticación, los roles y el rundown básico ya existentes.
