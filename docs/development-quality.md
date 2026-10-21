# Validación antes de publicar

GitHub Actions ejecuta `Quality checks` en cambios de código de main y pull requests, y admite ejecución manual desde Actions. Instala el lockfile con Bun 1.3.14, ejecuta las pruebas de la aplicación y de importaciones, verifica TypeScript y compila con el destino Vercel usando Node 24.

Las pruebas de pedidos y emails reemplazan las solicitudes de red con respuestas de prueba. No envían emails ni generan cobros reales. Este workflow no recibe claves privadas de producción, no modifica la base de datos y no publica por su cuenta.

Validación local:

```sh
bun install --frozen-lockfile
npm test
npm run typecheck
NITRO_PRESET=vercel VERCEL=1 bun run build
```

El despliegue automático de Vercel continúa siendo independiente. Este control informa errores; todavía no bloquea publicaciones. Para exigirlo antes de integrar cambios se deberá configurar una regla de protección de main que requiera el check `Tests, TypeScript and production build` y trabajar mediante pull requests.

## Próximos pasos

1. Playwright: pruebas de navegación, búsqueda, carrito y acceso al admin. Probar pagos y escrituras de stock solamente contra un entorno de prueba con datos separados.
2. Pagos y emails: completar la configuración privada de Mercado Pago y Resend, verificar el dominio remitente y ejecutar una compra y recuperación controladas antes de activar envíos a clientes.
3. Sentry: configurar seguimiento de errores con filtrado de datos personales. No habilitar grabación de sesiones por defecto.

Las cuentas, claves y dominios se configuran directamente en cada proveedor; no deben copiarse a issues, commits, logs ni chats. Revisar cuotas y condiciones antes de habilitar servicios adicionales.
