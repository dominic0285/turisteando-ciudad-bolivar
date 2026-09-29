// functions/api/admin/rutas.js
// GET   /api/admin/rutas   → todas las rutas, incluidas las desactivadas
// PATCH /api/admin/rutas   → edita una ruta (portada, textos, duración, punto de encuentro)

import { getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const rutas = await sql`SELECT * FROM rutas ORDER BY id`;
    return jsonResponse(rutas.map(r => ({ ...r, imagen_url: urlMedia(r.imagen_clave) })));
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener las rutas.', 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const body = await request.json();
    const { id, nombre, descripcion, imagen_clave, duracion_min, punto_encuentro, activa } = body;
    if (!id) return errorResponse('Falta el identificador de la ruta.');

    const sql = getDB(env);
    const actualizada = await sql`
      UPDATE rutas SET
        nombre          = COALESCE(${nombre ?? null}, nombre),
        descripcion     = COALESCE(${descripcion ?? null}, descripcion),
        imagen_clave    = COALESCE(${imagen_clave ?? null}, imagen_clave),
        duracion_min    = COALESCE(${duracion_min ?? null}, duracion_min),
        punto_encuentro = COALESCE(${punto_encuentro ?? null}, punto_encuentro),
        activa          = COALESCE(${typeof activa === 'boolean' ? activa : null}, activa)
      WHERE id = ${id}
      RETURNING *
    `;
    if (actualizada.length === 0) return errorResponse('Ruta no encontrada.', 404);

    const r = actualizada[0];
    return jsonResponse({ ...r, imagen_url: urlMedia(r.imagen_clave) });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar la ruta.', 500);
  }
}
