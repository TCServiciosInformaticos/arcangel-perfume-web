# Avisos internos de pedidos pagados

Solo un `payment_approved` producido tras verificar Mercado Pago, con intento aprobado y payment_id coincidente, genera la cola. Crear el pedido o volver desde Mercado Pago no basta. No se importan avisos históricos.

- Siempre: ventas@perfumeriaelarcangel.com.ar.
- Retiro `peron`: aviso separado a peron@perfumeriaelarcangel.com.ar.
- Retiro `bogado`: aviso separado a bogado@perfumeriaelarcangel.com.ar.
- Envío a domicilio: solamente ventas. Una sucursal desconocida se informa a ventas sin inventar destinatarios.

Cada mensaje incluye cliente/contacto, productos y cantidades del intento efectivamente pagado, precios, total, entrega y observaciones. No incluye costos internos, claves de acceso de invitados ni datos de tarjeta. El HTML escapa todos los textos de clientes/productos.

Si `needs_review` está activo, ventas recibe una advertencia de no preparar. El aviso de preparación a la sucursal queda retenido hasta resolver el caso. Esto incluye pagos tardíos sin stock.

## Configuración privada en Hostinger

Las casillas receptoras ya creadas no sustituyen un proveedor de envío. Verificar el dominio perfumeriaelarcangel.com.ar en Resend mediante sus registros DNS, conservando los MX de Hostinger.

Variables del servidor, sin prefijo VITE_:

```
RESEND_API_KEY=<guardar directamente en Hostinger; nunca en GitHub/chat>
ORDER_NOTIFICATION_FROM_EMAIL=Perfumería El Arcángel <ventas@perfumeriaelarcangel.com.ar>
ORDER_NOTIFICATION_EMAIL_ENABLED=true
```

El pago real también requiere MERCADOPAGO_ACCESS_TOKEN y MERCADOPAGO_WEBHOOK_SECRET, con el webhook configurado en `/api/public/mercadopago-webhook`. Configurar PUBLIC_SITE_URL=https://www.perfumeriaelarcangel.com.ar para los retornos de checkout existentes. No usar credenciales demo para ventas reales.

El flag de avisos internos es independiente de ORDER_RECOVERY_EMAIL_ENABLED. No habilita recordatorios de carritos ni envía correos al comprador.

`GET /api/public/paid-order-emails` informa solamente booleanos de configuración. No comprueba que Resend haya verificado el dominio ni que el mensaje haya llegado a una bandeja de entrada.

## Entrega y reintentos

La cola se crea dentro de la misma transacción de aprobación. El servidor intenta procesar dos avisos del pedido al verificar el pago. Un job de Supabase Cron cada cinco minutos llama al worker autenticado para los reintentos. El token vive en private.order_job_config, no en código ni variables del navegador. No depende de una pestaña abierta.

UNIQUE(order_id,recipient), leases de cinco minutos, payload congelado y clave Resend `paid-order/<uuid>` evitan duplicados por webhooks repetidos o confirmaciones perdidas. Tras 23 horas desde el primer intento, un envío ambiguo queda en review, porque Resend conserva la idempotencia durante 24 horas. No resetear first_send_at ni reutilizar el job para reenviar sin consultar antes al proveedor.

La confirmación del proveedor se registra como `paid_order_email_sent` en el historial. Significa aceptado por Resend, no entregado/leído. Un fallo de email nunca revierte el pago ni descuenta stock otra vez. Revisar colas failed/review y entregas/rebotes en Resend. Snapshot y payload tienen RLS sin acceso desde el navegador, incluidos empleados.

Pruebas unitarias usan fetch simulado y direcciones .invalid. `scripts/sql-tests/paid-order-notifications.sql` prueba el circuito DB con fixtures transaccionales y ROLLBACK; no envía emails ni consume números de pedido. No se hicieron compras ni envíos reales.
