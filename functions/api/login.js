// functions/api/login.js
import { getDB, verifyPassword, generateToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return errorResponse('Usuario/email y contraseña son obligatorios.');
    }

    const sql = getDB(env);
    const loginInput = email.trim().toLowerCase();

    // Buscar por email O por username
    const rows = await sql`
      SELECT * FROM usuarios 
      WHERE email = ${loginInput} OR username = ${loginInput}
    `;

    if (rows.length === 0) {
      return errorResponse('Credenciales incorrectas.', 401);
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return errorResponse('Credenciales incorrectas.', 401);
    }

    const token = generateToken();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO tokens_sesion (usuario_id, token, expira_at)
      VALUES (${user.id}, ${token}, ${expiry.toISOString()})
    `;

    return jsonResponse({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        telefono: user.telefono,
        cedula: user.cedula,
        nombre_institucion: user.nombre_institucion,
        tipo_solicitante: user.tipo_solicitante,
        debe_cambiar_password: user.debe_cambiar_password || false,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse('Error interno del servidor.', 500);
  }
}
