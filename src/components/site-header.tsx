import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, User, Search, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

const logoUrl = "/arcangel-logo.png";

const NAV = ["Perfumes", "Limpieza", "Cabello", "Higiene personal", "Cuidado de la piel", "Ofertas"];
const MARQUEE = Array.from({ length: 10 }, () => "El Arcángel — Perfumería, limpieza y cabello · Gran Bourg");

export function SiteHeader() {
  const { totalQty } = useCart();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/productos" });
  };

  const iconBtn =
    "inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary";

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="overflow-hidden bg-sidebar text-sidebar-foreground">
          <div className="flex w-max animate-marquee gap-12 whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
            {[...MARQUEE, ...MARQUEE].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        <div className="mx-auto flex h-24 max-w-7xl items-center gap-4 px-4 sm:gap-8 sm:px-6 lg:px-8">
          <button type="button" className={iconBtn} aria-label="Menú" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Inicio">
            <img src={logoUrl} alt="Perfumería El Arcángel" className="h-12 w-12 object-contain" width={48} height={48} />
            <div className="hidden leading-none sm:block">
              <div className="text-2xl font-extrabold text-foreground">El Arcángel<span className="text-primary">.</span></div>
              <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-primary">Perfumería & Hogar</div>
            </div>
          </Link>

          <form onSubmit={onSearch} className="relative hidden flex-1 md:block">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar productos, marcas..."
              className="h-13 w-full rounded-full border border-border bg-card py-3.5 pl-12 pr-5 text-sm outline-none transition-colors focus:border-primary"
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/auth" className={`${iconBtn} hidden sm:inline-flex`} aria-label="Mi cuenta">
              <User className="h-5 w-5" />
            </Link>
            <Link to="/carrito" className={`${iconBtn} relative`} aria-label="Mi carrito">
              <ShoppingCart className="h-5 w-5" />
              {totalQty > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {totalQty}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="border-y border-border">
          <nav className="mx-auto flex max-w-7xl items-center gap-8 overflow-x-auto px-4 py-4 sm:px-6 lg:px-8">
            {NAV.map((n) => (
              <Link
                key={n}
                to="/productos"
                className="shrink-0 text-xs font-bold uppercase tracking-wide text-foreground transition-colors hover:text-primary"
              >
                {n}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="shrink-0 text-xs font-bold uppercase tracking-wide text-primary">
                Admin
              </Link>
            )}
          </nav>
        </div>

        {open && (
          <div className="border-b border-border bg-background">
            <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2 sm:px-6 lg:px-8">
              <form onSubmit={onSearch} className="py-2 md:hidden">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full rounded-full border border-border bg-card px-5 py-3 text-sm outline-none focus:border-primary"
                />
              </form>
              {[{ to: "/", l: "Inicio" }, { to: "/productos", l: "Catálogo" }, { to: "/carrito", l: "Mi carrito" }, { to: "/auth", l: "Mi cuenta" }].map((n) => (
                <Link key={n.l} to={n.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-accent">
                  {n.l}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <a
        href="https://wa.me/5491125124333"
        target="_blank"
        rel="noreferrer noopener"
        aria-label="WhatsApp"
        className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </>
  );
}
