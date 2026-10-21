import type { SalesStatistics } from "./sales-statistics";
export async function exportSalesStatistics(
  data: SalesStatistics,
  from: string,
  to: string,
  category: string,
  brand: string,
) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Perfumería El Arcángel";
  const summary = book.addWorksheet("Resumen");
  summary.addRows([
    ["Estadísticas de ventas"],
    ["Desde", from],
    ["Hasta", to],
    ["Categoría", category],
    ["Marca", brand],
    ["Zona horaria", "America/Argentina/Buenos_Aires"],
    ["Cobrado ARS", data.current.revenue ?? 0],
    ["Envíos incluidos ARS", data.current.shipping ?? 0],
    ["Pedidos pagados", data.current.orders ?? 0],
    ["Unidades", data.current.units ?? 0],
    ["Ticket promedio ARS", data.current.average ?? 0],
    ["Pedidos sin evidencia excluidos", data.unverified_orders],
    ["Fechas estimadas", data.current.estimated_dates ?? 0],
    [
      "Criterio",
      "Solo pedidos pagados con intento aprobado coincidente. Con filtros, importes de artículos sin envío.",
    ],
    [
      "Stock",
      "Stock actual; no hay historial de disponibilidad. No mide rentabilidad ni devoluciones.",
    ],
  ]);
  const daily = book.addWorksheet("Evolución");
  daily.addRow(["Fecha", "Cobrado ARS", "Pedidos"]);
  data.daily.forEach((d) => daily.addRow([d.day, d.revenue, d.orders]));
  const products = book.addWorksheet("Artículos");
  products.addRow([
    "ID",
    "Código",
    "Artículo",
    "Categoría",
    "Marca",
    "Unidades vendidas",
    "Venta artículos ARS",
    "Stock actual",
    "Visible",
    "Alta",
  ]);
  data.products.forEach((p) =>
    products.addRow([
      p.id,
      p.article_code ?? "",
      p.name,
      p.category,
      p.brand,
      p.units,
      p.revenue,
      p.stock,
      p.is_active ? "Sí" : "No",
      p.created_at.slice(0, 10),
    ]),
  );
  for (const [name, rows] of [
    ["Categorías", data.categories],
    ["Marcas", data.brands],
  ] as const) {
    const s = book.addWorksheet(name);
    s.addRow(["Nombre", "Unidades", "Venta artículos ARS"]);
    rows.forEach((r) => s.addRow([r.name, r.units, r.revenue]));
  }
  const status = book.addWorksheet("Estados de pedidos");
  status.addRow(["Estado", "Cantidad (por fecha de creación)"]);
  Object.entries(data.statuses).forEach(([s, n]) => status.addRow([s, n]));
  book.eachSheet((s) => {
    s.views = [{ state: "frozen", ySplit: 1 }];
    s.getRow(1).font = { bold: true };
    s.columns.forEach((c, i) => {
      c.width = s.name === "Artículos" ? (i === 2 ? 55 : 24) : 30;
    });
  });
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `estadisticas-${from}-${to}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
