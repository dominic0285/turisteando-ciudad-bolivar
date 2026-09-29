// functions/api/admin/upload.js
// POST /api/admin/upload  (multipart/form-data)
//   campo "archivo"  → la imagen
//   campo "carpeta"  → rutas | noticias | atractivos | general  (opcional)
//
// Guarda el archivo en el bucket R2 y registra la referencia en la tabla
// `medios`, para que el panel pueda listar y reutilizar las imágenes.

import {
  getDB, requireAdmin, jsonResponse, errorResponse, corsHeaders,
  R2_BINDING, tieneR2, urlMedia, TIPOS_IMAGEN, MAX_BYTES_IMAGEN,
  extensionDe, limpiarNombre,
} from '../../_shared/utils.js';

const CARPETAS = ['rutas', 'noticias', 'atractivos', 'mensajes', 'general'];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const admin = await requireAdmin(request, env);
  if (!admin) return errorResponse('No autorizado.', 401);

  if (!tieneR2(env)) {
    return errorResponse(
      'El almacenamiento de imágenes todavía no está configurado. ' +
      'Crea el bucket en Cloudflare R2 y enlázalo como "MEDIA" en la configuración de Pages.',
      503
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return errorResponse('La solicitud debe enviarse como formulario con el archivo adjunto.');
  }

  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return errorResponse('No se recibió ningún archivo.');
  }
  if (!TIPOS_IMAGEN.includes(archivo.type)) {
    return errorResponse('Formato no admitido. Usa JPG, PNG, WebP o AVIF.');
  }
  if (archivo.size > MAX_BYTES_IMAGEN) {
    return errorResponse(`La imagen pesa ${(archivo.size / 1048576).toFixed(1)} MB y el máximo es 8 MB. Redúcela antes de subirla.`);
  }

  const carpetaPedida = String(form.get('carpeta') || 'general');
  const carpeta = CARPETAS.includes(carpetaPedida) ? carpetaPedida : 'general';
  const titulo = String(form.get('titulo') || archivo.name || '').trim();

  const base  = limpiarNombre(titulo.replace(/\.[a-z0-9]+$/i, ''));
  const clave = `${carpeta}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extensionDe(archivo.type)}`;

  try {
    await env[R2_BINDING].put(clave, archivo.stream(), {
      httpMetadata: {
        contentType: archivo.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        subidoPor: String(admin.id),
        nombreOriginal: (archivo.name || '').slice(0, 120),
      },
    });
  } catch (err) {
    console.error('R2 put error:', err);
    return errorResponse('No se pudo guardar la imagen en el almacenamiento.', 500);
  }

  // El registro en la base de datos es un apoyo para el panel: si falla,
  // la imagen ya quedó guardada y se puede usar igual.
  try {
    const sql = getDB(env);
    await sql`
      INSERT INTO medios (clave, titulo, carpeta, tipo_mime, bytes, subido_por)
      VALUES (${clave}, ${titulo || null}, ${carpeta}, ${archivo.type}, ${archivo.size}, ${admin.id})
      ON CONFLICT (clave) DO NOTHING
    `;
  } catch (err) {
    console.error('No se pudo registrar el medio en la base de datos:', err);
  }

  return jsonResponse({
    clave,
    url: urlMedia(clave),
    carpeta,
    bytes: archivo.size,
    tipo_mime: archivo.type,
  }, 201);
}
