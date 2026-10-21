import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle } from "lucide-react";
import { BranchMap } from "@/components/branch-map";

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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-sidebar-border/60 pb-10 sm:grid-cols-2 sm:gap-6 sm:pb-8 lg:gap-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Perfumería El Arcángel" className="h-24 w-24 shrink-0 object-contain" width={96} height={96} />
          </div>
          <div>
          <p className="max-w-md text-sm leading-relaxed text-sidebar-foreground/70">
            Tu perfumería de confianza en Gran Bourg: perfumes, limpieza y cuidado del cabello, con la atención de siempre.
          </p>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            <span className="block font-medium text-sidebar-foreground">Horarios</span>
            Lunes a sábado · 9 a 13 h y 16 a 20 h
          </p>
          </div>
        </div>

        <div className="border-t border-sidebar-border/40 pt-8 sm:border-l sm:border-sidebar-border/40 sm:border-t-0 sm:pl-6 sm:pt-0 lg:pl-10">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Navegar</h4>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
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

        <section aria-label="Nuestras sucursales" className="pt-8">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Sucursales · Gran Bourg</h4>
          <ul className="mt-5 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:gap-10">
            {branches.map((branch) => (
              <li key={branch.name} className="min-w-0">
                <div className="text-lg font-semibold text-sidebar-foreground">{branch.name}</div>
                <p className="mt-1 text-sm leading-relaxed text-sidebar-foreground/70 sm:min-h-10 lg:min-h-0">{branch.address}</p>
                <a
                  href={`https://wa.me/${branch.whatsapp}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 flex w-fit items-center gap-2 text-sm text-sidebar-primary underline-offset-2 hover:underline"
                >
                  <MessageCircle className="h-4 w-4" />
                  {branch.label}
                </a>
                <BranchMap name={branch.name} address={branch.address} />
              </li>
            ))}
          </ul>
        </section>
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
