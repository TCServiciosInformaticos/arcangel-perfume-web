import { useRef, useState } from "react";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { ExcelProduct, ProductUpdate } from "@/lib/product-excel";

async function currentProducts() {
  const all: ExcelProduct[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from("products").select("id,name,price,stock,is_active,subcategory_id,category:categories(name)").order("id").range(start, start + 999);
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
  async function exportFile() {
    setBusy(true); setError("");
    try {
      const [module, all, brands] = await Promise.all([import("@/lib/product-excel"), currentProducts(), supabase.from("subcategories").select("id,name")]);
      if (brands.error) throw brands.error;
      const buffer = await module.exportProductExcel(all, brands.data ?? []);
      const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `El-Arcangel-articulos-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${all.length} artículos exportados`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo exportar."); }
    finally { setBusy(false); }
  }
  async function readFile(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 10 * 1024 * 1024) throw new Error("Seleccioná un archivo .xlsx de hasta 10 MB.");
      const [module, all, buffer] = await Promise.all([import("@/lib/product-excel"), currentProducts(), file.arrayBuffer()]);
      const changes = await module.readProductExcel(buffer, all);
      if (!changes.length) { toast.info("El archivo no contiene cambios"); return; }
      setProducts(all); setUpdates(changes);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el Excel."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function save() {
    if (!updates) return;
    setBusy(true);
    try {
      const { data, error: failure } = await supabase.rpc("update_products_from_excel", { rows: updates });
      if (failure) throw failure;
      await qc.invalidateQueries();
      toast.success(`${data} artículos actualizados`); setUpdates(null);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar. No se aplicaron cambios."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={exportFile}><Download className="size-4" /> Exportar Excel</Button>
      <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Importar Excel</Button>
      <input ref={input} type="file" accept=".xlsx" aria-label="Archivo Excel de artículos" className="hidden" onChange={e => void readFile(e.target.files?.[0])} />
    </div>
    {error && <p role="alert" className="mt-3 whitespace-pre-line text-sm text-destructive">{error}</p>}
    <Dialog open={updates !== null} onOpenChange={open => { if (!open && !busy) setUpdates(null); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Confirmar importación</DialogTitle><DialogDescription>{updates?.length} artículos con cambios de precio, saldo de stock o visibilidad. Los nombres, fotos y categorías se conservan.</DialogDescription></DialogHeader>
        <div className="max-h-80 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="p-2">Artículo</th><th className="p-2">Precio (ARS)</th><th className="p-2">Stock</th><th className="p-2">Activo</th></tr></thead><tbody>{updates?.map(u => { const p = products.find(p => p.id === u.id); return <tr key={u.id} className="border-b border-border"><td className="p-2">{p?.name}</td><td className="p-2">{p?.price} → {u.price}</td><td className="p-2">{p?.stock} → {u.stock}</td><td className="p-2">{p?.is_active ? "Sí" : "No"} → {u.is_active ? "Sí" : "No"}</td></tr>; })}</tbody></table></div>
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setUpdates(null)}>Cancelar</Button><Button disabled={busy} onClick={save}>{busy && <Loader2 className="size-4 animate-spin" />} Aplicar cambios</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}