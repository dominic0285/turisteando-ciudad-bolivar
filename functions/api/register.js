// functions/api/register.js
import { getDB, hashPassword, generateToken, jsonResponse, errorResponse, corsHeaders } from '../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { nombre, email, password, telefono, cedula, tipo_solicitante, nombre_institucion, pregunta_seguridad, respuesta_seguridad } = body;

    if (!nombre || !email || !password || !cedula) {
      return errorResponse('Nombre, email, cédula y contraseña son obligatorios.');
    }
    if (password.length < 6) {
      return errorResponse('La contraseña debe tener al menos 6 caracteres.');
    }

    const cedulaClean = cedula.trim().toUpperCase();
    const cedulaRegex = /^[VJGEP]-?\d{1,15}/;
    if (!cedulaRegex.test(cedulaClean)) {
      return errorResponse('Formato de cédula inválido. Use: V-12345678, J-12345678, etc.');
    }

    const sql = getDB(env);

    const existingEmail = await sql`SELECT id FROM usuarios WHERE email = ${email.toLowerCase()}`;
    if (existingEmail.length > 0) {
      return errorResponse('Ya existe una cuenta con ese correo electrónico.');
    }

    const cedulaLimpia = cedulaClean.replace(/-/g, '');
    const existingCedula = await sql`SELECT id FROM usuarios WHERE REPLACE(cedula, '-', '') = ${cedulaLimpia}`;
    if (existingCedula.length > 0) {
      return errorResponse('Ya existe una cuenta registrada con esa cédula.');
    }

    const hash = await hashPassword(password);

    const newUser = await sql`
      INSERT INTO usuarios (nombre, email, password_hash, telefono, cedula, tipo_solicitante, nombre_institucion, pregunta_seguridad, respuesta_seguridad)
      VALUES (${nombre}, ${email.toLowerCase()}, ${hash}, ${telefono || null}, ${cedulaClean}, ${tipo_solicitante || null}, ${nombre_institucion || null}, ${pregunta_seguridad || null}, ${respuesta_seguridad || null})
      RETURNING id, nombre, email, rol, telefono, cedula, tipo_solicitante, nombre_institucion
    `;

    const user = newUser[0];
    const token = generateToken();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO tokens_sesion (usuario_id, token, expira_at)
      VALUES (${user.id}, ${token}, ${expiry.toISOString()})
    `;

    return jsonResponse({ token, user }, 201);
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse('Error interno del servidor.', 500);
  }
}
