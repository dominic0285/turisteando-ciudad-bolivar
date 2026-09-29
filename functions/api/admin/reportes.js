// functions/api/admin/reportes.js
// Endpoint para generar datos de reportes en PDF
import { getDB, verifyToken, jsonResponse, errorResponse, corsHeaders } from '../../_shared/utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await verifyToken(request, env);
  if (!user || user.rol !== 'admin') return errorResponse('No autorizado.', 401);

  try {
    const sql = getDB(env);
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') || 'general';
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');

    let solicitudes;

    if (desde && hasta) {
      solicitudes = await sql`
        SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono,
               u.nombre as usuario_nombre, u.email as usuario_email, u.cedula as usuario_cedula
        FROM solicitudes s
        LEFT JOIN rutas r ON r.id = s.ruta_id
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.created_at >= ${desde} AND s.created_at <= ${hasta}
        ORDER BY s.created_at DESC
      `;
    } else {
      solicitudes = await sql`
        SELECT s.*, r.nombre as ruta_nombre, r.color as ruta_color, r.icono as ruta_icono,
               u.nombre as usuario_nombre, u.email as usuario_email, u.cedula as usuario_cedula
        FROM solicitudes s
        LEFT JOIN rutas r ON r.id = s.ruta_id
        LEFT JOIN usuarios u ON u.id = s.usuario_id
        ORDER BY s.created_at DESC
      `;
    }

    // Estadísticas generales
    const totalPersonas = solicitudes.reduce((acc, s) => acc + (+s.cantidad_adultos || 0) + (+s.cantidad_menores || 0), 0);

    const porEstado = solicitudes.reduce((acc, s) => {
      acc[s.estado] = (acc[s.estado] || 0) + 1;
      return acc;
    }, {});

    const porRuta = solicitudes.reduce((acc, s) => {
      const nombre = s.ruta_nombre || 'Sin ruta';
      if (!acc[nombre]) acc[nombre] = { total: 0, personas: 0, color: s.ruta_color };
      acc[nombre].total += 1;
      acc[nombre].personas += (+s.cantidad_adultos || 0) + (+s.cantidad_menores || 0);
      return acc;
    }, {});

    const porTipoGrupo = solicitudes.reduce((acc, s) => {
      acc[s.tipo_grupo || 'otro'] = (acc[s.tipo_grupo || 'otro'] || 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      generado_en: new Date().toISOString(),
      periodo: { desde: desde || null, hasta: hasta || null },
      resumen: {
        total_solicitudes: solicitudes.length,
        total_personas: totalPersonas,
        por_estado: porEstado,
        por_ruta: porRuta,
        por_tipo_grupo: porTipoGrupo,
      },
      solicitudes,
    });
  } catch (err) {
    console.error('Reportes error:', err);
    return errorResponse('Error al generar reporte.', 500);
  }
}
