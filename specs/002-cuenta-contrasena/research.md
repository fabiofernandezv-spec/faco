# Research: Cuenta y contraseña

## R1. Flujo de recuperación

- **Decision**: `auth.resetPasswordForEmail(email, { redirectTo: origin + '/restablecer' })`.
  Con el flujo `implicit` (predeterminado de supabase-js 2) el enlace trae la
  sesión en el fragmento de la URL; supabase-js la detecta y emite el evento
  `PASSWORD_RECOVERY`. La app, en `/restablecer`, muestra el formulario y llama
  a `auth.updateUser({ password })`.
- **Rationale**: funciona aunque el enlace se abra en otro navegador (PKCE
  exigiría el mismo navegador que hizo la solicitud).
- **Alternatives**: PKCE (`exchangeCodeForSession`) — más estricto pero rompe el
  caso "pido en el PC y abro en el móvil".

## R2. Enlace inválido o vencido

- **Decision**: si la URL de `/restablecer` trae `error` / `error_code` /
  `error_description` (en el fragmento o la query), o si tras cargar no hay
  sesión de recuperación, se muestra "El enlace no es válido o venció" con la
  opción de pedir otro.

## R3. No revelar si el correo existe

- **Decision**: la UI siempre muestra el mismo mensaje tras la solicitud. Solo
  se muestran errores que no dependen del correo (límite de envíos, red).
- **Rationale**: Supabase ya responde igual para correos inexistentes; la UI no
  debe introducir diferencias.

## R4. Cambio de contraseña con verificación

- **Decision**: 1) `signInWithPassword(email, actual)`; si falla → "La contraseña
  actual no es correcta"; 2) `updateUser({ password: nueva })`; 3)
  `signOut({ scope: 'others' })`.
- **Rationale**: `updateUser` no exige la contraseña actual; la verificación
  explícita evita que una sesión abandonada cambie la contraseña. `scope:
  'others'` revoca los refresh tokens de las demás sesiones (sus access tokens
  vencen en ≤ 1 h — SC-004).
- **Alternatives**: `reauthenticate()` + nonce por correo (más fricción).

## R5. Reglas de perfil en la base

- **Decision**: ampliar `guard_profile_update()`: `full_name := trim(full_name)`
  (el CHECK 1-120 rechaza vacíos), `created_at` inmutable; se mantienen "solo
  director cambia roles" y "nadie cambia su propio rol". RLS ya limita la
  edición al propio perfil (o director).

## R6. Traducción de errores de Auth

- **Decision**: `authErrorMessage(e)` por `code` (`invalid_credentials`,
  `same_password`, `weak_password`, `over_email_send_rate_limit`,
  `over_request_rate_limit`, `otp_expired`) con mensaje genérico en español
  como respaldo.

## R7. Pruebas e2e sin Supabase real

- **Decision**: compilar con `VITE_SUPABASE_URL=http://127.0.0.1:54321` y
  simular las rutas `/auth/v1/*` y `/rest/v1/profiles` con intercepción de red
  del navegador para validar: mensaje idéntico con correo existente e
  inexistente, enlace inválido, y guardado de la nueva contraseña.
