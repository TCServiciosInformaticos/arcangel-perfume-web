# Herramientas de venta

Admin → Herramientas de venta (`/admin/herramientas`): combos, cupones, costos/códigos, preparación, margen bruto y solicitudes de reposición. Visitantes: `/combos`, `/favoritos`, sugerencias en la ficha y solicitudes de reposición desde productos agotados. Volver a comprar aparece en la confirmación de una compra pagada, protegida por su capacidad HMAC.

## Operación

- Combos: crear con 2–20 productos y cantidades 1–20. Inicialmente ocultos; activar explícitamente. No admite kits anidados. Los precios se distribuyen en centavos exactos sobre componentes y el stock se reserva/descuenta agregado por SKU, incluso si ese artículo también está suelto en el carrito. Pedidos/preparación muestran los componentes.
- Cupones: porcentaje o importe, categoría opcional, fechas argentinas, mínimo, usos globales y por cuenta y primera compra. Requieren cuenta confirmada. Un intento de pago pendiente retiene un uso hasta su vencimiento; los pagos tardíos conservan el snapshot y pueden consumir un uso luego del vencimiento; si superan el límite, el pedido se marca para revisión sin ignorar el cobro. Una aprobación duplicada no descuenta stock otra vez. No se generan promociones reales de ejemplo.
- Checkout: la consulta pública de precios no expone costos ni códigos de cupones. La validación de cupones y pago requieren la configuración privada del servidor. Al cambiar el precio total se pide revisar y confirmar otra vez antes de iniciar Mercado Pago.
- Favoritos: hasta 200 IDs en el navegador, sin sincronización entre dispositivos. Relacionados: misma marca/categoría, priorizando stock; no implica que sean sustitutos o un tratamiento recomendado.
- Recompra: revisa precios/stock activos antes de agregar; omite faltantes y acota cantidades al stock y al máximo del checkout. Un kit anterior se recompra como componentes a precios actuales, sin trasladar promociones viejas.
- Preparación: pedidos paid/preparing con stock confirmado y sin revisión. Lista paginada, marcas por artículo e impresión sin precios ni costos. No confirma automáticamente una entrega ni modifica stock.
- Costos: privados por RLS, código de barras único opcional, guardado con versiones. Margen bruto = venta de líneas cobradas con stock confirmado, sin revisión pendiente y con costo conocido menos el costo histórico; excluye envío, impuestos, comisiones, gastos y devoluciones. Costos desconocidos se informan aparte, nunca se rellenan con el costo actual.
- Lector: USB/teclado en buscador por código, barras o nombre. Cámara usa BarcodeDetector local y requiere HTTPS/permisos/soporte del navegador; ofrece búsqueda como alternativa. No se suben ni guardan imágenes de cámara.

## Reposición y configuración pendiente

El cliente autenticado y con email confirmado puede guardar/cancelar su solicitud sin claves privadas de servidor. La función de confirmación de email es privada, sin argumentos y verifica solo auth.uid(); no expone auth.users. Los clientes no pueden leer solicitudes ajenas ni costos.

El worker de correo requiere `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ORDER_RECOVERY_FROM_EMAIL`, `PUBLIC_SITE_URL` HTTPS y `RESTOCK_EMAIL_ENABLED=true`. El cron `arcangel-restock-notifications` se instala **inactivo** y debe activarse solo después de verificar dominio/remitente y una prueba controlada. No se enviaron mensajes a clientes. Cada solicitud se reclama una vez con SKIP LOCKED, se revalidan cuenta/producto/cancelación y se usa una clave de idempotencia fija. Una respuesta ambigua o un lease vencido se retiene en review; no hay reenvío automático fuera de ventana de deduplicación.

La revisión de variables de Vercel mostró que todavía faltan las credenciales privadas de Supabase/Mercado Pago/HMAC y Resend. El código no inventa pagos ni sustituye credenciales. Configurar valores privados directamente en Vercel, nunca en código ni en chat. `SUPABASE_URL`/`PUBLIC_SITE_URL` son configuración pública; las claves y secretos son solo servidor.

## SQL y pruebas

`supabase/commerce-tools.sql` es el cambio de esquema y funciones revisado. Aplicar **una sola vez, dentro de una transacción**; las políticas nuevas impiden repetirlo accidentalmente. Conserva los contratos y permisos de las funciones de ciclo de pedidos y agrega la cotización canónica. No requiere nuevas dependencias.

Verificación: pruebas SQL con ROLLBACK (`supabase/tests/commerce_tools.sql`, `commerce_security.sql`), pruebas de servidor con proveedor ficticio (cuentas confirmadas, HMAC, costos privados, worker apagado, idempotencia y respuestas ambiguas) y Playwright aislado (favoritos, kits/carrito, acceso admin, creación de kit y costo). Ninguna prueba usa pagos ni correos reales.
