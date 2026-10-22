# Usuarios del personal

Las cuentas con permiso de Usuarios gestionan cuentas en `/admin/usuarios`: nombre, correo, contraseña inicial de al menos 12 caracteres, módulos y acceso activo.

- Productos, Categorías y Política de Precios son permisos independientes.
- Pedidos: consulta y gestión operativa. Conciliación con Mercado Pago, enlaces de recuperación y resolución manual de stock quedan reservados al administrador.
- Slider: imágenes, textos y orden.

Usuarios, Resumen, Herramientas de venta y Estadísticas se asignan con sus propias casillas. Una cuenta sin módulos o desactivada no accede al panel. Desactivar conserva el historial y la cuenta de cliente. Los permisos se verifican en la base de datos en cada operación; el menú se actualiza al enfocar la ventana o dentro de 60 segundos.

## Hostinger

Desplegar `main`, que es la rama conectada a Hostinger. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas del servidor del proyecto Supabase independiente. No usar prefijo VITE para la clave de servicio ni incluirla en GitHub. Reiniciar/recompilar después de configurar.

La operación `supabase/operations/staff-access.sql` ya se aplicó al proyecto independiente. No ejecutarla de nuevo sin revisar. Las pruebas de permisos están en `supabase/tests/staff_access.sql` y revierten todos los datos sintéticos.

No se envían invitaciones por correo. El administrador entrega la contraseña inicial por un canal privado; crear una cuenta no cambia su sesión. No se modifican contraseñas de administradores existentes.

## Permisos individuales

La actualización `staff-individual-modules.sql` reemplaza el grupo Catálogo por Productos, Categorías y Política de Precios, y permite tildar las nueve opciones del menú por separado. Los permisos anteriores de Catálogo se convierten en esos tres accesos conservando su alcance.

Usuarios permite gestionar empleados y sus permisos, sin convertirlos en administradores ni modificar permisos de la cuenta administradora principal. Herramientas de venta incluye costos y rentabilidad. Resumen muestra únicamente accesos habilitados. Productos permite editar precios por artículo y Excel; Política de Precios autoriza los ajustes masivos porcentuales. El permiso de Política de Precios no permite cambiar descripciones ni stock, y Categorías no autoriza editar artículos.
