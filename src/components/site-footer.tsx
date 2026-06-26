import { Link } from "@tanstack/react-router";
import { Instagram } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <h3 className="font-serif text-2xl">El Arcángel</h3>
          <p className="mt-3 max-w-sm text-sm text-sidebar-foreground/70">
            Perfumería boutique. Fragancias seleccionadas, atención personalizada y envíos en CABA.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Navegar</h4>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link to="/" className="hover:text-sidebar-primary">Inicio</Link></li>
            <li><Link to="/productos" className="hover:text-sidebar-primary">Catálogo</Link></li>
            <li><Link to="/contacto" className="hover:text-sidebar-primary">Contacto</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-sidebar-primary">Seguinos</h4>
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
        © {new Date().getFullYear()} Perfumería El Arcángel. Todos los derechos reservados.
      </div>
    </footer>
  );
}
