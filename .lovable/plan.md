
# Sitio web Perfumería El Arcángel

Tienda online con catálogo administrable, carrito, checkout con MercadoPago y envío del pedido por WhatsApp al dueño usando link `wa.me` (igual que el formulario de Greenhouse).

## Cómo funciona la notificación por WhatsApp

Después de que MercadoPago confirma el pago, la página `/gracias` arma un mensaje con todos los datos del pedido y abre automáticamente `https://wa.me/5491125124333?text=<mensaje>`. El cliente ve WhatsApp abierto con el mensaje listo y solo aprieta "Enviar". Te llega el pedido en tu WhatsApp como cualquier chat.

- **Cero costo, sin Twilio, sin API.**
- Funciona en mobile (abre la app) y desktop (abre WhatsApp Web).
- Backup: en el panel admin, cada pedido tiene un botón "Reenviar por WhatsApp" por si el cliente cierra la pestaña antes de enviarlo. Y el pedido queda guardado en la base de datos pase lo que pase.

Mensaje que se arma:
```
🛍️ Nuevo pedido #1234 — Perfumería El Arcángel
Cliente: Juan Pérez
Email: juan@mail.com
WhatsApp: +54 9 11 xxxx-xxxx
Entrega: Envío a domicilio
Dirección: Av. Siempreviva 742, CABA, CP 1407
Día/horario preferido: Martes por la tarde
Items:
 • 2x Perfume X — $XX
 • 1x Perfume Y — $XX
Total: $XX
Pago: Aprobado (MercadoPago, id XXXX)
```

## Páginas públicas

- **/** — Home: hero, productos destacados, categorías, link a Instagram.
- **/productos** — Catálogo con búsqueda, filtro por categoría, orden por precio.
- **/producto/$id** — Detalle, imágenes, stock, botón agregar al carrito.
- **/carrito** — Items, cantidades, subtotal.
- **/checkout** — Datos del cliente + modalidad de entrega → redirige a MercadoPago.
- **/gracias** — Confirmación + apertura automática de WhatsApp con el pedido.
- **/pago-pendiente** y **/pago-fallido** — Estados alternos.

## Panel admin (`/admin`, con login)

- Auth email/contraseña (Lovable Cloud) + tabla `user_roles` con rol `admin`.
- **Productos**: alta/baja/edición (nombre, descripción, precio, stock, categoría, imágenes en storage).
- **Categorías**: CRUD.
- **Pedidos**: listado con estado (pendiente / pagado / preparando / enviado / entregado), detalle completo, botón "Abrir en WhatsApp" para reenviar.
- **Configuración**: costo de envío, zonas, horarios, número de WhatsApp del local.

## Datos del cliente en checkout

Nombre y apellido, email, WhatsApp, modalidad (retiro / envío). Si envío: dirección completa (calle, número, piso/depto, localidad, CP), día preferido, franja horaria (mañana / tarde / noche), notas opcionales (timbre, referencias, regalo).

## Pago con MercadoPago

- **Checkout Pro** vía API (server-side): se crea una `preference` y se redirige al cliente.
- Vas a necesitar el **Access Token** de tu cuenta de vendedor (te guío cuando lleguemos a ese paso).
- Webhook público en `/api/public/mercadopago-webhook` valida la notificación y marca la orden como `paid`.
- Solo cuando la orden está `paid`, la página `/gracias` dispara el `wa.me`.

## Stack técnico

- TanStack Start + React + Tailwind + shadcn/ui.
- **Lovable Cloud** (DB, auth, storage).
- Tablas: `categories`, `products`, `orders`, `order_items`, `user_roles`, `settings`. RLS estricto.
- Server functions para crear preferencia de MP y server route público para el webhook.
- Validación con Zod en cliente y servidor.

## Orden de implementación

1. Activar Lovable Cloud + schema con RLS.
2. UI pública: home, catálogo, detalle, carrito.
3. Auth + panel admin con CRUD de productos, categorías y settings.
4. Checkout y creación de orden en estado `pending`.
5. Integración MercadoPago (preferencia + webhook + páginas de retorno).
6. Página `/gracias` con apertura automática de `wa.me` + botón de reenvío en admin.
7. SEO básico y diseño mobile-first.

## Lo que necesito de vos

- Cuando lleguemos a pagos: crear cuenta vendedor en MercadoPago y generar Access Token.
- Si tenés logo, paleta o referencia visual del local, mandámelo. Si no, propongo estética elegante (dorado / negro / crema, tipografía serif para títulos) acorde a perfumería.
