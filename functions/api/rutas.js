// functions/api/rutas.js
// GET /api/rutas → rutas activas, con la portada que haya cargado la Dirección
import { getDB, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  try {
    const sql = getDB(context.env);
    const rutas = await sql`SELECT * FROM rutas WHERE activa = TRUE ORDER BY id`;
    // imagen_url queda en null si todavía no se ha cargado una portada:
    // el sitio usa entonces la fotografía de reserva que trae index.html.
    return jsonResponse(rutas.map(r => ({ ...r, imagen_url: urlMedia(r.imagen_clave) })));
  } catch (err) {
    console.error('Rutas error:', err);
    return errorResponse('Error al obtener rutas.', 500);
  }
}
