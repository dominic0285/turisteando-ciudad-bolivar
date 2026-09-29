// functions/media/[[clave]].js
// Sirve las imágenes guardadas en el bucket R2 bajo la ruta /media/<clave>.
//
// Al servirlas desde aquí no hace falta exponer el bucket al público ni
// configurar un dominio aparte: basta con crear el bucket y declarar el
// binding MEDIA en wrangler.toml. Cloudflare cachea la respuesta en el borde.

import { R2_BINDING, tieneR2 } from '../_shared/utils.js';

export async function onRequestGet(context) {
  const { request, env, params, waitUntil } = context;

  if (!tieneR2(env)) {
    return new Response('Almacenamiento de imágenes no configurado.', { status: 503 });
  }

  // params.clave es un arreglo con los segmentos de la ruta
  const segmentos = Array.isArray(params.clave) ? params.clave : [params.clave];
  const clave = segmentos.map(decodeURIComponent).join('/');

  if (!clave || clave.includes('..')) {
    return new Response('Ruta inválida.', { status: 400 });
  }

  // Caché en el borde. `caches` solo existe en el entorno de Cloudflare,
  // así que se comprueba antes de usarlo.
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  if (cache) {
    const cacheada = await cache.match(cacheKey);
    if (cacheada) return cacheada;
  }

  const objeto = await env[R2_BINDING].get(clave);
  if (objeto === null) {
    return new Response('Imagen no encontrada.', { status: 404 });
  }

  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  headers.set('etag', objeto.httpEtag);
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }
  headers.set('x-content-type-options', 'nosniff');

  const respuesta = new Response(objeto.body, { headers });
  if (cache && typeof waitUntil === 'function') {
    waitUntil(cache.put(cacheKey, respuesta.clone()));
  }
  return respuesta;
}

export async function onRequestHead(context) {
  const res = await onRequestGet(context);
  return new Response(null, { status: res.status, headers: res.headers });
}
