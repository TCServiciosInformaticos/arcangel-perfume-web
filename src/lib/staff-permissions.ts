export const STAFF_MODULES = [
  "usuarios",
  "resumen",
  "herramientas",
  "estadisticas",
  "pedidos",
  "slider",
  "productos",
  "categorias",
  "politica-precios",
] as const;
export type StaffModule = (typeof STAFF_MODULES)[number];
export const STAFF_LABELS: Record<StaffModule, string> = {
  usuarios: "Usuarios",
  resumen: "Resumen",
  herramientas: "Herramientas de venta",
  estadisticas: "Estadísticas",
  pedidos: "Pedidos",
  slider: "Slider",
  productos: "Productos",
  categorias: "Categorías",
  "politica-precios": "Política de Precios",
};
export function validStaffModules(value: unknown): StaffModule[] {
  if (!Array.isArray(value)) return [];
  // Compatibility while an existing deployment or account still uses the old group.
  const expanded = value.includes("catalogo")
    ? [...value, "productos", "categorias", "politica-precios"]
    : value;
  return STAFF_MODULES.filter((m) => expanded.includes(m));
}
export function canOpenAdminPath(path: string, isAdmin: boolean, modules: readonly StaffModule[]) {
  if (isAdmin) return true;
  const route = path.replace(/\/+$/, "");
  // The landing page is a module chooser when Resumen was not granted.
  if (route === "/admin") return modules.length > 0;
  return STAFF_MODULES.some(
    (m) => m !== "resumen" && route === `/admin/${m}` && modules.includes(m),
  );
}
