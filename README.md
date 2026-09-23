# Mesa Central — somoseffe

Sistema de redacción digital y TV: notas con flujo de aprobación, rundown
(escaleta), teleprompter y biblioteca de medios. React + Vite + Supabase.

## Desarrollo

```bash
npm install
cp .env.example .env   # opcional: sin Supabase arranca en modo demo
npm run dev
```

| Comando             | Qué hace                              |
|---------------------|---------------------------------------|
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | TypeScript                            |
| `npm test`          | Tests (Vitest)                        |
| `npm run build`     | Build de producción en `dist/`        |

**Modo demo:** sin `VITE_SUPABASE_*` la app usa datos de ejemplo guardados en
el navegador y un selector de usuario. No usar en producción.

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Si ya habías ejecutado el esquema antiguo (políticas `public read/write`),
   ejecuta `supabase/migrations/000_drop_legacy.sql` (⚠️ borra esos datos).
3. Ejecuta `supabase/schema.sql` completo en **SQL Editor**.
4. En **Authentication → Providers** deja habilitado Email. Recomendado:
   activar confirmación de correo y, si el equipo es cerrado, desactivar
   registros públicos (**Allow new users to sign up**) y crear usuarios desde
   el panel.
5. Regístrate en la app y conviértete en director desde SQL Editor:
   ```sql
   update profiles set role = 'director'
    where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
   ```
6. Desde la página **Equipo** el director asigna los roles al resto.

### Modelo de seguridad

- Sin sesión no hay acceso a ningún dato (RLS + `revoke` a `anon`).
- Roles en `profiles.role`; solo un director puede cambiarlos (trigger).
- Estados de nota validados en la base (`guard_note_write`):
  `borrador/rechazada → en_revision` (autor o editor),
  `en_revision → aprobada/rechazada` (editor/director),
  `aprobada → publicada` (editor/director).
  Autor, `approved_*` y `rejected_*` los fija la base, no el navegador.
- Historial de cambios de estado en `note_events`.
- Edición concurrente: si otra persona guardó antes, se avisa en vez de pisar.
- Presentadores solo cambian el estado de los segmentos del rundown.
- Medios en bucket **privado** `media` (máx. 100 MB, tipos permitidos),
  mostrados con URLs firmadas de 1 hora.
- HTML de las notas saneado con DOMPurify al guardar y al mostrar.

## Despliegue con Docker (EasyPanel u otro)

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
  -t mesa-central .
docker run -p 8080:80 mesa-central
```

En EasyPanel: servicio tipo *App* desde este repositorio con el `Dockerfile`,
define los **build args** anteriores y expón el puerto 80.

nginx sirve la SPA con cabeceras de seguridad (CSP, HSTS, X-Frame-Options,
nosniff, Referrer-Policy, Permissions-Policy). Si usas Supabase autoalojado
en otro dominio, ajusta en tiempo de ejecución:

```
SUPABASE_ORIGIN=https://supabase.midominio.com
SUPABASE_WS_ORIGIN=wss://supabase.midominio.com
```
