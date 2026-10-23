import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  operations,
  ALERT_LABELS,
  type AlertKind,
  type BusinessAlerts,
} from "@/lib/admin-operations-client";
import { useAuth } from "@/lib/auth-context";
import { canOpenAdminPath } from "@/lib/staff-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPager } from "@/components/admin-pager";
export const Route = createFileRoute("/_authenticated/admin/alertas")({ component: Alerts });
function Alerts() {
  const [kind, setKind] = useState<AlertKind>("sin_stock"),
    [threshold, setThreshold] = useState(5),
    [draft, setDraft] = useState("5"),
    [page, setPage] = useState(0);
  const { isAdmin, modules } = useAuth();
  const q = useQuery({
    queryKey: ["admin", "business-alerts", kind, threshold, page],
    queryFn: async () => {
      const r = await operations.rpc("admin_business_alerts", {
        kind,
        threshold,
        page_number: page,
      });
      if (r.error) throw r.error;
      return r.data as BusinessAlerts;
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Alertas del negocio</h1>
      <p className="text-sm text-muted-foreground">
        Estado actual de artículos visibles y pedidos no archivados. Estas alertas informan; no
        cambian precios, stock ni el estado de los pedidos.
      </p>
      {canOpenAdminPath("/admin/productos", isAdmin, modules) && (
        <Button variant="outline" asChild>
          <Link to="/admin/productos" search={{ revision: true, editar: undefined }}>
            Revisar artículos y fotos
          </Link>
        </Button>
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setThreshold(Number(draft));
          setPage(0);
        }}
      >
        <label className="text-sm">
          Avisar stock bajo hasta
          <Input
            type="number"
            min={1}
            max={100000}
            step={1}
            required
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <Button>Aplicar umbral</Button>
        <Button type="button" variant="outline" disabled={q.isFetching} onClick={() => q.refetch()}>
          Actualizar alertas
        </Button>
      </form>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(ALERT_LABELS) as AlertKind[]).map((k) => (
          <Button
            className="h-auto justify-between gap-3 whitespace-normal p-4 text-left"
            key={k}
            variant={k === kind ? "default" : "outline"}
            onClick={() => {
              setKind(k);
              setPage(0);
            }}
          >
            <span>{ALERT_LABELS[k]}</span>
            <strong>{q.data?.counts[k] ?? (q.isPending ? "…" : 0)}</strong>
          </Button>
        ))}
      </div>
      <h2 className="text-xl font-medium">{ALERT_LABELS[kind]}</h2>
      {q.isPending ? (
        <p>Cargando alertas…</p>
      ) : q.isError ? (
        <p role="alert">No se pudieron cargar las alertas. Probá Actualizar alertas.</p>
      ) : (
        <>
          <AdminPager
            page={page}
            total={q.data.counts[kind] ?? 0}
            onPage={setPage}
            busy={q.isFetching}
          />
          {q.data.rows.length === 0 ? (
            <p>No hay alertas de este tipo.</p>
          ) : (
            <ul className="space-y-2">
              {q.data.rows.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border bg-card p-3"
                >
                  <div>
                    <p className="font-medium">{a.label}</p>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    <p className="break-all text-xs text-muted-foreground">ID: {a.id}</p>
                  </div>
                  {canOpenAdminPath(a.route, isAdmin, modules) ? (
                    <Link
                      to={a.route as "/admin/productos" | "/admin/pedidos"}
                      search={
                        a.route === "/admin/productos"
                          ? { revision: true, editar: a.id }
                          : undefined
                      }
                      className="text-sm font-medium underline"
                    >
                      {a.route === "/admin/productos" ? "Editar artículo" : "Abrir módulo"}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Sin permiso para editar en este módulo
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
