# Constitución de Mesa Central

Sistema de redacción digital y TV de somoseffe: notas con flujo de aprobación,
rundown (escaleta), teleprompter y biblioteca de medios. React + Vite +
TypeScript en el cliente; Supabase (Postgres, Auth, Storage, Realtime) como
backend.

## Principios fundamentales

### I. La seguridad vive en la base de datos (NO NEGOCIABLE)

- Toda regla de acceso o de negocio que proteja datos se aplica en Supabase:
  políticas RLS, triggers `security definer` y restricciones `CHECK`. La UI
  solo refleja esas reglas (`src/lib/permissions.ts`); nunca es la única
  barrera.
- Ninguna tabla nueva se publica sin RLS habilitado, sin políticas explícitas
  por rol y sin `revoke` al rol `anon`.
- Los campos de autoría, aprobación y auditoría (`author_*`, `approved_*`,
  `rejected_*`, `uploaded_by*`) los fija el servidor; lo que envíe el cliente
  se ignora.
- La `anon key` es pública por diseño; la `service_role` key nunca entra al
  cliente, al repositorio ni a variables `VITE_*`.

*Razón:* el bundle es público y el navegador es territorio del usuario. Una
regla que solo existe en la UI no es una regla.

### II. Roles y flujo editorial explícitos

- Roles válidos: `redactor`, `editor`, `director`, `presentador`. Solo un
  director cambia roles y nadie cambia el suyo.
- Transiciones de nota permitidas: `borrador/rechazada → en_revision` (autor o
  editor), `en_revision → aprobada/rechazada` (editor/director; el rechazo
  exige motivo), `aprobada → publicada` y regreso a `borrador` (editor/director).
- Cada cambio de estado queda registrado en `note_events`.
- Cualquier cambio a roles o transiciones se implementa a la vez en
  `supabase/schema.sql`, `src/lib/noteWorkflow.ts` y `src/lib/permissions.ts`,
  con tests.

*Razón:* en una redacción, quién aprobó qué y cuándo es información editorial y
legal; debe ser verificable y no falsificable.

### III. Contenido no confiable siempre saneado

- Todo HTML de usuario pasa por `sanitizeHtml` (DOMPurify con lista blanca) al
  guardar **y** al mostrar. Todo texto interpolado en HTML pasa por
  `escapeHtml`.
- Prohibido `dangerouslySetInnerHTML` y asignar `innerHTML` (lo bloquea
  ESLint). Documentos generados (p. ej. impresión/PDF) llevan CSP propia.
- Archivos subidos: tipos MIME en lista blanca, tamaño máximo 100 MB, nombres
  saneados, bucket privado y URLs firmadas temporales.

*Razón:* una nota maliciosa no debe poder ejecutar código en la sesión de un
editor o director.

### IV. Pruebas antes de fusionar

- Toda regla de permisos, transición de estado, validación o saneamiento nueva
  o modificada lleva tests en Vitest (`src/**/*.test.ts`), incluidos casos
  negativos (lo que debe quedar bloqueado).
- Cambios en `supabase/schema.sql` se verifican ejecutando el esquema completo
  (debe ser re-ejecutable) y probando los casos de acceso denegado por rol.
- CI (`lint`, `typecheck`, `test`, `build`, `npm audit --audit-level=high`)
  debe estar en verde. Nunca se omite ni desactiva un test para pasar CI.

*Razón:* las regresiones de seguridad son silenciosas; solo un test negativo
las detecta.

### V. Simplicidad y un solo camino por dato

- Supabase es la única fuente de verdad en producción. `localStorage` solo se
  usa en el modo demo (sin variables `VITE_SUPABASE_*`) y para la sesión que
  gestiona supabase-js.
- El acceso a datos pasa por los servicios de `src/lib/*Service.ts`; los
  componentes no llaman a Supabase directamente.
- Los errores se muestran al usuario (store `error` + `ErrorBanner`); nunca se
  tragan en `console.error`.
- Ediciones concurrentes usan control optimista (`updated_at`): se avisa en
  lugar de sobrescribir.
- Dependencias nuevas solo si resuelven un problema real y no tienen
  vulnerabilidades altas conocidas.

*Razón:* un equipo pequeño mantiene mejor un sistema con pocas piezas y un flujo
de datos predecible.

## Restricciones técnicas

- Stack: React 18, TypeScript estricto, Vite, Tailwind, Zustand, React Router,
  TipTap, Supabase JS v2. Node 22 en CI y Docker.
- Idioma de la interfaz, mensajes de error y documentación: español.
- Despliegue: imagen Docker (nginx) con CSP, HSTS, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Toda nueva fuente
  externa (imágenes, APIs, websockets) debe añadirse explícitamente a la CSP.
- Accesibilidad básica: controles con `aria-label` cuando no tienen texto
  visible; formularios con `label`.
- El modo demo nunca se usa en producción y se identifica visiblemente en la UI.

## Flujo de desarrollo

- Cada funcionalidad sigue Spec Kit: `/speckit-specify` → (`/speckit-clarify`)
  → `/speckit-plan` → `/speckit-tasks` → (`/speckit-analyze`) →
  `/speckit-implement`.
- El plan de cada funcionalidad incluye una sección de **verificación de la
  constitución**: nuevas tablas/columnas, políticas RLS, cambios de roles o
  transiciones, fuentes externas en la CSP y tests negativos previstos.
- Cambios de esquema que destruyen datos van en `supabase/migrations/` con
  advertencia explícita y se documentan en el README.
- Pull requests pequeños y enfocados; la descripción indica cómo se probó.

## Gobernanza

- Esta constitución prevalece sobre cualquier otra práctica del proyecto. Las
  revisiones de PR verifican su cumplimiento; toda excepción se justifica por
  escrito en el plan de la funcionalidad (sección de complejidad).
- Enmiendas: se proponen por PR modificando este archivo, con la razón del
  cambio y el impacto en plantillas y código existente.
- Versionado semántico: MAJOR si se elimina o redefine un principio; MINOR si
  se añade un principio o sección, o se amplía materialmente; PATCH para
  aclaraciones y redacción.
- Guía operativa de desarrollo y despliegue: `README.md`.

**Versión**: 1.0.0 | **Ratificada**: 2026-09-23 | **Última enmienda**: 2026-09-23
