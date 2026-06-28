import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel admin · El Arcángel" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { to: "/admin/productos", label: "Productos", icon: Package, exact: false },
] as const;

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = router.state.location.pathname;

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl text-foreground">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu cuenta {user?.email} no tiene permisos de administrador.
          </p>
          <Button onClick={signOut} variant="outline" className="mt-6">
            Cerrar sesión
          </Button>
        </div>
      </div>
    );
  }

  const isOverview = pathname === "/admin";

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="font-serif text-lg text-foreground">
            El Arcángel <span className="text-xs font-sans font-medium text-muted-foreground">· Panel admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="w-56 shrink-0">
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent/30"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          {isOverview ? <AdminOverview /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

function AdminOverview() {
  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">Resumen</h1>
      <p className="mt-1 text-sm text-muted-foreground">Gestioná el catálogo desde el menú lateral.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/productos"
          className="group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <Package className="h-7 w-7 text-primary" />
          <h2 className="mt-3 font-serif text-xl text-foreground">Productos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cargá, editá o pausá productos, subí imágenes y marcá ofertas.
          </p>
        </Link>
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-6">
          <ShoppingBag className="h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 font-serif text-xl text-foreground">Pedidos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Próximamente: listado de pedidos y reenvío por WhatsApp.</p>
        </div>
      </div>
    </div>
  );
}
