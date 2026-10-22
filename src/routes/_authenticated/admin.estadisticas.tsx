import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  RefreshCw,
  ShoppingBag,
  Package,
  Wallet,
  ReceiptText,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatARS } from "@/lib/format";
import { orderStatusLabels } from "@/lib/order-lifecycle";
import {
  buenosAiresDate,
  shiftDate,
  previousSalesPeriod,
  validateSalesDates,
  salesChange,
  rankSalesProducts,
  type SalesStatistics,
  type SalesProduct,
  type Breakdown,
} from "@/lib/sales-statistics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export const Route = createFileRoute("/_authenticated/admin/estadisticas")({
  component: SalesDashboard,
});
const field = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const integer = (n: number) => n.toLocaleString("es-AR");
const shortDate = (s: string) => s.slice(0, 10).split("-").reverse().join("/");
function SalesDashboard() {
  const { isAdmin, modules, user } = useAuth();
  const canRead = isAdmin || modules.includes("estadisticas");
  const [today] = useState(() => buenosAiresDate());
  const [draft, setDraft] = useState(() => ({
    from: shiftDate(today, -29),
    to: today,
    category: "",
    brand: "",
  }));
  const [filters, setFilters] = useState(draft);
  const [validation, setValidation] = useState(""),
    [exportError, setExportError] = useState(""),
    [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<"best" | "least" | "none" | "stock">("best"),
    [metric, setMetric] = useState<"units" | "revenue">("units"),
    [threshold, setThreshold] = useState(5),
    [page, setPage] = useState(0);
  const lookups = useQuery({
    queryKey: ["admin", "sales-lookups", user?.id],
    enabled: canRead,
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("categories").select("id,name").order("sort_order"),
        supabase.from("subcategories").select("id,name,category_id").order("name"),
      ]);
      if (c.error || b.error) throw new Error("No se pudieron cargar categorías y marcas.");
      return { categories: c.data ?? [], brands: b.data ?? [] };
    },
  });
  const report = useQuery({
    queryKey: ["admin", "sales-statistics", user?.id, filters],
    enabled: canRead,
    staleTime: 60000,
    retry: false,
    queryFn: async () => {
      const r = await supabase.rpc("admin_sales_statistics", {
        p_from: filters.from,
        p_to: filters.to,
        p_category: filters.category || undefined,
        p_brand: filters.brand || undefined,
      });
      if (r.error) throw new Error(r.error.message);
      return r.data as unknown as SalesStatistics;
    },
  });
  const data = report.data;
  const products = useMemo(
    () => rankSalesProducts(data?.products ?? [], mode, metric, threshold, filters.to),
    [data, mode, metric, threshold, filters.to],
  );
  const previous = previousSalesPeriod(filters.from, filters.to),
    scoped = !!(filters.category || filters.brand);
  const maxPage = Math.max(0, Math.ceil(products.length / 20) - 1),
    currentPage = Math.min(page, maxPage);
  const categoryName =
      lookups.data?.categories.find((c) => c.id === filters.category)?.name ?? "Todas",
    brandName = lookups.data?.brands.find((b) => b.id === filters.brand)?.name ?? "Todas";
  function apply() {
    const error = validateSalesDates(draft.from, draft.to);
    setValidation(error);
    if (!error) {
      setFilters({ ...draft });
      setPage(0);
    }
  }
  function quick(days: number) {
    const next = {
      ...draft,
      from: days === 0 ? `${today.slice(0, 7)}-01` : shiftDate(today, 1 - days),
      to: today,
    };
    setDraft(next);
    setFilters(next);
    setValidation("");
    setPage(0);
  }
  async function exportExcel() {
    if (!data) return;
    setExporting(true);
    setExportError("");
    try {
      const { exportSalesStatistics } = await import("@/lib/sales-statistics-excel");
      await exportSalesStatistics(data, filters.from, filters.to, categoryName, brandName);
    } catch {
      setExportError("No se pudo generar el Excel. Volvé a intentar.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-3xl">
            <BarChart3 className="h-7 w-7 text-primary" />
            Estadísticas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ventas, productos y stock para decidir tu próximo paso.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={report.isFetching}
            onClick={() => void report.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button
            disabled={!data || report.isFetching || exporting}
            onClick={() => void exportExcel()}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Generando…" : "Exportar Excel"}
          </Button>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        className="space-y-4 rounded-xl border bg-card p-4"
      >
        <div className="flex flex-wrap gap-2">
          {[
            [7, "7 días"],
            [30, "30 días"],
            [90, "90 días"],
            [0, "Este mes"],
          ].map(([n, label]) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => quick(Number(n))}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm">
            Desde
            <Input
              type="date"
              value={draft.from}
              required
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            Hasta
            <Input
              type="date"
              value={draft.to}
              required
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            Categoría
            <select
              className={field}
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value, brand: "" })}
            >
              <option value="">Todas</option>
              {lookups.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Marca
            <select
              className={field}
              value={draft.brand}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            >
              <option value="">Todas</option>
              {lookups.data?.brands
                .filter((b) => !draft.category || b.category_id === draft.category)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit">Aplicar filtros</Button>
        </div>
        {(validation || lookups.isError) && (
          <p role="alert" className="text-sm text-destructive">
            {validation || lookups.error?.message}
          </p>
        )}
      </form>
      {exportError && (
        <p role="alert" className="text-sm text-destructive">
          {exportError}
        </p>
      )}
      {report.isPending ? (
        <p role="status">Calculando estadísticas…</p>
      ) : report.isError ? (
        <div role="alert" className="rounded-xl border border-destructive p-4">
          <p>No se pudieron cargar las estadísticas: {report.error.message}</p>
          <Button variant="outline" className="mt-3" onClick={() => void report.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        data && (
          <>
            <p className="text-sm text-muted-foreground">
              {shortDate(filters.from)} al {shortDate(filters.to)} · {categoryName} / {brandName}.
              Comparado con {shortDate(previous.from)} al {shortDate(previous.to)}. Horario de
              Argentina.
            </p>
            {data.unverified_orders > 0 && (
              <div
                role="status"
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              >
                Hay {integer(data.unverified_orders)} pedido(s) marcado(s) como pagado(s) sin un
                intento de pago aprobado coincidente. Se excluyen de las ventas.{" "}
                <Link to="/admin/pedidos" className="underline">
                  Revisar pedidos
                </Link>
                .
              </div>
            )}
            {(data.current.estimated_dates ?? 0) > 0 && (
              <p className="text-sm text-muted-foreground">
                {data.current.estimated_dates} cobro(s) sin fecha histórica de aprobación: se usa la
                fecha del intento de pago.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: scoped ? "Artículos cobrados" : "Total cobrado",
                  key: "revenue",
                  icon: Wallet,
                  money: true,
                },
                { label: "Pedidos pagados", key: "orders", icon: ShoppingBag },
                { label: "Unidades vendidas", key: "units", icon: Package },
                {
                  label: scoped ? "Ticket de artículos" : "Ticket promedio",
                  key: "average",
                  icon: ReceiptText,
                  money: true,
                },
              ].map((card) => {
                const key = card.key as "revenue" | "orders" | "units" | "average",
                  value = data.current[key] ?? 0;
                return (
                  <section key={key} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      {card.label}
                      <card.icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 break-words text-2xl font-semibold tabular-nums">
                      {card.money ? formatARS(value) : integer(value)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {salesChange(value, data.previous[key] ?? 0)} respecto del período anterior
                    </p>
                  </section>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Solo pedidos con pago aprobado coincidente, incluidos los archivados.{" "}
              {scoped
                ? "Con filtros se suman los artículos seleccionados, sin envío."
                : "El total y el ticket incluyen envío (" +
                  formatARS(data.current.shipping ?? 0) +
                  ")."}{" "}
              Los rankings siempre muestran importes de artículos. No mide ganancia ni descuenta
              devoluciones, que todavía no tienen registro propio.
            </p>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="font-serif text-xl">Evolución de ventas</h2>
              {(data.current.orders ?? 0) === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Todavía no hay cobros verificables en este período.
                </p>
              ) : (
                <div
                  className="mt-4 h-64"
                  role="img"
                  aria-label="Ventas cobradas por día; valores disponibles en la tabla de evolución"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tickFormatter={(s) => shortDate(s).slice(0, 5)}
                        minTickGap={28}
                      />
                      <YAxis
                        width={65}
                        tickFormatter={(n) =>
                          new Intl.NumberFormat("es-AR", { notation: "compact" }).format(n)
                        }
                      />
                      <Tooltip
                        labelFormatter={(s) => shortDate(String(s))}
                        formatter={(value) => [formatARS(Number(value)), "Cobrado"]}
                      />
                      <Area
                        dataKey="revenue"
                        name="Cobrado"
                        type="monotone"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer">Ver tabla diaria</summary>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cobrado</th>
                        <th>Pedidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.daily.map((d) => (
                        <tr key={d.day}>
                          <td>{shortDate(d.day)}</td>
                          <td>{formatARS(d.revenue)}</td>
                          <td>{d.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className="space-y-4 rounded-xl border bg-card p-4">
              <h2 className="font-serif text-xl">Artículos y reposición</h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["best", "Más vendidos"],
                    ["least", "Menos vendidos"],
                    ["none", "Sin ventas"],
                    ["stock", "Alertas de stock"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    size="sm"
                    key={value}
                    variant={mode === value ? "default" : "outline"}
                    onClick={() => {
                      setMode(value);
                      setPage(0);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {(mode === "best" || mode === "least") && (
                  <label className="text-sm">
                    Ordenar por
                    <select
                      className={field}
                      value={metric}
                      onChange={(e) => {
                        setMetric(e.target.value as "units" | "revenue");
                        setPage(0);
                      }}
                    >
                      <option value="units">Unidades vendidas</option>
                      <option value="revenue">Importe vendido</option>
                    </select>
                  </label>
                )}
                {mode === "stock" && (
                  <label className="text-sm">
                    Alertar con stock menor o igual a
                    <Input
                      className="w-36"
                      type="number"
                      min={0}
                      max={100000}
                      step={1}
                      value={threshold}
                      onChange={(e) => {
                        setThreshold(
                          Math.max(0, Math.min(100000, Math.floor(Number(e.target.value) || 0))),
                        );
                        setPage(0);
                      }}
                    />
                  </label>
                )}
                <p className="text-sm text-muted-foreground">
                  {integer(products.length)} artículos
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === "least"
                  ? "Menor venta entre artículos con al menos una unidad vendida. Los ceros están en “Sin ventas”."
                  : mode === "stock"
                    ? "Artículos visibles con stock actual bajo el umbral. Esta alerta usa el stock de hoy, independientemente del período."
                    : mode === "none"
                      ? "Artículos visibles creados hasta el final del período, sin ventas registradas en ese rango."
                      : "Ranking por ventas confirmadas del período."}{" "}
                El stock es actual; todavía no hay historial que permita saber cuántos días estuvo
                disponible cada artículo.
              </p>
              <ProductsTable products={products.slice(currentPage * 20, currentPage * 20 + 20)} />
              <div className="flex items-center justify-between gap-2 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </Button>
                <span>
                  Página {currentPage + 1} de {maxPage + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= maxPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </section>
            <div className="grid gap-4 xl:grid-cols-2">
              <BreakdownTable title="Ventas por categoría" rows={data.categories} />
              <BreakdownTable title="Ventas por marca" rows={data.brands} />
            </div>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="font-serif text-xl">Estado de los pedidos</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Pedidos creados en el período, según su estado actual. Las ventas de arriba usan la
                fecha del cobro.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {Object.entries(data.statuses).map(([status, count]) => (
                  <div key={status} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                    {orderStatusLabels[status] ?? status}: <strong>{count}</strong>
                  </div>
                ))}
                {Object.keys(data.statuses).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin pedidos creados en este período.
                  </p>
                )}
              </div>
              <Link
                to="/admin/pedidos"
                className="mt-4 inline-block text-sm text-primary underline"
              >
                Ir a Pedidos
              </Link>
            </section>
            <p className="text-xs text-muted-foreground">
              Actualizado:{" "}
              {new Date(data.generated_at).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
              })}
              . Excel incluye el listado completo de artículos del informe.
            </p>
          </>
        )
      )}
    </div>
  );
}
function ProductsTable({ products }: { products: SalesProduct[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="p-2">Artículo</th>
            <th className="p-2">Unidades</th>
            <th className="p-2">Venta de artículos</th>
            <th className="p-2">Stock actual</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="min-w-48 p-2">
                <Link to="/admin/productos" className="font-medium hover:underline">
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.article_code || "Sin código"} · {p.category} · {p.brand}
                  {!p.is_active ? " · Oculto" : ""}
                </p>
              </td>
              <td className="p-2 tabular-nums">{integer(p.units)}</td>
              <td className="whitespace-nowrap p-2 tabular-nums">{formatARS(p.revenue)}</td>
              <td className="p-2 tabular-nums">
                {p.stock <= 0 ? (
                  <span className="text-destructive">Agotado ({p.stock})</span>
                ) : (
                  integer(p.stock)
                )}
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-muted-foreground">
                No hay artículos para esta selección.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-3 max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">Nombre</th>
              <th>Unidades</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="py-2">{r.name}</td>
                <td>{r.units}</td>
                <td className="whitespace-nowrap">{formatARS(r.revenue)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-muted-foreground">
                  Sin ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
