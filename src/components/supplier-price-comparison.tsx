import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { readComparisonSession, writeComparisonSession } from "@/lib/supplier-price-session";
import { supabase } from "@/integrations/supabase/client";
import { applyAdminProductSearch } from "@/lib/admin-product-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatARS } from "@/lib/format";
import {
  barcodeValue,
  cemafeluPrice,
  cachedCellValue,
  priceValue,
  compareOffers,
  parseCsv,
  type Offer,
} from "@/lib/supplier-price-comparison";

type Table = { name: string; rows: unknown[][] };
type Batch = { id: string; supplier: string; file: string; offers: Offer[]; rejected: number };
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
function guess(headers: unknown[], re: RegExp) {
  return headers.findIndex((x) => re.test(norm(x)));
}
const cellText = (v: unknown): string => {
  if (v && typeof v === "object") {
    const obj = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (obj.text) return obj.text;
    if (obj.result != null) return String(obj.result);
    if (obj.richText) return obj.richText.map((x) => x.text).join("");
  }
  return String(v ?? "");
};
export function SupplierPriceComparison() {
  const [table, setTable] = useState<Table | null>(null);
  const [supplier, setSupplier] = useState("");
  const [headerRow, setHeaderRow] = useState(1);
  const [barcode, setBarcode] = useState(-1);
  const [name, setName] = useState(-1);
  const [price, setPrice] = useState(-1);
  const [useCemafeluRule, setUseCemafeluRule] = useState(false);
  const [stock, setStock] = useState(-1);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyMultiple, setOnlyMultiple] = useState(true);
  const { user } = useAuth();
  const userId = user?.id;
  const [restoredUser, setRestoredUser] = useState<string | null>(null);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    if (!userId) return;
    setBatches([]);
    setTable(null);
    setSupplier("");
    setHeaderRow(1);
    setBarcode(-1);
    setName(-1);
    setPrice(-1);
    setUseCemafeluRule(false);
    setStock(-1);
    setSearch("");
    setOnlyMultiple(true);
    setAvailableOnly(true);
    try {
      const saved = readComparisonSession(window.sessionStorage, userId);
      if (saved) {
        if (Array.isArray(saved.batches)) setBatches(saved.batches as Batch[]);
        if (
          saved.table &&
          typeof saved.table === "object" &&
          Array.isArray((saved.table as Table).rows)
        )
          setTable(saved.table as Table);
        if (typeof saved.supplier === "string") setSupplier(saved.supplier);
        if (typeof saved.headerRow === "number") setHeaderRow(saved.headerRow);
        if (typeof saved.barcode === "number") setBarcode(saved.barcode);
        if (typeof saved.name === "number") setName(saved.name);
        if (typeof saved.price === "number") setPrice(saved.price);
        if (typeof saved.useCemafeluRule === "boolean") setUseCemafeluRule(saved.useCemafeluRule);
        if (typeof saved.stock === "number") setStock(saved.stock);
        if (typeof saved.search === "string") setSearch(saved.search);
        if (typeof saved.onlyMultiple === "boolean") setOnlyMultiple(saved.onlyMultiple);
        if (typeof saved.availableOnly === "boolean") setAvailableOnly(saved.availableOnly);
      }
      setStorageError("");
    } catch {
      setStorageError("No se pudo recuperar la comparación guardada en esta pestaña.");
    }
    setRestoredUser(userId);
  }, [userId]);
  useEffect(() => {
    if (!userId || restoredUser !== userId) return;
    try {
      writeComparisonSession(window.sessionStorage, userId, {
        batches,
        table,
        supplier,
        headerRow,
        barcode,
        name,
        price,
        useCemafeluRule,
        stock,
        search,
        onlyMultiple,
        availableOnly,
      });
      setStorageError("");
    } catch {
      setStorageError(
        "No se pudo guardar la comparación en esta pestaña. Puede que el navegador no tenga espacio disponible; los datos podrían perderse al salir.",
      );
    }
  }, [
    userId,
    restoredUser,
    batches,
    table,
    supplier,
    headerRow,
    barcode,
    name,
    price,
    useCemafeluRule,
    stock,
    search,
    onlyMultiple,
    availableOnly,
  ]);

  const headers = table?.rows[headerRow - 1] ?? [];
  const promoCol = guess(headers, /^of\.?$/);
  const listCol = guess(headers, /^precio\s+lista$/);
  const cashCol = guess(headers, /^precio\s+cdo\.?$/);
  const canUseCemafeluRule = promoCol >= 0 && listCol >= 0 && cashCol >= 0;
  const rowPrice = (row: unknown[]) =>
    useCemafeluRule && canUseCemafeluRule
      ? cemafeluPrice(row, promoCol, listCol, cashCol)
      : priceValue(cachedCellValue(row[price]));

  const offers = useMemo(() => batches.flatMap((b) => b.offers), [batches]);
  const groups = useMemo(
    () =>
      compareOffers(
        availableOnly ? offers.filter((r) => r.stock == null || r.stock > 0) : offers,
      ).filter(
        (g) =>
          (!onlyMultiple || new Set(g.rows.map((r) => norm(r.supplier))).size >= 2) &&
          `${g.barcode} ${g.rows.map((r) => `${r.name} ${r.supplier}`).join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [offers, search, onlyMultiple, availableOnly],
  );
  async function openFile(file?: File) {
    if (!file) return;
    setError("");
    setBusy(true);
    setTable(null);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite de 10 MB.");
      let rows: unknown[][];
      if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
      else if (/\.xlsx$/i.test(file.name)) {
        const { default: ExcelJS } = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error("El Excel no tiene hojas.");
        if (sheet.rowCount > 20000 || sheet.columnCount > 150)
          throw new Error("El archivo supera 20.000 filas o 150 columnas.");
        rows = [];
        sheet.eachRow({ includeEmpty: true }, (row) => {
          const values: unknown[] = [];
          row.eachCell({ includeEmpty: true }, (cell, index) => {
            values[index - 1] = cell.value;
          });
          rows.push(values);
        });
      } else throw new Error("Elegí un archivo XLSX o CSV.");
      if (!rows.length || rows.length > 20000)
        throw new Error("El archivo está vacío o supera 20.000 filas.");
      const candidate = rows
        .slice(0, 100)
        .findIndex(
          (h) =>
            guess(h, /^(ean|ean13|gtin|codigo de barras|codigo barras?|barcode)$/) >= 0 &&
            guess(h, /precio|costo|price/) >= 0,
        );
      const index = candidate >= 0 ? candidate : 0;
      const h = rows[index];
      setHeaderRow(index + 1);
      setBarcode(guess(h, /^(ean|ean13|gtin|codigo de barras|codigo barras?|barcode)$/));
      setName(guess(h, /^(nombre|articulo|producto|descripcion|description)$/));
      const isCemafelu =
        guess(h, /^of\.?$/) >= 0 &&
        guess(h, /^precio\s+lista$/) >= 0 &&
        guess(h, /^precio\s+cdo\.?$/) >= 0;
      setUseCemafeluRule(isCemafelu);
      setPrice(
        guess(
          h,
          isCemafelu ? /^precio\s+lista$/ : /^(precio|precio unitario|costo|price|precio final)$/,
        ),
      );
      setStock(guess(h, /^stocks?(\s|$)/));
      setSupplier(file.name.replace(/\.(csv|xlsx)$/i, ""));
      setTable({ name: file.name, rows });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setBusy(false);
    }
  }
  function add() {
    if (
      !table ||
      !supplier.trim() ||
      barcode < 0 ||
      price < 0 ||
      barcode === price ||
      name === barcode ||
      name === price ||
      (stock >= 0 && [barcode, name, price].includes(stock))
    ) {
      setError("Indicá proveedor y columnas distintas para código de barras y precio.");
      return;
    }
    const found: Offer[] = [];
    let rejected = 0;
    table.rows.slice(headerRow).forEach((row, i) => {
      if (row.every((v) => !cellText(v).trim())) return;
      const b = barcodeValue(cellText(row[barcode]));
      const p = rowPrice(row);
      const stockValue = stock >= 0 ? cachedCellValue(row[stock]) : null;
      const amount =
        stockValue == null || String(stockValue).trim() === "" ? null : Number(stockValue);
      if (!b || p === null) {
        rejected++;
        return;
      }
      found.push({
        barcode: b,
        name: name >= 0 ? cellText(row[name]) : "",
        price: p,
        stock: amount !== null && Number.isFinite(amount) ? amount : null,
        supplier: supplier.trim(),
        file: table.name,
        row: headerRow + i + 1,
      });
    });
    if (!found.length) {
      setError(
        "No se encontraron filas con código de barras y precio válido. Revisá las columnas.",
      );
      return;
    }
    setBatches((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        supplier: supplier.trim(),
        file: table.name,
        offers: found,
        rejected,
      },
    ]);
    setTable(null);
    setError("");
  }
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-2xl">Comparar precios de proveedores</h2>
      <p className="text-sm text-muted-foreground">
        Cargá una lista por proveedor. Se usa la primera hoja del Excel. Se comparan únicamente
        artículos con el mismo código de barras; verificá que los precios tengan la misma moneda,
        IVA, unidad y condiciones. Las listas se guardan en esta pestaña del navegador hasta
        cerrarla.
      </p>
      <label className="block text-sm">
        Archivo de precios (.xlsx o .csv, hasta 10 MB)
        <Input
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={(e) => {
            void openFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {busy && <p role="status">Leyendo archivo…</p>}
      {storageError && (
        <p role="alert" className="text-destructive">
          {storageError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {table && (
        <div className="space-y-3 rounded border p-3">
          <p className="font-medium">Configurar {table.name}</p>
          <label className="block text-sm">
            Proveedor
            <Input value={supplier} maxLength={100} onChange={(e) => setSupplier(e.target.value)} />
          </label>
          <label className="block text-sm">
            Fila de encabezados
            <Input
              type="number"
              min={1}
              max={table.rows.length}
              value={headerRow}
              onChange={(e) => {
                setHeaderRow(Math.max(1, Math.min(table.rows.length, Number(e.target.value) || 1)));
                setBarcode(-1);
                setName(-1);
                setPrice(-1);
                setUseCemafeluRule(false);
                setStock(-1);
              }}
            />
          </label>
          {(
            [
              ["Código de barras / EAN", barcode, setBarcode],
              ["Descripción (opcional)", name, setName],
              ["Precio unitario", price, setPrice],
              ["Stock del proveedor (opcional)", stock, setStock],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="block text-sm">
              {label}
              <select
                className="block h-10 w-full rounded border bg-background px-2"
                value={value}
                disabled={label === "Precio unitario" && useCemafeluRule && canUseCemafeluRule}
                onChange={(e) => set(Number(e.target.value))}
              >
                <option value={-1}>Seleccionar columna</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {cellText(h) || `Columna ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {canUseCemafeluRule && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useCemafeluRule}
                onChange={(e) => {
                  setUseCemafeluRule(e.target.checked);
                  if (e.target.checked) setPrice(listCol);
                }}
              />
              Cemafelu: OF usa precio contado; el resto usa precio de lista
            </label>
          )}
          <div className="overflow-auto rounded border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">Fila</th>
                  <th className="p-2">EAN</th>
                  <th className="p-2">Descripción</th>
                  <th className="p-2">Precio leído</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.slice(headerRow, headerRow + 5).map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{headerRow + i + 1}</td>
                    <td className="p-2">{barcode >= 0 ? cellText(row[barcode]) : "—"}</td>
                    <td className="p-2">{name >= 0 ? cellText(row[name]) : "—"}</td>
                    <td className="p-2">
                      {price >= 0
                        ? rowPrice(row) === null
                          ? "Inválido"
                          : formatARS(rowPrice(row)!)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Revisá los encabezados y confirmá que el precio sea por una unidad. Los códigos deben
            contener 8, 12, 13 o 14 dígitos. Los precios escritos como texto usan formato argentino:
            1.234,56.
          </p>
          <Button onClick={add}>Agregar lista</Button>
        </div>
      )}
      <ManualOffer
        onAdd={(offer) =>
          setBatches((old) => [
            ...old,
            {
              id: crypto.randomUUID(),
              supplier: offer.supplier,
              file: offer.file,
              offers: [offer],
              rejected: 0,
            },
          ])
        }
      />
      {batches.length > 0 && (
        <>
          <h3 className="font-medium">Listas cargadas</h3>
          <ul className="space-y-2">
            {batches.map((b) => (
              <li className="flex flex-wrap items-center gap-3 text-sm" key={b.id}>
                <span>
                  {b.supplier} · {b.file}: {b.offers.length} filas válidas; {b.rejected} omitidas
                  por código o precio inválido
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBatches((old) => old.filter((x) => x.id !== b.id))}
                >
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            Buscar
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Artículo, código o proveedor"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyMultiple}
              onChange={(e) => setOnlyMultiple(e.target.checked)}
            />
            Solo artículos con dos o más proveedores
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            Excluir ofertas con stock cero o negativo (el stock desconocido se conserva)
          </label>
          <p className="text-sm">
            {groups.length} artículos encontrados. El precio menor se indica para cada código.
          </p>
          <div className="max-h-[36rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Artículo / EAN</th>
                  <th className="p-2">Proveedor y precio unitario</th>
                </tr>
              </thead>
              <tbody>
                {groups.slice(0, 500).map((g) => (
                  <tr key={g.barcode} className="border-t align-top">
                    <td className="p-2">
                      {g.rows[0].name || "Sin descripción"}
                      <br />
                      <span className="text-muted-foreground">
                        {g.barcode.startsWith("product:")
                          ? "Artículo sin EAN registrado"
                          : g.barcode}
                      </span>
                    </td>
                    <td className="p-2">
                      {g.rows.map((r, i) => (
                        <div
                          key={`${r.file}-${r.row}-${i}`}
                          className={
                            r.price === g.rows[0].price ? "font-semibold text-primary" : ""
                          }
                        >
                          {r.supplier}: {formatARS(r.price)}
                          {r.stock != null ? ` · Stock ${r.stock}` : " · Stock no informado"}{" "}
                          {r.price === g.rows[0].price ? "· menor precio cargado" : ""}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {r.name} · {r.file}
                            {r.row > 0 ? `, fila ${r.row}` : ""}
                            {r.conditions ? ` · ${r.conditions}` : ""}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {groups.length > 500 && (
              <p>Se muestran los primeros 500 resultados; usá el buscador para acotar.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

type CatalogMatch = { id: string; name: string; barcode: string | null };
function ManualOffer({ onAdd }: { onAdd: (offer: Offer) => void }) {
  const [description, setDescription] = useState("");
  const [term, setTerm] = useState("");
  const [chosen, setChosen] = useState<CatalogMatch | null>(null);
  const [provider, setProvider] = useState("");
  const [price, setPrice] = useState("");
  const [conditions, setConditions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["admin", "supplier-match", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const r = await applyAdminProductSearch(
        supabase.from("products").select("id,name,barcode").order("name").limit(20),
        term,
      );
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const cost = priceValue(price);
    if (!chosen || !provider.trim() || !description.trim() || cost === null) {
      setError("Completá proveedor, descripción, precio y confirmá un artículo de la tienda.");
      return;
    }
    onAdd({
      barcode: barcodeValue(chosen.barcode) || `product:${chosen.id}`,
      name: chosen.name,
      supplier: provider.trim(),
      price: cost,
      stock: null,
      file: file?.name ?? "Oferta cargada manualmente",
      row: 0,
      conditions: `${description.trim()}${conditions.trim() ? ` · ${conditions.trim()}` : ""}`,
    });
    setDescription("");
    setTerm("");
    setChosen(null);
    setPrice("");
    setConditions("");
  }
  return (
    <details className="rounded border p-4">
      <summary className="cursor-pointer font-medium">Agregar oferta de un PDF o imagen</summary>
      <div className="space-y-3 pt-3">
        <p className="text-sm text-muted-foreground">
          Abrí el archivo como referencia e ingresá los datos de la oferta. Buscá el artículo y
          confirmá la presentación exacta. La lectura del documento es manual.
        </p>
        <label className="block text-sm">
          Archivo de referencia (PDF o imagen)
          <Input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {preview && (
          <a className="text-sm underline" href={preview} target="_blank" rel="noopener noreferrer">
            Abrir archivo de referencia
          </a>
        )}
        <form onSubmit={addManual} className="space-y-3">
          <label className="block text-sm">
            Proveedor
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} maxLength={100} />
          </label>
          <label className="block text-sm">
            Descripción tal como figura en el folleto
            <Input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setTerm(e.target.value);
                setChosen(null);
              }}
              maxLength={160}
            />
          </label>
          <label className="block text-sm">
            Buscar en artículos de la tienda
            <Input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setChosen(null);
              }}
              placeholder="Buscá por marca y presentación"
            />
          </label>
          {q.isFetching && (
            <p role="status" className="text-sm">
              Buscando artículos…
            </p>
          )}
          {q.isError && <p role="alert">No se pudieron consultar los artículos.</p>}
          {!chosen && q.data && (
            <ul className="max-h-52 overflow-auto rounded border">
              {q.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full border-b p-2 text-left text-sm hover:bg-secondary"
                    onClick={() => {
                      setChosen(p);
                      setTerm("");
                    }}
                  >
                    {p.name} · {p.barcode || "Sin EAN"}
                  </button>
                </li>
              ))}
              {q.data.length === 0 && (
                <li className="p-2 text-sm">
                  No se encontraron artículos. Probá con menos palabras.
                </li>
              )}
            </ul>
          )}
          {chosen && (
            <p className="rounded border p-2 text-sm">
              Artículo seleccionado: <strong>{chosen.name}</strong> · {chosen.barcode || "Sin EAN"}{" "}
              <button type="button" className="underline" onClick={() => setChosen(null)}>
                Cambiar
              </button>
            </p>
          )}
          <label className="block text-sm">
            Precio efectivo por unidad (ARS)
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ej.: 2.649,00"
            />
          </label>
          <label className="block text-sm">
            Condiciones y vigencia
            <Input
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Ej.: compra mínima de 12 unidades, hasta el 06/11"
              maxLength={300}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Revisá que el importe corresponda a la misma unidad, IVA y presentación. Combos con
            regalos u otras condiciones deben evaluarse por separado.
          </p>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button type="submit">Confirmar artículo y agregar oferta</Button>
        </form>
      </div>
    </details>
  );
}
