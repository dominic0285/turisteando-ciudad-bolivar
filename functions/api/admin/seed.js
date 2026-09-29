// functions/api/admin/seed.js
// Endpoint para crear el usuario administrador inicial
// USAR UNA SOLA VEZ durante el setup
import { getDB, hashPassword, jsonResponse, errorResponse, corsHeaders } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    // Clave secreta y contraseña inicial vienen de variables de entorno
    // (SEED_SECRET y ADMIN_PASSWORD_INICIAL), nunca del código.
    if (!env.SEED_SECRET || !env.ADMIN_PASSWORD_INICIAL) {
      return errorResponse('Seed deshabilitado: faltan SEED_SECRET o ADMIN_PASSWORD_INICIAL.', 403);
    }
    if (secret !== env.SEED_SECRET) {
      return errorResponse('Clave secreta incorrecta.', 403);
    }

    const sql = getDB(env);

    // Verificar si ya existe un admin
    const existing = await sql`SELECT id FROM usuarios WHERE username = 'admin'`;
    if (existing.length > 0) {
      return errorResponse('El usuario admin ya existe.');
    }

    const hash = await hashPassword(env.ADMIN_PASSWORD_INICIAL);

    const newAdmin = await sql`
      INSERT INTO usuarios (username, nombre, email, password_hash, rol, debe_cambiar_password)
      VALUES ('admin', 'Administrador', 'admin@ejemplo.com', ${hash}, 'admin', true)
      RETURNING id, username, nombre, email, rol
    `;

    return jsonResponse({ ok: true, user: newAdmin[0] }, 201);
  } catch (err) {
    console.error('Seed error:', err);
    return errorResponse('Error al crear admin: ' + err.message, 500);
  }
}
