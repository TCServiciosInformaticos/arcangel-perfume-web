export type Offer = {
  barcode: string;
  name: string;
  price: number;
  supplier: string;
  file: string;
  row: number;
  stock?: number | null;
  conditions?: string;
};
export function barcodeValue(value: unknown): string {
  const s = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  return /^\d{8}$|^\d{12,14}$/.test(s) ? s : "";
}
export function priceValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  let s = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/^\$|^ARS/i, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  // Text prices use Argentine formatting: 1.234,56. Reject malformed groupings.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)) return null;
  s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function compareOffers(offers: Offer[]) {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    const rows = groups.get(offer.barcode);
    if (rows) rows.push(offer);
    else groups.set(offer.barcode, [offer]);
  }
  return [...groups.entries()]
    .map(([barcode, rows]) => ({ barcode, rows: [...rows].sort((a, b) => a.price - b.price) }))
    .sort((a, b) => a.rows[0].name.localeCompare(b.rows[0].name));
}
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", ",", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"' && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (!quoted && c === sep) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("El CSV contiene comillas sin cerrar.");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Preserve cached numeric Excel formula results instead of parsing them as localized strings. */
export function cachedCellValue(value: unknown): unknown {
  if (value && typeof value === "object" && ("result" in value || "formula" in value))
    return (value as { result?: unknown }).result ?? null;
  return value;
}

/** Cemafelu: the OF marker chooses cash price; regular rows use list price. */
export function cemafeluPrice(
  row: unknown[],
  marker: number,
  list: number,
  cash: number,
): number | null {
  const isOffer = /^of\.?$/i.test(String(cachedCellValue(row[marker]) ?? "").trim());
  return priceValue(cachedCellValue(row[isOffer ? cash : list]));
}
