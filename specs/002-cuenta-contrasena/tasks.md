---
description: "Lista de tareas: Cuenta y contraseña"
---

# Tasks: Cuenta y contraseña

**Input**: Design documents from `/specs/002-cuenta-contrasena/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth.md, quickstart.md

**Tests**: incluidos (constitución IV y especificación: casos negativos).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Añadir el job de CI para `supabase/tests/account_behavior.sql` en `.github/workflows/ci.yml` (paso adicional del job `database`)

---

## Phase 2: Foundational

- [ ] T002 [P] Tests en `src/lib/__tests__/accountValidation.test.ts`: `validatePassword` (9 caracteres → error "al menos 10"; 10 → ok; 73 → error "72 como máximo"; confirmación distinta → "no coinciden") y `validateDisplayName` ("   " → error; 121 → error; " Ana " → ok)
- [ ] T003 [P] Crear `src/lib/accountValidation.ts` con `PASSWORD_MIN = 10`, `PASSWORD_MAX = 72`, `validatePassword(password, confirm) → string | null`, `validateDisplayName(name) → string | null` (recortado 1-120)
- [ ] T004 [P] Tests en `src/lib/__tests__/authErrors.test.ts` y creación de `src/lib/authErrors.ts` con `authErrorMessage(e)`: `invalid_credentials` → "La contraseña actual no es correcta."; `same_password` → "La contraseña nueva debe ser distinta de la actual."; `weak_password` → "La contraseña no cumple los requisitos de seguridad (mínimo 10 caracteres)."; `over_email_send_rate_limit`/`over_request_rate_limit` → "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."; `otp_expired` → "El enlace no es válido o venció. Solicita uno nuevo."; otros → `errorMessage(e)`
- [ ] T005 En `src/store/useStore.ts`: estado `accountEmail: string | null` (se carga en `loadSession` con `auth.getUser()`) y `recovery: boolean` (true al recibir `PASSWORD_RECOVERY` o si la ruta inicial es `/restablecer`)

---

## Phase 3: User Story 1 - Recuperar el acceso (P1) 🎯 MVP

**Independent Test**: pedir enlace (mismo mensaje con correo existente o no), abrir `/restablecer` con sesión de recuperación, fijar nueva contraseña y entrar; enlace vencido muestra aviso.

- [ ] T006 [P] [US1] Tests del servicio en `src/lib/__tests__/accountService.test.ts` con cliente simulado (`vi.mock('../supabase')`): `requestPasswordReset` normaliza correo y usa `redirectTo = origin + '/restablecer'`; no lanza por respuesta vacía; lanza traducido en límite de envíos; `completePasswordReset` llama `updateUser({ password })`
- [ ] T007 [US1] En `src/lib/profilesService.ts`: `requestPasswordReset(email)`, `completePasswordReset(password)` (valida con `validatePassword` antes), `getAccountEmail()`; errores con `authErrorMessage`
- [ ] T008 [US1] En `src/store/useStore.ts`: acciones `requestPasswordReset(email)` y `completePasswordReset(password, confirm)`; al completar, `recovery = false` y carga de la sesión normal
- [ ] T009 [US1] En `src/pages/Login.tsx`: modo "¿Olvidaste tu contraseña?" con campo correo, mensaje único "Si el correo está registrado, recibirás un enlace para restablecer la contraseña." y botón bloqueado 60 s tras enviar
- [ ] T010 [US1] Crear `src/pages/ResetPassword.tsx`: nueva contraseña + confirmación con `validatePassword` (botón deshabilitado con motivo); si la URL trae `error`/`error_code`/`error_description` o no hay sesión de recuperación tras cargar, aviso "El enlace no es válido o venció…" y botón "Pedir otro enlace" (vuelve al login en modo recuperación); al guardar, navega a `/`
- [ ] T011 [US1] En `src/App.tsx`: si `recovery` o la ruta es `/restablecer`, renderizar `ResetPassword` antes de la puerta de login (aunque haya sesión)

---

## Phase 4: User Story 2 - Cambiar la contraseña (P2)

**Independent Test**: contraseña actual incorrecta → error y sin cambios; igual a la actual → error; correcta → "Contraseña actualizada" y `signOut({ scope: 'others' })`.

- [ ] T012 [P] [US2] Tests en `src/lib/__tests__/accountService.test.ts`: `changePassword` verifica primero con `signInWithPassword`; si falla, no llama `updateUser` y lanza "La contraseña actual no es correcta."; si la nueva es igual a la actual lanza sin llamadas; éxito llama en orden `signInWithPassword` → `updateUser` → `signOut({ scope: 'others' })`
- [ ] T013 [US2] En `src/lib/profilesService.ts`: `changePassword(email, current, next)` según el contrato
- [ ] T014 [US2] En `src/store/useStore.ts`: acción `changePassword(current, next, confirm)` (usa `accountEmail`; no disponible en demo)
- [ ] T015 [US2] Crear `src/pages/Account.tsx` (sección Contraseña): actual, nueva, confirmación; mensajes de validación; "Contraseña actualizada" al terminar; en demo, texto "En modo demo la contraseña no se gestiona: usa una cuenta real."

---

## Phase 5: User Story 3 - Editar el nombre visible (P3)

**Independent Test**: cambiar el nombre y verlo en el menú; nombre vacío rechazado; SQL: nombre ajeno 0 filas, rol propio rechazado.

- [ ] T016 [P] [US3] Crear `supabase/tests/account_behavior.sql`: el usuario cambia su nombre (queda recortado); `'   '` y 121 caracteres rechazados; cambiar el nombre de otro → 0 filas; cambiar su propio rol → "Solo un director"; director cambia rol ajeno, no el propio; `created_at` no cambia aunque se envíe; anon no lee perfiles
- [ ] T017 [US3] En `supabase/schema.sql` (`guard_profile_update`): `new.full_name := trim(new.full_name)`; `new.created_at := old.created_at`; mantener reglas de rol
- [ ] T018 [US3] En `src/lib/profilesService.ts`: `updateOwnName(userId, name)` (0 filas → "No tienes permiso…"; CHECK → "El nombre debe tener entre 1 y 120 caracteres.")
- [ ] T019 [US3] En `src/store/useStore.ts`: acción `updateOwnName(name)` (demo y Supabase) que actualiza `currentUser` y `profiles`
- [ ] T020 [US3] En `src/pages/Account.tsx` (sección Perfil): correo y rol en solo lectura, nombre editable con `validateDisplayName`, "Nombre actualizado"
- [ ] T021 [US3] En `src/App.tsx` y `src/components/Layout.tsx`: ruta `/cuenta` y enlace "Mi cuenta" en el menú de usuario (modo real y demo)

---

## Phase 6: Polish

- [ ] T022 Ejecutar `account_behavior.sql` y `rundown_behavior.sql` sobre PostgreSQL 16 con el esquema aplicado dos veces
- [ ] T023 Recorrido e2e con Chromium: (a) demo: Mi cuenta cambia el nombre y el menú lo refleja; (b) build con `VITE_SUPABASE_URL=http://127.0.0.1:54321` y red simulada: mensaje idéntico para dos correos, enlace vencido muestra aviso, recuperación fija contraseña (`PUT /auth/v1/user` recibido) y entra
- [ ] T024 Ejecutar `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] T025 [P] `README.md`: configuración de Supabase Auth (Site URL, Redirect URL `/restablecer`, mínimo 10 caracteres) y uso de Mi cuenta

---

## Dependencies & Execution Order

- Foundational (T002-T005) antes de las historias.
- US1 (T006-T011), US2 (T012-T015), US3 (T016-T021) son independientes entre sí salvo archivos compartidos: `profilesService.ts` (T007, T013, T018), `useStore.ts` (T005, T008, T014, T019), `Account.tsx` (T015, T020), `App.tsx` (T011, T021).
- Tests antes de su implementación (T002→T003, T006→T007, T012→T013, T016→T017).

## Parallel Opportunities

- T002, T003, T004 en paralelo; T006, T012 y T016 en paralelo (archivos distintos).

## Implementation Strategy

1. MVP: Foundational + US1 (recuperación: elimina el bloqueo principal).
2. US2 (cambio de contraseña) y US3 (nombre) como incrementos.
3. Polish: SQL, e2e, README.
