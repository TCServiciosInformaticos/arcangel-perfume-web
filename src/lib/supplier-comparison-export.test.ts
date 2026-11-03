import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { compareOffers } from "./supplier-price-comparison";
import { exportSupplierComparison } from "./supplier-comparison-export";

test("Excel export preserves ties, original prices, stock, conditions and source", async () => {
  const offers = [
    {
      barcode: "0012345678905",
      name: "Crema 50 ml",
      price: 100,
      supplier: "Doan",
      file: "lista.xlsx",
      row: 10,
      stock: 3,
      conditions: "Mínimo 12 unidades",
    },
    {
      barcode: "0012345678905",
      name: "Crema 50 ml",
      price: 100,
      supplier: "Mendi",
      file: "oferta.pdf",
      row: 0,
      stock: null,
    },
    {
      barcode: "0012345678905",
      name: "Crema 50 ml",
      price: 120,
      supplier: "Doan",
      file: "lista-anterior.xlsx",
      row: 2,
    },
    {
      barcode: "product:abc",
      name: "Gel 100 ml",
      price: 50.1234,
      supplier: "Doan",
      file: "lista.xlsx",
      row: 11,
    },
  ];
  const input = compareOffers(offers);
  const raw = await exportSupplierComparison(input);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(raw);
  assert.deepEqual(
    book.worksheets.map((s) => s.name),
    ["Comparación", "Detalle de ofertas", "Cómo leer"],
  );
  const sheet = book.worksheets[0];
  const rows = sheet.getRows(2, 2)!;
  const cream = rows.find((r) => r.getCell(1).value === "Crema 50 ml")!;
  const gel = rows.find((r) => r.getCell(1).value === "Gel 100 ml")!;
  assert.equal(cream.getCell(2).value, "0012345678905");
  assert.equal(cream.getCell(3).value, 100);
  assert.equal(cream.getCell(4).value, "Doan / Mendi");
  assert.equal(cream.getCell(5).value, "Empate");
  assert.equal(cream.getCell(6).value, 100);
  assert.equal(cream.getCell(7).value, 100);
  assert.equal(gel.getCell(3).value, 50.1234);
  assert.equal(gel.getCell(5).value, "Un solo proveedor");
  const details = book.worksheets[1];
  assert.equal(details.rowCount, 5);
  assert.equal(details.getRow(2).getCell(7).value, "Mínimo 12 unidades");
  assert.equal(details.getRow(3).getCell(6).value, "No informado");
});

test("export refuses empty result sets", async () => {
  await assert.rejects(exportSupplierComparison([]), /No hay resultados/);
});
