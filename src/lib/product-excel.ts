import ExcelJS from "exceljs";

export type ExcelProduct = { id: string; name: string; price: number; stock: number; is_active: boolean; category?: { name: string } | null; subcategory_id?: string | null };
export type ProductUpdate = { id: string; price: number; stock: number; is_active: boolean };
export const excelHeaders = ["ID", "Artículo", "Categoría", "Marca", "Precio (ARS)", "Stock", "Activo"];

export async function exportProductExcel(products: ExcelProduct[], brands: { id: string; name: string }[]) {
  const book = new ExcelJS.Workbook();
  book.creator = "Perfumería El Arcángel";
  const sheet = book.addWorksheet("Artículos", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  sheet.addRow(excelHeaders);
  sheet.columns = [38, 68, 22, 24, 20, 14, 16].map((width) => ({ width }));
  for (const p of [...products].sort((a, b) => a.name.localeCompare(b.name, "es"))) {
    sheet.addRow([p.id, p.name, p.category?.name ?? "", brands.find(b => b.id === p.subcategory_id)?.name ?? "", Number(p.price), p.stock, p.is_active ? "Sí" : "No"]);
  }
  sheet.autoFilter = "A1:G1";
  sheet.getRow(1).height = 30;
  sheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 30 : 32;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.font = { name: "Arial", size: 11, color: { argb: rowNumber === 1 ? "FFFFFFFF" : column >= 5 ? "FF0000FF" : "FF333333" }, bold: rowNumber === 1 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowNumber === 1 ? "FFD01070" : column >= 5 ? "FFFFF1F7" : rowNumber % 2 ? "FFF7F7F7" : "FFFFFFFF" } };
      if (rowNumber > 1 && column === 5) { cell.numFmt = '"$"#,##0.00'; cell.dataValidation = { type: "decimal", operator: "greaterThan", formulae: [0], allowBlank: false, showErrorMessage: true, error: "Ingresá un precio mayor que cero." }; }
      if (rowNumber > 1 && column === 6) { cell.numFmt = "0"; cell.dataValidation = { type: "whole", operator: "between", formulae: [0, 2147483647], allowBlank: false, showErrorMessage: true, error: "El stock debe ser un entero igual o mayor que cero." }; }
      if (rowNumber > 1 && column === 7) cell.dataValidation = { type: "list", formulae: ['"Sí,No"'], allowBlank: false, showErrorMessage: true, error: "Seleccioná Sí o No." };
    });
  });
  for (const col of [1, 2, 3, 4]) sheet.getCell(1, col).note = "Referencia del artículo. No modificar: la importación solo actualiza Precio, Stock y Activo.";
  sheet.getCell("E1").note = "Precio de venta final en pesos argentinos. No se aplica ningún descuento adicional al importar.";
  sheet.getCell("F1").note = "Saldo total de stock: reemplaza la cantidad actual, no se suma.";
  sheet.getCell("G1").note = "Sí: visible en la web. No: oculto. Con stock cero no se puede comprar.";
  return book.xlsx.writeBuffer();
}

export function validateExcelRows(rows: unknown[][], products: ExcelProduct[]): ProductUpdate[] {
  if (!rows.length || !excelHeaders.every((h, i) => rows[0]?.[i] === h)) throw new Error("Usá el Excel exportado y conservá los encabezados originales.");
  const known = new Map(products.map(p => [p.id, p]));
  const seen = new Set<string>();
  const updates: ProductUpdate[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((row, i) => {
    if (row.every(v => v === null || v === undefined || v === "")) return;
    const id = typeof row[0] === "string" ? row[0].trim() : "";
    const p = known.get(id);
    const price = row[4]; const stock = row[5];
    const active = typeof row[6] === "string" ? row[6].trim().toLowerCase() : row[6];
    let reason = "";
    if (!p) reason = "ID desconocido o eliminado";
    else if (seen.has(id)) reason = "ID repetido";
    else if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 999999999) reason = "precio numérico mayor que cero requerido";
    else if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) reason = "stock entero igual o mayor que cero requerido";
    else if (!["sí", "si", "no", true, false].includes(active as string | boolean)) reason = "Activo debe ser Sí o No";
    if (reason) { errors.push(`Fila ${i + 2}: ${reason}.`); return; }
    seen.add(id);
    const is_active = active === "sí" || active === "si" || active === true;
    if (p && (Number(p.price) !== price || p.stock !== stock || p.is_active !== is_active)) updates.push({ id, price: price as number, stock: stock as number, is_active });
  });
  if (errors.length) throw new Error(errors.slice(0, 12).join("\n") + (errors.length > 12 ? `\nY ${errors.length - 12} errores más.` : ""));
  if (seen.size > 10000) throw new Error("El archivo supera los 10.000 artículos.");
  return updates;
}

export async function readProductExcel(buffer: ArrayBuffer, products: ExcelProduct[]) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet("Artículos");
  if (!sheet) throw new Error('Falta la hoja "Artículos".');
  if (sheet.rowCount > 10001) throw new Error("El archivo supera los 10.000 artículos.");
  const rows: unknown[][] = [];
  for (let n = 1; n <= sheet.rowCount; n++) {
    rows.push(excelHeaders.map((_, c) => {
      const cell = sheet.getCell(n, c + 1);
      if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) throw new Error(`Fila ${n}: reemplazá las fórmulas por valores antes de importar.`);
      return cell.value;
    }));
  }
  return validateExcelRows(rows, products);
}