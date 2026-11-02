import { test } from "node:test";
import assert from "node:assert/strict";
import {
  barcodeValue,
  priceValue,
  parseCsv,
  compareOffers,
  cachedCellValue,
} from "./supplier-price-comparison";

test("parses Argentine prices without silently accepting foreign or malformed formatting", () => {
  assert.equal(priceValue("$ 1.234,56"), 1234.56);
  assert.equal(priceValue("1234,50"), 1234.5);
  assert.equal(priceValue(1250.5), 1250.5);
  assert.equal(priceValue("1,234.56"), null);
  assert.equal(priceValue("0"), null);
});
test("reads quoted CSV and preserves barcode leading zeroes", () => {
  const rows = parseCsv('EAN;Nombre;Precio\n0123456789012;"Loción; suave";"1.234,56"');
  assert.deepEqual(rows[1], ["0123456789012", "Loción; suave", "1.234,56"]);
  assert.equal(barcodeValue(rows[1][0]), "0123456789012");
  assert.equal(barcodeValue("1.234E+12"), "");
});
test("compares only identical EANs and sorts by unit price", () => {
  const offers = [
    {
      barcode: "7791234567890",
      name: "Shampoo",
      price: 300,
      supplier: "A",
      file: "a.xlsx",
      row: 2,
    },
    {
      barcode: "7791234567890",
      name: "Shampoo",
      price: 200,
      supplier: "B",
      file: "b.xlsx",
      row: 2,
    },
    {
      barcode: "7791234567891",
      name: "Shampoo otro tamaño",
      price: 100,
      supplier: "B",
      file: "b.xlsx",
      row: 3,
    },
  ];
  const groups = compareOffers(offers);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((x) => x.barcode === "7791234567890")?.rows[0].supplier, "B");
});

test("reads cached formula results and preserves zero as stock", () => {
  assert.equal(priceValue(cachedCellValue({ formula: "E12*0.95", result: 1709.3445 })), 1709.3445);
  assert.equal(cachedCellValue({ formula: "lookup", result: 0 }), 0);
  assert.equal(cachedCellValue({ formula: "lookup" }), null);
});
