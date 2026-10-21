import { FavoriteButton } from "@/components/favorites";
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
  thumbnail_url?: string | null;
  category?: { name: string } | null;
};

export function ProductCard({ p, size = "sm" }: { p: ProductCardData; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const img = p.thumbnail_url ?? p.image_urls?.[0] ?? null;
  const out = p.stock <= 0;
  const price = Number(p.price);
  const compare = p.compare_at_price != null ? Number(p.compare_at_price) : null;
  const onSale = compare != null && compare > price;
  const discount = onSale ? Math.round(((compare! - price) / compare!) * 100) : 0;

  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <FavoriteButton id={p.id} />
      </div>
      <Link to="/producto/$slug" params={{ slug: p.slug }} className="group flex flex-col">
        <div className="relative aspect-square overflow-hidden bg-card">
          {img ? (
            <img
              src={img}
              alt={p.name}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-contain transition-transform duration-500 group-hover:scale-105 ${lg ? "p-8" : "p-4"}`}
            />
          ) : (
            <div
              className={`flex h-full items-center justify-center font-bold text-muted-foreground/40 ${lg ? "text-3xl" : "text-xl"}`}
            >
              El Arcángel
            </div>
          )}
          {onSale && !out && (
            <span
              className={`absolute left-2 top-2 bg-primary font-bold text-primary-foreground ${lg ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-[11px]"}`}
            >
              {discount}% OFF
            </span>
          )}
          {out && (
            <span
              className={`absolute left-2 top-2 bg-foreground/85 font-medium text-background ${lg ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"}`}
            >
              Sin stock
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col pt-3">
          <h3
            className={`line-clamp-2 font-medium uppercase leading-snug text-foreground ${lg ? "min-h-[3rem] text-lg" : "min-h-[2.5rem] text-sm"}`}
          >
            {p.name}
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`${lg ? "text-2xl" : "text-lg"} font-bold text-foreground`}>
              {formatARS(price)}
            </span>
            {onSale && (
              <span
                className={`${lg ? "text-base" : "text-xs"} text-muted-foreground line-through`}
              >
                {formatARS(compare!)}
              </span>
            )}
          </div>
          {!out && p.stock <= 5 && (
            <p className={`mt-1 ${lg ? "text-sm" : "text-xs"} text-primary`}>
              ¡Quedan solo {p.stock}!
            </p>
          )}
          <span
            className={`mt-3 block bg-primary text-center font-semibold uppercase tracking-wide text-primary-foreground transition-opacity group-hover:opacity-90 ${
              lg ? "py-3.5 text-sm" : "py-2.5 text-xs"
            }`}
          >
            Comprar
          </span>
        </div>
      </Link>
    </div>
  );
}
