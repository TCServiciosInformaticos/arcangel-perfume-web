import type { ExcelProduct, ProductUpdate } from "./product-excel";
export function prepareProductPreview(
  updates: ProductUpdate[],
  products: ExcelProduct[],
  selected: ReadonlySet<string>,
) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return updates
    .filter((u) => selected.has(u.id))
    .map((u) => {
      const p = byId.get(u.id);
      if (!p?.updated_at)
        throw new Error("Falta la versión del artículo. Volvé a cargar el Excel.");
      return { ...u, expected_updated_at: p.updated_at };
    });
}
