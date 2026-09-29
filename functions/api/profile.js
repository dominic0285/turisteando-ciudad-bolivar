// functions/api/profile.js
// Endpoint para ver y editar el perfil del usuario autenticado
import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET /api/profile → datos del perfil
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const rows = await sql`
      SELECT id, nombre, email, telefono, cedula, tipo_solicitante, nombre_institucion, created_at
      FROM usuarios WHERE id = ${user.id}
    `;
    if (rows.length === 0) return errorResponse('Usuario no encontrado.', 404);
    return jsonResponse(rows[0]);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener perfil.', 500);
  }
}

// PATCH /api/profile → editar perfil
export async function onRequestPatch(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const body = await request.json();
    const { nombre, telefono, tipo_solicitante, nombre_institucion } = body;

    if (!nombre || !nombre.trim()) {
      return errorResponse('El nombre es obligatorio.');
    }

    const sql = getDB(env);
    const updated = await sql`
      UPDATE usuarios SET
        nombre = ${nombre.trim()},
        telefono = ${telefono || null},
        tipo_solicitante = ${tipo_solicitante || null},
        nombre_institucion = ${nombre_institucion || null}
      WHERE id = ${user.id}
      RETURNING id, nombre, email, telefono, cedula, tipo_solicitante, nombre_institucion, rol
    `;

    if (updated.length === 0) return errorResponse('Usuario no encontrado.', 404);
    return jsonResponse(updated[0]);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar perfil.', 500);
  }
}
