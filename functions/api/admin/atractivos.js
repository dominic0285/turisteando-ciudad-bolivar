// functions/api/admin/atractivos.js
// GET / POST / PATCH / DELETE  → gestión de los atractivos del inicio
import { getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../../_shared/utils.js';

const CATEGORIAS = ['patrimonio', 'naturaleza', 'gastronomia', 'cultura', 'paisaje', 'arquitectura'];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);
  try {
    const sql = getDB(env);
    const filas = await sql`SELECT * FROM atractivos ORDER BY destacado DESC, orden ASC, id ASC`;
    return jsonResponse(filas.map(a => ({ ...a, imagen_url: urlMedia(a.imagen_clave) })));
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener los atractivos.', 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);
  try {
    const { nombre, descripcion, categoria, imagen_clave, destacado, orden } = await request.json();
    if (!nombre || !nombre.trim()) return errorResponse('El nombre del atractivo es obligatorio.');

    const cat = CATEGORIAS.includes(categoria) ? categoria : 'patrimonio';
    const sql = getDB(env);
    const [nuevo] = await sql`
      INSERT INTO atractivos (nombre, descripcion, categoria, imagen_clave, destacado, orden, creado_por)
      VALUES (${nombre.trim()}, ${descripcion || null}, ${cat}, ${imagen_clave || null},
              ${!!destacado}, ${Number(orden) || 0}, ${admin.id})
      RETURNING *
    `;
    return jsonResponse({ ...nuevo, imagen_url: urlMedia(nuevo.imagen_clave) }, 201);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al crear el atractivo.', 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);
  try {
    const { id, nombre, descripcion, categoria, imagen_clave, destacado, orden, publicado } = await request.json();
    if (!id) return errorResponse('Falta el identificador del atractivo.');

    const cat = CATEGORIAS.includes(categoria) ? categoria : null;
    const sql = getDB(env);
    const filas = await sql`
      UPDATE atractivos SET
        nombre       = COALESCE(${nombre ?? null}, nombre),
        descripcion  = COALESCE(${descripcion ?? null}, descripcion),
        categoria    = COALESCE(${cat}, categoria),
        imagen_clave = COALESCE(${imagen_clave ?? null}, imagen_clave),
        destacado    = COALESCE(${typeof destacado === 'boolean' ? destacado : null}, destacado),
        publicado    = COALESCE(${typeof publicado === 'boolean' ? publicado : null}, publicado),
        orden        = COALESCE(${orden ?? null}, orden)
      WHERE id = ${id}
      RETURNING *
    `;
    if (filas.length === 0) return errorResponse('Atractivo no encontrado.', 404);
    return jsonResponse({ ...filas[0], imagen_url: urlMedia(filas[0].imagen_clave) });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar el atractivo.', 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return errorResponse('Falta el identificador del atractivo.');
    const sql = getDB(env);
    const borrado = await sql`DELETE FROM atractivos WHERE id = ${id} RETURNING id`;
    if (borrado.length === 0) return errorResponse('Atractivo no encontrado.', 404);
    return jsonResponse({ ok: true, id: borrado[0].id });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al eliminar el atractivo.', 500);
  }
}
