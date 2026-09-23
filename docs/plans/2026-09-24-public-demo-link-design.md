# Enlaces públicos para la aplicación a Arbitrum

Solicitud: ofrecer `/deck` y `/demo` para compartir PerkOS en la aplicación de
Singapur. El propietario proporcionó el destino de YouTube para la demo.

## Decisión

- `/deck` ya existe como presentación pública de doce slides y devuelve HTTP 200.
  Conservarla sin reescribir su contenido ni inventar claims específicos de Arbitrum.
- `/demo` devuelve una redirección HTTP 307 al destino fijo
  `https://www.youtube.com/watch?v=ZsdH46NOCdk`, siguiendo el patrón de `/telegram`.
- Sin login, cookies, parámetros de redirección controlados por visitantes,
  llamadas a proveedores, cambios de DNS o modificaciones de permisos.

Una página con video embebido agregaría UI y dependencias innecesarias para este
enlace. Una redirección permanente dificultaría sustituir el video en el futuro.

## Verificación y publicación

- Prueba de status 307, Location exacto y ausencia de cookies; regresión de
  `/telegram` y contrato del deck; typecheck.
- PR hacia main. Tras merge y despliegue, comprobar públicamente `/demo` sin
  seguir el redirect y `/deck` HTTP 200. No declarar `/demo` publicado antes.
- El contenido del video y una adaptación del deck a Arbitrum quedan fuera de
  este cambio; sustituir el deck requiere un destino o contenido aprobado.

Referencia técnica: NextResponse.redirect en la documentación local de Next.js
y https://nextjs.org/docs/app/api-reference/functions/next-response .
