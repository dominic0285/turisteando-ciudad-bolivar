// functions/api/reset-password.js
import { getDB, hashPassword, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function generarPasswordTemporal() {
  // Caracteres sin ambigüedad (sin 0/O, 1/I/l)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { usuario_id, respuesta } = body;

    if (!usuario_id || !respuesta) {
      return errorResponse('Todos los campos son obligatorios.');
    }

    const sql = getDB(env);
    const rows = await sql`
      SELECT id, respuesta_seguridad FROM usuarios WHERE id = ${usuario_id}
    `;

    if (rows.length === 0) return errorResponse('Usuario no encontrado.', 404);

    const user = rows[0];
    const respuestaGuardada = (user.respuesta_seguridad || '').trim().toLowerCase();
    const respuestaIngresada = respuesta.trim().toLowerCase();

    if (respuestaGuardada !== respuestaIngresada) {
      return errorResponse('Respuesta de seguridad incorrecta.', 401);
    }

    const tempPassword = generarPasswordTemporal();
    const hash = await hashPassword(tempPassword);

    // Actualizar contraseña (siempre funciona)
    await sql`UPDATE usuarios SET password_hash = ${hash} WHERE id = ${usuario_id}`;

    // Marcar que debe cambiar contraseña (opcional — si la columna no existe se ignora)
    try {
      await sql`UPDATE usuarios SET debe_cambiar_password = true WHERE id = ${usuario_id}`;
    } catch (_) { /* columna puede no existir aún */ }

    // Invalidar sesiones anteriores
    try {
      await sql`DELETE FROM tokens_sesion WHERE usuario_id = ${usuario_id}`;
    } catch (_) { /* ignorar */ }

    return jsonResponse({
      ok: true,
      password_temporal: tempPassword,
      mensaje: 'Contraseña temporal generada exitosamente.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return errorResponse('Error interno del servidor: ' + err.message, 500);
  }
}
