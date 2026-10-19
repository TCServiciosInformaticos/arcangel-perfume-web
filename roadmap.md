# Flujo de compra

- [x] Validar carrito e iniciar pago real sin aprobar pedidos de demostración.
- [x] Proteger consulta del pedido y verificar pagos de Mercado Pago.
- [x] Mostrar confirmación y enlace WhatsApp solo para pagos aprobados; conservar carrito si falla.
- [x] Probar validaciones y recorrido público hasta bloqueo por credenciales: 7 pruebas aprobadas, carrito conservado y retorno protegido.
- [ ] Conectar credenciales de prueba y verificar un pago completo (requiere Access Token de prueba y clave secreta de Webhooks).
- [x] Aclarar que Public Key no reemplaza la clave secreta de Webhooks.
- [ ] Orientar al usuario en la pantalla de configuración de Mercado Pago de su captura.