import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";

export function BranchMap({ name, address }: { name: string; address: string }) {
  const [authorizedOrigin, setAuthorizedOrigin] = useState(false);
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const location = `${address}, Buenos Aires, Argentina`;

  useEffect(() => {
    const hostname = window.location.hostname;
    setAuthorizedOrigin(
      window.location.protocol === "https:" &&
      /\.(lovable\.app|lovableproject\.com)$/.test(hostname) &&
      !hostname.includes("-devserver-"),
    );
  }, []);

  return (
    <div className="mt-3">
      {key && authorizedOrigin ? (
        <iframe
          title={`Mapa de ${name}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(location)}&zoom=17&language=es`}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="h-40 w-full rounded-md border-0 bg-secondary"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent text-sidebar-primary">
          <MapPin className="size-7" aria-hidden="true" />
        </div>
      )}
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