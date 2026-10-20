export type SubcategoryOption = { id: string; category_id: string; name: string };
export type ProductTypeOption = { id: string; subcategory_id: string; name: string };

export function subcategoriesForCategory(items: SubcategoryOption[], categoryId: string) {
  return items.filter((item) => item.category_id === categoryId);
}

export function typesForBrand(items: ProductTypeOption[], subcategoryId: string) {
  return items.filter((item) => item.subcategory_id === subcategoryId);
}

export function validateProductClassification(
  categoryId: string | null,
  subcategoryId: string | null,
  items: SubcategoryOption[],
  productTypeId: string | null = null,
  types: ProductTypeOption[] = [],
) {
  if (productTypeId) {
    if (!subcategoryId || !types.some((t) => t.id === productTypeId && t.subcategory_id === subcategoryId)) {
      throw new Error("El tipo de producto debe pertenecer a la marca seleccionada");
    }
  }
  if (!subcategoryId) return;
  if (!categoryId || !items.some((item) => item.id === subcategoryId && item.category_id === categoryId)) {
    throw new Error("La marca debe pertenecer a la categoría seleccionada");
  }
}
