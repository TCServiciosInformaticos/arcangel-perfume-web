import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  excelHeaders,
  exportProductExcel,
  readProductExcel,
  validateExcelRows,
} from "./product-excel";
const p = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Shampoo",
  description: "Detalle original",
  article_code: "000123",
  price: 8000,
  stock: 0,
  is_active: true,
};
const row = [p.id, "Shampoo nuevo", "", "", 9500, 12, "No", "Detalle nuevo", "000124"];
test("actualiza textos, código, precio, saldo absoluto y visibilidad por ID", () => {
  assert.deepEqual(validateExcelRows([excelHeaders, row], [p]), [
    {
      id: p.id,
      name: "Shampoo nuevo",
      description: "Detalle nuevo",
      article_code: "000124",
      price: 9500,
      stock: 12,
      is_active: false,
    },
  ]);
});
test("exportación e importación sin cambios incluye inactivos y precio cero", async () => {
  const products = [
    p,
    {
      ...p,
      id: "22222222-2222-4222-8222-222222222222",
      article_code: "000002",
      is_active: false,
      price: 0,
    },
  ];
  const buffer = await exportProductExcel(products, []);
  assert.deepEqual(await readProductExcel(new Uint8Array(buffer).buffer, products), []);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Artículos")!;
  assert.equal(sheet.getCell("I2").value, "000123");
  assert.equal(sheet.getColumn(9).numFmt, "@");
  sheet.getCell("B2").value = "Nombre editado";
  sheet.getCell("H2").value = null;
  sheet.getCell("I2").value = "0000007";
  const changes = await readProductExcel(
    new Uint8Array(await book.xlsx.writeBuffer()).buffer,
    products,
  );
  assert.equal(changes[0].name, "Nombre editado");
  assert.equal(changes[0].description, "");
  assert.equal(changes[0].article_code, "0000007");
});
test("acepta plantillas anteriores sin cambiar textos ni códigos", () => {
  const headers = ["ID", "Artículo", "Categoría", "Marca", "Precio (ARS)", "Stock", "Activo"];
  assert.deepEqual(validateExcelRows([headers, [p.id, "Referencia", "", "", 8500, 4, "Sí"]], [p]), [
    { id: p.id, price: 8500, stock: 4, is_active: true },
  ]);
});
test("rechaza códigos duplicados incluso contra filas omitidas y permite intercambiarlos", () => {
  const other = { ...p, id: "22222222-2222-4222-8222-222222222222", article_code: "OTRO" };
  assert.throws(
    () => validateExcelRows([excelHeaders, [...row.slice(0, 8), "OTRO"]], [p, other]),
    /Código.*repetido/,
  );
  assert.equal(
    validateExcelRows(
      [
        excelHeaders,
        [...row.slice(0, 8), "OTRO"],
        [other.id, p.name, "", "", 8000, 0, "Sí", p.description, p.article_code],
      ],
      [p, other],
    ).length,
    2,
  );
  assert.throws(
    () => validateExcelRows([excelHeaders, [...row.slice(0, 8), 123]], [p]),
    /código inválido/,
  );
});
test("rechaza datos inválidos y filas duplicadas sin resultado parcial", () => {
  for (const [column, values] of [
    [1, ["", null]],
    [4, [null, -1, Infinity]],
    [5, [-1, 1.5]],
    [6, ["quizá"]],
    [7, [123]],
    [8, ["x".repeat(101)]],
  ] as const)
    for (const value of values) {
      const invalid: unknown[] = [...row];
      invalid[column] = value;
      assert.throws(() => validateExcelRows([excelHeaders, invalid], [p]));
    }
  assert.throws(() => validateExcelRows([excelHeaders, row, row], [p]), /ID repetido/);
  assert.throws(
    () => validateExcelRows([excelHeaders, ["otro", ...row.slice(1)]], [p]),
    /ID desconocido/,
  );
});
test("rechaza fórmulas en las columnas editables", async () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Artículos");
  sheet.addRow(excelHeaders);
  sheet.addRow(row);
  sheet.getCell("I2").value = { formula: "1+1", result: 2 };
  await assert.rejects(
    readProductExcel(new Uint8Array(await book.xlsx.writeBuffer()).buffer, [p]),
    /fórmulas/,
  );
});
