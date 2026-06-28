import { Link, useRouter, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, User, Search, Instagram, Phone, MapPin } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

const logoUrl = "/arcangel-logo.png";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/productos", label: "Catálogo" },
  { to: "/productos", label: "Perfumes" },
  { to: "/productos", label: "Limpieza" },
  { to: "/productos", label: "Cabello" },
] as const;

export function SiteHeader() {
  const { totalQty } = useCart();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = router.state.location.pathname;

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/productos" });
  };


  return (
    <header className="sticky top-0 z-40 bg-background shadow-sm">
      {/* Top bar */}
      <div className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/perfumeriaelarcangel/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 opacity-90 hover:text-primary hover:opacity-100"
            >
              <Instagram className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">@perfumeriaelarcangel</span>
            </a>
          </div>
          <div className="hidden items-center gap-4 sm:flex">
            <span className="inline-flex items-center gap-1.5 opacity-80">
              <MapPin className="h-3.5 w-3.5" /> Gran Bourg · 2 sucursales
            </span>
            <span className="inline-flex items-center gap-1.5 opacity-80">
              <Phone className="h-3.5 w-3.5" /> Lun a Sáb · 9–13 / 16–20 h
            </span>
          </div>
        </div>
      </div>

      {/* Main row */}
      <div className="border-b border-border">
        <div className="mx-auto grid h-20 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-2.5 shrink-0" aria-label="Inicio">
            <img
              src={logoUrl}
              alt="Perfumería El Arcángel"
              className="h-12 w-12 object-contain transition-transform group-hover:scale-105"
              width={48}
              height={48}
            />
            <div className="hidden sm:block">
              <div className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">Perfumería</div>
              <div className="-mt-0.5 text-xl font-bold leading-tight text-primary">El Arcángel</div>
            </div>
          </Link>

          <form onSubmit={onSearch} className="relative mx-auto w-full max-w-2xl min-w-0">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿Qué estás buscando?"
              className="h-11 w-full rounded-full border-2 border-primary/70 bg-background pl-5 pr-12 text-sm outline-none transition-colors focus:border-primary"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          <div className="flex items-center gap-1 shrink-0">
            <Link
              to="/auth"
              className="hidden flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-foreground hover:text-primary sm:flex"
              title="Mi cuenta"
            >
              <User className="h-5 w-5" />
              <span>Mi cuenta</span>
            </Link>
            <Link
              to="/carrito"
              className="relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-foreground hover:text-primary"
              aria-label="Mi carrito"
            >
              <span className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalQty > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {totalQty}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">Mi carrito</span>
            </Link>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent/30 md:hidden"
              aria-label="Abrir menú"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Nav row */}
      <div className="hidden border-b border-border bg-background md:block">
        <nav className="mx-auto flex max-w-7xl items-center justify-center gap-8 px-4 py-3 sm:px-6 lg:px-8">
          {NAV.map((n, i) => (
            <Link
              key={`${n.label}-${i}`}
              to={n.to}
              className={`text-sm font-medium uppercase tracking-wide transition-colors hover:text-primary ${
                pathname === n.to && i === 0 ? "text-primary" : "text-foreground/80"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="text-sm font-medium uppercase tracking-wide text-foreground/80 hover:text-primary">
              Admin
            </Link>
          )}
        </nav>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {NAV.map((n, i) => (
              <Link
                key={`m-${n.label}-${i}`}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-accent/30"
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-accent/30">
                Panel admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
