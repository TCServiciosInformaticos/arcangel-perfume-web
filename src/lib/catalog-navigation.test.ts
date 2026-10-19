import { describe, expect, it } from "bun:test";
import { catalogHeading } from "./catalog-navigation";

const categories = [
  { id: "c1", name: "Perfumes", slug: "perfumes" },
  { id: "c2", name: "Limpieza", slug: "limpieza" },
  { id: "c3", name: "Cabello", slug: "cabello" },
  { id: "c4", name: "Novedades", slug: "novedades" },
];
const subcategories = [{ id: "s1", name: "Fidelité", category_id: "c3" }];

describe("catalogHeading", () => {
  it("uses the category name for a category that has no custom title", () => {
    const h = catalogHeading({ categories, subcategories, search: { categoria: "limpieza" }, count: 12 });
    expect(h.title).toBe("Productos de limpieza");
    expect(h.title.toLowerCase()).not.toContain("fragancias");
    expect(h.subtitle).toBe("12 productos disponibles.");
  });

  it("keeps the fragrances wording for perfumes", () => {
    expect(catalogHeading({ categories, subcategories, search: { categoria: "perfumes" }, count: 4 }).title).toBe(
      "Nuestras fragancias",
    );
  });

  it("shows the subcategory brand when one is selected", () => {
    const h = catalogHeading({ categories, subcategories, search: { categoria: "cabello", subcategoria: "s1" }, count: 87 });
    expect(h.title).toBe("Fidelité");
    expect(h.subtitle).toBe("87 productos disponibles.");
  });

  it("says ofertas for a category filtered to discounts", () => {
    const h = catalogHeading({ categories, subcategories, search: { categoria: "limpieza", ofertas: true }, count: 1 });
    expect(h.title).toBe("Ofertas de Limpieza");
    expect(h.subtitle).toBe("1 producto con descuento.");
  });

  it("falls back to the plain category name for a newly created category", () => {
    expect(catalogHeading({ categories, subcategories, search: { categoria: "novedades" }, count: 0 }).title).toBe("Novedades");
  });

  it("names the search term when the visitor searched", () => {
    expect(catalogHeading({ categories, subcategories, search: { q: "keratina" }, count: 2 }).title).toBe(
      "Resultados para “keratina”",
    );
  });
});
