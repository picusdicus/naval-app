# Estado del trabajo — rama `feature/superadmin-admin-user`

> Snapshot creado el 2026-07-16 antes de cambiar de rama para otra tarea.
> Borrar este archivo cuando la rama se mergee o el contenido quede obsoleto.

## Qué estamos haciendo en esta rama

Evolucionar el panel de gestión hacia un modelo **multi-tenant con superadmin y suscripciones por organización**:

1. **Separación de logins** (ya commiteado, también en `main`): usuarios de organización entran por `/login` y trabajan en `/panel`; el superadmin tiene login + dashboard fusionados en `/admin`. Las rutas antiguas (`/admin/login`, `/admin/registro`, `/admin/super`) redirigen.
2. **Tiers de organización** (commit `ae3966a`, único commit de esta rama que no está en `main`): columnas de suscripción en `organizaciones` dentro de `db/schema.sql` — `tier` (`bloqueado`/`pro`/`premium`), `trial_iniciado_en` + `trial_usado` (trial de 30 días, una sola vez por org), `suscripcion_estado`/`suscripcion_inicio`/`suscripcion_vence_en`, `stripe_customer_id`/`stripe_subscription_id`, e índice `idx_organizaciones_tier`.
3. **Auditoría de usuarios en Neon**: se creó `scripts/audit-usuarios.js` para inspeccionar el estado real de la BD (organizaciones con su tier, usuarios por org, códigos de invitación con su estado). Se ejecuta con `POSTGRES_URL`/`DATABASE_URL` en el entorno: `node scripts/audit-usuarios.js`.

## Estado exacto de git

- Rama: `feature/superadmin-admin-user`, **1 commit por delante de `main`**: `ae3966a` "sanadir las columnas de tier a organizaciones".
- Hay **cambios staged sin commitear** (ojo: te acompañan al cambiar de rama si no los commiteas o stasheas):
  - `CLAUDE.md` (modificado) — documentación puesta al día: sección de roles/permisos (no hay jerarquía real `admin` vs `editor` dentro de una org), Edge Runtime, tabla `analytics`, y la nueva sección **"Organization tiers and subscriptions"** que describe el diseño de tiers/trial/Stripe.
  - `scripts/audit-usuarios.js` (nuevo) — el script de auditoría descrito arriba.
  - `test-db.mjs` (borrado) — script de prueba suelto en la raíz, sustituido por el script de auditoría.

## En qué punto nos hemos quedado

El trabajo de tiers está en fase **"schema only"**:

- Las columnas existen en `db/schema.sql`, pero `npm run db:setup` **no se ha ejecutado** todavía contra ninguna base de datos real — las columnas no están vivas en Neon.
- **Ningún handler de API ni página lee `tier`** todavía. No hay enforcement: una org `bloqueado` puede publicar igual que una `pro`.
- No existe aún el webhook de Stripe ni el paso de reconciliación que debe ser lo único que escriba `tier` (derivándolo de `suscripcion_estado`).
- El dashboard del superadmin (`/admin`) no muestra ni gestiona tiers.

## Próximos pasos (en orden razonable)

1. Commitear los cambios staged (doc + script de auditoría + borrado de `test-db.mjs`).
2. Ejecutar `npm run db:setup` para aplicar las columnas de tier a Neon (es idempotente) y verificar con `node scripts/audit-usuarios.js`.
3. Implementar el enforcement de `tier`: bloquear publicación (`POST`/`PUT`/`PATCH` a `publicado` en `api/admin/eventos.js`) cuando la org está en `bloqueado` y su trial no está vivo.
4. Endpoint/acción para **iniciar el trial** (comprobar `trial_usado` antes de conceder; stampar `trial_iniciado_en` y flipear `trial_usado` en el mismo paso).
5. Exponer/gestionar `tier` en el panel superadmin (`/api/super/organizaciones`, `AdminSuperPanel.jsx`), agrupando por plan.
6. Integración Stripe (webhook que escribe `suscripcion_*`/`stripe_*` y deriva `tier`) — más adelante.

## Recordatorios / deuda conocida

- `api/_db.js` → la constante `TABLAS` (usada por `/api/health`) sigue sin incluir `analytics`; pendiente de arreglar.
- `npm run lint` falla: no hay `eslint.config.js` en la raíz.
- El diseño de referencia de todo esto está en la sección **"Organization tiers and subscriptions"** del `CLAUDE.md` staged — es diseño a implementar, no comportamiento vivo.
