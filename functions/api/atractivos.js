// functions/api/atractivos.js
// GET /api/atractivos → atractivos publicados, para el mosaico del inicio
import { getDB, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  try {
    const sql = getDB(context.env);
    const filas = await sql`
      SELECT id, nombre, descripcion, categoria, imagen_clave, destacado, orden
      FROM atractivos
      WHERE publicado = TRUE
      ORDER BY destacado DESC, orden ASC, id ASC
      LIMIT 24
    `;
    return jsonResponse(filas.map(a => ({ ...a, imagen_url: urlMedia(a.imagen_clave) })));
  } catch (err) {
    console.error('Atractivos error:', err);
    return errorResponse('Error al obtener los atractivos.', 500);
  }
}
