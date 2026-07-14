-- Esquema inicial de Navalcarnero Vecinal (Neon Postgres).
--
-- Las sentencias se separan por ';' al final de línea: no uses funciones ni
-- bloques con dollar-quoting aquí (scripts/db-setup.mjs las trocea así).

-- Organizaciones culturales (teatros, asociaciones, peñas...) que publican
-- eventos en la agenda.
-- `categoria_defecto` y `lugar_defecto` son el perfil con el que se rellenan
-- los eventos de la organización: sus gestores no los eligen evento a evento.
--
-- Suscripción: `tier` decide qué puede hacer la organización.
--   'bloqueado' — no puede publicar (es el valor por defecto: una organización
--                 recién creada no tiene nada contratado ni trial arrancado).
--   'pro'       — plan de pago estándar.
--   'premium'   — plan de pago superior.
-- El trial de 30 días se concede una sola vez: al arrancarlo se sella
-- `trial_iniciado_en` y se marca `trial_usado`, que ya nunca vuelve a false,
-- de modo que borrar la fecha no regala un segundo periodo de prueba.
CREATE TABLE IF NOT EXISTS organizaciones (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                 text NOT NULL,
  slug                   text NOT NULL UNIQUE,
  descripcion            text,
  email_contacto         text,
  telefono               text,
  web                    text,
  categoria_defecto      text,
  lugar_defecto          text,
  activa                 boolean NOT NULL DEFAULT true,
  tier                   text NOT NULL DEFAULT 'bloqueado' CHECK (tier IN ('bloqueado', 'pro', 'premium')),
  trial_iniciado_en      timestamptz,
  trial_usado            boolean NOT NULL DEFAULT false,
  suscripcion_estado     text NOT NULL DEFAULT 'ninguna' CHECK (suscripcion_estado IN ('ninguna', 'trial', 'activa', 'impagada', 'cancelada')),
  suscripcion_inicio     timestamptz,
  suscripcion_vence_en   timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  creada_en              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizaciones_tier ON organizaciones (tier);

-- Códigos de invitación: una organización los reparte para que sus gestores
-- se den de alta y puedan publicar eventos en su nombre.
CREATE TABLE IF NOT EXISTS codigos_invitacion (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text NOT NULL UNIQUE,
  organizacion_id  uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  rol_concedido    text NOT NULL DEFAULT 'editor' CHECK (rol_concedido IN ('admin', 'editor')),
  usos_maximos     integer NOT NULL DEFAULT 1 CHECK (usos_maximos > 0),
  usos_actuales    integer NOT NULL DEFAULT 0 CHECK (usos_actuales >= 0),
  expira_en        timestamptz,
  activo           boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usos_no_exceden_maximo CHECK (usos_actuales <= usos_maximos)
);

CREATE INDEX IF NOT EXISTS idx_codigos_organizacion ON codigos_invitacion (organizacion_id);

-- Usuarios registrados. Un vecino no pertenece a ninguna organización;
-- un editor/admin sí, y llegó canjeando un código de invitación;
-- un superadmin no tiene organización.
CREATE TABLE IF NOT EXISTS usuarios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL UNIQUE,
  nombre               text NOT NULL,
  password_hash        text,
  rol                  text NOT NULL DEFAULT 'vecino' CHECK (rol IN ('admin', 'editor', 'vecino', 'superadmin')),
  organizacion_id      uuid REFERENCES organizaciones(id) ON DELETE SET NULL,
  codigo_invitacion_id uuid REFERENCES codigos_invitacion(id) ON DELETE SET NULL,
  activo               boolean NOT NULL DEFAULT true,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso_en     timestamptz,
  CONSTRAINT gestor_requiere_organizacion CHECK (rol IN ('vecino', 'superadmin') OR organizacion_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion ON usuarios (organizacion_id);

-- Eventos creados desde la app por usuarios de una organización. Conviven con
-- los eventos estáticos de src/data/eventos.json y eventos-externos.json.
CREATE TABLE IF NOT EXISTS eventos_usuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id uuid NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  creado_por      uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  descripcion     text,
  categoria       text,
  fecha_inicio    date NOT NULL,
  fecha_fin       date,
  hora            text,
  hora_fin        text,
  lugar           text,
  direccion       text,
  precio          text,
  url             text,
  entradas_texto  text,
  entradas_url    text,
  imagen_url      text,
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fin_no_anterior_a_inicio CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_eventos_organizacion ON eventos_usuario (organizacion_id);

CREATE INDEX IF NOT EXISTS idx_eventos_publicados ON eventos_usuario (estado, fecha_inicio);

-- Migraciones sobre bases de datos que ya tenían la tabla creada: CREATE TABLE
-- IF NOT EXISTS no añade columnas nuevas a una tabla existente.
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS categoria_defecto text;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS lugar_defecto text;

-- Suscripciones. Las organizaciones que ya existieran entran como 'bloqueado'
-- con el trial sin usar, así que pueden arrancar su periodo de prueba.
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'bloqueado' CHECK (tier IN ('bloqueado', 'pro', 'premium'));

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS trial_iniciado_en timestamptz;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS trial_usado boolean NOT NULL DEFAULT false;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS suscripcion_estado text NOT NULL DEFAULT 'ninguna' CHECK (suscripcion_estado IN ('ninguna', 'trial', 'activa', 'impagada', 'cancelada'));

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS suscripcion_inicio timestamptz;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS suscripcion_vence_en timestamptz;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS hora_fin text;

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS entradas_texto text;

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS entradas_url text;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash text;

-- Tabla de analytics: registra eventos anónimos de uso de la app.
CREATE TABLE IF NOT EXISTS analytics (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento      text NOT NULL,
  seccion          text,
  organizacion_id  uuid REFERENCES organizaciones(id) ON DELETE SET NULL,
  pregunta_asistente text,
  comercio_buscado text,
  creado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_tipo ON analytics (tipo_evento);

CREATE INDEX IF NOT EXISTS idx_analytics_seccion ON analytics (seccion);

CREATE INDEX IF NOT EXISTS idx_analytics_org ON analytics (organizacion_id);

CREATE INDEX IF NOT EXISTS idx_analytics_fecha ON analytics (creado_en);

-- Vincula una visita ('visita_evento') con el evento concreto que se vio.
-- Nullable: los demás tipos (pregunta_asistente, comercio_buscado...) no
-- tienen evento asociado. Si el evento se borra, la visita queda huérfana
-- pero se conserva para los totales de la organización.
ALTER TABLE analytics ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES eventos_usuario(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_evento ON analytics (evento_id);
