# Dos niveles de subcategorías: Marca y Tipo de producto

## Qué va a cambiar para la dueña
- Cada categoría (ej. Cabello) tiene **Marcas** (Fidelité, Han…).
- Cada marca tiene sus **Tipos de producto** (Shampoo, Enjuagues, Baños de crema…).
- En el admin de Categorías se ve un árbol: Categoría → Marca → Tipo, con botones para crear, renombrar y borrar en cada nivel.
- Al editar un producto se elige Categoría, luego Marca (solo las de esa categoría) y luego Tipo (solo los de esa marca; opcional).
- En el catálogo público: al elegir una categoría aparecen sus marcas; al elegir una marca aparecen sus tipos como filtros. Los filtros quedan en la dirección de la página, así funcionan el botón Atrás y los enlaces del menú.

## Datos existentes
- Han: hoy Shampoo, Enjuagues, etc. están al mismo nivel que Han dentro de Cabello. Pasan a ser **tipos dentro de Han**, y los 89 productos Han quedan con Marca = Han y su Tipo correspondiente.
- Fidelité, Biobellus, Algabo y las demás marcas quedan como Marcas, sin Tipo (se pueden cargar después).
- No se borra ni se cambia ningún producto, precio ni stock.

## Detalles técnicos
- Nueva tabla `product_types` (id, subcategory_id → subcategories, name, slug, sort_order; único por marca), con GRANT, RLS: lectura pública, gestión solo admin (`private.has_role`).
- `products.product_type_id` nullable, con FK compuesta `(subcategory_id, product_type_id)` → `product_types(subcategory_id, id)` y CHECK que exija marca si hay tipo, para que la base impida asignaciones mezcladas.
- Migración aditiva: crea tipos bajo Han a partir de las subcategorías Han-*, reasigna productos (subcategory_id = Han, product_type_id = tipo), y elimina las subcategorías Han-* ya vacías (pide confirmación por ser borrado).
- Borrado protegido: no se puede borrar una marca o tipo con productos.
- Actualizar: `admin.categorias.tsx`, selector en `admin.productos.tsx`, `category-selection.ts`, `catalog-navigation.ts` (nuevo parámetro `tipo`), `productos.tsx`, export Excel (columna Tipo, solo lectura) y herramientas MCP de categorías/búsqueda.
- Pruebas: selección de tipo exige marca de la misma categoría; filtro por tipo en URL; reinicio de página al cambiar filtros.
