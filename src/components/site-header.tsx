import { Link, useRouter } from "@tanstack/react-router";
import { ShoppingBag, Menu, X, User } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
const logoUrl = "/arcangel-logo.png";


const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/productos", label: "Catálogo" },
] as const;

export function SiteHeader() {
  const { totalQty } = useCart();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = router.state.location.pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5" aria-label="Perfumería El Arcángel — Inicio">
          <img
            src={logoUrl}
            alt="Perfumería El Arcángel"
            className="h-11 w-11 object-contain transition-transform group-hover:scale-105"
            width={44}
            height={44}
          />
          <span className="hidden font-serif text-xl leading-none tracking-tight text-foreground sm:inline">
            El Arcángel
          </span>
        </Link>


        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === n.to ? "text-primary" : "text-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {isAdmin && (
            <Link
              to="/admin"
              className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/10 sm:inline-flex"
              title="Panel admin"
            >
              <User className="h-4 w-4" /> Admin
            </Link>
          )}
          <Link
            to="/carrito"
            className="relative inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent/10"
            aria-label="Carrito"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalQty > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                {totalQty}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent/10 md:hidden"
            aria-label="Abrir menú"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-accent/10"
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-accent/10">
                Panel admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
