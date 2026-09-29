// functions/api/admin/conversaciones.js
// GET   /api/admin/conversaciones?estado=abierta&tipo=soporte  → bandeja de entrada
// PATCH /api/admin/conversaciones                              → cambia el estado del hilo

import { getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders } from '../../_shared/utils.js';

const ESTADOS = ['abierta', 'respondida', 'cerrada'];
const TIPOS   = ['ruta', 'soporte'];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  const url = new URL(request.url);
  const estadoParam = url.searchParams.get('estado');
  const tipoParam   = url.searchParams.get('tipo');
  const estado = ESTADOS.includes(estadoParam) ? estadoParam : null;
  const tipo   = TIPOS.includes(tipoParam)     ? tipoParam   : null;

  try {
    const sql = getDB(env);

    // El driver de Neon no permite componer fragmentos SQL, así que
    // cada combinación de filtros va en su propia consulta completa.
    let hilos;
    if (estado && tipo) {
      hilos = await sql`
        SELECT c.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
               u.telefono AS usuario_telefono, u.nombre_institucion,
               r.nombre AS ruta_nombre, r.color AS ruta_color,
               (SELECT m.cuerpo FROM mensajes m WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultimo_cuerpo,
               (SELECT COUNT(*) FROM mensajes m WHERE m.conversacion_id = c.id AND m.autor_rol = 'solicitante' AND m.leido = FALSE) AS no_leidos
        FROM conversaciones c
        LEFT JOIN usuarios u    ON u.id = c.usuario_id
        LEFT JOIN solicitudes s ON s.id = c.solicitud_id
        LEFT JOIN rutas r       ON r.id = s.ruta_id
        WHERE c.estado = ${estado} AND c.tipo = ${tipo}
        ORDER BY c.ultimo_msg_at DESC`;
    } else if (estado) {
      hilos = await sql`
        SELECT c.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
               u.telefono AS usuario_telefono, u.nombre_institucion,
               r.nombre AS ruta_nombre, r.color AS ruta_color,
               (SELECT m.cuerpo FROM mensajes m WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultimo_cuerpo,
               (SELECT COUNT(*) FROM mensajes m WHERE m.conversacion_id = c.id AND m.autor_rol = 'solicitante' AND m.leido = FALSE) AS no_leidos
        FROM conversaciones c
        LEFT JOIN usuarios u    ON u.id = c.usuario_id
        LEFT JOIN solicitudes s ON s.id = c.solicitud_id
        LEFT JOIN rutas r       ON r.id = s.ruta_id
        WHERE c.estado = ${estado}
        ORDER BY c.ultimo_msg_at DESC`;
    } else if (tipo) {
      hilos = await sql`
        SELECT c.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
               u.telefono AS usuario_telefono, u.nombre_institucion,
               r.nombre AS ruta_nombre, r.color AS ruta_color,
               (SELECT m.cuerpo FROM mensajes m WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultimo_cuerpo,
               (SELECT COUNT(*) FROM mensajes m WHERE m.conversacion_id = c.id AND m.autor_rol = 'solicitante' AND m.leido = FALSE) AS no_leidos
        FROM conversaciones c
        LEFT JOIN usuarios u    ON u.id = c.usuario_id
        LEFT JOIN solicitudes s ON s.id = c.solicitud_id
        LEFT JOIN rutas r       ON r.id = s.ruta_id
        WHERE c.tipo = ${tipo}
        ORDER BY c.ultimo_msg_at DESC`;
    } else {
      hilos = await sql`
        SELECT c.*, u.nombre AS usuario_nombre, u.email AS usuario_email,
               u.telefono AS usuario_telefono, u.nombre_institucion,
               r.nombre AS ruta_nombre, r.color AS ruta_color,
               (SELECT m.cuerpo FROM mensajes m WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS ultimo_cuerpo,
               (SELECT COUNT(*) FROM mensajes m WHERE m.conversacion_id = c.id AND m.autor_rol = 'solicitante' AND m.leido = FALSE) AS no_leidos
        FROM conversaciones c
        LEFT JOIN usuarios u    ON u.id = c.usuario_id
        LEFT JOIN solicitudes s ON s.id = c.solicitud_id
        LEFT JOIN rutas r       ON r.id = s.ruta_id
        ORDER BY c.ultimo_msg_at DESC`;
    }

    const [resumen] = await sql`
      SELECT
        COUNT(*)                                      AS total,
        COUNT(*) FILTER (WHERE estado = 'abierta')    AS abiertas,
        COUNT(*) FILTER (WHERE estado = 'respondida') AS respondidas,
        COUNT(*) FILTER (WHERE estado = 'cerrada')    AS cerradas
      FROM conversaciones
    `;

    const [pendientes] = await sql`
      SELECT COUNT(DISTINCT conversacion_id) AS sin_leer
      FROM mensajes WHERE autor_rol = 'solicitante' AND leido = FALSE
    `;

    return jsonResponse({ hilos, resumen, sin_leer: Number(pendientes.sin_leer) });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener la bandeja de mensajes.', 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const { id, estado } = await request.json();
    if (!id) return errorResponse('Falta el identificador de la conversación.');
    if (!ESTADOS.includes(estado)) return errorResponse('Estado no válido.');

    const sql = getDB(env);
    const actualizado = await sql`
      UPDATE conversaciones SET estado = ${estado} WHERE id = ${id} RETURNING *
    `;
    if (actualizado.length === 0) return errorResponse('Conversación no encontrada.', 404);
    return jsonResponse(actualizado[0]);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar la conversación.', 500);
  }
}
