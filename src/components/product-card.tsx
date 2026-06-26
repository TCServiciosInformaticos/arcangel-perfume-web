import { Link } from "@tanstack/react-router";
import { formatARS } from "@/lib/format";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  stock: number;
  image_urls: string[];
  category?: { name: string } | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const img = p.image_urls?.[0] ?? null;
  const out = p.stock <= 0;
  return (
    <Link
      to="/producto/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary/40">
        {img ? (
          <img
            src={img}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-serif text-3xl text-muted-foreground/40">
            El Arcángel
          </div>
        )}
        {out && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-2.5 py-0.5 text-xs font-medium text-background">
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
        <h3 className="font-serif text-lg leading-tight text-foreground">{p.name}</h3>
        <div className="mt-2 font-medium text-primary">{formatARS(p.price)}</div>
      </div>
    </Link>
  );
}
