# Flujo de compra

## Política de Precios
- [ ] Agregar apartado con filtros, selección paginada, porcentaje de aumento/descuento y vista previa.
- [ ] Aplicar precios de forma atómica solo para administradores, con redondeo hacia arriba y protección ante cambios simultáneos.
- [ ] Verificar cálculos y actualización real desde el panel.

## Administrador y sucursales
- [x] Verificar el nombre Cuidado Personal sin cambiar enlaces existentes.
- [x] Cargar productos del administrador por páginas y conservar la exportación completa; navegación real 1 → 2 → 1 verificada, 24 filas por petición.
- [x] Agregar un mapa Google Maps debajo de cada sucursal con las direcciones existentes y enlace para abrirlo.
- [ ] Verificar las ubicaciones de Google Maps; requiere revisión de la usuaria en el sitio publicado autorizado porque el entorno de pruebas no admite mapas en vivo.

## Integraciones con asistentes
- [ ] Agregar MCP protegido con OAuth y consultas de catálogo, categorías y fichas.
- [ ] Agregar herramientas de lectura y búsqueda en la pantalla del catálogo.
- [ ] Verificar consentimiento, retorno al iniciar sesión y manifiesto; requiere republicación para uso externo.

## Actualización por Excel
- [x] Exportar todos los artículos con ID, nombre, categoría, marca, precio, stock y activo.
- [x] Validar e importar únicamente precio, stock y activo con confirmación y guardado atómico para administradores.
- [x] Entregar Excel actual y verificar exportación e importación en el panel.

## Catálogo cuidado personal Thelma & Louise
- [x] Obtener los 84 artículos de las dos páginas de cuidado personal con precios, fotos y descripciones.
- [x] Cargar sus 147 presentaciones en Skin care con descuento del 20%, precios enteros y stock cero; verificar catálogo, ficha y las 147 imágenes.

## Categorías y subcategorías
- [x] Crear subcategorías por categoría y asignar Fidelité a los 87 artículos de Cabello.
- [x] Permitir crear, editar y eliminar categorías y subcategorías en el panel, y elegirlas en los productos; impedir borrar categorías con productos.
- [x] Filtrar el catálogo por subcategoría y verificar creación, edición, eliminación y guardado de producto desde el panel.

## Catálogo Fidelité
- [x] Revisar los 87 artículos de las cuatro páginas de BM Distribuidora y obtener fotos, descripciones y precios publicados.
- [x] Cargar 87 artículos en Cabello con precios de origen y stock cero, sin alterar los cuatro productos existentes.
- [x] Verificar 87 tarjetas, fotos sin errores y cuatro fichas de producto en la tienda.

- [x] Validar carrito e iniciar pago real sin aprobar pedidos de demostración.
- [x] Proteger consulta del pedido y verificar pagos de Mercado Pago.
- [x] Mostrar confirmación y enlace WhatsApp solo para pagos aprobados; conservar carrito si falla.
- [x] Probar validaciones y recorrido público hasta bloqueo por credenciales: 7 pruebas aprobadas, carrito conservado y retorno protegido.
- [ ] Conectar credenciales de prueba y verificar un pago completo (requiere Access Token de prueba y clave secreta de Webhooks).
- [x] Aclarar que Public Key no reemplaza la clave secreta de Webhooks.
- [x] Orientar al usuario en la captura: modo de prueba, URL indicada, Pagos (legacy) y guardar configuración.
## Textos del catálogo
- [x] Que el título bajo "Catálogo" cambie según la categoría, subcategoría, ofertas o búsqueda elegidas.

## Banner de la portada
- [x] Mostrar los tres frascos del banner de Perfumes en celular.
- [x] Probar la imagen nueva de tocador verde en la diapositiva Cabello y verificarla en celular y escritorio.
- [x] Cambiar "Cabello" por "Cuidado Capilar" en menú, portada y carrusel.
- [x] Agregar diapositiva Make up que abre el catálogo filtrado por Make up.
- [x] Cambiar la foto provisorial de la diapositiva Make up por la imagen subida por la usuaria.
- [x] Que cada diapositiva del carrusel abra el catálogo filtrado por su categoría.
