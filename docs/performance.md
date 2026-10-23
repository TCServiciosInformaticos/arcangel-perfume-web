# Catálogo y slider: optimización

## Medición inicial

Desde el entorno de trabajo, la página pública de Hostinger devolvió HTML de inicio de 89.568 bytes (TTFB 6,16 s) y HTML del catálogo de 966.468 bytes (TTFB 5,15 s). Son mediciones externas puntuales, no resultados de Core Web Vitals ni tiempos garantizados en celulares. El catálogo cargaba los 1.635 productos activos y los serializaba aunque mostraba 24.

## Cambios

- store_catalog_page ejecuta los filtros y el orden en Postgres y devuelve como máximo 24 productos con total y página canónica. Función SECURITY INVOKER disponible para anon/authenticated: el predicado is_active se aplica incluso al administrador. No devuelve costos ni datos de pedidos.
- El loader inicia consultas de página y clasificación en paralelo; se elimina collectPages del catálogo público. Las exportaciones Excel mantienen lectura completa.
- Índices parciales para productos activos por fecha/ID y precio/ID. La paginación tiene desempate estable por ID. Las ofertas comparan precio anterior con precio actual en SQL.
- La búsqueda textual usa coincidencia literal, como antes, con límite de 200 caracteres y una espera de 250 ms para evitar enviar una consulta por tecla. Los filtros siguen en la URL.
- Cache de datos de página durante 30 segundos en el navegador y clasificación/menú durante 5 minutos. No se añade cache global de precios ni de páginas personalizadas. El checkout siempre revalida precios y disponibilidad.
- El slider conserva Embla, gestos, enlaces y controles. Usa una sola imagen por diapositiva en ambos tamaños de pantalla, prioriza la primera y monta solo la seleccionada y sus vecinas; conserva las ya visitadas. No se reemplazan imágenes ni se modifica su contenido.

En la base real, la primera página devuelve 24 productos de 1.635 en 18.461 bytes de JSON. Este tamaño de JSON no se compara directamente con el HTML inicial: el HTML final se mide después del despliegue.

## Validación

supabase/tests/store_catalog_pagination.sql comprueba lectura anónima, límites, no repetición entre páginas, página fuera de rango, clasificación, orden por precio, ofertas, búsqueda literal y ausencia de campos privados. Sus productos de prueba se revierten. Los tests de navegador verifican búsqueda, cambio de página, límites de imágenes del slider y prioridad de la primera imagen en escritorio y celular.
