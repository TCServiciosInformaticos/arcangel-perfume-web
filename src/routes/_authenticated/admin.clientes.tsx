import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  operations,
  adminDate,
  type Customer,
  type CustomerOrder,
  type PageResult,
} from "@/lib/admin-operations-client";
import { orderStatusLabels } from "@/lib/order-lifecycle";
import { formatARS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPager } from "@/components/admin-pager";
export const Route = createFileRoute("/_authenticated/admin/clientes")({ component: Customers });
function Customers() {
  const [draft, setDraft] = useState(""),
    [term, setTerm] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState<Customer | null>(null),
    [detailPage, setDetailPage] = useState(0);
  const q = useQuery({
    queryKey: ["admin", "customers", term, page],
    queryFn: async () => {
      const r = await operations.rpc("admin_customer_list", { term, page_number: page });
      if (r.error) throw r.error;
      return r.data as PageResult<Customer>;
    },
  });
  const details = useQuery({
    queryKey: ["admin", "customer-orders", selected?.email, detailPage],
    enabled: !!selected,
    queryFn: async () => {
      const r = await operations.rpc("admin_customer_orders", {
        customer_key: selected!.email,
        page_number: detailPage,
      });
      if (r.error) throw r.error;
      return r.data as PageResult<CustomerOrder>;
    },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-3xl">Clientes</h1>
      <p className="text-sm text-muted-foreground">
        Clientes con pedidos, agrupados por correo (de cuenta cuando está disponible). El gasto
        incluye envío y solo suma pedidos con pago aprobado verificado, incluidos los archivados.
        Los datos de contacto son los del último pedido.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(draft.trim());
          setPage(0);
          setSelected(null);
        }}
      >
        <label className="flex-1 text-sm">
          Buscar por nombre, correo o teléfono
          <Input maxLength={200} value={draft} onChange={(e) => setDraft(e.target.value)} />
        </label>
        <Button className="self-end">Buscar clientes</Button>
        <Button
          type="button"
          className="self-end"
          variant="outline"
          onClick={() => {
            void q.refetch();
            if (selected) void details.refetch();
          }}
        >
          Actualizar
        </Button>
      </form>
      {q.isPending ? (
        <p>Cargando clientes…</p>
      ) : q.isError ? (
        <p role="alert">No se pudieron cargar los clientes. Probá Actualizar.</p>
      ) : (
        <>
          <AdminPager page={page} total={q.data.total} onPage={setPage} busy={q.isFetching} />
          {q.data.rows.length === 0 ? (
            <p>No hay clientes con esos datos.</p>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    {[
                      "Cliente",
                      "Contacto",
                      "Pedidos",
                      "Compras pagadas",
                      "Gasto confirmado",
                      "Último pedido",
                      "Detalle",
                    ].map((t) => (
                      <th className="p-3" key={t}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data.rows.map((c) => (
                    <tr className="border-t" key={c.email}>
                      <td className="p-3">{c.name}</td>
                      <td className="p-3">
                        <div>{c.email}</div>
                        <div>{c.whatsapp}</div>
                      </td>
                      <td className="p-3">{c.orders}</td>
                      <td className="p-3">{c.paid_orders}</td>
                      <td className="p-3">{formatARS(c.spent)}</td>
                      <td className="p-3">{adminDate(c.last_order)}</td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelected(c);
                            setDetailPage(0);
                          }}
                        >
                          Ver compras de {c.name}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {selected && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 className="font-serif text-2xl">Compras de {selected.name}</h2>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cerrar detalle
            </Button>
          </div>
          <p className="text-sm">
            {selected.email} · Pedidos sin pago: {selected.unpaid_orders}
          </p>
          {details.isPending ? (
            <p>Cargando compras…</p>
          ) : details.isError ? (
            <p role="alert">No se pudieron cargar las compras.</p>
          ) : (
            <>
              <AdminPager
                page={detailPage}
                size={20}
                total={details.data.total}
                onPage={setDetailPage}
              />
              {details.data.rows.map((o) => (
                <article className="rounded border p-3" key={o.id}>
                  <h3 className="font-medium">
                    Pedido #{o.order_number} · {orderStatusLabels[o.status] ?? o.status}
                  </h3>
                  <p className="text-sm">
                    {adminDate(o.created_at)} · {formatARS(o.total)} ·{" "}
                    {o.verified ? "Pago verificado" : "Sin pago verificado"}
                  </p>
                  <ul className="mt-2 text-sm">
                    {o.items.map((i, n) => (
                      <li key={n}>
                        {i.quantity} × {i.name} · {formatARS(i.total)}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
