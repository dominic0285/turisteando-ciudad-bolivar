// functions/api/admin/dashboard.js
import { getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await requireAdmin(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);

    const [stats] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE TRUE) as total,
        COUNT(*) FILTER (WHERE estado = 'pendiente') as pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_revision') as en_revision,
        COUNT(*) FILTER (WHERE estado = 'aprobada') as aprobadas,
        COUNT(*) FILTER (WHERE estado = 'denegada') as denegadas,
        COUNT(*) FILTER (WHERE estado = 'en_proceso') as en_proceso,
        COUNT(*) FILTER (WHERE estado = 'cumplida') as cumplidas
      FROM solicitudes
    `;

    const porRuta = await sql`
      SELECT r.nombre, r.color, r.icono, COUNT(s.id) as total
      FROM rutas r
      LEFT JOIN solicitudes s ON s.ruta_id = r.id
      GROUP BY r.id, r.nombre, r.color, r.icono
      ORDER BY total DESC
    `;

    const recientes = await sql`
      SELECT s.id, s.nombre_solicitante, s.tipo_grupo, s.estado, s.created_at,
             r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono
      FROM solicitudes s
      LEFT JOIN rutas r ON r.id = s.ruta_id
      ORDER BY s.created_at DESC
      LIMIT 5
    `;

    // Mensajes sin leer, para el contador de la bandeja de entrada
    let mensajes = { sin_leer: 0, hilos_abiertos: 0 };
    try {
      const [m] = await sql`
        SELECT
          (SELECT COUNT(DISTINCT conversacion_id) FROM mensajes
            WHERE autor_rol = 'solicitante' AND leido = FALSE)      AS sin_leer,
          (SELECT COUNT(*) FROM conversaciones WHERE estado = 'abierta') AS hilos_abiertos
      `;
      mensajes = { sin_leer: Number(m.sin_leer), hilos_abiertos: Number(m.hilos_abiertos) };
    } catch (_) { /* las tablas de mensajería aún no existen */ }

    return jsonResponse({ stats, porRuta, recientes, mensajes });
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener estadísticas.', 500);
  }
}
