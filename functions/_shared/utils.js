// functions/_shared/utils.js
import { neon } from '@neondatabase/serverless';

export function getDB(env) {
  return neon(env.DATABASE_URL);
}

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256
  );
  const computedHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === hashHex;
}

export function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const sql = getDB(env);
  try {
    const rows = await sql`
      SELECT u.id, u.nombre, u.email, u.rol, u.cedula, u.telefono, u.nombre_institucion, u.tipo_solicitante
      FROM tokens_sesion ts
      JOIN usuarios u ON u.id = ts.usuario_id
      WHERE ts.token = ${token} AND ts.expira_at > NOW()
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// AUTORIZACIÓN
// ────────────────────────────────────────────────────────────

/** Devuelve el usuario si la sesión es válida y tiene rol admin; si no, null. */
export async function requireAdmin(request, env) {
  const user = await verifyToken(request, env);
  if (!user || user.rol !== 'admin') return null;
  return user;
}

// ────────────────────────────────────────────────────────────
// ALMACENAMIENTO DE IMÁGENES (Cloudflare R2)
// ────────────────────────────────────────────────────────────

/** Nombre del binding de R2 declarado en wrangler.toml */
export const R2_BINDING = 'MEDIA';

/** true si el bucket está configurado y disponible en este entorno. */
export function tieneR2(env) {
  return !!(env && env[R2_BINDING] && typeof env[R2_BINDING].put === 'function');
}

/**
 * Convierte la clave de un objeto de R2 en la URL pública que sirve el sitio.
 * Las imágenes se entregan desde /media/<clave> a través de functions/media,
 * así que no hace falta exponer el bucket ni configurar un dominio aparte.
 */
export function urlMedia(clave) {
  if (!clave) return null;
  if (/^https?:\/\//i.test(clave) || clave.startsWith('/')) return clave; // enlaces antiguos
  return '/media/' + clave.split('/').map(encodeURIComponent).join('/');
}

/** Tipos de imagen aceptados al subir. */
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Tamaño máximo por archivo: 8 MB. */
export const MAX_BYTES_IMAGEN = 8 * 1024 * 1024;

/** Extensión sugerida a partir del tipo MIME. */
export function extensionDe(tipo) {
  return ({
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
  })[tipo] || 'bin';
}

/** Limpia un nombre para usarlo como parte de la clave del objeto. */
export function limpiarNombre(nombre, largo = 40) {
  return String(nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, largo) || 'archivo';
}
