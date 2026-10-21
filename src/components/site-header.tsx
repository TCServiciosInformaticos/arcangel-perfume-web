import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, Menu, X, User, Search, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatARS } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { navigationCategoriesQuery } from "@/lib/catalog-navigation";
import { Button } from "@/components/ui/button";

const logoUrl = "/arcangel-mark.png";

const MARQUEE = Array.from(
  { length: 8 },
  () =>
    "Envíos por Gran Bourg y alrededores 🚚 / Pagá con MercadoPago 💖 / Lunes a sábado 9 a 13 y 16 a 20 h",
);

export function SiteHeader() {
  const { totalQty, subtotal: total } = useCart();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: categories = [] } = useQuery(navigationCategoriesQuery);
  const nav = [
    ...categories.map((c) => ({ name: c.name, search: { categoria: c.slug } })),
    { name: "Ofertas", search: { ofertas: true } },
  ];

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    navigate({ to: "/productos", search: { q: q.trim() || undefined } });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-background">
        <div className="overflow-hidden bg-accent text-primary">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap py-3 text-sm font-medium uppercase">
            {[...MARQUEE, ...MARQUEE].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>

        <div className="mx-auto flex h-24 max-w-7xl items-center gap-4 px-4 sm:gap-10 sm:px-6 lg:px-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menú"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <Link to="/" className="flex shrink-0 items-center" aria-label="Inicio">
            <img
              src={logoUrl}
              alt="Perfumería El Arcángel"
              className="h-16 w-16 object-contain sm:h-20 sm:w-20"
              width={80}
              height={80}
            />
          </Link>

          <form onSubmit={onSearch} className="hidden flex-1 md:flex">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿Qué estás buscando?"
              className="h-11 w-full border border-border bg-card px-3 text-sm outline-none focus:border-primary"
            />
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              aria-label="Buscar"
              className="h-11 w-11 shrink-0 rounded-none bg-accent text-primary"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="ml-auto flex items-center gap-6">
            <Link to="/auth" className="hidden items-center gap-2 sm:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold leading-tight">
                Entrá /<br />
                Registrate
              </span>
            </Link>
            <Link to="/carrito" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-primary">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <span className="hidden text-xs font-semibold leading-tight sm:block">
                Carrito ({totalQty})<br />
                {formatARS(total)}
              </span>
            </Link>
          </div>
        </div>

        <div className="bg-secondary">
          <nav className="mx-auto hidden max-w-7xl items-center gap-9 overflow-x-auto px-4 py-5 sm:px-6 md:flex lg:px-8">
            {nav.map((n) => (
              <Link
                key={n.name}
                to="/productos"
                search={n.search}
                className="shrink-0 text-sm font-medium uppercase text-primary hover:opacity-70"
              >
                {n.name}
              </Link>
            ))}
            <Link to="/combos" className="text-sm font-semibold">
              Combos
            </Link>
            <Link to="/favoritos" className="text-sm font-semibold">
              Favoritos
            </Link>
          </nav>
        </div>

        {open && (
          <div className="border-b border-border bg-background md:hidden">
            <nav className="flex flex-col px-4 py-2">
              <form onSubmit={onSearch} className="py-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="¿Qué estás buscando?"
                  className="w-full border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </form>
              {nav.map((n) => (
                <Link
                  key={n.name}
                  to="/productos"
                  search={n.search}
                  onClick={() => setOpen(false)}
                  className="px-2 py-3 text-sm font-medium uppercase text-primary"
                >
                  {n.name}
                </Link>
              ))}
              <Link to="/auth" onClick={() => setOpen(false)} className="px-2 py-3 text-sm">
                Mi cuenta
              </Link>
              <Link to="/combos" className="text-sm font-semibold">
                Combos
              </Link>
              <Link to="/favoritos" className="text-sm font-semibold">
                Favoritos
              </Link>
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
