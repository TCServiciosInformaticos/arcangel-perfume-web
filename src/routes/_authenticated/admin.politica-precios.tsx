import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Percent, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { collectPages } from "@/lib/catalog-products";
import { adminPageRange, adminPageCount } from "@/lib/admin-pagination";
import { previewPrice, validatePercentage, type PolicyProduct, type PricePolicyMode } from "@/lib/price-policy";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Filters = { category: string; brand: string; type: string; status: string; search: string };
const initialFilters: Filters = { category: "all", brand: "all", type: "all", status: "all", search: "" };
const columns = "id,name,price,compare_at_price,updated_at,is_active,category_id,subcategory_id,product_type_id";

function productRequest(filters: Filters) {
  let request = supabase.from("products").select(columns, { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (filters.category !== "all") request = request.eq("category_id", filters.category);
  if (filters.brand !== "all") request = request.eq("subcategory_id", filters.brand);
  if (filters.type !== "all") request = request.eq("product_type_id", filters.type);
  if (filters.status !== "all") request = request.eq("is_active", filters.status === "active");
  if (filters.search.trim()) request = request.ilike("name", `%${filters.search.trim().replace(/[%_\\]/g, "")}%`);
  return request;
}

const classificationQuery = queryOptions({
  queryKey: ["admin", "price-policy-classification"],
  queryFn: async () => {
    const [categories, brands, types] = await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("subcategories").select("id,name,category_id").order("name"),
      supabase.from("product_types").select("id,name,subcategory_id").order("name"),
    ]);
    if (categories.error) throw categories.error;
    if (brands.error) throw brands.error;
    if (types.error) throw types.error;
    return { categories: categories.data ?? [], brands: brands.data ?? [], types: types.data ?? [] };
  },
});

function productsQuery(filters: Filters, page: number) {
  return queryOptions({
    queryKey: ["admin", "price-policy-products", filters, page],
    queryFn: async () => {
      const range = adminPageRange(page);
      const { data, error, count } = await productRequest(filters).range(range.from, range.to);
      if (error) throw error;
      return { products: (data ?? []) as PolicyProduct[], total: count ?? 0 };
    },
  });
}

