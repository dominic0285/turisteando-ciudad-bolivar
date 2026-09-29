// functions/api/admin/noticias.js
// GET    /api/admin/noticias  → todas las publicaciones
// POST   /api/admin/noticias  → crear
// PATCH  /api/admin/noticias  → editar (título, contenido, imagen, destacada, publicado)
// DELETE /api/admin/noticias?id=…

import { getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function conUrl(n) {
  return { ...n, imagen_url: urlMedia(n.imagen_clave) || n.imagen_url || null };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const noticias = await sql`
      SELECT n.*, u.nombre as autor_nombre
      FROM noticias n
      LEFT JOIN usuarios u ON u.id = n.creado_por
      ORDER BY n.created_at DESC
    `;
    return jsonResponse(noticias.map(conUrl));
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener noticias.', 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const { titulo, contenido, imagen_url, imagen_clave, destacada } = await request.json();
    if (!titulo || !titulo.trim()) return errorResponse('El título es obligatorio.');

    const sql = getDB(env);
    const [nueva] = await sql`
      INSERT INTO noticias (titulo, contenido, imagen_url, imagen_clave, destacada, creado_por)
      VALUES (${titulo.trim()}, ${contenido || null}, ${imagen_url || null},
              ${imagen_clave || null}, ${!!destacada}, ${admin.id})
      RETURNING *
    `;
    return jsonResponse(conUrl(nueva), 201);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al crear noticia.', 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const { id, titulo, contenido, imagen_url, imagen_clave, destacada, publicado } = await request.json();
    if (!id) return errorResponse('Falta el identificador de la noticia.');

    const sql = getDB(env);
    const filas = await sql`
      UPDATE noticias SET
        titulo       = COALESCE(${titulo ?? null}, titulo),
        contenido    = COALESCE(${contenido ?? null}, contenido),
        imagen_url   = COALESCE(${imagen_url ?? null}, imagen_url),
        imagen_clave = COALESCE(${imagen_clave ?? null}, imagen_clave),
        destacada    = COALESCE(${typeof destacada === 'boolean' ? destacada : null}, destacada),
        publicado    = COALESCE(${typeof publicado === 'boolean' ? publicado : null}, publicado)
      WHERE id = ${id}
      RETURNING *
    `;
    if (filas.length === 0) return errorResponse('Noticia no encontrada.', 404);
    return jsonResponse(conUrl(filas[0]));
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar la noticia.', 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return errorResponse('ID de noticia requerido.');

    const sql = getDB(env);
    const deleted = await sql`DELETE FROM noticias WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) return errorResponse('Noticia no encontrada.', 404);
    return jsonResponse({ ok: true, id: deleted[0].id });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al eliminar noticia.', 500);
  }
}
