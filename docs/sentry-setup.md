# Sentry: errores técnicos de El Arcángel

La integración se activa únicamente en producción y cuando hay un DSN válido. Sin configuración de DSN, la tienda sigue funcionando y no envía eventos. No se habilitan Replay, trazas de rendimiento, logs, breadcrumbs ni sesiones automáticas.

## Crear y conectar el proyecto

1. Crear una cuenta en https://sentry.io/signup/ y un proyecto JavaScript/React llamado `arcangel-web`. No hace falta una casilla del dominio del negocio.
2. Obtener el DSN público del proyecto desde Project Settings → Client Keys (DSN).
3. Configurar en Vercel, proyecto `arcangel-perfume-web`, entorno Production:
   - `VITE_SENTRY_DSN`: DSN público para el navegador (se incorpora durante el build).
   - `SENTRY_DSN`: mismo DSN para errores del servidor (solo runtime servidor).
4. Crear un nuevo despliegue de producción para aplicar la variable del navegador.
5. Verificar un evento controlado desde una sesión administradora y comprobar su llegada en Issues. No considerar activo el monitoreo hasta observar ese evento en Sentry.

Un DSN público identifica el destino de los eventos; no es el token privado de administración. No guardar tokens de administración en variables VITE\_, commits ni chats. La subida de source maps no está habilitada en esta primera integración y requerirá configuración privada adicional; las ubicaciones pueden aparecer minificadas.

## Cobertura y privacidad

- Navegador: errores no controlados, promesas rechazadas y el error boundary principal de TanStack Router.
- Servidor: excepciones que llegan al wrapper SSR y respuestas catastróficas de h3 que el wrapper convierte en una pantalla de error. Las respuestas de error manejadas dentro de endpoints no se convierten automáticamente en eventos.
- Cada evento se reconstruye con una lista permitida de campos técnicos. Se descartan mensajes originales, usuario, IP incluida en el evento, headers, cookies, cuerpo de solicitudes, payloads, contexto de código, breadcrumbs y datos extra. Se conservan tipo técnico, archivo, función y línea.
- Las rutas dinámicas se agrupan como `/producto/:slug`, `/api/:route` o `/:route`; nunca se incluyen parámetros de búsqueda ni capacidades de pedidos.
- Un fallo al reportar no impide mostrar la respuesta original. El servidor espera hasta 1,5 segundos para vaciar la cola al reportar un error; sin DSN no carga el SDK del servidor.

## Verificación

`npm test` incluye las pruebas de eliminación de datos sensibles y normalización de rutas. Ejecutar también `npm run typecheck`, la compilación para Vercel y las pruebas de navegador antes de publicar.
