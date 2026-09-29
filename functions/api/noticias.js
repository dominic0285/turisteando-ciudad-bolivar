// functions/api/noticias.js
// Endpoint PÚBLICO para obtener noticias publicadas
import { getDB, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  try {
    const sql = getDB(context.env);
    const noticias = await sql`
      SELECT id, titulo, contenido, imagen_url, imagen_clave, destacada, created_at
      FROM noticias
      WHERE publicado = TRUE
      ORDER BY destacada DESC, created_at DESC
      LIMIT 20
    `;
    // Las imágenes subidas al bucket tienen prioridad; los enlaces
    // externos antiguos (imagen_url) se siguen respetando.
    return jsonResponse(noticias.map(n => ({
      ...n,
      imagen_url: urlMedia(n.imagen_clave) || n.imagen_url || null,
    })));
  } catch (err) {
    console.error('Noticias error:', err);
    return errorResponse('Error al obtener noticias.', 500);
  }
}
