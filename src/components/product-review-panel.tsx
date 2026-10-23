import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { collectPages } from "@/lib/catalog-products";
import {
  checkImageBatch,
  currentImageCheck,
  productImageUrls,
  reviewIssues,
  type ImageChecks,
  type ReviewIssue,
  type ReviewProduct,
} from "@/lib/product-review";
import { ProductImage } from "@/components/product-image";
import { AdminPager } from "@/components/admin-pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatARS } from "@/lib/format";

const LABELS: Record<ReviewIssue, string> = {
  all: "Todos los artículos",
  missing: "Sin foto principal",
  failed: "Fotos que no responden",
  unchecked: "Fotos sin comprobar",
  code: "Sin código",
  price: "Precio en cero",
  stock: "Stock en cero",
};
const SIZE = 25;
export function ProductReviewPanel({ onEdit }: { onEdit: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["admin", "product-image-checks", user?.id];
  const [checks, setChecks] = useState<ImageChecks>(() => qc.getQueryData(key) ?? {});
  const [brand, setBrand] = useState("");
  const [term, setTerm] = useState("");
  const [issue, setIssue] = useState<ReviewIssue>("all");
  const [visibility, setVisibility] = useState("all");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    qc.setQueryData(key, checks);
  }, [checks, qc, user?.id]);
  const q = useQuery({
    queryKey: ["admin", "product-review", user?.id],
    staleTime: 0,
    queryFn: async () => {
      const [products, brands] = await Promise.all([
        collectPages<ReviewProduct>(async (from, to) => {
          const r = await supabase
            .from("products")
            .select(
              "id,name,article_code,subcategory_id,price,stock,is_active,image_urls,thumbnail_url",
            )
            .order("id")
            .range(from, to);
          if (r.error) throw r.error;
          return r.data ?? [];
        }),
        supabase.from("subcategories").select("id,name").order("name"),
      ]);
      if (brands.error) throw brands.error;
      return { products, brands: brands.data ?? [] };
    },
  });
  const brands = useMemo(
    () => new Map(q.data?.brands.map((b) => [b.id, b.name]) ?? []),
    [q.data?.brands],
  );
  const names = [...new Set(brands.values())].sort((a, b) => a.localeCompare(b, "es"));
  const filtered = (q.data?.products ?? []).filter(
    (p) =>
      (!brand || brands.get(p.subcategory_id ?? "") === brand) &&
      (!term.trim() ||
        `${p.name} ${p.article_code ?? ""}`
          .toLocaleLowerCase("es")
          .includes(term.trim().toLocaleLowerCase("es"))) &&
      (visibility === "all" || p.is_active === (visibility === "visible")) &&
      (issue === "all" || reviewIssues(p, checks).includes(issue)),
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / SIZE) - 1));
  const rows = filtered.slice(safePage * SIZE, (safePage + 1) * SIZE);
  async function scan(products: ReviewProduct[]) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    const urls = [...new Set(products.flatMap(productImageUrls))];
    setProgress({ done: 0, total: urls.length });
    setBusy(true);
    try {
      await checkImageBatch(urls, abort.signal, (url, check) => {
        setChecks((previous) => ({ ...previous, [url]: check }));
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      });
    } finally {
      controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function stop() {
    controller.current?.abort();
    setBusy(false);
  }
  return (
    <section
      className="my-6 space-y-4 rounded-xl border bg-card p-4 sm:p-6"
      aria-label="Revisión de artículos"
    >
      <h2 className="font-serif text-2xl">Revisión de artículos</h2>
      <p className="text-sm text-muted-foreground">
        Incluye artículos visibles y ocultos. Los precios y saldos en cero son avisos para revisar;
        no se modifican automáticamente. Las fotos se comprueban desde este navegador, con dos
        intentos si fallan.
      </p>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm">
          Buscar artículo
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Descripción o código"
          />
        </label>
        <label className="text-sm">
          Marca
          <select
            className="mt-1 h-10 w-full rounded border bg-background px-2"
            aria-label="Marca"
            value={brand}
            onChange={(e) => {
              setBrand(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todas las marcas</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Problema
          <select
            className="mt-1 h-10 w-full rounded border bg-background px-2"
            aria-label="Problema"
            value={issue}
            onChange={(e) => {
              setIssue(e.target.value as ReviewIssue);
              setPage(0);
            }}
          >
            {Object.entries(LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Visibilidad
          <select
            className="mt-1 h-10 w-full rounded border bg-background px-2"
            aria-label="Visibilidad"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Visibles y ocultos</option>
            <option value="visible">Visibles</option>
            <option value="hidden">Ocultos</option>
          </select>
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || q.isFetching || !rows.some((p) => productImageUrls(p).length)}
          onClick={() => scan(rows)}
        >
          Comprobar fotos de esta página
        </Button>
        {busy && (
          <Button variant="outline" onClick={stop}>
            Detener comprobación
          </Button>
        )}
        <Button variant="outline" disabled={busy || q.isFetching} onClick={() => q.refetch()}>
          Actualizar artículos
        </Button>
      </div>
      <p role="status" className="text-sm">
        {busy
          ? `Comprobando fotos: ${progress.done} de ${progress.total}.`
          : progress.total
            ? `Última comprobación: ${progress.done} de ${progress.total} fotos.`
            : "Las fotos todavía no se comprobaron. Revisá por páginas para evitar cargar todo el catálogo de imágenes."}
      </p>
      <p className="text-xs text-muted-foreground">
        “No responde” requiere revisión: puede deberse al enlace, a la conexión o a una restricción
        del proveedor. Los resultados duran 30 minutos en esta sesión del panel.
      </p>
      {q.isPending ? (
        <p>Cargando artículos para revisión…</p>
      ) : q.isError ? (
        <p role="alert">No se pudieron cargar los artículos. Probá Actualizar artículos.</p>
      ) : (
        <>
          <AdminPager
            page={safePage}
            total={filtered.length}
            size={SIZE}
            onPage={setPage}
            busy={busy}
          />
          {!rows.length && <p>No hay artículos para estos filtros.</p>}
          <ul className="space-y-3">
            {rows.map((p) => {
              const issues = reviewIssues(p, checks);
              const urls = productImageUrls(p);
              return (
                <li key={p.id} className="flex flex-wrap gap-4 rounded-lg border p-3">
                  <ProductImage
                    src={p.thumbnail_url}
                    fallbackSrc={p.image_urls?.[0]}
                    alt={p.name}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded object-contain"
                  />
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Código: {p.article_code || "Sin código"} ·{" "}
                      {brands.get(p.subcategory_id ?? "") || "Sin marca"} ·{" "}
                      {p.is_active ? "Visible" : "Oculto"}
                    </p>
                    <p className="text-sm">
                      {formatARS(p.price)} · Stock: {p.stock}
                    </p>
                    <p className="mt-1 text-sm">
                      {issues.length
                        ? issues.map((i) => LABELS[i]).join(" · ")
                        : "Sin observaciones en esta revisión"}
                    </p>
                    {urls.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary>Ver estado de las fotos ({urls.length})</summary>
                        <ul className="space-y-1">
                          {urls.map((url, i) => {
                            const check = currentImageCheck(checks, url);
                            return (
                              <li key={url} className="break-all">
                                Foto {i + 1}:{" "}
                                {check?.status === "ok"
                                  ? "Abre correctamente"
                                  : check?.status === "failed"
                                    ? "No responde tras dos intentos"
                                    : "Sin comprobar"}
                                {check &&
                                  ` · ${new Date(check.checkedAt).toLocaleTimeString("es-AR")}`}
                                <br />
                                <span className="text-muted-foreground">{url}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <Button variant="outline" disabled={busy} onClick={() => onEdit(p.id)}>
                      Editar artículo
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || !urls.length}
                      onClick={() => scan([p])}
                    >
                      Recomprobar fotos
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
