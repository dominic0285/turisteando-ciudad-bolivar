// functions/api/admin/solicitudes.js
import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function requireAdmin(request, env) {
  const user = await verifyToken(request, env);
  if (!user || user.rol !== 'admin') return null;
  return user;
}

// GET → todas las solicitudes
export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const url = new URL(request.url);
    const estado = url.searchParams.get('estado');
    const buscar = url.searchParams.get('buscar');

    let solicitudes;
    if (estado && estado !== 'todos') {
      solicitudes = await sql`
        SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono,
               u.nombre as usuario_nombre, u.email as usuario_email
        FROM solicitudes s
        LEFT JOIN rutas r ON r.id = s.ruta_id
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.estado = ${estado}
        ORDER BY s.created_at DESC
      `;
    } else if (buscar) {
      solicitudes = await sql`
        SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono,
               u.nombre as usuario_nombre, u.email as usuario_email
        FROM solicitudes s
        LEFT JOIN rutas r ON r.id = s.ruta_id
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.nombre_solicitante ILIKE ${'%' + buscar + '%'}
           OR s.nombre_institucion ILIKE ${'%' + buscar + '%'}
           OR s.cedula_solicitante ILIKE ${'%' + buscar + '%'}
        ORDER BY s.created_at DESC
      `;
    } else {
      solicitudes = await sql`
        SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono,
               u.nombre as usuario_nombre, u.email as usuario_email
        FROM solicitudes s
        LEFT JOIN rutas r ON r.id = s.ruta_id
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        ORDER BY s.created_at DESC
      `;
    }
    return jsonResponse(solicitudes);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener solicitudes.', 500);
  }
}

// PATCH → actualizar estado/datos de una solicitud
export async function onRequestPatch(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  try {
    const body = await request.json();
    const { id, estado, nota_admin, telefono_asignado, fecha_asignada } = body;

    if (!id) return errorResponse('ID de solicitud requerido.');

    const sql = getDB(env);
    const updated = await sql`
      UPDATE solicitudes SET
        estado = COALESCE(${estado || null}, estado),
        nota_admin = COALESCE(${nota_admin ?? null}, nota_admin),
        telefono_asignado = COALESCE(${telefono_asignado || null}, telefono_asignado),
        fecha_asignada = COALESCE(${fecha_asignada || null}::DATE, fecha_asignada),
        fecha_respuesta = NOW(),
        respondido_por = ${admin.id}
      WHERE id = ${id}
      RETURNING *
    `;
    if (updated.length === 0) return errorResponse('Solicitud no encontrada.', 404);
    return jsonResponse(updated[0]);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al actualizar solicitud.', 500);
  }
}
