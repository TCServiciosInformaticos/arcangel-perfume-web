import type { compareOffers } from "./supplier-price-comparison";

type Group = ReturnType<typeof compareOffers>[number];
const supplierKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Export the complete filtered results, including ties, source and offer conditions. */
export async function exportSupplierComparison(groups: Group[]): Promise<ArrayBuffer> {
  if (!groups.length) throw new Error("No hay resultados para exportar.");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Perfumería El Arcángel";
  book.created = new Date();
  const summary = book.addWorksheet("Comparación", { views: [{ state: "frozen", ySplit: 1 }] });
  const detail = book.addWorksheet("Detalle de ofertas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const suppliers = new Map<string, string>();
  for (const group of groups)
    for (const offer of group.rows) {
      const key = supplierKey(offer.supplier);
      if (!suppliers.has(key)) suppliers.set(key, offer.supplier.trim());
    }
  if (suppliers.size > 16000) throw new Error("Hay demasiados proveedores para exportar en Excel.");
  const names = [...suppliers.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  summary.addRow([
    "Artículo",
    "EAN / identificador",
    "Menor precio cargado",
    "Proveedor con menor precio",
    "Comparación",
    ...names.map(([, name]) => name),
  ]);
  detail.addRow([
    "Artículo",
    "EAN / identificador",
    "Proveedor",
    "Precio cargado",
    "Menor precio",
    "Stock informado",
    "Condiciones",
    "Descripción de la oferta",
    "Archivo",
    "Fila",
  ]);
  for (const group of groups) {
    const best = group.rows[0].price;
    const perSupplier = new Map<string, number>();
    for (const offer of group.rows) {
      const key = supplierKey(offer.supplier);
      perSupplier.set(key, Math.min(perSupplier.get(key) ?? Infinity, offer.price));
    }
    const winners = names.filter(([key]) => perSupplier.get(key) === best).map(([, name]) => name);
    const itemName = group.rows[0].name || "Sin descripción";
    const identifier = group.barcode.startsWith("product:")
      ? "Sin EAN · " + group.barcode.slice(8)
      : group.barcode;
    const row = summary.addRow([
      itemName,
      identifier,
      best,
      winners.join(" / "),
      perSupplier.size === 1 ? "Un solo proveedor" : winners.length > 1 ? "Empate" : "Comparado",
      ...names.map(([key]) => perSupplier.get(key) ?? null),
    ]);
    row.getCell(3).numFmt = '"$" #,##0.00';
    row.getCell(3).font = { bold: true, color: { argb: "FF096F4B" } };
    for (let i = 0; i < names.length; i++) {
      const cell = row.getCell(6 + i);
      cell.numFmt = '"$" #,##0.00';
      if (cell.value !== null && cell.value === best)
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    }
    for (const offer of group.rows) {
      const r = detail.addRow([
        itemName,
        identifier,
        offer.supplier,
        offer.price,
        offer.price === best ? "Sí" : "",
        offer.stock ?? "No informado",
        offer.conditions ?? "",
        offer.name,
        offer.file,
        offer.row > 0 ? offer.row : "",
      ]);
      r.getCell(4).numFmt = '"$" #,##0.00';
    }
  }
  for (const sheet of [summary, detail]) {
    const h = sheet.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9D145A" } };
    h.height = 25;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
    sheet.getColumn(1).width = 45;
    sheet.getColumn(2).width = 26;
    for (let c = 3; c <= sheet.columnCount; c++) sheet.getColumn(c).width = c === 4 ? 30 : 22;
  }
  detail.getColumn(7).width = 48;
  detail.getColumn(8).width = 44;
  detail.getColumn(9).width = 42;
  const info = book.addWorksheet("Cómo leer");
  info.columns = [{ width: 27 }, { width: 105 }];
  info.addRows([
    [
      "Contenido",
      "La hoja Comparación muestra los resultados filtrados; Detalle de ofertas conserva cada precio y su origen.",
    ],
    [
      "Menor precio",
      "Es el menor importe cargado entre las ofertas incluidas. Un empate marca a todos los proveedores con ese importe.",
    ],
    [
      "Precio y condiciones",
      "Los precios se muestran con dos decimales; se conserva el importe original. Revisá vigencia, IVA, unidades y condiciones en el detalle.",
    ],
    [
      "Proveedores repetidos",
      "Si un proveedor tiene varias ofertas para el mismo artículo, la comparación usa la menor. Todas aparecen en el detalle.",
    ],
    [
      "Filtros",
      "El archivo refleja los filtros activos al momento de exportar, incluyendo búsqueda y exclusión de stock cero.",
    ],
    ["Fecha", new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })],
  ]);
  info.getColumn(1).font = { bold: true };
  const raw = await book.xlsx.writeBuffer();
  return new Uint8Array(raw).buffer;
}
