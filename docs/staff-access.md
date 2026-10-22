# Usuarios del personal

El administrador gestiona cuentas en `/admin/usuarios`: nombre, correo, contraseña inicial de al menos 12 caracteres, módulos y acceso activo.

- Catálogo: productos, categorías, precios e importación Excel.
- Pedidos: consulta y gestión operativa. Conciliación con Mercado Pago, enlaces de recuperación y resolución manual de stock quedan reservados al administrador.
- Slider: imágenes, textos y orden.

Usuarios, estadísticas, costos y herramientas comerciales quedan reservados al administrador. Una cuenta sin módulos o desactivada no accede al panel. Desactivar conserva el historial y la cuenta de cliente. Los permisos se verifican en la base de datos en cada operación; el menú se actualiza al enfocar la ventana o dentro de 60 segundos.

## Hostinger

Desplegar la rama `hostinger-usuarios`. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas del servidor del proyecto Supabase independiente. No usar prefijo VITE para la clave de servicio ni incluirla en GitHub. Reiniciar/recompilar después de configurar.

La operación `supabase/operations/staff-access.sql` ya se aplicó al proyecto independiente. No ejecutarla de nuevo sin revisar. Las pruebas de permisos están en `supabase/tests/staff_access.sql` y revierten todos los datos sintéticos.

No se envían invitaciones por correo. El administrador entrega la contraseña inicial por un canal privado; crear una cuenta no cambia su sesión. No se modifican contraseñas de administradores existentes.
