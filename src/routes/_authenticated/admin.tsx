import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  LogOut,
  FolderTree,
  Percent,
  Images,
  BarChart3,
  Wrench,
  Users,
  History,
  Bell,
  Contact,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { canOpenAdminPath } from "@/lib/staff-permissions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel admin · El Arcángel" },
      { name: "description", content: "Administración de la tienda El Arcángel." },
      { property: "og:title", content: "Panel de administración — El Arcángel" },
      { property: "og:description", content: "Gestión de la tienda y su catálogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/historial", label: "Historial de cambios", icon: History, exact: false },
  { to: "/admin/clientes", label: "Clientes", icon: Contact, exact: false },
  { to: "/admin/alertas", label: "Alertas del negocio", icon: Bell, exact: false },
  { to: "/admin/usuarios", label: "Usuarios", icon: Users, exact: false },
  { to: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { to: "/admin/herramientas", label: "Herramientas de venta", icon: Wrench, exact: false },
  { to: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3, exact: false },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag, exact: false },
  { to: "/admin/slider", label: "Slider", icon: Images, exact: false },
  { to: "/admin/productos", label: "Productos", icon: Package, exact: false },
  { to: "/admin/categorias", label: "Categorías", icon: FolderTree, exact: false },
  { to: "/admin/politica-precios", label: "Política de Precios", icon: Percent, exact: false },
] as const;

function AdminLayout() {
  const { user, isAdmin, modules, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!isAdmin && modules.length === 0) {
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

  const isOverview = pathname === "/admin" || pathname === "/admin/";

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="font-serif text-lg text-foreground">
            El Arcángel{" "}
            <span className="text-xs font-sans font-medium text-muted-foreground">
              · Panel admin
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">{user?.email}</span>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:px-8">
        <aside className="shrink-0 lg:w-56">
          <nav className="flex flex-wrap gap-1 lg:flex-col">
            {NAV.filter(
              (n) =>
                canOpenAdminPath(n.to, isAdmin, modules) &&
                (n.to !== "/admin" || isAdmin || modules.includes("resumen")),
            ).map((n) => {
              const active = n.exact
                ? pathname === n.to || pathname === `${n.to}/`
                : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent/30"
                  }`}
                >
                  <n.icon className="h-4 w-4 shrink-0" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {!canOpenAdminPath(pathname, isAdmin, modules) ? (
            <p role="alert">No tenés permiso para acceder a este módulo.</p>
          ) : isOverview ? (
            isAdmin || modules.includes("resumen") ? (
              <AdminOverview />
            ) : (
              <div>
                <h1 className="font-serif text-3xl">Tu panel</h1>
                <p className="mt-3">Elegí uno de tus módulos habilitados en el menú.</p>
              </div>
            )
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

function AdminOverview() {
  const { isAdmin, modules } = useAuth();
  return (
    <div>
      <h1 className="font-serif text-3xl text-foreground">Resumen</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Accedé a los módulos habilitados para tu cuenta.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV.filter((n) => n.to !== "/admin" && canOpenAdminPath(n.to, isAdmin, modules)).map(
          (n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <n.icon className="h-7 w-7 text-primary" />
              <h2 className="mt-3 font-serif text-xl">{n.label}</h2>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
