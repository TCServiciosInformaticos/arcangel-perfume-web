# Pedidos, reservas y conciliación

## Comportamiento

- El pedido y sus productos se guardan juntos. Cada intento de pago conserva sus precios y presentaciones, un identificador propio y vencimiento a 30 minutos.
- Las reservas reducen la disponibilidad para otros checkouts, sin modificar el saldo físico. Las consultas del catálogo siguen mostrando el saldo físico; el checkout informa cuando esas unidades están reservadas.
- Aprobación verificada: descuenta stock una única vez. Aprobación tardía: respeta las reservas de otros clientes. Si falta stock, registra el cobro como pagado y bloquea la preparación hasta resolver la revisión.
- Un segundo cobro aprobado del mismo pedido se señala para revisión. No se generan devoluciones automáticas.
- Abandono: 24 horas sin un nuevo intento. Se puede retomar el mismo pedido con precio y disponibilidad actuales. Un intento activo mantiene su precio durante su reserva.
- Rechazo, cancelación manual y abandono son estados distintos. Archivar oculta el registro del listado habitual, pero no lo borra ni anonimiza.
- Se conservan pedidos, intentos e historial sin borrado automático. Cualquier política futura de depuración de datos personales debe definirse aparte.
- Admin → Pedidos ofrece filtros, productos, datos de entrega, historial, consulta de Mercado Pago, enlace de recuperación, cancelación, preparación, entrega y archivo.
- Copiar un enlace no envía mensajes. El enlace contiene una capacidad para consultar y retomar un único pedido: compartir solo con el cliente correspondiente.

## Publicación y activación

1. Aplicar las dos migraciones `order_lifecycle` y `order_lifecycle_functions` en ese orden, en transacciones distintas (PostgreSQL exige confirmar los nuevos valores del enum antes de usarlos).
2. Publicar el código nuevo. Verificar `GET /api/public/order-maintenance` en el dominio de producción: debe devolver `{"protocol":"order-lifecycle-v1"}`. El POST sin credencial debe devolver 401.
3. Confirmar que `PUBLIC_SITE_URL` corresponde a la tienda pública y que el endpoint de `private.order_job_config` apunta al mismo despliegue. No imprimir ni copiar el token privado a logs o archivos.
4. Activar los trabajos de base, inicialmente pausados para impedir una publicación parcial:

```sql
SELECT cron.alter_job(jobid, active := true)
FROM cron.job
WHERE jobname IN ('arcangel-order-expiry', 'arcangel-order-reconciliation');
```

5. Vencimientos: cada minuto. Conciliación: cada 10 minutos, lotes de 5 pedidos rotativos, incluidos abandonados, cancelados y aprobados para detectar cobros tardíos o duplicados. La duración de una vuelta depende del número de pedidos. Revisar `cron.job_run_details` y `net._http_response`; una respuesta 503 exige revisar la integración y se reintentará en la siguiente vuelta. El admin también puede conciliar un pedido puntualmente.
6. Hacer una compra completa con usuarios de prueba de Mercado Pago antes de habilitar ventas reales. Verificar preferencia, firma del webhook, importe, reserva, aprobación, descuento de stock y repetición de la notificación.

## Verificación

`npm run build`, `npx tsc --noEmit` y `node --import tsx --test src/lib/order-lifecycle.test.ts`.

Para las pruebas transaccionales, ejecutar `BEGIN;`, el contenido de `scripts/tests/order-lifecycle.sql`, y `ROLLBACK;`. Crean artículos y pedidos técnicos temporales; no contactar Mercado Pago ni confirmar esa transacción. Cubren reserva, límite de stock, idempotencia, vencimiento, rechazo, recuperación, precios históricos y pagos tardíos/duplicados.

La conciliación verifica cada pago consultando la API de Mercado Pago y su merchant order; nunca confía en parámetros de retorno ni acepta una aprobación desde el navegador.
