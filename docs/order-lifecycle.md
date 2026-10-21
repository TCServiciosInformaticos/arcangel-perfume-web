# Pedidos, reservas y conciliación

## Comportamiento

- El pedido y sus productos se guardan juntos. Cada intento de pago conserva sus precios y presentaciones, un identificador propio y vencimiento a 30 minutos.
- Las reservas reducen la disponibilidad para otros checkouts, sin modificar el saldo físico. Las consultas del catálogo siguen mostrando el saldo físico; el checkout informa cuando esas unidades están reservadas.
- Aprobación verificada: descuenta stock una única vez. Aprobación tardía: respeta las reservas de otros clientes. Si falta stock, registra el cobro como pagado y bloquea la preparación hasta resolver la revisión.
- Un segundo cobro aprobado del mismo pedido se señala para revisión. No se generan devoluciones automáticas.
- Recuperación por email (cuando está activada): tras una hora sin completar el pago se prepara un único aviso por pedido. Se verifica Mercado Pago antes de enviarlo. El plazo de abandono definitivo es de 24 horas después de la aceptación del email por el proveedor; una cola o un fallo no inician ese plazo. Durante la recuperación se puede retomar el mismo pedido con precio y disponibilidad actuales. Un intento activo mantiene su precio durante su reserva. Un pedido definitivamente abandonado puede recibir y registrar una aprobación tardía, pero no inicia otro intento de pago.
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


## Recordatorio por email

La implementación usa la API de Resend con un remitente de dominio verificado. No usa la cuenta personal de Gmail ni el SMTP de autenticación de Supabase. Aplica a pedidos iniciados con email; el carrito guardado solo en el navegador no tiene datos suficientes para enviar avisos.

Configurar directamente en el entorno servidor de Vercel, sin pegar secretos en chats ni guardarlos en el repositorio:

- `RESEND_API_KEY`: credencial del proveedor.
- `ORDER_RECOVERY_FROM_EMAIL`: remitente verificado; admite `Perfumería El Arcángel <ventas@dominio-verificado>`.
- `PUBLIC_SITE_URL`: origen HTTPS de la tienda pública que recibirá el enlace.
- `ORDER_RECOVERY_EMAIL_ENABLED=true`: habilitación explícita, después de probar la integración.
- Deben seguir configuradas las credenciales existentes de Supabase, Mercado Pago y el secreto de acceso a pedidos.

Aplicar las migraciones `abandoned_order_email` y `abandoned_order_email_functions` en transacciones separadas. Las columnas, funciones, cola y programación se guardan con la función de email apagada. Mientras esté apagada, se mantiene el vencimiento previo; el estado nuevo de abandono definitivo no se asigna por un aviso no enviado.

Después de publicar y verificar la configuración, hacer una prueba con un pedido técnico y un destinatario controlado, y recién entonces activar:

```sql
UPDATE private.order_recovery_config SET enabled=true WHERE id;
SELECT cron.alter_job(jobid,active:=true)
FROM cron.job WHERE jobname='arcangel-order-recovery-email';
```

`GET /api/public/order-recovery-emails` informa el protocolo `order-recovery-email-v1`, disponibilidad y comprobaciones booleanas, sin valores secretos. El POST requiere la credencial privada de mantenimiento que ya usa la tienda. El admin muestra si falta configuración o activación.

La tarea corre cada 5 minutos y procesa hasta 5 pedidos por vuelta. Cada aviso tiene una reserva de procesamiento de 5 minutos y reintentos temporales separados por 10 minutos. El contenido y la clave de idempotencia se conservan en cada reintento. No reintentar automáticamente un envío ambiguo después de 23 horas: Resend conserva su deduplicación por 24 horas. Revisar ese caso en el proveedor antes de cualquier intervención. Los rechazos permanentes requieren revisar remitente o destinatario.

El momento guardado es la aceptación del proveedor, no la entrega, la apertura o la lectura por parte del cliente. Como todo envío externo, un pago aprobado en el instante posterior a la última comprobación puede coincidir con un email en tránsito; un pedido pagado nunca pasa a abandono definitivo.

No se prometen precios anteriores ni stock en el email. El enlace recupera el mismo pedido y verifica disponibilidad y precio al generar otro intento. No se envían descuentos ni mensajes adicionales. El payload firmado de la cola se restringe al servidor; el admin solo recibe metadatos de estado.

Pruebas adicionales: `src/lib/order-recovery-email.test.ts`, `src/lib/order-recovery-email.server.test.ts` y `scripts/tests/order-recovery-email.sql`. Las pruebas de email usan transporte simulado; no enviaron correo a clientes reales.
