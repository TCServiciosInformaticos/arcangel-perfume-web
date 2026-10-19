import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, User, Search, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { formatARS } from "@/lib/format";

const logoUrl = "/arcangel-mark.png";

const NAV = ["Perfumes", "Limpieza", "Cabello", "Higiene personal", "Cuidado de la piel", "Ofertas"];
const MARQUEE = Array.from({ length: 8 }, () => "Envíos por Gran Bourg y alrededores 🚚 / Pagá con MercadoPago 💖 / Lunes a sábado 9 a 13 y 16 a 20 h");

export function SiteHeader() {
  const { totalQty, subtotal: total } = useCart();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/productos" });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-background">
        <div className="overflow-hidden bg-accent text-accent-foreground">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap py-3 text-sm font-medium uppercase">
            {[...MARQUEE, ...MARQUEE].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        <div className="mx-auto flex h-24 max-w-7xl items-center gap-4 px-4 sm:gap-10 sm:px-6 lg:px-8">
          <button type="button" className="md:hidden" aria-label="Menú" onClick={() => setOpen((v) => !v)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Inicio">
            <img src={logoUrl} alt="Perfumería El Arcángel" className="h-12 w-12 object-contain" width={48} height={48} />
            <span className="text-3xl font-medium tracking-tight text-primary">El Arcángel</span>
          </Link>

          <form onSubmit={onSearch} className="hidden flex-1 md:flex">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿Qué estás buscando?"
              className="h-11 w-full border border-border bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <button type="submit" aria-label="Buscar" className="grid h-11 w-11 shrink-0 place-items-center bg-accent text-primary">
              <Search className="h-4 w-4" />
            </button>
          </form>

          <div className="ml-auto flex items-center gap-6">
            <Link to="/auth" className="hidden items-center gap-2 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-primary"><User className="h-4 w-4" /></span>
              <span className="text-xs font-semibold leading-tight">Entrá /<br />Registrate</span>
            </Link>
            <Link to="/carrito" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-primary"><ShoppingCart className="h-4 w-4" /></span>
              <span className="hidden text-xs font-semibold leading-tight sm:block">Carrito ({totalQty})<br />{formatARS(total)}</span>
            </Link>
          </div>
        </div>

        <div className="bg-secondary">
          <nav className="mx-auto hidden max-w-7xl items-center gap-9 overflow-x-auto px-4 py-5 sm:px-6 md:flex lg:px-8">
            {NAV.map((n) => (
              <Link key={n} to="/productos" className="shrink-0 text-sm font-medium uppercase text-primary hover:opacity-70">
                {n}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" className="shrink-0 text-sm font-bold uppercase text-foreground">Admin</Link>
            )}
          </nav>
        </div>

        {open && (
          <div className="border-b border-border bg-background md:hidden">
            <nav className="flex flex-col px-4 py-2">
              <form onSubmit={onSearch} className="py-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué estás buscando?" className="w-full border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
              </form>
              {NAV.map((n) => (
                <Link key={n} to="/productos" onClick={() => setOpen(false)} className="px-2 py-3 text-sm font-medium uppercase text-primary">{n}</Link>
              ))}
              <Link to="/auth" onClick={() => setOpen(false)} className="px-2 py-3 text-sm">Mi cuenta</Link>
              {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="px-2 py-3 text-sm font-bold">Admin</Link>}
            </nav>
          </div>
        )}
      </header>

      <a href="https://wa.me/5491125124333" target="_blank" rel="noreferrer noopener" aria-label="WhatsApp" className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-primary-foreground shadow-lg transition-transform hover:scale-105">
        <MessageCircle className="h-6 w-6" />
      </a>
    </>
  );
}
