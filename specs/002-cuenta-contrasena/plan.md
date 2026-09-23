# Implementation Plan: Cuenta y contraseña

**Branch**: `002-cuenta-contrasena` (trabajo en `claude/gifted-bardeen-byfpdq`) | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cuenta-contrasena/spec.md`

## Summary

Recuperación de contraseña por correo, cambio de contraseña verificando la
actual (cerrando las demás sesiones) y edición del nombre visible. La
autenticación la gestiona Supabase Auth (`resetPasswordForEmail`,
`updateUser`, `signOut({ scope: 'others' })`); las reglas de perfil (solo el
propio nombre, nunca el propio rol, nombre recortado 1-120) se refuerzan en el
trigger `guard_profile_update`. La lógica de validación y la traducción de
errores de autenticación son funciones puras testeadas; los servicios de cuenta
se prueban con un cliente simulado.

## Technical Context

**Language/Version**: TypeScript 5 (estricto), SQL (PostgreSQL 15+)

**Primary Dependencies**: React 18, React Router 7, Zustand 4, @supabase/supabase-js 2 (auth-js, flujo `implicit` por defecto)

**Storage**: tabla `profiles` (nombre, rol); credenciales y sesiones en Supabase Auth.

**Testing**: Vitest (validaciones, mapeo de errores, servicio de cuenta con cliente simulado); SQL de comportamiento (`supabase/tests/account_behavior.sql`); e2e con Chromium contra la app compilada apuntando a un Supabase simulado por intercepción de red.

**Target Platform**: navegadores de escritorio; SPA en nginx.

**Project Type**: SPA + backend gestionado.

**Performance Goals**: respuesta de formularios < 1 s (sin contar red).

**Constraints**: no revelar existencia de correos; mínimo 10 caracteres; sin dependencias nuevas; CSP actual (solo `self` + origen Supabase) suficiente.

**Scale/Scope**: decenas de usuarios.

## Constitution Check

| Principio | Cumplimiento | Estado |
|-----------|--------------|--------|
| I. Seguridad en la base | Cambios de perfil validados por RLS + `guard_profile_update` (recorta y valida nombre, bloquea rol propio, `created_at` inmutable). Contraseñas y sesiones las gestiona Auth; nunca pasan por tablas propias. | ✅ |
| II. Roles | El rol solo lo cambia un director (sin cambios); Mi cuenta lo muestra en solo lectura. | ✅ |
| III. Contenido saneado | Nombre mostrado como texto; sin HTML. | ✅ |
| IV. Pruebas | Tests negativos SQL (nombre ajeno, rol propio, nombre vacío/largo) y Vitest (contraseña actual incorrecta, igual a la actual, no revelar correo). | ✅ |
| V. Simplicidad | Servicios en `profilesService.ts`; errores traducidos y mostrados en `ErrorBanner`/formularios. | ✅ |
| CSP | Sin orígenes nuevos. | ✅ |

Re-evaluación post-diseño: sin violaciones.

## Project Structure

### Documentation

```text
specs/002-cuenta-contrasena/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/auth.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
supabase/
├── schema.sql                       # guard_profile_update: recorta/valida nombre, created_at inmutable
└── tests/account_behavior.sql       # nuevo

src/
├── lib/
│   ├── accountValidation.ts         # validatePassword, validateDisplayName (nuevo)
│   ├── authErrors.ts                # traducción de errores de Auth (nuevo)
│   ├── profilesService.ts           # requestPasswordReset, completePasswordReset, changePassword, updateOwnName, getAccountEmail
│   └── __tests__/account*.test.ts   # nuevos
├── store/useStore.ts                # recovery, accountEmail, acciones de cuenta
├── pages/
│   ├── Login.tsx                    # modo "¿Olvidaste tu contraseña?"
│   ├── ResetPassword.tsx            # /restablecer (nuevo)
│   └── Account.tsx                  # /cuenta (nuevo)
├── components/Layout.tsx            # enlace "Mi cuenta"
└── App.tsx                          # /restablecer fuera del login; ruta /cuenta
```

**Structure Decision**: misma SPA; lógica pura en `src/lib`, reglas en `supabase/schema.sql`.

## Complexity Tracking

Sin violaciones.
