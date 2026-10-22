import { MapPin } from "lucide-react";

export function BranchMap({ name, address }: { name: string; address: string }) {
  const location = `${address}, Buenos Aires, Argentina`;

  return (
    <div className="mt-3">
      <iframe
        title={`Mapa de ${name}`}
        src={`https://www.google.com/maps?q=${encodeURIComponent(location)}&z=17&hl=es&output=embed`}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="h-48 w-full rounded-md border-0 bg-secondary"
      />
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-2 inline-flex items-center gap-1 text-xs text-sidebar-primary hover:underline"
      >
        <MapPin className="size-3.5" /> Ver en Google Maps
      </a>
    </div>
  );
}