export const Route = createFileRoute("/_authenticated/admin/politica-precios")({
  head: () => ({ meta: [
    { title: "Política de Precios · Panel El Arcángel" },
    { name: "description", content: "Actualización de precios por categoría, marca y tipo de producto en El Arcángel." },
    { property: "og:title", content: "Política de Precios — El Arcángel" },
    { property: "og:description", content: "Administración de aumentos y descuentos del catálogo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(classificationQuery),
    context.queryClient.ensureQueryData(productsQuery(initialFilters, 1)),
  ]),
  component: PricePolicy,
});

function PricePolicy() {
  const { data: classification } = useSuspenseQuery(classificationQuery);
  const qc = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, PolicyProduct>>(new Map());
  const [mode, setMode] = useState<PricePolicyMode>("increase");
  const [percentage, setPercentage] = useState("");
  const [adjustCompare, setAdjustCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ rows: PolicyProduct[]; percentage: number; mode: PricePolicyMode; adjustCompare: boolean } | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const products = useQuery(productsQuery(filters, page));
  const rows = products.data?.products ?? [];
  const total = products.data?.total ?? 0;
  const pages = adminPageCount(total);
  const brands = classification.brands.filter((brand) => filters.category === "all" || brand.category_id === filters.category);
  const types = classification.types.filter((type) => filters.brand !== "all" ? type.subcategory_id === filters.brand : brands.some((brand) => brand.id === type.subcategory_id));
  const categoryName = (id: string | null) => classification.categories.find((c) => c.id === id)?.name ?? "Sin categoría";
  const brandName = (id: string | null) => classification.brands.find((b) => b.id === id)?.name ?? "Sin marca";

  function changeFilters(next: Filters) {
    setFilters(next); setPage(1); setSelected(new Map()); setError("");
  }
  function toggle(product: PolicyProduct, checked: boolean) {
    setSelected((previous) => { const next = new Map(previous); if (checked) next.set(product.id, product); else next.delete(product.id); return next; });
  }
  async function selectAll() {
    setBusy(true); setError("");
    try {
      const all = await collectPages<PolicyProduct>(async (from, to) => {
        const { data, error: failure } = await productRequest(filters).range(from, to);
        if (failure) throw failure;
        return (data ?? []) as PolicyProduct[];
      });
      setSelected(new Map(all.map((product) => [product.id, product])));
    } catch { setError("No se pudieron seleccionar los artículos. Reintentá."); }
    finally { setBusy(false); }
  }
  function review() {
    setError("");
    try {
      const percent = validatePercentage(percentage, mode);
      if (!selected.size) throw new Error("Seleccioná al menos un artículo.");
      const selection = [...selected.values()];
      selection.forEach((product) => previewPrice(product, percent, mode, adjustCompare));
      setPreviewPage(1);
      setConfirmation({ rows: selection, percentage: percent, mode, adjustCompare });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Revisá los valores."); }
  }
  async function apply() {
    if (!confirmation || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: failure } = await supabase.rpc("apply_price_policy", {
        p_rows: confirmation.rows.map((product) => ({ id: product.id, updated_at: product.updated_at })),
        p_percentage: confirmation.percentage, p_mode: confirmation.mode, p_adjust_compare: confirmation.adjustCompare,
      });
      if (failure) throw failure;
      setConfirmation(null); setSelected(new Map());
      await Promise.all(["admin", "catalog", "home", "product"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(`Política aplicada: ${data} artículo(s) actualizado(s).`);
    } catch (failure) {
      setConfirmation(null);
      setSelected(new Map());
      void products.refetch();
      setError(failure instanceof Error ? failure.message : (failure as { message?: string })?.message ?? "No se pudieron actualizar los precios. No se aplicaron cambios.");
    } finally { setBusy(false); }
  }

  let validPercentage: number | null = null;
  try { validPercentage = validatePercentage(percentage, mode); } catch { /* input may be incomplete */ }
  const previewRows = confirmation?.rows.slice((previewPage - 1) * 24, previewPage * 24) ?? [];
  const allPageSelected = rows.length > 0 && rows.every((product) => selected.has(product.id));

  return <div className="min-w-0 text-foreground">
    <h1 className="font-serif text-3xl">Política de Precios</h1>
    <fieldset disabled={busy} className="mt-6 grid gap-4 border-y border-border py-5 sm:grid-cols-2 xl:grid-cols-4">
      <Filter label="Categoría" value={filters.category} options={classification.categories} onChange={(category) => changeFilters({ ...filters, category, brand: "all", type: "all" })} />
      <Filter label="Marca" value={filters.brand} options={brands.map((brand) => ({ id: brand.id, name: `${brand.name} · ${categoryName(brand.category_id)}` }))} onChange={(brand) => changeFilters({ ...filters, brand, type: "all" })} />
      <Filter label="Tipo de producto" value={filters.type} options={types} onChange={(type) => changeFilters({ ...filters, type })} />
      <Filter label="Estado" value={filters.status} options={[{ id: "active", name: "Activos" }, { id: "inactive", name: "Pausados" }]} onChange={(status) => changeFilters({ ...filters, status })} />
      <form className="flex items-end gap-2 sm:col-span-2" onSubmit={(event) => { event.preventDefault(); changeFilters({ ...filters, search }); }}>
        <div className="flex-1"><Label htmlFor="policy-search">Artículo</Label><Input id="policy-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" /></div>
        <Button type="submit" size="icon" variant="outline" aria-label="Buscar artículos" title="Buscar artículos"><Search className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Limpiar filtros" title="Limpiar filtros" onClick={() => { setSearch(""); changeFilters(initialFilters); }}><X className="size-4" /></Button>
      </form>
    </fieldset>

    <fieldset disabled={busy} className="flex flex-wrap items-end gap-4 py-5">
      <div><Label>Operación</Label><div className="mt-1 flex gap-1"><Button variant={mode === "increase" ? "default" : "outline"} onClick={() => setMode("increase")}>Aumento</Button><Button variant={mode === "discount" ? "default" : "outline"} onClick={() => setMode("discount")}>Descuento</Button></div></div>
      <div className="w-40"><Label htmlFor="policy-percent">Porcentaje (%)</Label><Input id="policy-percent" inputMode="decimal" value={percentage} onChange={(event) => setPercentage(event.target.value)} placeholder="Ej. 15" /></div>
      <label className="flex max-w-xs items-center gap-2 pb-2 text-sm"><Checkbox checked={adjustCompare} onCheckedChange={(checked) => setAdjustCompare(checked === true)} />Ajustar también el precio anterior de las ofertas</label>
      <Button className="ml-auto" disabled={!selected.size || validPercentage === null} onClick={review}><Percent className="size-4" /> Revisar cambios ({selected.size})</Button>
    </fieldset>
    {error && <p role="alert" className="mb-4 border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{total} artículos · {selected.size} seleccionados</span>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || products.isFetching || !total} onClick={selectAll}>{busy && <Loader2 className="size-4 animate-spin" />}Seleccionar todos los resultados ({total})</Button><Button variant="ghost" size="sm" disabled={busy || !selected.size} onClick={() => setSelected(new Map())}>Quitar selección</Button></div>
    </div>
    <div className="overflow-x-auto rounded-md border border-border bg-card" aria-busy={products.isFetching}>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-left text-muted-foreground"><tr>
          <th className="p-3"><Checkbox aria-label="Seleccionar esta página" checked={allPageSelected} disabled={busy || !rows.length} onCheckedChange={(checked) => setSelected((previous) => { const next = new Map(previous); rows.forEach((product) => { if (checked === true) next.set(product.id, product); else next.delete(product.id); }); return next; })} /></th>
          <th className="p-3">Artículo</th><th className="p-3">Marca</th><th className="p-3 text-right">Precio actual</th><th className="p-3 text-right">Nuevo precio</th>
        </tr></thead>
        <tbody className="divide-y divide-border">{rows.map((product) => {
          let next: number | null = null;
          try { if (validPercentage !== null) next = previewPrice(product, validPercentage, mode, adjustCompare).price; } catch { /* invalid value is blocked at confirmation */ }
          return <tr key={product.id} className={selected.has(product.id) ? "bg-primary/5" : ""}>
            <td className="p-3"><Checkbox aria-label={`Seleccionar ${product.name}`} checked={selected.has(product.id)} disabled={busy} onCheckedChange={(checked) => toggle(product, checked === true)} /></td>
            <td className="min-w-52 p-3 font-medium">{product.name}<div className="text-xs font-normal text-muted-foreground">{categoryName(product.category_id)} · {product.is_active ? "Activo" : "Pausado"}</div></td>
            <td className="p-3 text-muted-foreground">{brandName(product.subcategory_id)}</td>
            <td className="whitespace-nowrap p-3 text-right tabular-nums">{formatARS(product.price)}</td>
            <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums text-primary">{next === null ? "—" : formatARS(next)}</td>
          </tr>;
        })}</tbody>
      </table>
      {products.isLoading && <p className="p-6 text-center text-muted-foreground">Cargando artículos…</p>}
      {products.isError && <div className="p-6 text-center text-destructive">No se pudieron cargar los artículos. <Button variant="outline" onClick={() => void products.refetch()}>Reintentar</Button></div>}
      {!products.isLoading && !products.isError && !rows.length && <p className="p-6 text-center text-muted-foreground">No hay artículos con estos filtros.</p>}
    </div>
    <Pager page={page} pages={pages} disabled={busy || products.isFetching} onChange={setPage} />

    <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open && !busy) setConfirmation(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Confirmar política de precios</DialogTitle><DialogDescription>{confirmation?.mode === "increase" ? "Aumento" : "Descuento"} del {confirmation?.percentage}% sobre {confirmation?.rows.length} artículos. Precios redondeados hacia arriba al peso entero. Stock y visibilidad no cambian.</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">{confirmation?.adjustCompare ? "Se ajusta también el precio anterior de las ofertas." : "Se conserva el precio anterior, salvo que deje de superar al nuevo precio."}</p>
        <div className="max-h-80 overflow-auto rounded-md border border-border"><table className="w-full text-sm"><thead className="sticky top-0 bg-secondary text-left"><tr><th className="p-3">Artículo</th><th className="p-3 text-right">Actual</th><th className="p-3 text-right">Nuevo</th></tr></thead><tbody className="divide-y divide-border">{confirmation && previewRows.map((product) => {
          const next = previewPrice(product, confirmation.percentage, confirmation.mode, confirmation.adjustCompare);
          return <tr key={product.id}><td className="p-3">{product.name}</td><td className="whitespace-nowrap p-3 text-right">{formatARS(product.price)}{product.compare_at_price !== null && <div className="text-xs text-muted-foreground">Anterior: {formatARS(product.compare_at_price)}</div>}</td><td className="whitespace-nowrap p-3 text-right font-medium text-primary">{formatARS(next.price)}{product.compare_at_price !== null && <div className="text-xs text-muted-foreground">Anterior: {next.compare_at_price === null ? "Sin oferta" : formatARS(next.compare_at_price)}</div>}</td></tr>;
        })}</tbody></table></div>
        <Pager page={previewPage} pages={adminPageCount(confirmation?.rows.length ?? 0)} disabled={busy} onChange={setPreviewPage} />
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button><Button disabled={busy} onClick={apply}>{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}{busy ? "Actualizando…" : "Confirmar y actualizar precios"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{options.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}

function Pager({ page, pages, disabled, onChange }: { page: number; pages: number; disabled: boolean; onChange: (page: number) => void }) {
  return <nav aria-label="Páginas de política de precios" className="mt-4 flex items-center justify-end gap-3"><Button size="icon" variant="outline" aria-label="Página anterior" title="Página anterior" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="size-4" /></Button><span className="text-sm tabular-nums">Página {page} de {pages}</span><Button size="icon" variant="outline" aria-label="Página siguiente" title="Página siguiente" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="size-4" /></Button></nav>;
}