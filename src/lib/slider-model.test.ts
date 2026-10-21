import assert from "node:assert/strict";
import test from "node:test";
import { moveSlide, slideSearch, slideFormSchema, validateSliderFile } from "./slider-model";
test("reordering preserves snapshots and handles list boundaries", () => {
  const a = { id: "a", updated_at: "original" },
    b = { id: "b", updated_at: "original" };
  const rows = [a, b];
  const moved = moveSlide(rows, 0, 1);
  assert.deepEqual(moved, [b, a]);
  assert.deepEqual(rows, [a, b]);
  assert.equal(moved[1], a);
  assert.equal(moveSlide(rows, 0, -1), rows);
  assert.equal(moveSlide(rows, 1, 1), rows);
});
test("links preserve offers and category catalog filters", () => {
  assert.deepEqual(slideSearch("offers"), { ofertas: true });
  assert.deepEqual(slideSearch("category", "perfumes"), { categoria: "perfumes" });
  assert.deepEqual(slideSearch("catalog"), {});
});
test("requires image, title and a valid destination category", () => {
  const valid = {
    title: "  Oferta  ",
    subtitle: "",
    alt_text: "",
    image_path: "builtin:hero-ofertas",
    mobile_position: 50,
    destination: "catalog",
    category_id: null,
    is_active: true,
  };
  assert.equal(slideFormSchema.parse(valid).title, "Oferta");
  for (const change of [
    { title: "" },
    { image_path: "" },
    { destination: "category" },
    { mobile_position: 101 },
  ])
    assert.equal(slideFormSchema.safeParse({ ...valid, ...change }).success, false);
  assert.equal(
    slideFormSchema.safeParse({
      ...valid,
      destination: "category",
      category_id: "00000000-0000-4000-8000-000000000001",
    }).success,
    true,
  );
});
test("rejects unsupported, empty and oversized uploads", () => {
  validateSliderFile({ type: "image/png", size: 1024 });
  for (const file of [
    { type: "image/svg+xml", size: 100 },
    { type: "image/jpeg", size: 0 },
    { type: "image/webp", size: 13 * 1024 * 1024 },
  ])
    assert.throws(() => validateSliderFile(file));
});
