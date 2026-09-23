# Quickstart: validar Cuenta y contraseña

## 1. Automático

```bash
npm run lint && npm run typecheck && npm test && npm run build
psql -v ON_ERROR_STOP=1 -f supabase/tests/account_behavior.sql   # ver supabase/tests/README.md
```

Esperado: tests de `accountValidation`, `authErrors` y `accountService`
(cliente simulado) en verde; SQL: nombre propio recortado, nombre vacío/largo
rechazado, nombre ajeno 0 filas, rol propio rechazado, director cambia roles
ajenos pero no el suyo.

## 2. e2e con Supabase simulado

Compilar con `VITE_SUPABASE_URL=http://127.0.0.1:54321` y ejecutar el
recorrido de Chromium (ver tareas): mismo mensaje para correo existente e
inexistente; `/restablecer#error_code=otp_expired…` muestra el aviso;
`/restablecer#access_token=…&type=recovery` permite fijar la contraseña.

## 3. Demo

`npm run dev` sin variables: Menú de usuario → Mi cuenta → cambiar nombre → el
menú lateral lo muestra; la sección de contraseña explica que no aplica en demo.

## 4. Supabase real

1. Configurar Site URL y Redirect URL `/restablecer`; mínimo 10 caracteres.
2. Login → "¿Olvidaste tu contraseña?" → abrir el correo → fijar nueva → entra.
3. Con dos navegadores abiertos, cambiar la contraseña en uno desde Mi cuenta:
   el otro pierde el acceso al renovar la sesión (≤ 1 h).
