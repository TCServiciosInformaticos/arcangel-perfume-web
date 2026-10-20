import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle } from "lucide-react";

const logoUrl = "/arcangel-logo.png";

const branches = [
  {
    name: "Sucursal Bogado",
    address: "Coronel Bogado 1678, Gran Bourg",
    whatsapp: "5491131448238",
    label: "+54 9 11 3144-8238",
  },
  {
    name: "Sucursal Perón",
    address: "Av. Eva Duarte de Perón 1103, Local 2, Gran Bourg",
    whatsapp: "5491128931359",
    label: "+54 9 11 2893-1359",
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Perfumería El Arcángel" className="h-28 w-auto object-contain" width={112} height={112} />
          </div>
          <p className="mt-3 max-w-sm text-sm text-sidebar-foreground/70">
            Tu perfumería de confianza en Gran Bourg: perfumes, limpieza y cuidado del cabello, con la atención de siempre.
          </p>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            <span className="block font-medium text-sidebar-foreground">Horarios</span>
            Lunes a sábado · 9 a 13 h y 16 a 20 h
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Sucursales</h4>
          <ul className="mt-4 space-y-3 text-sm text-sidebar-foreground/80">
            <li>
              <div className="font-medium text-sidebar-foreground">Sucursal 1</div>
              Coronel Bogado 1678, Gran Bourg
            </li>
            <li>
              <div className="font-medium text-sidebar-foreground">Sucursal 2</div>
              Av. Eva Duarte de Perón 1103, Local 2, Gran Bourg
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Navegar</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-sidebar-primary">Inicio</Link></li>
            <li><Link to="/productos" className="hover:text-sidebar-primary">Catálogo</Link></li>
            <li><Link to="/carrito" className="hover:text-sidebar-primary">Carrito</Link></li>
          </ul>
          <a
            href="https://www.instagram.com/perfumeriaelarcangel/"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-2 text-sm hover:text-sidebar-primary"
          >
            <Instagram className="h-4 w-4" />
            @perfumeriaelarcangel
          </a>
        </div>
      </div>
      <div className="border-t border-sidebar-border/40 py-4 text-center text-xs text-sidebar-foreground/50">
        <div>© {new Date().getFullYear()} Perfumería El Arcángel. Todos los derechos reservados.</div>
        <div className="mt-1">
          Sitio desarrollado por{" "}
          <a
            href="https://tcserviciosinformaticos.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-sidebar-primary underline-offset-2 hover:underline"
          >
            TC Servicios Informáticos
          </a>
        </div>
      </div>
    </footer>
  );
}
