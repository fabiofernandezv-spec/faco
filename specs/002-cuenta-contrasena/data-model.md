# Data Model: Cuenta y contraseña

## Perfil (`profiles`) — sin columnas nuevas

| Campo | Reglas |
|-------|--------|
| id | = `auth.users.id`; inmutable |
| full_name | se recorta en la base; 1-120 caracteres (CHECK existente) |
| role | solo un director lo cambia; nadie cambia el suyo |
| created_at | inmutable (nuevo en el trigger) |

**Quién edita**: el propio usuario (solo `full_name`) o un director (nombre y
rol de otros). RLS existente: `profiles update self`, `profiles update director`.

## Cuenta (Supabase Auth)

- Correo (solo lectura en Mi cuenta), contraseña (mín. 10), sesiones.
- Operaciones: solicitar recuperación, fijar contraseña con sesión de
  recuperación, cambiar contraseña con verificación, cerrar otras sesiones.

## Estado del cliente (store)

| Campo | Uso |
|-------|-----|
| `accountEmail: string \| null` | correo de la sesión, para mostrar y reverificar |
| `recovery: boolean` | hay una sesión de recuperación pendiente (`PASSWORD_RECOVERY`) |

## Validaciones compartidas (`src/lib/accountValidation.ts`)

- `validatePassword(nueva, confirmación)`: ≥ 10 caracteres, ≤ 72 (límite de
  bcrypt), coinciden.
- `validateDisplayName(nombre)`: recortado 1-120.
