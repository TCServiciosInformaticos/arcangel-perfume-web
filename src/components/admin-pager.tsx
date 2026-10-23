import { Button } from "@/components/ui/button";
export function AdminPager({
  page,
  total,
  size = 25,
  onPage,
  busy = false,
}: {
  page: number;
  total: number;
  size?: number;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>
        {total} resultado(s) · Página {page + 1} de {Math.max(1, Math.ceil(total / size))}
      </span>
      <Button variant="outline" disabled={busy || page === 0} onClick={() => onPage(page - 1)}>
        Anterior
      </Button>
      <Button
        variant="outline"
        disabled={busy || (page + 1) * size >= total}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}
