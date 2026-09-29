// functions/api/mensajes.js
// GET  /api/mensajes?conversacion_id=12   → mensajes del hilo (marca los ajenos como leídos)
// POST /api/mensajes                      → responde en un hilo
//
// Sirve tanto al solicitante como a la administradora: cada quien ve
// únicamente los hilos que le corresponden.

import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders, urlMedia } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** Devuelve el hilo si el usuario puede verlo; si no, null. */
async function hiloAccesible(sql, conversacionId, user) {
  const filas = await sql`SELECT * FROM conversaciones WHERE id = ${conversacionId}`;
  if (filas.length === 0) return null;
  const hilo = filas[0];
  if (user.rol === 'admin') return hilo;
  return hilo.usuario_id === user.id ? hilo : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  const id = Number(new URL(request.url).searchParams.get('conversacion_id'));
  if (!id) return errorResponse('Falta el identificador de la conversación.');

  try {
    const sql = getDB(env);
    const hilo = await hiloAccesible(sql, id, user);
    if (!hilo) return errorResponse('Conversación no encontrada.', 404);

    const mensajes = await sql`
      SELECT m.*, u.nombre AS autor_nombre
      FROM mensajes m
      LEFT JOIN usuarios u ON u.id = m.autor_id
      WHERE m.conversacion_id = ${id}
      ORDER BY m.created_at ASC
    `;

    // Marca como leídos los mensajes escritos por la otra parte.
    const rolAjeno = user.rol === 'admin' ? 'solicitante' : 'admin';
    await sql`
      UPDATE mensajes SET leido = TRUE
      WHERE conversacion_id = ${id} AND autor_rol = ${rolAjeno} AND leido = FALSE
    `;

    return jsonResponse({
      conversacion: hilo,
      mensajes: mensajes.map(m => ({ ...m, adjunto_url: urlMedia(m.adjunto_clave) })),
    });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener los mensajes.', 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const { conversacion_id, cuerpo, adjunto_clave } = await request.json();

    if (!conversacion_id) return errorResponse('Falta el identificador de la conversación.');
    if (!cuerpo || !String(cuerpo).trim()) return errorResponse('Escribe tu mensaje antes de enviarlo.');
    if (String(cuerpo).length > 4000) return errorResponse('El mensaje es demasiado largo (máximo 4000 caracteres).');

    const sql = getDB(env);
    const hilo = await hiloAccesible(sql, conversacion_id, user);
    if (!hilo) return errorResponse('Conversación no encontrada.', 404);
    if (hilo.estado === 'cerrada' && user.rol !== 'admin') {
      return errorResponse('Esta conversación está cerrada. Abre una nueva si necesitas algo más.', 409);
    }

    const rol = user.rol === 'admin' ? 'admin' : 'solicitante';

    const [mensaje] = await sql`
      INSERT INTO mensajes (conversacion_id, autor_id, autor_rol, cuerpo, adjunto_clave)
      VALUES (${conversacion_id}, ${user.id}, ${rol}, ${String(cuerpo).trim()}, ${adjunto_clave || null})
      RETURNING *
    `;

    await sql`
      UPDATE conversaciones
      SET ultimo_msg_at = NOW(),
          estado = ${rol === 'admin' ? 'respondida' : 'abierta'}
      WHERE id = ${conversacion_id}
    `;

    return jsonResponse({ ...mensaje, autor_nombre: user.nombre, adjunto_url: urlMedia(mensaje.adjunto_clave) }, 201);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al enviar el mensaje.', 500);
  }
}
