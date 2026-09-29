-- ============================================================
--  TURISTEANDO EN CIUDAD BOLÍVAR — ESQUEMA COMPLETO v2
--  Dirección de Turismo · Alcaldía del Municipio Angostura del Orinoco
--
--  Úsalo SOLO para una base de datos nueva y vacía.
--  Si ya tienes datos en Neon, ejecuta en su lugar 02-migracion.sql,
--  que agrega lo nuevo sin tocar lo existente.
--
--  Cómo ejecutarlo:  Neon → tu proyecto → SQL Editor → pegar → Run
-- ============================================================

-- ── RUTAS TURÍSTICAS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rutas (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(255) NOT NULL,
  descripcion     TEXT,
  color           VARCHAR(20)  NOT NULL,
  icono           VARCHAR(10)  NOT NULL,
  imagen_clave    TEXT,                    -- clave del objeto en R2
  duracion_min    INTEGER,                 -- duración estimada en minutos
  punto_encuentro TEXT,
  activa          BOOLEAN   DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── USUARIOS (solicitantes + administración) ────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id                    SERIAL PRIMARY KEY,
  username              VARCHAR(100) UNIQUE,
  nombre                VARCHAR(255) NOT NULL,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  telefono              VARCHAR(50),
  cedula                VARCHAR(50) UNIQUE,
  tipo_solicitante      VARCHAR(100),
  nombre_institucion    VARCHAR(255),
  password_hash         VARCHAR(512) NOT NULL,
  rol                   VARCHAR(20) DEFAULT 'solicitante',
  pregunta_seguridad    TEXT,
  respuesta_seguridad   TEXT,
  debe_cambiar_password BOOLEAN   DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- ── SESIONES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens_sesion (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  token      VARCHAR(255) UNIQUE NOT NULL,
  expira_at  TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── SOLICITUDES DE RECORRIDO ────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
  id                    SERIAL PRIMARY KEY,
  usuario_id            INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre_solicitante    VARCHAR(255) NOT NULL,
  cedula_solicitante    VARCHAR(50),
  telefono_contacto     VARCHAR(50)  NOT NULL,
  email_contacto        VARCHAR(255),
  tipo_grupo            VARCHAR(100) NOT NULL,
  nombre_institucion    VARCHAR(255),
  ruta_id               INTEGER REFERENCES rutas(id),
  fecha_preferida       DATE,
  cantidad_adultos      INTEGER DEFAULT 0,
  cantidad_menores      INTEGER DEFAULT 0,
  cantidad_docentes     INTEGER DEFAULT 0,
  responsable_principal VARCHAR(255) NOT NULL,
  observaciones         TEXT,
  -- Campos administrativos
  estado                VARCHAR(50) DEFAULT 'pendiente',
  nota_admin            TEXT,
  telefono_asignado     VARCHAR(50),
  fecha_asignada        DATE,
  fecha_respuesta       TIMESTAMP,
  respondido_por        INTEGER REFERENCES usuarios(id),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- ── NOTICIAS Y EVENTOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS noticias (
  id           SERIAL PRIMARY KEY,
  titulo       VARCHAR(500) NOT NULL,
  contenido    TEXT,
  imagen_url   TEXT,                        -- enlaces externos (formato antiguo)
  imagen_clave TEXT,                        -- clave del objeto en R2 (formato nuevo)
  destacada    BOOLEAN DEFAULT FALSE,
  publicado    BOOLEAN DEFAULT TRUE,
  creado_por   INTEGER REFERENCES usuarios(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ── ATRACTIVOS DE LA CIUDAD (mosaico del inicio) ────────────
CREATE TABLE IF NOT EXISTS atractivos (
  id           SERIAL PRIMARY KEY,
  nombre       VARCHAR(255) NOT NULL,
  descripcion  TEXT,
  categoria    VARCHAR(60) DEFAULT 'patrimonio',
  imagen_clave TEXT,
  destacado    BOOLEAN DEFAULT FALSE,
  publicado    BOOLEAN DEFAULT TRUE,
  orden        INTEGER DEFAULT 0,
  creado_por   INTEGER REFERENCES usuarios(id),
  created_at   TIMESTAMP DEFAULT NOW()
);

-- ── BIBLIOTECA DE IMÁGENES (registro de lo que hay en R2) ───
CREATE TABLE IF NOT EXISTS medios (
  id         SERIAL PRIMARY KEY,
  clave      TEXT UNIQUE NOT NULL,          -- ruta del objeto dentro del bucket
  titulo     VARCHAR(255),
  carpeta    VARCHAR(40) DEFAULT 'general',
  tipo_mime  VARCHAR(60),
  bytes      INTEGER,
  subido_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── MENSAJERÍA: HILOS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversaciones (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER REFERENCES usuarios(id)    ON DELETE CASCADE,
  solicitud_id  INTEGER REFERENCES solicitudes(id) ON DELETE SET NULL,
  tipo          VARCHAR(20) NOT NULL DEFAULT 'ruta',     -- 'ruta' | 'soporte'
  asunto        VARCHAR(255),
  estado        VARCHAR(20) NOT NULL DEFAULT 'abierta',  -- 'abierta' | 'respondida' | 'cerrada'
  ultimo_msg_at TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── MENSAJERÍA: MENSAJES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensajes (
  id              SERIAL PRIMARY KEY,
  conversacion_id INTEGER REFERENCES conversaciones(id) ON DELETE CASCADE,
  autor_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_rol       VARCHAR(20) NOT NULL,      -- 'solicitante' | 'admin'
  cuerpo          TEXT NOT NULL,
  adjunto_clave   TEXT,
  leido           BOOLEAN   DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── ÍNDICES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario ON solicitudes(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado  ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_tokens_token        ON tokens_sesion(token);
CREATE INDEX IF NOT EXISTS idx_msg_conv            ON mensajes(conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_sin_leer        ON mensajes(autor_rol, leido);
CREATE INDEX IF NOT EXISTS idx_conv_usuario        ON conversaciones(usuario_id, ultimo_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_estado         ON conversaciones(estado, ultimo_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_medios_carpeta      ON medios(carpeta, created_at DESC);

-- ── updated_at automático en solicitudes ────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_solicitudes_updated_at ON solicitudes;
CREATE TRIGGER trigger_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
--  DATOS INICIALES
-- ============================================================

INSERT INTO rutas (nombre, descripcion, color, icono) VALUES
  ('Turisteando en Ciudad Bolívar',
   'Recorrido por los principales atractivos históricos y culturales del casco central: Plaza Bolívar, Palacio Municipal, Paseo Orinoco y más.',
   '#FF007F', '🏛️'),
  ('Turisteando en la Angostura del Orinoco',
   'Experiencia única a orillas del majestuoso río Orinoco, conociendo la historia de la Angostura y sus paisajes inigualables.',
   '#0088DB', '🌊'),
  ('Ruta Turística Religiosa Caminos de Fe',
   'Visita a las iglesias, ermitas y espacios de devoción histórica de Ciudad Bolívar, incluyendo la Catedral y la iglesia Santísima Trinidad.',
   '#6C2EB9', '⛪'),
  ('Ruta Turística La Gran Colombia',
   'Recorrido histórico por los espacios vinculados al Congreso de Angostura de 1819 y la gesta libertadora de la Gran Colombia.',
   '#FF6B00', '🗺️'),
  ('Ruta Turística Historia Médica de Ciudad Bolívar',
   'Descubre la rica historia de la medicina, farmacias antiguas e instituciones sanitarias históricas de la ciudad.',
   '#00B050', '🏥'),
  ('Ruta Turística Angostuarte',
   'Recorrido por los espacios de arte, murales, galerías y expresiones culturales que hacen de Ciudad Bolívar un destino artístico.',
   '#FFB300', '🎨'),
  ('El Recorrer de las Aves en Ciudad Bolívar',
   'Avistamiento de aves y recorrido por los ecosistemas naturales, playas del Orinoco y espacios verdes del Municipio Heres.',
   '#00C5E0', '🦜')
ON CONFLICT DO NOTHING;

-- Atractivos de arranque. Se quedan sin imagen_clave a propósito:
-- mientras no se cargue una foto desde el panel, el inicio muestra
-- la fotografía de reserva que trae el propio sitio.
INSERT INTO atractivos (nombre, descripcion, categoria, destacado, orden) VALUES
  ('Catedral Metropolitana Santo Tomás Apóstol', 'Iniciada en 1777 y consagrada en 1896, es el templo mayor de la ciudad y patrona junto a la Virgen de las Nieves.', 'patrimonio', TRUE, 1),
  ('Paseo Orinoco',                              'El balcón de la ciudad sobre el río más caudaloso de Venezuela, y el mejor lugar para ver el atardecer.',           'paisaje',      FALSE, 2),
  ('Puente Angostura',                           'Primer puente colgante sobre el Orinoco, inaugurado en 1967 e ícono indiscutible de Ciudad Bolívar.',                'patrimonio',   FALSE, 3),
  ('Palacio Municipal',                          'Sede del gobierno municipal y una de las edificaciones civiles más representativas del casco histórico.',            'arquitectura', FALSE, 4),
  ('Casa del Congreso de Angostura',             'Levantada en 1766, fue sede del Congreso de 1819 donde el Libertador decretó la creación de la Gran Colombia.',      'patrimonio',   FALSE, 5),
  ('Cocina guayanesa',                           'Pescado de río, casabe y dulces criollos: la mesa que acompaña cada recorrido.',                                     'gastronomia',  FALSE, 6)
ON CONFLICT DO NOTHING;

-- ============================================================
--  ADMINISTRADORA
--  Se crea con el endpoint  GET /api/admin/seed?secret=<SEED_SECRET>
--  Usuario: admin   Contraseña: la de ADMIN_PASSWORD_INICIAL (se pide cambiarla al entrar)
--  CAMBIA esa contraseña apenas entres por primera vez.
-- ============================================================
