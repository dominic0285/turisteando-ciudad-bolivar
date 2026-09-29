// functions/api/forgot-password.js
// Recuperación de contraseña mediante pregunta de seguridad
import { getDB, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// POST: buscar usuario por cédula y devolver su pregunta de seguridad
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { cedula } = body;

    if (!cedula) return errorResponse('La cédula es obligatoria.');

    const sql = getDB(env);
    const cedulaLimpia = cedula.trim().toUpperCase().replace(/-/g, '');
    
    const rows = await sql`
      SELECT id, nombre, pregunta_seguridad
      FROM usuarios
      WHERE REPLACE(cedula, '-', '') = ${cedulaLimpia}
    `;

    if (rows.length === 0) return errorResponse('No se encontró ninguna cuenta con esa cédula.', 404);

    const user = rows[0];
    if (!user.pregunta_seguridad) {
      return errorResponse('Esta cuenta no tiene pregunta de seguridad configurada. Contacta al administrador.', 404);
    }

    return jsonResponse({
      usuario_id: user.id,
      nombre: user.nombre,
      pregunta: user.pregunta_seguridad,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return errorResponse('Error interno del servidor.', 500);
  }
}
