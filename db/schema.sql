-- Esquema inicial de En Navalcarnero (Neon Postgres).
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

-- Destacados contratados: eventos o comercios que se realzan en portada,
-- agenda y guía. `referencia_id` es texto opaco: ids de eventos estáticos
-- ('ev-…', 'aytocult-…'), de la base ('bd-<uuid>'), de comercios ('gpl_…') o
-- de servicios locales ('local/…'); si la referencia muere (evento borrado,
-- comercio desaparecido al regenerar el JSON), el cliente la filtra sin romper.
-- `organizacion_id` registra quién contrató el destacado; la vigencia se
-- calcula en lectura con fecha_inicio/fecha_fin (sin cron). Una fila por item
-- (UNIQUE): una nueva contratación del mismo item reutiliza su fila, no hay
-- histórico de campañas pasadas.
CREATE TABLE IF NOT EXISTS destacados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL CHECK (tipo IN ('evento', 'comercio')),
  referencia_id   text NOT NULL,
  organizacion_id uuid REFERENCES organizaciones(id) ON DELETE SET NULL,
  orden           integer NOT NULL DEFAULT 0,
  imagen_url      text,
  fecha_inicio    date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin       date,
  estado          text NOT NULL DEFAULT 'activo' CHECK (estado IN ('pendiente', 'activo', 'cancelado')),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT destacado_unico UNIQUE (tipo, referencia_id),
  CONSTRAINT destacado_fin_no_anterior CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_destacados_vigentes ON destacados (estado, fecha_inicio, fecha_fin);

-- Vincula una cuenta de organización con su ficha del directorio de comercios
-- ('gpl_…' de comercios.json o 'local/…' de servicios-locales.json), para que
-- pueda solicitar destacar su negocio desde /panel. Texto sin FK: el
-- directorio vive en JSON, no en la base. El índice único parcial garantiza
-- que un comercio solo pertenece a una organización.
ALTER TABLE organizaciones ADD COLUMN IF NOT EXISTS comercio_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizaciones_comercio ON organizaciones (comercio_id) WHERE comercio_id IS NOT NULL;

-- Suscripciones push anónimas por dispositivo (fase 1 de NOTIFICACIONES_PUSH.md).
-- `endpoint` identifica el dispositivo (URL del push service del navegador);
-- `temas` es la lista plana de intereses ('todos', 'cat:<categoria>',
-- 'org:<slug>'). `usuario_id` nace NULL: si en el futuro hay cuenta de vecino
-- (fase 3), sus suscripciones anónimas se le adjuntan sin migración. Las filas
-- caducadas se borran inline cuando el envío devuelve 404/410 (sin cron aparte).
CREATE TABLE IF NOT EXISTS push_suscripciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  temas      jsonb NOT NULL DEFAULT '["todos"]',
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  creada_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temas_es_lista CHECK (jsonb_typeof(temas) = 'array')
);

-- Marca de "ya avisado" del digest push: el cron notifica los eventos
-- publicados con notificado_en NULL y la rellena después. Así un evento que
-- pasa a publicado días después de crearse también entra en el digest, y las
-- ediciones posteriores no re-notifican.
ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS notificado_en timestamptz;

