// functions/api/change-password.js
import { getDB, hashPassword, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const user = await verifyToken(request, env);
    if (!user) return errorResponse('No autorizado.', 401);

    const { nueva_password } = await request.json();
    if (!nueva_password || nueva_password.length < 6) {
      return errorResponse('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    const hash = await hashPassword(nueva_password);
    const sql = getDB(env);

    // Actualizar contraseña (siempre funciona)
    await sql`UPDATE usuarios SET password_hash = ${hash} WHERE id = ${user.id}`;

    // Limpiar flag (opcional — si la columna no existe se ignora)
    try {
      await sql`UPDATE usuarios SET debe_cambiar_password = false WHERE id = ${user.id}`;
    } catch (_) { /* columna puede no existir aún */ }

    return jsonResponse({ ok: true, mensaje: 'Contraseña actualizada exitosamente.' });
  } catch (err) {
    console.error('Change password error:', err);
    return errorResponse('Error interno del servidor.', 500);
  }
}
