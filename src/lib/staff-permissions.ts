export const STAFF_MODULES = ["catalogo", "pedidos", "slider"] as const;
export type StaffModule = (typeof STAFF_MODULES)[number];
export const STAFF_LABELS: Record<StaffModule, string> = {
  catalogo: "Catálogo: productos, categorías y precios",
  pedidos: "Pedidos: clientes, pagos e historial",
  slider: "Slider de inicio",
};
export function validStaffModules(value: unknown): StaffModule[] {
  return Array.isArray(value) ? STAFF_MODULES.filter((m) => value.includes(m)) : [];
}
export function canOpenAdminPath(path: string, isAdmin: boolean, modules: readonly StaffModule[]) {
  if (isAdmin) return true;
  const route = path.replace(/\/+$/, "");
  if (route === "/admin") return modules.length > 0;
  if (["/admin/productos", "/admin/categorias", "/admin/politica-precios"].includes(route))
    return modules.includes("catalogo");
  if (route === "/admin/pedidos") return modules.includes("pedidos");
  if (route === "/admin/slider") return modules.includes("slider");
  return false;
}
