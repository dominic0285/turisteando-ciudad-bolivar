// functions/api/conversaciones.js
// GET  /api/conversaciones            → mis hilos, con el último mensaje y los no leídos
// POST /api/conversaciones            → abre un hilo nuevo (con su primer mensaje)

import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

const TIPOS = ['ruta', 'soporte'];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const hilos = await sql`
      SELECT c.*,
             s.id                AS solicitud_numero,
             r.nombre            AS ruta_nombre,
             r.color             AS ruta_color,
             (SELECT m.cuerpo FROM mensajes m
               WHERE m.conversacion_id = c.id
               ORDER BY m.created_at DESC LIMIT 1)      AS ultimo_cuerpo,
             (SELECT m.autor_rol FROM mensajes m
               WHERE m.conversacion_id = c.id
               ORDER BY m.created_at DESC LIMIT 1)      AS ultimo_autor_rol,
             (SELECT COUNT(*) FROM mensajes m
               WHERE m.conversacion_id = c.id
                 AND m.autor_rol = 'admin'
                 AND m.leido = FALSE)                   AS no_leidos
      FROM conversaciones c
      LEFT JOIN solicitudes s ON s.id = c.solicitud_id
      LEFT JOIN rutas r       ON r.id = s.ruta_id
      WHERE c.usuario_id = ${user.id}
      ORDER BY c.ultimo_msg_at DESC
    `;
    return jsonResponse(hilos);
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
    const { tipo, asunto, solicitud_id, cuerpo } = await request.json();

    if (!cuerpo || !String(cuerpo).trim()) {
      return errorResponse('Escribe tu mensaje antes de enviarlo.');
    }
    if (String(cuerpo).length > 4000) {
      return errorResponse('El mensaje es demasiado largo (máximo 4000 caracteres).');
    }

    const tipoFinal = TIPOS.includes(tipo) ? tipo : 'ruta';
    const sql = getDB(env);

    // Si el hilo va atado a una solicitud, tiene que ser del propio usuario.
    let solicitudId = null;
    if (solicitud_id) {
      const propia = await sql`
        SELECT id FROM solicitudes WHERE id = ${solicitud_id} AND usuario_id = ${user.id}
      `;
      if (propia.length === 0) return errorResponse('Esa solicitud no es tuya.', 403);
      solicitudId = propia[0].id;

      // Una sola conversación por solicitud: si ya existe, se reutiliza.
      const existente = await sql`
        SELECT id FROM conversaciones
        WHERE solicitud_id = ${solicitudId} AND usuario_id = ${user.id}
        LIMIT 1
      `;
      if (existente.length > 0) {
        await sql`
          INSERT INTO mensajes (conversacion_id, autor_id, autor_rol, cuerpo)
          VALUES (${existente[0].id}, ${user.id}, 'solicitante', ${String(cuerpo).trim()})
        `;
        await sql`
          UPDATE conversaciones
          SET ultimo_msg_at = NOW(), estado = 'abierta'
          WHERE id = ${existente[0].id}
        `;
        const [hilo] = await sql`SELECT * FROM conversaciones WHERE id = ${existente[0].id}`;
        return jsonResponse(hilo, 200);
      }
    }

    const asuntoFinal = (asunto && String(asunto).trim())
      || (solicitudId ? `Solicitud N.º ${solicitudId}` : (tipoFinal === 'soporte' ? 'Soporte del sistema' : 'Consulta sobre las rutas'));

    const [hilo] = await sql`
      INSERT INTO conversaciones (usuario_id, solicitud_id, tipo, asunto)
      VALUES (${user.id}, ${solicitudId}, ${tipoFinal}, ${asuntoFinal})
      RETURNING *
    `;

    await sql`
      INSERT INTO mensajes (conversacion_id, autor_id, autor_rol, cuerpo)
      VALUES (${hilo.id}, ${user.id}, 'solicitante', ${String(cuerpo).trim()})
    `;

    return jsonResponse(hilo, 201);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al abrir la conversación.', 500);
  }
}
