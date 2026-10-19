import { test } from "node:test";
import { strict as assert } from "node:assert";
import { catalogHeading } from "./catalog-navigation";

const categories = [
  { id: "c1", name: "Perfumes", slug: "perfumes" },
  { id: "c2", name: "Limpieza", slug: "limpieza" },
  { id: "c3", name: "Cabello", slug: "cabello" },
  { id: "c4", name: "Novedades", slug: "novedades" },
];
const subcategories = [{ id: "s1", name: "Fidelité", category_id: "c3" }];

test("usa el nombre de la categoría cuando no tiene un título propio", () => {
  const h = catalogHeading({ categories, subcategories, search: { categoria: "limpieza" }, count: 12 });
  assert.equal(h.title, "Productos de limpieza");
  assert.equal(h.title.toLowerCase().includes("fragancias"), false);
  assert.equal(h.subtitle, "12 productos disponibles.");
});

test("mantiene la palabra fragancias para perfumes", () => {
  const h = catalogHeading({ categories, subcategories, search: { categoria: "perfumes" }, count: 4 });
  assert.equal(h.title, "Nuestras fragancias");
});

test("muestra la subcategoría o marca cuando está seleccionada", () => {
  const h = catalogHeading({ categories, subcategories, search: { categoria: "cabello", subcategoria: "s1" }, count: 87 });
  assert.equal(h.title, "Fidelité");
  assert.equal(h.subtitle, "87 productos disponibles.");
});

test("dice ofertas cuando la categoría está filtrada por descuento", () => {
  const h = catalogHeading({ categories, subcategories, search: { categoria: "limpieza", ofertas: true }, count: 1 });
  assert.equal(h.title, "Ofertas de Limpieza");
  assert.equal(h.subtitle, "1 producto con descuento.");
});

test("usa el nombre tal cual para una categoría nueva", () => {
  const h = catalogHeading({ categories, subcategories, search: { categoria: "novedades" }, count: 0 });
  assert.equal(h.title, "Novedades");
});

test("nombra la búsqueda cuando el cliente buscó", () => {
  const h = catalogHeading({ categories, subcategories, search: { q: "keratina" }, count: 2 });
  assert.equal(h.title, "Resultados para “keratina”");
});
