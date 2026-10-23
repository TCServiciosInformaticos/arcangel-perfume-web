import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  operations,
  adminDate,
  auditEntities,
  type AuditEntry,
} from "@/lib/admin-operations-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPager } from "@/components/admin-pager";
export const Route = createFileRoute("/_authenticated/admin/historial")({ component: History });
const fields: Record<string, string> = {
  name: "Nombre",
  description: "Descripción",
  article_code: "Código",
  price: "Precio",
  compare_at_price: "Precio anterior",
  stock: "Stock",
  is_active: "Visible",
  modules: "Permisos",
  enabled: "Acceso activo",
  status: "Estado",
  total: "Total",
  sort_order: "Orden",
  title: "Título",
  image_urls: "Imágenes",
  thumbnail_url: "Miniatura",
  barcode: "Código de barras",
  needs_review: "Requiere revisión",
};
function value(v: unknown) {
  if (v === null || v === undefined) return "Sin valor";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return typeof v === "string" ? v : JSON.stringify(v);
}
function History() {
  const [draft, setDraft] = useState({ term: "", entity: "", from: "", to: "" }),
    [filters, setFilters] = useState(draft),
    [page, setPage] = useState(0);
  const invalid = !!(filters.from && filters.to && filters.from > filters.to);
  const q = useQuery({
    queryKey: ["admin", "history", filters, page],
    enabled: !invalid,
    queryFn: async () => {
      let query = operations
        .from("admin_change_log")
        .select("*", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false });
      if (filters.entity) query = query.eq("entity", filters.entity);
      if (filters.term)
        query = query.ilike("record_name", `%${filters.term.replace(/[\\%_]/g, "\\$&")}%`);
      if (filters.from) query = query.gte("occurred_at", filters.from + "T00:00:00-03:00");
      if (filters.to) query = query.lte("occurred_at", filters.to + "T23:59:59.999999-03:00");
      const r = await query.range(page * 25, page * 25 + 24);
      if (r.error) throw r.error;
      return { rows: r.data as AuditEntry[], total: r.count ?? 0 };
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Historial de cambios</h1>
      <p className="text-sm text-muted-foreground">
        Quién cambió cada dato, cuándo y sus valores anterior y nuevo. Registra cambios desde la
        activación de esta función; los anteriores no se reconstruyen. Horarios de Argentina.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setFilters({ ...draft, term: draft.term.trim() });
        }}
      >
        <label className="text-sm">
          Artículo o registro
          <Input
            value={draft.term}
            maxLength={200}
            onChange={(e) => setDraft({ ...draft, term: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Módulo
          <select
            className="block h-10 rounded border bg-background px-2"
            value={draft.entity}
            onChange={(e) => setDraft({ ...draft, entity: e.target.value })}
          >
            <option value="">Todos</option>
            {Object.entries(auditEntities).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Desde
          <Input
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Hasta
          <Input
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </label>
        <Button>Filtrar historial</Button>
        <Button
          type="button"
          variant="outline"
          disabled={q.isFetching || invalid}
          onClick={() => q.refetch()}
        >
          Actualizar
        </Button>
      </form>
      {invalid ? (
        <p role="alert">La fecha Hasta debe ser igual o posterior a Desde.</p>
      ) : q.isError ? (
        <p role="alert">No se pudo cargar el historial. Probá Actualizar.</p>
      ) : q.isPending ? (
        <p>Cargando historial…</p>
      ) : (
        <>
          <AdminPager page={page} total={q.data.total} onPage={setPage} busy={q.isFetching} />
          {q.data.rows.length === 0 ? (
            <p>No hay cambios registrados con estos filtros.</p>
          ) : (
            <div className="space-y-3">
              {q.data.rows.map((row) => (
                <article className="rounded-xl border bg-card p-4" key={row.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="font-medium">{row.record_name}</h2>
                    <time className="text-xs">{adminDate(row.occurred_at)}</time>
                  </div>
                  <p className="my-2 text-xs text-muted-foreground">
                    {row.actor_name} · {auditEntities[row.entity] ?? row.entity} ·{" "}
                    {
                      { INSERT: "Creación", UPDATE: "Modificación", DELETE: "Eliminación" }[
                        row.operation
                      ]
                    }{" "}
                    · {row.source}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Ver {Object.keys(row.changes).length} campo(s) modificado(s)
                    </summary>
                    <div className="mt-3 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th className="p-2">Campo</th>
                            <th className="p-2">Antes</th>
                            <th className="p-2">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(row.changes).map(([key, v]) => (
                            <tr key={key} className="border-t align-top">
                              <th className="p-2">{fields[key] ?? key}</th>
                              <td className="max-w-xs whitespace-pre-wrap break-words p-2">
                                {value(v.before)}
                              </td>
                              <td className="max-w-xs whitespace-pre-wrap break-words p-2">
                                {value(v.after)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 break-all text-xs text-muted-foreground">
                      Registro: {row.record_id} · Usuario: {row.actor_id ?? "Sistema"}
                    </p>
                  </details>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
