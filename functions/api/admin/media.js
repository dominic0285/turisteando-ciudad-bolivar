// functions/api/admin/media.js
// GET    /api/admin/media?carpeta=rutas   → biblioteca de imágenes
// DELETE /api/admin/media?clave=...       → borra del bucket y del registro

import {
  getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders,
  R2_BINDING, tieneR2, urlMedia,
} from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  const url = new URL(request.url);
  const carpeta = url.searchParams.get('carpeta');

  try {
    const sql = getDB(env);
    const filas = carpeta && carpeta !== 'todas'
      ? await sql`SELECT * FROM medios WHERE carpeta = ${carpeta} ORDER BY created_at DESC LIMIT 300`
      : await sql`SELECT * FROM medios ORDER BY created_at DESC LIMIT 300`;

    return jsonResponse({
      configurado: tieneR2(env),
      medios: filas.map(m => ({ ...m, url: urlMedia(m.clave) })),
    });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener la biblioteca de imágenes.', 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  const clave = new URL(request.url).searchParams.get('clave');
  if (!clave) return errorResponse('Falta la clave de la imagen.');

  if (tieneR2(env)) {
    try {
      await env[R2_BINDING].delete(clave);
    } catch (err) {
      console.error('R2 delete error:', err);
      return errorResponse('No se pudo borrar la imagen del almacenamiento.', 500);
    }
  }

  try {
    const sql = getDB(env);
    await sql`DELETE FROM medios WHERE clave = ${clave}`;
    // Deja sin portada lo que apuntaba a esta imagen, para no romper la vista pública.
    await sql`UPDATE rutas      SET imagen_clave = NULL WHERE imagen_clave = ${clave}`;
    await sql`UPDATE noticias   SET imagen_clave = NULL WHERE imagen_clave = ${clave}`;
    await sql`UPDATE atractivos SET imagen_clave = NULL WHERE imagen_clave = ${clave}`;
  } catch (err) {
    console.error(err);
  }

  return jsonResponse({ ok: true, clave });
}
