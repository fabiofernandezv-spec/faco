# Especificación: Cuenta y contraseña

**Feature Branch**: `002-cuenta-contrasena` (desarrollada en `claude/gifted-bardeen-byfpdq`)

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Cuenta y contraseña para Mesa Central: cualquier usuario puede recuperar el acceso si olvida su contraseña (solicitar un enlace por correo desde la pantalla de login y fijar una contraseña nueva al abrirlo), y desde una página "Mi cuenta" puede cambiar su contraseña (confirmando la actual) y editar su nombre visible. Tras cambiar la contraseña se cierran las demás sesiones. La solicitud de recuperación no debe revelar si un correo está registrado. Contraseñas de mínimo 10 caracteres. El rol no se puede cambiar desde Mi cuenta. En modo demo solo se puede cambiar el nombre. Debe respetar la constitución: reglas en la base, tests negativos, errores visibles, español."

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Recuperar el acceso (Prioridad: P1)

Una redactora olvidó su contraseña antes del cierre de edición. Desde la
pantalla de inicio de sesión pulsa "¿Olvidaste tu contraseña?", escribe su
correo y recibe un enlace. Al abrirlo, la aplicación le pide una contraseña
nueva (dos veces), la guarda y la deja dentro con su sesión iniciada.

**Por qué esta prioridad**: hoy no hay forma de recuperar el acceso sin que un
administrador entre al panel del proveedor; bloquea el trabajo diario.

**Prueba independiente**: con una cuenta existente, solicitar el enlace, abrirlo,
fijar una contraseña nueva y entrar; la contraseña anterior deja de funcionar.

**Escenarios de aceptación**:

1. **Dado** la pantalla de inicio de sesión, **cuando** la usuaria pide
   recuperar la contraseña con su correo, **entonces** ve "Si el correo está
   registrado, recibirás un enlace para restablecer la contraseña".
2. **Dado** un correo **no** registrado, **cuando** se pide la recuperación,
   **entonces** se muestra exactamente el mismo mensaje (no se revela si existe).
3. **Dado** un enlace de recuperación válido, **cuando** la usuaria lo abre,
   **entonces** ve el formulario "Nueva contraseña" y, al guardar una contraseña
   válida, entra a la aplicación.
4. **Dado** un enlace vencido o ya usado, **cuando** se abre, **entonces** se
   muestra "El enlace no es válido o venció; solicita uno nuevo" y un acceso a
   pedir otro.
5. **Dado** una contraseña de menos de 10 caracteres o que no coincide con la
   confirmación, **entonces** el botón Guardar queda deshabilitado con el motivo.

---

### Historia 2 - Cambiar la contraseña desde Mi cuenta (Prioridad: P2)

Un editor quiere cambiar su contraseña. En "Mi cuenta" escribe la contraseña
actual y la nueva (dos veces). Al guardar, su sesión actual sigue abierta y las
sesiones abiertas en otros equipos se cierran.

**Por qué esta prioridad**: práctica básica de seguridad (por ejemplo, tras usar
un equipo compartido), pero el acceso ya funciona sin ella.

**Prueba independiente**: con dos sesiones abiertas, cambiar la contraseña en
una; la otra queda cerrada; la contraseña nueva funciona y la anterior no.

**Escenarios de aceptación**:

1. **Dado** la contraseña actual correcta y una nueva válida, **cuando** guarda,
   **entonces** ve "Contraseña actualizada" y las demás sesiones se cierran.
2. **Dado** una contraseña actual incorrecta, **entonces** se muestra "La
   contraseña actual no es correcta" y no se cambia nada.
3. **Dado** una nueva igual a la actual, **entonces** se rechaza con "La
   contraseña nueva debe ser distinta de la actual".

---

### Historia 3 - Editar el nombre visible (Prioridad: P3)

Una presentadora quiere que su nombre aparezca con su segundo apellido. En "Mi
cuenta" lo cambia; el nuevo nombre aparece en el menú lateral y en lo que haga
a partir de ese momento (notas nuevas, asignaciones de presentador).

**Por qué esta prioridad**: mejora de calidad; no bloquea el trabajo.

**Prueba independiente**: cambiar el nombre y comprobar que el menú lo muestra;
crear una nota y ver el nombre nuevo como autor; las notas anteriores conservan
el nombre con el que se firmaron.

**Escenarios de aceptación**:

1. **Dado** un nombre de 1 a 120 caracteres (sin contar espacios de los
   extremos), **cuando** lo guarda, **entonces** se actualiza y se muestra.
