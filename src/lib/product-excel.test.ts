import { test } from "node:test";
import assert from "node:assert/strict";
import { excelHeaders, exportProductExcel, readProductExcel, validateExcelRows } from "./product-excel";
const p = { id: "11111111-1111-4111-8111-111111111111", name: "Artículo", price: 8000, stock: 0, is_active: true };
const row = [p.id, p.name, "", "", 9500, 12, "No"];
test("Excel reemplaza precio y saldo de stock y permite desactivar", () => {
  assert.deepEqual(validateExcelRows([excelHeaders, row], [p]), [{ id: p.id, price: 9500, stock: 12, is_active: false }]);
});
test("Excel permite activar con Sí", () => {
  assert.equal(validateExcelRows([excelHeaders, [...row.slice(0, 6), "Sí"]], [{ ...p, is_active: false }])[0]?.is_active, true);
});
test("exportación conserva todos los artículos incluso inactivos", async () => {
  const buffer = await exportProductExcel([p, { ...p, id: "otro", is_active: false }], []);
  assert.deepEqual(await readProductExcel(new Uint8Array(buffer).buffer, [p, { ...p, id: "otro", is_active: false }]), []);
});
test("rechaza stock negativo o fraccionario", () => {
  for (const stock of [-1, 1.5]) assert.throws(() => validateExcelRows([excelHeaders, [...row.slice(0, 5), stock, "Sí"]], [p]), /stock/);
});
test("rechaza precio vacío o no positivo", () => {
  for (const price of [null, 0, -1]) assert.throws(() => validateExcelRows([excelHeaders, [...row.slice(0, 4), price, 0, "Sí"]], [p]), /precio/);
});
test("rechaza IDs desconocidos o duplicados y estados inválidos sin aplicar parcialmente", () => {
  assert.throws(() => validateExcelRows([excelHeaders, ["otro", ...row.slice(1)]], [p]), /ID desconocido/);
  assert.throws(() => validateExcelRows([excelHeaders, row, row], [p]), /ID repetido/);
  assert.throws(() => validateExcelRows([excelHeaders, [...row.slice(0, 6), "quizá"]], [p]), /Activo/);
});