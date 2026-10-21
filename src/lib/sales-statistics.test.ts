import test from "node:test";
import assert from "node:assert/strict";
import {
  buenosAiresDate,
  previousSalesPeriod,
  rankSalesProducts,
  salesChange,
  validateSalesDates,
  type SalesProduct,
} from "./sales-statistics";
const product = (
  id: string,
  units: number,
  stock: number,
  extra: Partial<SalesProduct> = {},
): SalesProduct => ({
  id,
  name: id,
  article_code: null,
  category: "Perfumes",
  brand: "Marca",
  stock,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  units,
  revenue: units * 100,
  ...extra,
});
test("Argentina calendar boundaries and equal inclusive previous periods", () => {
  assert.equal(buenosAiresDate(new Date("2026-10-21T01:00:00Z")), "2026-10-20");
  assert.deepEqual(previousSalesPeriod("2026-03-01", "2026-03-31"), {
    from: "2026-01-29",
    to: "2026-02-28",
  });
  assert.equal(validateSalesDates("2026-02-30", "2026-03-02").length > 0, true);
  assert.equal(validateSalesDates("2026-10-21", "2026-10-20").length > 0, true);
  assert.equal(validateSalesDates("2025-01-01", "2026-01-02").length > 0, true);
});
test("zero sellers, inactive and newly introduced products are handled separately", () => {
  const rows = [
    product("top", 5, 4),
    product("little", 1, 0),
    product("zero", 0, 5),
    product("hidden", 0, 0, { is_active: false }),
    product("new", 0, 1, { created_at: "2026-11-01T00:00:00Z" }),
  ];
  assert.deepEqual(
    rankSalesProducts(rows, "least", "units", 5, "2026-10-21").map((p) => p.id),
    ["little", "top"],
  );
  assert.deepEqual(
    rankSalesProducts(rows, "none", "units", 5, "2026-10-21").map((p) => p.id),
    ["zero"],
  );
  assert.deepEqual(
    rankSalesProducts(rows, "stock", "units", 0, "2026-10-21").map((p) => p.id),
    ["little"],
  );
  assert.equal(salesChange(100, 0), "Sin base anterior");
  assert.equal(salesChange(120, 100), "+20%");
});
