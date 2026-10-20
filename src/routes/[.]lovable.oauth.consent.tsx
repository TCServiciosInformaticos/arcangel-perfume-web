import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Conectar un asistente — El Arcángel" },
    { name: "description", content: "Revisá y autorizá la conexión de un asistente a tu cuenta de El Arcángel." },
    { property: "og:title", content: "Conectar un asistente — El Arcángel" },
    { property: "og:description", content: "Autorización segura para consultar el catálogo de El Arcángel." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  validateSearch: (search: Record<string, unknown>) => ({ authorization_id: typeof search.authorization_id === "string" ? search.authorization_id : "" }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta la solicitud de autorización. Volvé a iniciar la conexión desde tu asistente.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("No pudimos verificar tu sesión. Volvé a intentar.");
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr + location.hash } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("Falta la solicitud de autorización.");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw new Error("Esta solicitud venció, no es válida o no pudo consultarse. Iniciá una nueva conexión desde tu asistente.");
    if (!data) throw new Error("No encontramos la solicitud de conexión.");
    if ("redirect_url" in data && data.redirect_url) throw redirect({ href: data.redirect_url });
    const { data: session } = await supabase.auth.getSession();
    return { details: data, email: session.session?.user.email };
  },
  pendingComponent: () => <main className="mx-auto max-w-xl px-4 py-20 text-center">Consultando la solicitud de conexión…</main>,
  errorComponent: ({ error, reset }) => <main className="mx-auto max-w-xl px-4 py-20 text-center"><img src="/arcangel-logo.png" alt="El Arcángel" className="mx-auto h-20 w-20 object-contain" /><h1 className="mt-6 font-serif text-3xl">No pudimos conectar el asistente</h1><p role="alert" className="mt-4 text-muted-foreground">{error instanceof Error ? error.message : "No pudimos consultar la autorización."}</p><Button className="mt-6" onClick={reset}>Reintentar</Button><Link to="/" className="mt-6 block text-primary">Volver a la tienda</Link></main>,
  component: ConsentPage,
});

function ConsentPage() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!("client" in details)) return <main className="px-4 py-20 text-center">Volvé a iniciar la conexión desde tu asistente.</main>;
  const name = details.client.name || "tu asistente";
  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: failure } = approve
        ? await supabase.auth.oauth.approveAuthorization(authorization_id)
        : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (failure) throw failure;
      if (!data?.redirect_url) throw new Error("No se recibió el destino de la conexión.");
      window.location.assign(data.redirect_url);
    } catch {
      setError(approve ? "No pudimos aprobar la conexión. Volvé a intentar." : "No pudimos cancelar la conexión. Volvé a intentar.");
      setBusy(false);
    }
  }

  return <main className="mx-auto w-full max-w-xl px-5 py-16">
    <img src="/arcangel-logo.png" alt="El Arcángel" className="h-24 w-24 object-contain" />
    <h1 className="mt-6 font-serif text-3xl">Conectar {name} a El Arcángel</h1>
    <p className="mt-4 text-muted-foreground">{email}</p>
    <p className="mt-4">{name} podrá consultar el catálogo usando tu cuenta.</p>
    <p className="mt-3 break-all text-sm text-muted-foreground">Destino de la conexión: {details.redirect_uri}</p>
    <ul className="mt-6 space-y-2 border-y border-border py-6">
      {scopes.map((scope) => <li key={scope}>{scope === "openid" ? "Identificar tu cuenta" : scope === "email" ? "Compartir tu dirección de email" : scope === "profile" ? "Compartir tu perfil básico" : `Permiso adicional solicitado: ${scope}`}</li>)}
      <li>Consultar categorías, marcas, productos, precios y disponibilidad.</li>
    </ul>
    <p className="mt-4 text-sm text-muted-foreground">No permite realizar pagos ni enviar pedidos. Se mantienen los permisos de tu cuenta y las restricciones de la tienda.</p>
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    <div className="mt-8 flex flex-wrap gap-3"><Button disabled={busy} onClick={() => decide(true)}>{busy ? "Procesando…" : "Permitir conexión"}</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button></div>
    <Button variant="link" disabled={busy} className="mt-4" onClick={async () => { const { error } = await supabase.auth.signOut(); if (error) { setError("No pudimos cerrar la sesión."); return; } window.location.reload(); }}>Usar otra cuenta</Button>
  </main>;
}