2. **Dado** un nombre vacío o de más de 120 caracteres, **entonces** se rechaza.
3. **Dado** cualquier usuario, **cuando** intenta cambiar su propio rol o el
   nombre de otra persona (también fuera de la interfaz), **entonces** se
   rechaza. Solo un director puede cambiar roles, desde "Equipo".
4. **Dado** el modo demo, **entonces** Mi cuenta permite cambiar el nombre y
   explica que la contraseña solo se gestiona con cuentas reales.

---

### Casos límite

- Pedir varios enlaces seguidos: el botón queda deshabilitado 60 segundos tras
  cada solicitud; si el proveedor limita los envíos, se muestra su mensaje.
- Abrir el enlace de recuperación estando ya con otra sesión iniciada: se
  muestra el formulario de nueva contraseña para la cuenta del enlace.
- Correo con mayúsculas o espacios: se normaliza antes de enviar.
- Falla la conexión al guardar: se muestra el error y no se da por cambiada.
- Nombre con solo espacios: se trata como vacío.
- Cambiar el nombre no altera la autoría ya registrada en notas, aprobaciones,
  rechazos ni segmentos existentes.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: La pantalla de inicio de sesión DEBE ofrecer "¿Olvidaste tu
  contraseña?" para pedir un enlace de recuperación por correo.
- **FR-002**: La respuesta a la solicitud DEBE ser idéntica exista o no el
  correo.
- **FR-003**: El enlace DEBE llevar a una pantalla para fijar una contraseña
  nueva con confirmación; al guardarla, la persona queda con sesión iniciada.
- **FR-004**: Un enlace inválido, vencido o usado DEBE mostrar un aviso claro y
  permitir solicitar uno nuevo.
- **FR-005**: Toda contraseña nueva DEBE tener al menos 10 caracteres y
  coincidir con su confirmación.
- **FR-006**: "Mi cuenta" DEBE permitir cambiar la contraseña solo tras
  verificar la contraseña actual; la nueva debe ser distinta de la actual.
- **FR-007**: Tras cambiar la contraseña, el sistema DEBE cerrar todas las demás
  sesiones de esa persona y mantener la actual.
- **FR-008**: "Mi cuenta" DEBE permitir editar el nombre visible (1-120
  caracteres tras recortar espacios) y mostrar el correo y el rol en solo
  lectura.
- **FR-009**: Una persona solo DEBE poder cambiar su propio nombre; nadie puede
  cambiar su propio rol. Estas reglas DEBEN aplicarse en el servidor.
- **FR-010**: El nombre nuevo DEBE reflejarse de inmediato en la interfaz y
  usarse en las acciones posteriores; los registros anteriores conservan el
  nombre original.
- **FR-011**: En modo demo, "Mi cuenta" DEBE permitir solo el cambio de nombre.
- **FR-012**: Todos los mensajes y errores DEBEN estar en español y mostrarse al
  usuario.

### Entidades clave

- **Cuenta**: credenciales de acceso de una persona (correo, contraseña,
  sesiones abiertas). Gestionada por el servicio de autenticación.
- **Perfil**: nombre visible y rol dentro de la redacción; editable (nombre) por
  su dueño y (rol) solo por un director.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Una persona que olvidó su contraseña recupera el acceso sin ayuda
  en menos de 3 minutos desde que pide el enlace (sin contar la entrega del
  correo).
- **SC-002**: 0 solicitudes de recuperación revelan si un correo está
  registrado (mismo mensaje y mismo comportamiento visible en ambos casos).
- **SC-003**: El 100 % de los intentos de cambiar el rol propio o el nombre de
  otra persona se rechazan, también fuera de la interfaz.
- **SC-004**: Tras un cambio de contraseña, las demás sesiones dejan de tener
  acceso a los datos en menos de 1 hora (vida máxima de la credencial de
  sesión) y no pueden renovarse.
- **SC-005**: Las solicitudes de soporte para restablecer contraseñas bajan a 0.

## Supuestos

- El proveedor de autenticación envía el correo de recuperación y define la
  vigencia del enlace (por defecto, 1 hora) y los límites de envío.
- El dominio de la aplicación debe estar autorizado como destino de
  redirección en la configuración del proveedor (se documenta en el README).
- La longitud mínima de 10 caracteres también se configura en el proveedor para
  que no dependa solo de la interfaz.
- No se incluye en esta versión: cambio de correo, verificación en dos pasos,
  inicio de sesión con proveedores externos ni foto de perfil.
- Depende de la autenticación y los perfiles existentes.
