-- Esquema inicial de Navalcarnero Vecinal (Neon Postgres).
--
-- Las sentencias se separan por ';' al final de línea: no uses funciones ni
-- bloques con dollar-quoting aquí (scripts/db-setup.mjs las trocea así).

-- Organizaciones culturales (teatros, asociaciones, peñas...) que publican
-- eventos en la agenda.
-- `categoria_defecto` y `lugar_defecto` son el perfil con el que se rellenan
-- los eventos de la organización: sus gestores no los eligen evento a evento.
CREATE TABLE IF NOT EXISTS organizaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  slug              text NOT NULL UNIQUE,
  descripcion       text,
  email_contacto    text,
  telefono          text,
  web               text,
  categoria_defecto text,
  lugar_defecto     text,
  activa            boolean NOT NULL DEFAULT true,
  creada_en         timestamptz NOT NULL DEFAULT now()
);

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
-- un editor/admin sí, y llegó canjeando un código de invitación.
CREATE TABLE IF NOT EXISTS usuarios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL UNIQUE,
  nombre               text NOT NULL,
  rol                  text NOT NULL DEFAULT 'vecino' CHECK (rol IN ('admin', 'editor', 'vecino')),
  organizacion_id      uuid REFERENCES organizaciones(id) ON DELETE SET NULL,
  codigo_invitacion_id uuid REFERENCES codigos_invitacion(id) ON DELETE SET NULL,
  activo               boolean NOT NULL DEFAULT true,
  creado_en            timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso_en     timestamptz,
  CONSTRAINT gestor_requiere_organizacion CHECK (rol = 'vecino' OR organizacion_id IS NOT NULL)
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

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS hora_fin text;

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS entradas_texto text;

ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS entradas_url text;
