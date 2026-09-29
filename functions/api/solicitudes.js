// functions/api/solicitudes.js
import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET /api/solicitudes → mis solicitudes
export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const solicitudes = await sql`
      SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono
      FROM solicitudes s
      LEFT JOIN rutas r ON r.id = s.ruta_id
      WHERE s.usuario_id = ${user.id}
      ORDER BY s.created_at DESC
    `;
    return jsonResponse(solicitudes);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al obtener solicitudes.', 500);
  }
}

// POST /api/solicitudes → nueva solicitud
export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user) return errorResponse('No autorizado.', 401);

  try {
    const body = await request.json();
    const {
      nombre_solicitante, cedula_solicitante, telefono_contacto, email_contacto,
      tipo_grupo, nombre_institucion, ruta_id, fecha_preferida,
      cantidad_adultos, cantidad_menores, cantidad_docentes,
      responsable_principal, observaciones
    } = body;

    if (!nombre_solicitante || !telefono_contacto || !tipo_grupo || !ruta_id || !responsable_principal) {
      return errorResponse('Faltan campos obligatorios.');
    }

    const sql = getDB(env);
    const nueva = await sql`
      INSERT INTO solicitudes (
        usuario_id, nombre_solicitante, cedula_solicitante, telefono_contacto, email_contacto,
        tipo_grupo, nombre_institucion, ruta_id, fecha_preferida,
        cantidad_adultos, cantidad_menores, cantidad_docentes,
        responsable_principal, observaciones
      ) VALUES (
        ${user.id}, ${nombre_solicitante}, ${cedula_solicitante || null}, ${telefono_contacto}, ${email_contacto || null},
        ${tipo_grupo}, ${nombre_institucion || null}, ${ruta_id}, ${fecha_preferida || null},
        ${cantidad_adultos || 0}, ${cantidad_menores || 0}, ${cantidad_docentes || 0},
        ${responsable_principal}, ${observaciones || null}
      )
      RETURNING *
    `;
    return jsonResponse(nueva[0], 201);
  } catch (err) {
    console.error(err);
    return errorResponse('Error al crear solicitud.', 500);
  }
}
