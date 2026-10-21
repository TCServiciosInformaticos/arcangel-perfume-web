import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
const key = "arcangel-favorites-v1";
function readFavorites(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v)
      ? v.filter((x) => typeof x === "string" && /^[a-f0-9-]{36}$/i.test(x)).slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setIds(readFavorites());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("arcangel-favorites", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("arcangel-favorites", refresh);
    };
  }, []);
  return {
    ids,
    toggle: (id: string) => {
      const current = readFavorites(),
        next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id].slice(-200);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event("arcangel-favorites"));
      } catch {
        /* unavailable browser storage */
      }
    },
  };
}
export function FavoriteButton({ id }: { id: string }) {
  const { ids, toggle } = useFavorites(),
    saved = ids.includes(id);
  return (
    <button
      type="button"
      aria-label={saved ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={saved}
      onClick={() => toggle(id)}
      className="rounded-full border bg-background p-2 text-primary shadow-sm"
    >
      <Heart className="h-5 w-5" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
