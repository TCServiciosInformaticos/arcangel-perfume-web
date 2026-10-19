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
    <Link
      to="/producto/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {img ? (
          <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-xl font-bold text-muted-foreground/40">El Arcángel</div>
        )}
        {onSale && !out && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
            -{discount}%
          </span>
        )}
        {out && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium text-background">Sin stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {p.category?.name && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{p.category.name}</span>
        )}
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground">{p.name}</h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            {onSale && <div className="text-xs text-muted-foreground line-through">{formatARS(compare!)}</div>}
            <div className="text-lg font-extrabold text-foreground">{formatARS(price)}</div>
          </div>
          <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
            Comprar
          </span>
        </div>
      </div>
    </Link>
  );
}
