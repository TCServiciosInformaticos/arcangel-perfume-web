export type SubcategoryOption = { id: string; category_id: string; name: string };

export function subcategoriesForCategory(items: SubcategoryOption[], categoryId: string) {
  return items.filter((item) => item.category_id === categoryId);
}

export function validateProductClassification(categoryId: string | null, subcategoryId: string | null, items: SubcategoryOption[]) {
  if (!subcategoryId) return;
  if (!categoryId || !items.some((item) => item.id === subcategoryId && item.category_id === categoryId)) {
    throw new Error("La subcategoría debe pertenecer a la categoría seleccionada");
  }
}