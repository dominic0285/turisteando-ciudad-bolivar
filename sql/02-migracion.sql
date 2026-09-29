-- ============================================================
--  MIGRACIÓN v1 → v2
--  Turisteando en Ciudad Bolívar
--
--  ESTE es el archivo que hay que ejecutar si la base de datos
--  ya está en uso con solicitudes reales. Solo agrega cosas:
--  no borra ni modifica nada de lo que ya existe, y se puede
--  ejecutar varias veces sin causar problemas.
--
--  Cómo ejecutarlo:  Neon → tu proyecto → SQL Editor → pegar → Run
-- ============================================================

-- ── 1. Columnas nuevas en tablas existentes ─────────────────

ALTER TABLE rutas ADD COLUMN IF NOT EXISTS imagen_clave    TEXT;
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS duracion_min    INTEGER;
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS punto_encuentro TEXT;

ALTER TABLE noticias ADD COLUMN IF NOT EXISTS imagen_clave TEXT;
ALTER TABLE noticias ADD COLUMN IF NOT EXISTS destacada    BOOLEAN DEFAULT FALSE;

-- Por si la base viene de una versión anterior a la recuperación de contraseña
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pregunta_seguridad    TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS respuesta_seguridad   TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT FALSE;

-- ── 2. Biblioteca de imágenes ───────────────────────────────

CREATE TABLE IF NOT EXISTS medios (
  id         SERIAL PRIMARY KEY,
  clave      TEXT UNIQUE NOT NULL,
  titulo     VARCHAR(255),
  carpeta    VARCHAR(40) DEFAULT 'general',
  tipo_mime  VARCHAR(60),
  bytes      INTEGER,
  subido_por INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── 3. Atractivos de la ciudad ──────────────────────────────

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

-- ── 4. Mensajería ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversaciones (
  id            SERIAL PRIMARY KEY,
  usuario_id    INTEGER REFERENCES usuarios(id)    ON DELETE CASCADE,
  solicitud_id  INTEGER REFERENCES solicitudes(id) ON DELETE SET NULL,
  tipo          VARCHAR(20) NOT NULL DEFAULT 'ruta',
  asunto        VARCHAR(255),
  estado        VARCHAR(20) NOT NULL DEFAULT 'abierta',
  ultimo_msg_at TIMESTAMP DEFAULT NOW(),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes (
  id              SERIAL PRIMARY KEY,
  conversacion_id INTEGER REFERENCES conversaciones(id) ON DELETE CASCADE,
  autor_id        INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_rol       VARCHAR(20) NOT NULL,
  cuerpo          TEXT NOT NULL,
  adjunto_clave   TEXT,
  leido           BOOLEAN   DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── 5. Índices ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_msg_conv       ON mensajes(conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_sin_leer   ON mensajes(autor_rol, leido);
CREATE INDEX IF NOT EXISTS idx_conv_usuario   ON conversaciones(usuario_id, ultimo_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_estado    ON conversaciones(estado, ultimo_msg_at DESC);
CREATE INDEX IF NOT EXISTS idx_medios_carpeta ON medios(carpeta, created_at DESC);

-- ── 6. Atractivos de arranque (solo si la tabla quedó vacía) ─

INSERT INTO atractivos (nombre, descripcion, categoria, destacado, orden)
SELECT * FROM (VALUES
  ('Catedral Metropolitana Santo Tomás Apóstol', 'Iniciada en 1777 y consagrada en 1896, es el templo mayor de la ciudad y patrona junto a la Virgen de las Nieves.', 'patrimonio',   TRUE,  1),
  ('Paseo Orinoco',                              'El balcón de la ciudad sobre el río más caudaloso de Venezuela, y el mejor lugar para ver el atardecer.',            'paisaje',      FALSE, 2),
  ('Puente Angostura',                           'Primer puente colgante sobre el Orinoco, inaugurado en 1967 e ícono indiscutible de Ciudad Bolívar.',                 'patrimonio',   FALSE, 3),
  ('Palacio Municipal',                          'Sede del gobierno municipal y una de las edificaciones civiles más representativas del casco histórico.',             'arquitectura', FALSE, 4),
  ('Casa del Congreso de Angostura',             'Levantada en 1766, fue sede del Congreso de 1819 donde el Libertador decretó la creación de la Gran Colombia.',       'patrimonio',   FALSE, 5),
  ('Cocina guayanesa',                           'Pescado de río, casabe y dulces criollos: la mesa que acompaña cada recorrido.',                                      'gastronomia',  FALSE, 6)
) AS nuevos(nombre, descripcion, categoria, destacado, orden)
WHERE NOT EXISTS (SELECT 1 FROM atractivos);

-- ── 7. Comprobación ─────────────────────────────────────────
-- Ejecuta esto al final: debe devolver 4 filas.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('medios', 'atractivos', 'conversaciones', 'mensajes')
ORDER BY table_name;
