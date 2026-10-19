import { Link } from "@tanstack/react-router";
import { formatARS } from "@/lib/format";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  compare_at_price?: number | string | null;
  stock: number;
  image_urls: string[];
  category?: { name: string } | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.image_urls?.[0] ?? null;
  const out = p.stock <= 0;
  const price = Number(p.price);
  const compare = p.compare_at_price != null ? Number(p.compare_at_price) : null;
  const onSale = compare != null && compare > price;
  const discount = onSale ? Math.round(((compare! - price) / compare!) * 100) : 0;

  return (
    <Link to="/producto/$slug" params={{ slug: p.slug }} className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-card">
        {img ? (
          <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xl font-bold text-muted-foreground/40">El Arcángel</div>
        )}
        {onSale && !out && (
          <span className="absolute left-2 top-2 bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">{discount}% OFF</span>
        )}
        {out && (
          <span className="absolute left-2 top-2 bg-foreground/85 px-2 py-1 text-xs font-medium text-background">Sin stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium uppercase leading-snug text-foreground">{p.name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-foreground">{formatARS(price)}</span>
          {onSale && <span className="text-xs text-muted-foreground line-through">{formatARS(compare!)}</span>}
        </div>
        {!out && p.stock <= 5 && <p className="mt-1 text-xs text-primary">¡Quedan solo {p.stock}!</p>}
        <span className="mt-3 block bg-primary py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-primary-foreground transition-opacity group-hover:opacity-90">
          Comprar
        </span>
      </div>
    </Link>
  );
}
