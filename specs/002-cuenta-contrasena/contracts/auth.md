# Contrato: cuenta y contraseña

## Servicios del cliente (`src/lib/profilesService.ts`)

| Función | Llamadas a Supabase | Resultado / errores (español) |
|---------|--------------------|-------------------------------|
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: origin + '/restablecer' })` | Éxito siempre que no haya error de red o de límite; nunca distingue correos |
| `completePasswordReset(password)` | `auth.updateUser({ password })` (con sesión de recuperación) | "El enlace no es válido o venció…" si no hay sesión |
| `changePassword(email, actual, nueva)` | `auth.signInWithPassword({ email, password: actual })` → `auth.updateUser({ password: nueva })` → `auth.signOut({ scope: 'others' })` | "La contraseña actual no es correcta"; "La contraseña nueva debe ser distinta de la actual" |
| `updateOwnName(userId, nombre)` | `from('profiles').update({ full_name }).eq('id', userId).select()` | "No tienes permiso…" si 0 filas; CHECK → "El nombre debe tener entre 1 y 120 caracteres" |
| `getAccountEmail()` | `auth.getUser()` | correo o null |

## Pantallas

| Ruta | Acceso | Contenido |
|------|--------|-----------|
| Login (sin sesión) | público | "¿Olvidaste tu contraseña?" → correo → mensaje único; botón bloqueado 60 s |
| `/restablecer` | público (se muestra aunque haya sesión) | Nueva contraseña + confirmación; aviso de enlace inválido con "Pedir otro enlace" |
| `/cuenta` | con sesión (también demo) | Correo y rol (solo lectura); nombre editable; cambio de contraseña (oculto en demo con explicación) |

## Base de datos

- `profiles` update: RLS existente (propio perfil o director).
- `guard_profile_update()`: recorta `full_name`; `created_at` inmutable; rol
  solo por director y nunca el propio (sin JWT se permite, administración).

## Configuración del proveedor (README)

- Site URL = dominio de la app; Redirect URLs incluye `https://<dominio>/restablecer`.
- Longitud mínima de contraseña = 10.
