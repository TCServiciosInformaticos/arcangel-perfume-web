import { useRef, useState } from "react";
import { Download, Upload, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { operations } from "@/lib/admin-operations-client";
import { prepareProductPreview } from "@/lib/product-excel-preview";
import { AdminPager } from "@/components/admin-pager";
import { Input } from "@/components/ui/input";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ExcelProduct, ProductUpdate } from "@/lib/product-excel";

async function currentProducts() {
  const all: ExcelProduct[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,description,article_code,price,stock,is_active,updated_at,subcategory_id,category:categories(name)",
      )
      .order("id")
      .range(start, start + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return all;
  }
}

export function ProductExcelControls() {
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [updates, setUpdates] = useState<ProductUpdate[] | null>(null);
  const [products, setProducts] = useState<ExcelProduct[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const byId = new Map(products.map((p) => [p.id, p]));
  const visibleUpdates = (updates ?? []).filter((u) =>
    `${u.name ?? byId.get(u.id)?.name ?? ""} ${u.article_code ?? ""}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );

  async function exportFile() {
    setBusy(true);
    setError("");
    try {
      const [module, all, brands] = await Promise.all([
        import("@/lib/product-excel"),
        currentProducts(),
        supabase.from("subcategories").select("id,name"),
      ]);
      if (brands.error) throw brands.error;
      const buffer = await module.exportProductExcel(all, brands.data ?? []);
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(buffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `El-Arcangel-articulos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${all.length} artículos exportados correctamente`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setBusy(false);
    }
  }

  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 10 * 1024 * 1024) {
        throw new Error("Seleccioná un archivo .xlsx de hasta 10 MB.");
      }
      const [module, all, buffer] = await Promise.all([
        import("@/lib/product-excel"),
        currentProducts(),
        file.arrayBuffer(),
      ]);
      const changes = await module.readProductExcel(buffer, all);
      if (!changes.length) {
        toast.info("El archivo no contiene cambios respecto a la base de datos.");
        return;
      }
      setProducts(all);
      setUpdates(changes);
      setSelected(new Set(changes.map((u) => u.id)));
      setSearch("");
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el Excel.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function save() {
    if (!updates || selected.size === 0) return;
    setError("");
    setBusy(true);
    try {
      const { data, error: failure } = await operations.rpc("admin_apply_product_preview", {
        rows: prepareProductPreview(updates, products, selected),
      });
      if (failure) throw failure;
      await qc.invalidateQueries({ queryKey: ["admin", "products"] });
      await qc.invalidateQueries({ queryKey: ["home"] });
      await qc.invalidateQueries({ queryKey: ["catalog"] });
      await qc.invalidateQueries({ queryKey: ["product"] });
      toast.success(`${data ?? selected.size} artículo(s) actualizado(s) correctamente`);
      setUpdates(null);
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "No se pudo guardar. No se aplicaron cambios.",
      );
    } finally {
      setBusy(false);
    }
  }

  const textChangesCount =
    updates?.filter((u) => {
      const p = byId.get(u.id);
      return (
        p &&
        ((u.name !== undefined && u.name !== p.name) ||
          (u.description !== undefined && u.description !== (p.description ?? "")))
      );
    }).length ?? 0;

  const codeChangesCount =
    updates?.filter(
      (u) =>
        u.article_code !== undefined && u.article_code !== (byId.get(u.id)?.article_code ?? null),
    ).length ?? 0;

  const priceChangesCount =
    updates?.filter((u) => {
      const p = byId.get(u.id);
      return p && Number(p.price) !== Number(u.price);
    }).length ?? 0;

  const stockChangesCount =
    updates?.filter((u) => {
      const p = byId.get(u.id);
      return p && p.stock !== u.stock;
    }).length ?? 0;

  const activeChangesCount =
    updates?.filter((u) => {
      const p = byId.get(u.id);
      return p && p.is_active !== u.is_active;
    }).length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={busy} onClick={exportFile}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Exportar Excel ({products.length > 0 ? products.length : "todos los"} artículos)
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Importar Excel
        </Button>
        <input
          ref={input}
          type="file"
          accept=".xlsx"
          aria-label="Archivo Excel de artículos"
          className="hidden"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Exportá el archivo, editá descripción del artículo, descripción detallada, código, precio,
        saldo de stock y Visible (Sí/No), e importalo para revisar y aplicar los cambios. El saldo
        reemplaza el stock actual.
      </p>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p className="whitespace-pre-line">{error}</p>
        </div>
      )}

      <Dialog
        open={updates !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setUpdates(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Confirmar importación de Excel
            </DialogTitle>
            <DialogDescription>
              Se detectaron <strong>{updates?.length}</strong> artículo(s) con cambios. Revisá los
              cambios de descripción, código, precio, saldo de stock y visibilidad antes de
              aplicarlos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs">
            {codeChangesCount > 0 && (
              <Badge variant="secondary">Códigos modificados: {codeChangesCount}</Badge>
            )}
            {textChangesCount > 0 && (
              <Badge variant="secondary">Descripciones modificadas: {textChangesCount}</Badge>
            )}
            {priceChangesCount > 0 && (
              <Badge variant="secondary">Precios modificados: {priceChangesCount}</Badge>
            )}
            {stockChangesCount > 0 && (
              <Badge variant="secondary">Stock modificado: {stockChangesCount}</Badge>
            )}
            {activeChangesCount > 0 && (
              <Badge variant="secondary">Visibilidad modificada: {activeChangesCount}</Badge>
            )}
          </div>

          <p className="text-sm">
            Seleccionados: {selected.size} de {updates?.length}. Solo se aplicarán los artículos
            tildados. Si alguno cambió en la web desde esta revisión, se cancelará toda la
            importación.
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 text-sm">
              Buscar en la vista previa
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(new Set(updates?.map((u) => u.id)))}
            >
              Seleccionar todos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Quitar selección
            </Button>
          </div>
          {error && (
            <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Precios en cero: {updates?.filter((u) => selected.has(u.id) && u.price === 0).length} ·
            Saldo en cero: {updates?.filter((u) => selected.has(u.id) && u.stock === 0).length}. El
            saldo de Excel reemplaza el existente.
          </p>
          <AdminPager
            page={page}
            total={visibleUpdates.length}
            size={50}
            onPage={setPage}
            busy={busy}
          />
          <div className="max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-xs text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border text-left">
                  <th className="p-2.5">Aplicar</th>
                  <th className="p-2.5">Artículo</th>
                  <th className="p-2.5">Precio (ARS)</th>
                  <th className="p-2.5">Saldo de stock</th>
                  <th className="p-2.5">Visible</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleUpdates.slice(page * 50, page * 50 + 50).map((u) => {
                  const p = byId.get(u.id);
                  const priceChanged = p && Number(p.price) !== Number(u.price);
                  const stockChanged = p && p.stock !== u.stock;
                  const activeChanged = p && p.is_active !== u.is_active;

                  return (
                    <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Aplicar cambios de ${p?.name ?? u.id}`}
                          disabled={busy}
                          checked={selected.has(u.id)}
                          onChange={(e) =>
                            setSelected((old) => {
                              const next = new Set(old);
                              if (e.target.checked) next.add(u.id);
                              else next.delete(u.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="p-2.5 max-w-sm whitespace-pre-wrap break-words">
                        {u.name !== undefined && u.name !== p?.name ? (
                          <>
                            <div className="text-muted-foreground line-through">{p?.name}</div>
                            <div className="font-medium text-primary">{u.name}</div>
                          </>
                        ) : (
                          <div className="font-medium">{p?.name ?? u.id}</div>
                        )}
                        {u.article_code !== undefined &&
                          u.article_code !== (p?.article_code ?? null) && (
                            <div className="mt-1 text-xs">
                              Código:{" "}
                              <span className="line-through text-muted-foreground">
                                {p?.article_code || "Sin código"}
                              </span>{" "}
                              → {u.article_code || "Sin código"}
                            </div>
                          )}
                        {u.description !== undefined &&
                          u.description !== (p?.description ?? "") && (
                            <div className="mt-2 text-xs">
                              <div className="text-muted-foreground line-through">
                                {p?.description || "Sin descripción detallada"}
                              </div>
                              <div>{u.description || "Sin descripción detallada"}</div>
                            </div>
                          )}
                      </td>
                      <td className="p-2.5">
                        {priceChanged ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-muted-foreground line-through">
                              {formatARS(p?.price ?? 0)}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="font-semibold text-primary">{formatARS(u.price)}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatARS(u.price)}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {stockChanged ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <span className="text-muted-foreground">{p?.stock ?? 0}</span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{u.stock}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{u.stock}</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {activeChanged ? (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="text-muted-foreground">
                              {p?.is_active ? "Sí" : "No"}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span
                              className={`font-medium ${
                                u.is_active ? "text-primary" : "text-destructive"
                              }`}
                            >
                              {u.is_active ? "Sí" : "No"}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {u.is_active ? "Sí" : "No"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" disabled={busy} onClick={() => setUpdates(null)}>
              Cancelar
            </Button>
            <Button disabled={busy || selected.size === 0} onClick={save}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Aplicar cambios ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