-- Historial de avisos push (la "bandeja" que el vecino ve en la app). Web Push
-- es efímero, así que el cron registra aquí cada evento que anuncia en un
-- digest: una fila por evento (`referencia_id` = id público del evento, UNIQUE
-- para no duplicar entre ejecuciones del cron). La app lee este historial y lo
-- filtra CLIENT-SIDE por los temas del dispositivo (mismo patrón que
-- destacados), así no se multiplica el almacenamiento por suscriptor ni hace
-- falta exponer el `endpoint`. El "no leído" se calcula en el cliente
-- (localStorage con la última visita); no hay estado de lectura por dispositivo.
CREATE TABLE IF NOT EXISTS push_avisos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia_id text NOT NULL UNIQUE,
  titulo        text NOT NULL,
  cuerpo        text,
  url           text NOT NULL,
  temas         jsonb NOT NULL DEFAULT '[]',
  enviado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avisos_temas_es_lista CHECK (jsonb_typeof(temas) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_push_avisos_fecha ON push_avisos (enviado_en DESC);

-- Identificador del contenido de origen para eventos sincronizados desde
-- fuentes externas (api/sync-instagram.js guarda 'ig-<shortCode>'). El índice
-- único parcial soporta el upsert: re-ejecutar la sincronización actualiza la
-- fila en vez de duplicarla. Los eventos creados desde el panel lo dejan NULL.
ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS origen_externo_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_origen_externo ON eventos_usuario (origen_externo_id) WHERE origen_externo_id IS NOT NULL;

-- Subcategoría de un evento de cultura (teatro, cine, musica, danza,
-- exposicion, otros): la rellena api/sync-instagram.js (whitelist en
-- src/lib/eventos.js, SUBCATEGORIAS_CULTURA) y permite los sub-filtros de la
-- página Eventos. NULL para el resto de categorías o si no está clara.
ALTER TABLE eventos_usuario ADD COLUMN IF NOT EXISTS subcategoria text;

-- Noticias y alertas del Ayuntamiento sincronizadas desde Instagram
-- (api/sync-instagram-noticias.js). Conviven con src/data/noticias.json (RSS):
-- van a Neon porque una alerta urgente no puede esperar al ciclo
-- commit→redeploy que regenera los JSON. origen_externo_id = 'ig-<shortCode>';
-- aquí la columna es NOT NULL, así que el UNIQUE va directo en la columna (no
-- hace falta el índice parcial de eventos_usuario) y el upsert usa
-- ON CONFLICT (origen_externo_id) a secas. Las alertas vigentes se filtran
-- CLIENT-SIDE (urgente + expira_en > now), sin cron: al caducar simplemente
-- dejan de mostrarse. Las actividades viven ahora en su propia tabla.
CREATE TABLE IF NOT EXISTS noticias_instagram (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_externo_id text NOT NULL UNIQUE,
  titulo            text NOT NULL,
  resumen           text,
  cuerpo            text,
  imagen_url        text,
  url               text,
  usuario           text,
  tipo              text NOT NULL DEFAULT 'noticia' CHECK (tipo IN ('noticia')),
  urgente           boolean NOT NULL DEFAULT false,
  tipo_alerta       text CHECK (tipo_alerta IN ('incendio', 'corte_agua', 'corte_luz', 'trafico', 'emergencia', 'general')),
  publicado_en      timestamptz NOT NULL,
  expira_en         timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alerta_coherente CHECK ((urgente AND tipo_alerta IS NOT NULL) OR (NOT urgente AND tipo_alerta IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_noticias_ig_publicado ON noticias_instagram (publicado_en DESC);

-- Eventos ocultados a mano por el superadmin desde el panel (tab Eventos).
-- referencia_id = id público del evento, en el mismo formato que usan los
-- destacados y la bandeja de avisos (ev-…, aytocult-…, bd-<uuid>, ig-…). Cubre
-- tanto los eventos estáticos (eventos.json / eventos-externos.json) como los
-- de Neon sin tocar el estado del evento de la organización: la agenda pública
-- (useEventosPublicos) filtra CLIENT-SIDE los ids presentes aquí. Ocultar es
-- reversible: basta borrar la fila.
CREATE TABLE IF NOT EXISTS eventos_ocultos (
  referencia_id text PRIMARY KEY,
  oculto_en timestamptz NOT NULL DEFAULT now()
);

-- Solicitudes de reclamación de comercios por sus dueños (anónimas). El
-- superadmin las aprueba en /admin: genera un código de invitación vinculado
-- al comercio_id, y el dueño se registra con ese código. La columna estado
-- permite el triaje de gestión en el panel (pendiente → aprobada/rechazada).
CREATE TABLE IF NOT EXISTS solicitudes_reclamacion (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comercio_id       text NOT NULL,
  nombre            text NOT NULL,
  email             text NOT NULL,
  telefono          text,
  mensaje           text NOT NULL,
  estado            text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  creado_en         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_comercio ON solicitudes_reclamacion (comercio_id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_reclamacion (estado);

-- Perfil enriquecido de un comercio reclamado. Cada org puede tener un
-- comercio vinculado (organizaciones.comercio_id); el perfil se almacena aquí
-- y tiene prioridad sobre los datos estáticos del JSON. Upsert por comercio_id
-- (PK, referencia al JSON estático, inmutable).
CREATE TABLE IF NOT EXISTS comercios_perfil (
  comercio_id       text PRIMARY KEY,
  organizacion_id   uuid REFERENCES organizaciones(id) ON DELETE CASCADE,
  descripcion       text,
  horarios          jsonb,
  foto_principal    text,
  fotos             jsonb,
  web               text,
  telefono          text,
  direccion         text,
  lat               numeric,
  lng               numeric,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comercios_perfil_org ON comercios_perfil (organizacion_id);

-- Vincula un código de invitación con el comercio que reclama (si aplica).
-- Cuando el superadmin aprueba una reclamación, genera un código aquí con
-- comercio_id NOT NULL. Al registrarse con ese código, api/registro.js vincula
-- automáticamente la org al comercio (UPDATE organizaciones.comercio_id).
ALTER TABLE codigos_invitacion ADD COLUMN IF NOT EXISTS comercio_id text;

-- Actividades con plazo de inscripción sincronizadas desde Instagram del Ayuntamiento
-- (api/sync-instagram-noticias.js). Extraídas de posts que enlazan a programaciones
-- completas (ej: programación deportiva de fiestas). Una fila por actividad individual.
-- origen_externo_id = 'ig-<shortCode>-<slug>' para evitar duplicados si se re-scrapeaña
-- la misma fuente. Las actividades vigentes se filtran CLIENT-SIDE (fecha_limite >= hoy),
-- sin cron: al caducar simplemente dejan de mostrarse en la UI.
CREATE TABLE IF NOT EXISTS actividades (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_externo_id text NOT NULL UNIQUE,
  titulo            text NOT NULL,
  descripcion       text,
  categoria         text NOT NULL CHECK (categoria IN ('deporte', 'talleres', 'infantil', 'mayores', 'educacion', 'ayudas', 'empleo', 'general')),
  fecha_limite      date,
  horario           text,
  lugar             text,
  imagen_url        text,
  url_fuente        text,
  publicado_en      timestamptz NOT NULL DEFAULT now(),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actividades_origen ON actividades (origen_externo_id);

CREATE INDEX IF NOT EXISTS idx_actividades_fecha_limite ON actividades (fecha_limite DESC);
