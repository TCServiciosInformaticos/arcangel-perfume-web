# Historial, clientes, alertas y revisión de Excel

## Permisos

Historial de cambios, Clientes y Alertas del negocio tienen casillas independientes en Usuarios. El administrador principal conserva todos los accesos. La importación Excel permanece en Productos; no requiere un permiso adicional. Ver una alerta no concede permiso para editar el módulo de origen.

## Historial

El registro comienza al activar la función, sin inventar cambios anteriores. Registra creación, edición y eliminación de productos, clasificación, slider, pedidos y permisos de empleados. Guarda usuario, fecha argentina, registro, campos y valores anterior/nuevo; las importaciones se identifican como Excel. Las operaciones de integraciones sin identidad de usuario figuran como Sistema / integración. No registra contraseñas, correos, teléfonos, direcciones de clientes ni capacidades de acceso a pedidos. El rol web solo puede consultar el historial con su permiso, sin insertar, editar o eliminar eventos. No reemplaza backups ni registra cambios realizados antes de su activación o por un operador que deshabilite triggers desde la base.

## Excel

La revisión compara los datos del archivo con valores actuales, valida el archivo antes de guardar, permite búsqueda, paginación y selección de artículos, y señala saldos o precios en cero. Los saldos reemplazan el stock; no son ingresos adicionales. Se envían solo artículos seleccionados. La confirmación verifica la versión exacta de cada fila dentro de una transacción con el mismo orden de bloqueos del inventario. Si cualquier artículo cambió desde la revisión, se rechaza el lote completo y se pide volver a cargar el archivo. No crea ni elimina artículos. Una copia de Excel antigua puede contener valores anteriores: la vista previa es el momento para revisar esas diferencias.

## Clientes

Lista clientes que tienen pedidos, agrupados por correo normalizado; usa el correo de cuenta si existe y el de compra en los demás casos. No incluye usuarios sin pedidos ni unifica correos diferentes por semejanza del nombre. El contacto mostrado es el del último pedido. Permite buscar y ver compras paginadas. El gasto confirmado incluye envío, considera pedidos archivados y exige estado pagado/en preparación/enviado/entregado con intento de pago aprobado cuyo identificador coincide. Los pedidos sin evidencia de cobro no suman gasto. La pantalla es de consulta; no envía mensajes ni modifica contactos.

## Alertas

Muestra artículos visibles sin stock, con stock bajo (umbral configurable), sin imagen, sin código o con precio cero. Muestra pedidos no archivados que requieren revisión o que siguen sin pago después de 24 horas. Son indicadores del estado actual, no alertas por correo ni una modificación automática del pedido. Los contadores pueden superponerse porque un artículo puede tener varias incidencias. La lista tiene paginación y actualización manual. El acceso al módulo correspondiente se muestra solo si la cuenta tiene el permiso necesario.

## Instalación y pruebas

`supabase/operations/admin-operations.sql` fue aplicado en el Supabase independiente. No volver a ejecutarlo sin revisar: crea objetos y triggers una sola vez. La versión final usa los campos reales del slider (image_path, destination, etc.). Las pruebas SQL están en `supabase/tests/admin_operations.sql`; usan identidades y pedidos sintéticos y revierten los datos. Las pruebas de navegador interceptan solicitudes a un servidor local y bloquean dominios externos.
