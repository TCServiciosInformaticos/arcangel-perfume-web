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
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {img ? (
          <img
            src={img}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground/40">
            El Arcángel
          </div>
        )}
        {onSale && !out && (
          <span className="absolute left-0 top-3 rounded-r-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase text-primary-foreground shadow-sm">
            {discount}% OFF
          </span>
        )}
        {out && (
          <span className="absolute left-3 top-3 rounded-md bg-foreground/85 px-2.5 py-0.5 text-xs font-medium text-background">
            Sin stock
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        {p.category?.name && (
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {p.category.name}
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground min-h-[2.5rem]">
          {p.name}
        </h3>
        <div className="mt-2">
          {onSale && (
            <div className="text-xs text-muted-foreground line-through">{formatARS(compare!)}</div>
          )}
          <div className="text-lg font-bold text-primary">{formatARS(price)}</div>
        </div>
        <span className="mt-2 inline-flex items-center justify-center rounded-md border border-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          Comprar
        </span>
      </div>
    </Link>
  );
}
